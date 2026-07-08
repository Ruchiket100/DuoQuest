import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";

export default async function notificationsRoutes(app: FastifyInstance) {
  // Get notifications (unread first, paginated)
  app.get(
    "/api/notifications",
    { preHandler: requireAuth },
    async (request) => {
      const userId = request.user!.id;
      const { cursor, limit = "20" } = request.query as { cursor?: string; limit?: string };
      const take = Math.min(parseInt(limit, 10), 50);

      const notifications = await app.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ read: "asc" }, { createdAt: "desc" }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = notifications.length > take;
      const items = hasMore ? notifications.slice(0, take) : notifications;

      return {
        success: true,
        data: {
          items,
          nextCursor: hasMore ? items[items.length - 1].id : null,
        },
      };
    }
  );

  // Get unread count
  app.get(
    "/api/notifications/unread-count",
    { preHandler: requireAuth },
    async (request) => {
      const userId = request.user!.id;

      const count = await app.prisma.notification.count({
        where: { userId, read: false },
      });

      return { success: true, data: { count } };
    }
  );

  // Mark single notification as read
  app.post<{ Params: { id: string } }>(
    "/api/notifications/:id/read",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      await app.prisma.notification.updateMany({
        where: { id, userId },
        data: { read: true },
      });

      return { success: true };
    }
  );

  // Mark all notifications as read
  app.post(
    "/api/notifications/read-all",
    { preHandler: requireAuth },
    async (request) => {
      const userId = request.user!.id;

      await app.prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });

      return { success: true };
    }
  );
}
