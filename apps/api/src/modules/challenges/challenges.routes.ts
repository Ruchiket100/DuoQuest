import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { AppError } from "../../plugins/error-handler.js";
import { z } from "zod";

const createChallengeSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.string(), // e.g. "fitness", "coding", "reading", "custom"
  targetDays: z.number().int().min(1).max(365),
  startDate: z.string().optional(), // ISO date string, defaults to today
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export default async function challengesRoutes(app: FastifyInstance) {
  // Create a new challenge
  app.post<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/challenges",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const userId = request.user!.id;
      const { title, description, type, targetDays, startDate, icon, color, imageUrl } =
        createChallengeSchema.parse(request.body);

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      const start = startDate ? new Date(startDate) : new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + targetDays);

      // Create challenge
      const challenge = await app.prisma.challenge.create({
        data: {
          title,
          description: description || null,
          type,
          targetDays,
          startDate: start,
          endDate: end,
          duoSpaceId,
          icon: icon || null,
          color: color || null,
          imageUrl: imageUrl || null,
        },
      });

      // Auto-enroll all members
      const members = await app.prisma.duoMember.findMany({
        where: { duoSpaceId },
      });

      await app.prisma.challengeParticipant.createMany({
        data: members.map((m) => ({
          challengeId: challenge.id,
          userId: m.userId,
        })),
      });

      // Grant XP for creating a challenge
      await app.xpService.grantXp(userId, 25, "challenge_created", duoSpaceId, {
        challengeId: challenge.id,
        title,
      });

      // Create notifications for all members
      for (const m of members) {
        await app.prisma.notification.create({
          data: {
            userId: m.userId,
            type: "challenge",
            title: "New Challenge Started!",
            body: `"${title}" — ${targetDays} day challenge has begun! 🔥`,
            metadata: { challengeId: challenge.id },
          },
        });
      }

      // System message in chat
      await app.prisma.message.create({
        data: {
          duoSpaceId,
          senderId: userId,
          content: `🏆 New Challenge: "${title}" (${targetDays} days) started!`,
          type: "system",
        },
      });

      const fullChallenge = await app.prisma.challenge.findUnique({
        where: { id: challenge.id },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      return { success: true, data: fullChallenge };
    }
  );

  // List challenges for a Duo Space
  app.get<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/challenges",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const userId = request.user!.id;

      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      const challenges = await app.prisma.challenge.findMany({
        where: { duoSpaceId },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });

      return { success: true, data: challenges };
    }
  );

  // Get challenge detail
  app.get<{ Params: { id: string } }>(
    "/api/challenges/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;

      const challenge = await app.prisma.challenge.findUnique({
        where: { id },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, avatarUrl: true },
              },
            },
          },
        },
      });

      if (!challenge) {
        throw new AppError(404, "NOT_FOUND", "Challenge not found");
      }

      return { success: true, data: challenge };
    }
  );

  // Check-in for a challenge
  app.post<{ Params: { id: string } }>(
    "/api/challenges/:id/check-in",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const challenge = await app.prisma.challenge.findUnique({
        where: { id },
        include: { participants: true },
      });

      if (!challenge) {
        throw new AppError(404, "NOT_FOUND", "Challenge not found");
      }

      if (challenge.status !== "active") {
        throw new AppError(400, "BAD_REQUEST", "This challenge is no longer active");
      }

      const participant = challenge.participants.find((p) => p.userId === userId);
      if (!participant) {
        throw new AppError(403, "FORBIDDEN", "You are not a participant in this challenge");
      }

      // Check if already checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (participant.lastCheckIn) {
        const lastDate = new Date(participant.lastCheckIn);
        lastDate.setHours(0, 0, 0, 0);
        if (lastDate.getTime() === today.getTime()) {
          throw new AppError(400, "BAD_REQUEST", "You have already checked in today");
        }
      }

      // Update participant
      const updatedParticipant = await app.prisma.challengeParticipant.update({
        where: { id: participant.id },
        data: {
          daysCompleted: { increment: 1 },
          lastCheckIn: new Date(),
        },
      });

      // Grant XP
      await app.xpService.grantXp(userId, 15, "challenge_checkin", challenge.duoSpaceId, {
        challengeId: id,
        day: updatedParticipant.daysCompleted,
      });

      // Check if challenge is complete (all participants hit targetDays)
      const allParticipants = await app.prisma.challengeParticipant.findMany({
        where: { challengeId: id },
      });

      const allComplete = allParticipants.every(
        (p) => (p.id === participant.id ? updatedParticipant.daysCompleted : p.daysCompleted) >= challenge.targetDays
      );

      if (allComplete) {
        await app.prisma.challenge.update({
          where: { id },
          data: { status: "completed" },
        });

        // Bonus XP for completing
        for (const p of allParticipants) {
          await app.xpService.grantXp(p.userId, 100, "challenge_completed", challenge.duoSpaceId, {
            challengeId: id,
            title: challenge.title,
          });

          await app.prisma.notification.create({
            data: {
              userId: p.userId,
              type: "challenge",
              title: "Challenge Completed! 🎉",
              body: `You and your partner completed "${challenge.title}"!`,
              metadata: { challengeId: id },
            },
          });
        }

        await app.prisma.message.create({
          data: {
            duoSpaceId: challenge.duoSpaceId,
            senderId: userId,
            content: `🏆 Challenge "${challenge.title}" completed by the duo!`,
            type: "system",
          },
        });
      }

      // Evaluate achievements
      await app.achievementsService.checkAndUnlock(userId, challenge.duoSpaceId);

      return {
        success: true,
        data: {
          participant: updatedParticipant,
          challengeCompleted: allComplete,
        },
      };
    }
  );
}
