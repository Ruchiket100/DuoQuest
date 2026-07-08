import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { sendMessageSchema, addReactionSchema } from "@duoquest/shared";
import { AppError } from "../../plugins/error-handler.js";

async function safeBroadcast(app: any, channelName: string, event: string, payload: any) {
  if (!app.supabase) return;
  const channel = app.supabase.channel(channelName);
  return new Promise<void>((resolve) => {
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event,
            payload,
          })
          .then(() => {
            app.supabase.removeChannel(channel);
            resolve();
          })
          .catch((err: any) => {
            app.log.error(err, `Failed to send broadcast on ${channelName}`);
            app.supabase.removeChannel(channel);
            resolve();
          });
      }
    });
  });
}

export default async function messagesRoutes(app: FastifyInstance) {
  // Send message
  app.post<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/messages",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const senderId = request.user!.id;
      const { content, type } = sendMessageSchema.parse(request.body);

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId: senderId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      // Create message in database
      const message = await app.prisma.message.create({
        data: {
          content,
          type: type || "text",
          senderId,
          duoSpaceId,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          reactions: true,
        },
      });

      // Ephemeral broadcast via Supabase if configured (for instant UX or fallback)
      if (app.supabase) {
        await safeBroadcast(app, `duo-chat:${duoSpaceId}`, "new_message", message);
      }

      // Send push notification to partner if registered
      const partnerMember = await app.prisma.duoMember.findFirst({
        where: {
          duoSpaceId,
          userId: { not: senderId },
        },
        include: {
          user: {
            select: {
              pushToken: true,
            },
          },
        },
      });

      if (partnerMember?.user?.pushToken) {
        const senderName = message.sender.displayName || message.sender.username || "Partner";
        const title = type === "nudge" ? `👋 Nudge from ${senderName}` : `💬 Message from ${senderName}`;
        const body = content;

        app.sendPush(partnerMember.user.pushToken, {
          title,
          body,
          data: {
            duoSpaceId,
            senderId,
            type: type || "text",
          },
        }).catch((err) => {
          app.log.error(err, "Failed to send push notification");
        });
      }

      return { success: true, data: message };
    }
  );

  // Get chat history
  app.get<{ Params: { duoSpaceId: string }; Querystring: { limit?: string; before?: string } }>(
    "/api/duo-spaces/:duoSpaceId/messages",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const userId = request.user!.id;
      const limit = parseInt(request.query.limit || "50", 10);
      const { before } = request.query;

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      // Build query
      const where: any = { duoSpaceId };
      if (before) {
        where.createdAt = { lt: new Date(before) };
      }

      const messages = await app.prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          reactions: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      // Reverse messages to restore chronological order for UI
      return { success: true, data: messages.reverse() };
    }
  );

  // Add emoji reaction to a message
  app.post<{ Params: { messageId: string } }>(
    "/api/messages/:messageId/reactions",
    { preHandler: requireAuth },
    async (request) => {
      const { messageId } = request.params;
      const userId = request.user!.id;
      const { emoji } = addReactionSchema.parse(request.body);

      const message = await app.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new AppError(404, "NOT_FOUND", "Message not found");
      }

      // Verify user has access to this space
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId: message.duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this chat");
      }

      const reaction = await app.prisma.messageReaction.upsert({
        where: {
          userId_messageId_emoji: {
            userId,
            messageId,
            emoji,
          },
        },
        create: {
          userId,
          messageId,
          emoji,
        },
        update: {},
      });

      // Broadcast reaction via Supabase if configured
      if (app.supabase) {
        await safeBroadcast(
          app,
          `duo-chat:${message.duoSpaceId}`,
          "reaction_added",
          { messageId, userId, emoji, reactionId: reaction.id }
        );
      }

      return { success: true, data: reaction };
    }
  );

  // Remove emoji reaction from a message
  app.delete<{ Params: { messageId: string }; Querystring: { emoji: string } }>(
    "/api/messages/:messageId/reactions",
    { preHandler: requireAuth },
    async (request) => {
      const { messageId } = request.params;
      const userId = request.user!.id;
      const { emoji } = request.query;

      if (!emoji) {
        throw new AppError(400, "BAD_REQUEST", "Emoji parameter is required");
      }

      const message = await app.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new AppError(404, "NOT_FOUND", "Message not found");
      }

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId: message.duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this chat");
      }

      await app.prisma.messageReaction.deleteMany({
        where: {
          messageId,
          userId,
          emoji,
        },
      });

      // Broadcast reaction removal via Supabase if configured
      if (app.supabase) {
        await safeBroadcast(
          app,
          `duo-chat:${message.duoSpaceId}`,
          "reaction_removed",
          { messageId, userId, emoji }
        );
      }

      return { success: true, data: { messageId, emoji } };
    }
  );
}
