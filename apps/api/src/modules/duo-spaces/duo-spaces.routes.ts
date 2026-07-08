import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { createDuoSpaceSchema, joinDuoSpaceSchema } from "@duoquest/shared";
import { AppError } from "../../plugins/error-handler.js";

export default async function duoSpacesRoutes(app: FastifyInstance) {
  // Create a new Duo Space
  app.post(
    "/api/duo-spaces",
    { preHandler: requireAuth },
    async (request) => {
      const { name } = createDuoSpaceSchema.parse(request.body);
      const userId = request.user!.id;

      // Check if user is already in a Duo Space (Free plan limits)
      const existingMemberships = await app.prisma.duoMember.findMany({
        where: { userId },
      });

      if (existingMemberships.length >= 1) {
        throw new AppError(400, "LIMIT_EXCEEDED", "Free users are limited to 1 Duo Space");
      }

      // Generate a short readable invite code (e.g. DQ-7F9X)
      const code = "DQ-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create DuoSpace and add user as owner
      const duoSpace = await app.prisma.duoSpace.create({
        data: {
          name,
          inviteCode: code,
          members: {
            create: {
              userId,
              role: "owner",
            },
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      return { success: true, data: duoSpace };
    }
  );

  // Join an existing Duo Space using invite code
  app.post(
    "/api/duo-spaces/join",
    { preHandler: requireAuth },
    async (request) => {
      const { inviteCode } = joinDuoSpaceSchema.parse(request.body);
      const userId = request.user!.id;

      // Find the Duo Space
      const duoSpace = await app.prisma.duoSpace.findUnique({
        where: { inviteCode },
        include: {
          members: true,
        },
      });

      if (!duoSpace) {
        throw new AppError(404, "NOT_FOUND", "Duo Space not found with this invite code");
      }

      // Check if it already has 2 members
      if (duoSpace.members.length >= 2) {
        throw new AppError(400, "DUO_SPACE_FULL", "This Duo Space already has 2 members");
      }

      // Check if the user is already a member
      if (duoSpace.members.some((m) => m.userId === userId)) {
        throw new AppError(400, "ALREADY_MEMBER", "You are already a member of this Duo Space");
      }

      // Limit check
      const existingMemberships = await app.prisma.duoMember.findMany({
        where: { userId },
      });

      if (existingMemberships.length >= 1) {
        throw new AppError(400, "LIMIT_EXCEEDED", "Free users are limited to 1 Duo Space");
      }

      // Join the space
      const updatedMember = await app.prisma.duoMember.create({
        data: {
          userId,
          duoSpaceId: duoSpace.id,
          role: "member",
        },
        include: {
          duoSpace: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      // Log activity
      await app.prisma.activityLog.create({
        data: {
          userId,
          duoSpaceId: duoSpace.id,
          action: "challenge_joined", // generic action or we can add custom ones
          xpEarned: 50, // first_duo achievement XP reward will be handled separately
        },
      });

      return { success: true, data: updatedMember.duoSpace };
    }
  );

  // Get details of a Duo Space by ID
  app.get<{ Params: { id: string } }>(
    "/api/duo-spaces/:id",
    { preHandler: requireAuth },
    async (request) => {
      const duoSpaceId = request.params.id;
      const userId = request.user!.id;

      // Verify user belongs to this Duo Space
      const membership = await app.prisma.duoMember.findUnique({
        where: {
          userId_duoSpaceId: {
            userId,
            duoSpaceId,
          },
        },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      const duoSpace = await app.prisma.duoSpace.findUnique({
        where: { id: duoSpaceId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          goals: {
            include: {
              milestones: true,
            },
            orderBy: { createdAt: "desc" },
          },
          tasks: {
            include: {
              user: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      return { success: true, data: duoSpace };
    }
  );

  // Get overview for Home screen (aggregator)
  app.get<{ Params: { id: string } }>(
    "/api/duo-spaces/:id/overview",
    { preHandler: requireAuth },
    async (request) => {
      const duoSpaceId = request.params.id;
      const userId = request.user!.id;

      const membership = await app.prisma.duoMember.findUnique({
        where: {
          userId_duoSpaceId: {
            userId,
            duoSpaceId,
          },
        },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      const duoSpace = await app.prisma.duoSpace.findUnique({
        where: { id: duoSpaceId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!duoSpace) {
        throw new AppError(404, "NOT_FOUND", "Duo Space not found");
      }

      // Fetch today's progress for members
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayDayName = new Date()
        .toLocaleDateString("en-US", { weekday: "short" })
        .toLowerCase();

      // Self-heal: Reset recurring tasks completed on previous days
      await app.prisma.task.updateMany({
        where: {
          duoSpaceId,
          completed: true,
          completedAt: { lt: todayStart },
          OR: [
            { recurring: { not: null } },
            { daysOfWeek: { not: null } },
          ],
        },
        data: {
          completed: false,
          completedAt: null,
        },
      });

      const todayProgress = await Promise.all(
        duoSpace.members.map(async (m) => {
          const allUserTasks = await app.prisma.task.findMany({
            where: {
              duoSpaceId,
              userId: m.userId,
              OR: [
                { completed: false },
                { completed: true, completedAt: { gte: todayStart } },
              ],
            },
          });

          // Filter by schedule
          const activeUserTasks = allUserTasks.filter((task) => {
            if (task.completed && task.completedAt && task.completedAt >= todayStart) {
              return true;
            }
            if (task.dueDate) {
              const due = new Date(task.dueDate);
              due.setHours(0, 0, 0, 0);
              return due <= todayStart;
            }
            if (task.daysOfWeek) {
              const days = task.daysOfWeek.split(",").map((d) => d.trim().toLowerCase());
              return days.includes(todayDayName);
            }
            return true;
          });

          const totalTasks = activeUserTasks.length;
          const completedTasks = activeUserTasks.filter((t) => t.completed).length;

          return {
            userId: m.userId,
            username: m.user.username,
            avatarUrl: m.user.avatarUrl,
            completedTasks,
            totalTasks,
          };
        })
      );

      // Recent activity
      const recentActivity = await app.prisma.activityLog.findMany({
        where: { duoSpaceId },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      });

      // Get current streak
      const streak = await app.prisma.streak.findFirst({
        where: { duoSpaceId }, // Can also track duo streak or member streaks
      });

      // Fetch activity logs for the last 12 weeks (84 days)
      const userIds = duoSpace.members.map((m) => m.userId);
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 90);

      const [logs, taskCompletions] = await Promise.all([
        app.prisma.activityLog.findMany({
          where: {
            userId: { in: userIds },
            createdAt: { gte: twelveWeeksAgo },
          },
          select: {
            userId: true,
            date: true,
          },
        }),
        // Also pull from actual task completions to catch any missing activity logs
        app.prisma.taskCompletion.findMany({
          where: {
            userId: { in: userIds },
            completedAt: { gte: twelveWeeksAgo },
            task: { duoSpaceId },
          },
          select: {
            userId: true,
            completedAt: true,
          },
        }),
      ]);

      // Group logs by date string (YYYY-MM-DD)
      const heatmap: Record<string, { u1: boolean; u2: boolean }> = {};

      const markDay = (userId: string, dateStr: string) => {
        if (!heatmap[dateStr]) {
          heatmap[dateStr] = { u1: false, u2: false };
        }
        if (userId === userIds[0]) heatmap[dateStr].u1 = true;
        if (userId === userIds[1]) heatmap[dateStr].u2 = true;
      };

      for (const log of logs) {
        const dateStr = log.date.toISOString().split("T")[0];
        markDay(log.userId, dateStr);
      }

      for (const tc of taskCompletions) {
        const dateStr = tc.completedAt.toISOString().split("T")[0];
        markDay(tc.userId, dateStr);
      }

      // Fetch stats for Weekly Recap (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [weeklyLogs, weeklyTasksCount] = await Promise.all([
        app.prisma.activityLog.findMany({
          where: {
            duoSpaceId,
            createdAt: { gte: sevenDaysAgo },
          },
          select: {
            userId: true,
            action: true,
            xpEarned: true,
          },
        }),
        app.prisma.taskCompletion.count({
          where: {
            completedAt: { gte: sevenDaysAgo },
            task: { duoSpaceId },
          },
        }),
      ]);

      const weeklyXp = weeklyLogs.reduce((sum, l) => sum + l.xpEarned, 0);

      // Calculate MVP or user metrics for this week
      const weeklyUserStats = userIds.map((uid) => {
        const userLogs = weeklyLogs.filter((l) => l.userId === uid);
        const xpEarned = userLogs.reduce((sum, l) => sum + l.xpEarned, 0);
        
        // Find user name
        const member = duoSpace.members.find((m) => m.userId === uid);
        return {
          userId: uid,
          username: member?.user.username || "User",
          avatarUrl: member?.user.avatarUrl || null,
          xpEarned,
        };
      });

      // Weekly MVP is the user with higher XP this week (or both if tied)
      let weeklyMvp: any = null;
      if (weeklyUserStats.length === 2) {
        const [u1, u2] = weeklyUserStats;
        if (u1.xpEarned > u2.xpEarned) {
          weeklyMvp = u1;
        } else if (u2.xpEarned > u1.xpEarned) {
          weeklyMvp = u2;
        } else if (u1.xpEarned > 0) {
          weeklyMvp = { tie: true, text: "Dream Team! (Tied)" };
        }
      } else if (weeklyUserStats.length === 1 && weeklyUserStats[0].xpEarned > 0) {
        weeklyMvp = weeklyUserStats[0];
      }

      return {
        success: true,
        data: {
          duoSpace,
          members: duoSpace.members,
          streak: streak || { currentDays: 0, longestDays: 0 },
          todayProgress,
          recentActivity,
          heatmap,
          weeklyRecap: {
            totalTasksCompleted: weeklyTasksCount,
            totalXpEarned: weeklyXp,
            weeklyUserStats,
            weeklyMvp,
          },
        },
      };
    }
  );

  // Update Duo Space name
  app.patch<{ Params: { id: string } }>(
    "/api/duo-spaces/:id",
    { preHandler: requireAuth },
    async (request) => {
      const duoSpaceId = request.params.id;
      const userId = request.user!.id;
      const { name } = createDuoSpaceSchema.parse(request.body);

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      const updatedSpace = await app.prisma.duoSpace.update({
        where: { id: duoSpaceId },
        data: { name },
      });

      return { success: true, data: updatedSpace };
    }
  );

  // Leave Duo Space
  app.post<{ Params: { id: string } }>(
    "/api/duo-spaces/:id/leave",
    { preHandler: requireAuth },
    async (request) => {
      const duoSpaceId = request.params.id;
      const userId = request.user!.id;

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      // Check how many members are left
      const members = await app.prisma.duoMember.findMany({
        where: { duoSpaceId },
      });

      if (members.length === 1) {
        // Only this user left -> delete the whole Duo Space
        await app.prisma.duoSpace.delete({
          where: { id: duoSpaceId },
        });
      } else {
        // Two members exist
        const otherMember = members.find((m) => m.userId !== userId);
        
        // Remove membership
        await app.prisma.duoMember.delete({
          where: { id: membership.id },
        });

        // If the leaving user was owner, nominate other user as owner
        if (membership.role === "owner" && otherMember) {
          await app.prisma.duoMember.update({
            where: { id: otherMember.id },
            data: { role: "owner" },
          });
        }
      }

      return { success: true, data: { leftSpaceId: duoSpaceId } };
    }
  );

  // Disband Duo Space (Owner only)
  app.delete<{ Params: { id: string } }>(
    "/api/duo-spaces/:id",
    { preHandler: requireAuth },
    async (request) => {
      const duoSpaceId = request.params.id;
      const userId = request.user!.id;

      // Verify membership & role
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      if (membership.role !== "owner") {
        throw new AppError(403, "FORBIDDEN", "Only the owner can disband the Duo Space");
      }

      await app.prisma.duoSpace.delete({
        where: { id: duoSpaceId },
      });

      return { success: true, data: { disbandedSpaceId: duoSpaceId } };
    }
  );

  // Remove partner from Duo Space (Owner only)
  app.post<{ Params: { id: string } }>(
    "/api/duo-spaces/:id/remove-partner",
    { preHandler: requireAuth },
    async (request) => {
      const duoSpaceId = request.params.id;
      const ownerId = request.user!.id;

      // Verify owner membership and role
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId: ownerId, duoSpaceId } },
      });

      if (!membership || membership.role !== "owner") {
        throw new AppError(403, "FORBIDDEN", "Only the owner can remove a partner");
      }

      // Find the other member in the Duo Space
      const otherMember = await app.prisma.duoMember.findFirst({
        where: {
          duoSpaceId,
          userId: { not: ownerId },
        },
        include: {
          user: true,
        },
      });

      if (!otherMember) {
        throw new AppError(404, "NOT_FOUND", "No partner found to remove from this Duo Space");
      }

      // Remove the partner's membership
      await app.prisma.duoMember.delete({
        where: { id: otherMember.id },
      });

      // Insert system announcement in Chat
      await app.prisma.message.create({
        data: {
          duoSpaceId,
          senderId: ownerId,
          content: `🚫 Owner removed @${otherMember.user.username} from the Duo Space.`,
          type: "system",
        },
      });

      return { success: true, data: { removedUserId: otherMember.userId } };
    }
  );

  // Upload custom cover photo
  app.post<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/upload-cover",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const userId = request.user!.id;

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      const data = await request.file();
      if (!data) {
        return { success: false, error: { code: "BAD_REQUEST", message: "No file provided" } };
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(data.mimetype)) {
        return { success: false, error: { code: "BAD_REQUEST", message: "Only JPEG, PNG, WebP, and GIF images are allowed" } };
      }

      const ext = data.mimetype.split("/")[1].replace("jpeg", "jpg");
      const randomId = Math.random().toString(36).substring(2, 15);
      const filePath = `covers/${duoSpaceId}/${randomId}.${ext}`;
      const buffer = await data.toBuffer();

      if (!app.supabase) {
        return { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Storage is not configured" } };
      }

      // Upload to Supabase Storage
      const { error } = await app.supabase.storage
        .from("avatars")
        .upload(filePath, buffer, {
          contentType: data.mimetype,
          upsert: true,
        });

      if (error) {
        app.log.error(error, "Cover upload failed");
        return { success: false, error: { code: "UPLOAD_FAILED", message: "Failed to upload image" } };
      }

      const { data: urlData } = app.supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      return { success: true, data: { imageUrl: urlData.publicUrl } };
    }
  );
}
