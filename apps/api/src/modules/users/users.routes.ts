import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { updateProfileSchema } from "@duoquest/shared";

export default async function usersRoutes(app: FastifyInstance) {
  // Get current user profile
  app.get(
    "/api/users/me",
    { preHandler: requireAuth },
    async (request) => {
      const user = await app.prisma.user.findUnique({
        where: { id: request.user!.id },
        include: {
          duoMemberships: {
            include: {
              duoSpace: true,
            },
          },
          achievements: {
            include: {
              achievement: true,
            },
          },
        },
      });

      return { success: true, data: user };
    }
  );

  // Update current user profile
  app.patch(
    "/api/users/me",
    { preHandler: requireAuth },
    async (request) => {
      const data = updateProfileSchema.parse(request.body);

      const user = await app.prisma.user.update({
        where: { id: request.user!.id },
        data,
      });

      return { success: true, data: user };
    }
  );

  // Get user by username (public profile)
  app.get<{ Params: { username: string } }>(
    "/api/users/:username",
    async (request) => {
      const user = await app.prisma.user.findUnique({
        where: { username: request.params.username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          xp: true,
          level: true,
          createdAt: true,
        },
      });

      if (!user) {
        return { success: false, error: { code: "NOT_FOUND", message: "User not found" } };
      }

      return { success: true, data: user };
    }
  );

  // Upload avatar
  app.post(
    "/api/users/avatar",
    { preHandler: requireAuth },
    async (request) => {
      const userId = request.user!.id;
      const data = await request.file();

      if (!data) {
        return { success: false, error: { code: "BAD_REQUEST", message: "No file provided" } };
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(data.mimetype)) {
        return { success: false, error: { code: "BAD_REQUEST", message: "Only JPEG, PNG, WebP, and GIF images are allowed" } };
      }

      const ext = data.mimetype.split("/")[1].replace("jpeg", "jpg");
      const filePath = `${userId}/avatar.${ext}`;
      const buffer = await data.toBuffer();

      if (!app.supabase) {
        return { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Storage is not configured" } };
      }

      // Upload to Supabase Storage (upsert)
      const { error } = await app.supabase.storage
        .from("avatars")
        .upload(filePath, buffer, {
          contentType: data.mimetype,
          upsert: true,
        });

      if (error) {
        app.log.error(error, "Avatar upload failed");
        return { success: false, error: { code: "UPLOAD_FAILED", message: "Failed to upload avatar" } };
      }

      const { data: urlData } = app.supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Update user record
      await app.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
      });

      return { success: true, data: { avatarUrl } };
    }
  );

  // Remove avatar
  app.delete(
    "/api/users/avatar",
    { preHandler: requireAuth },
    async (request) => {
      const userId = request.user!.id;

      // Reset user avatarUrl to null in DB
      await app.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      });

      // Delete user's avatar files from Supabase Storage
      if (app.supabase) {
        try {
          const { data: files } = await app.supabase.storage
            .from("avatars")
            .list(userId);
          
          if (files && files.length > 0) {
            const filesToRemove = files.map((f) => `${userId}/${f.name}`);
            await app.supabase.storage
              .from("avatars")
              .remove(filesToRemove);
          }
        } catch (err) {
          app.log.error(err, "Failed to delete avatar files from storage");
        }
      }

      return { success: true };
    }
  );

  // Log daily mood
  app.post(
    "/api/users/mood",
    { preHandler: requireAuth },
    async (request) => {
      const userId = request.user!.id;
      const { mood } = request.body as { mood: string };

      if (!["angry", "meh", "ok", "happy", "fire"].includes(mood)) {
        return { success: false, error: { code: "BAD_REQUEST", message: "Invalid mood value" } };
      }

      // Find user's active duo space
      const membership = await app.prisma.duoMember.findFirst({
        where: { userId },
      });

      // Log as activity
      await app.prisma.activityLog.create({
        data: {
          userId,
          duoSpaceId: membership?.duoSpaceId || null,
          action: "mood_checkin",
          metadata: { mood },
          xpEarned: 5,
        },
      });

      // Grant small XP
      if (membership) {
        await app.xpService.grantXp(userId, 5, "mood_checkin", membership.duoSpaceId, { mood });
      }

      return { success: true, data: { mood } };
    }
  );

  // Get today's mood for the duo space (both partners)
  app.get<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/moods",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const moods = await app.prisma.activityLog.findMany({
        where: {
          duoSpaceId,
          action: "mood_checkin",
          createdAt: { gte: todayStart },
        },
        select: {
          userId: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return { success: true, data: moods };
    }
  );

  // Register push token
  app.post(
    "/api/users/push-token",
    { preHandler: requireAuth },
    async (request) => {
      const userId = request.user!.id;
      const { token } = request.body as { token: string };

      if (!token) {
        return { success: false, error: { code: "BAD_REQUEST", message: "Token is required" } };
      }

      await app.prisma.user.update({
        where: { id: userId },
        data: { pushToken: token },
      });

      return { success: true, data: { message: "Push token registered successfully" } };
    }
  );
}
