import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { AppError } from "../../plugins/error-handler.js";
import { createJournalSchema, updateJournalSchema } from "@duoquest/shared";

export default async function journalRoutes(app: FastifyInstance) {
  // Create a new journal entry
  app.post<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/journal",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const userId = request.user!.id;
      const { title, content, type } = createJournalSchema.parse(request.body);

      // Verify membership in duo space
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      // Create journal entry
      const entry = await app.prisma.journalEntry.create({
        data: {
          title,
          content,
          type,
          userId,
          duoSpaceId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Grant XP for journaling (15 XP for reflection)
      await app.xpService.grantXp(userId, 15, "journal_created", duoSpaceId, {
        entryId: entry.id,
        entryTitle: title,
        type,
      });

      return { success: true, data: entry };
    }
  );

  // List journal entries in a duo space
  app.get<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/journal",
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

      // Find all journal entries:
      // Return ALL "shared" entries in this space, AND only the CURRENT user's "private" entries.
      const entries = await app.prisma.journalEntry.findMany({
        where: {
          duoSpaceId,
          OR: [
            { type: "shared" },
            { type: "private", userId },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { success: true, data: entries };
    }
  );

  // Get a single journal entry by ID
  app.get<{ Params: { id: string } }>(
    "/api/journal/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const entry = await app.prisma.journalEntry.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!entry) {
        throw new AppError(404, "NOT_FOUND", "Journal entry not found");
      }

      // Check authorization:
      // If the entry is private, only the creator of the entry can fetch it.
      if (entry.type === "private" && entry.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "You are not authorized to view this private journal entry");
      }

      // Also ensure that if it is a shared entry, the current user is a member of the duo space where it belongs.
      const membership = await app.prisma.duoMember.findUnique({
        where: {
          userId_duoSpaceId: {
            userId,
            duoSpaceId: entry.duoSpaceId,
          },
        },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not authorized to view this journal entry");
      }

      return { success: true, data: entry };
    }
  );

  // Edit a journal entry
  app.patch<{ Params: { id: string } }>(
    "/api/journal/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;
      const updates = updateJournalSchema.parse(request.body);

      const entry = await app.prisma.journalEntry.findUnique({
        where: { id },
      });

      if (!entry) {
        throw new AppError(404, "NOT_FOUND", "Journal entry not found");
      }

      // Check authorization:
      // If the entry is private, only the creator of the entry can update it.
      // If it is shared, any member of the duo space can update it.
      if (entry.type === "private" && entry.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "You are not authorized to edit this private journal entry");
      }

      const membership = await app.prisma.duoMember.findUnique({
        where: {
          userId_duoSpaceId: {
            userId,
            duoSpaceId: entry.duoSpaceId,
          },
        },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not authorized to edit this journal entry");
      }

      const updated = await app.prisma.journalEntry.update({
        where: { id },
        data: updates,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      return { success: true, data: updated };
    }
  );

  // Delete a journal entry
  app.delete<{ Params: { id: string } }>(
    "/api/journal/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const entry = await app.prisma.journalEntry.findUnique({
        where: { id },
      });

      if (!entry) {
        throw new AppError(404, "NOT_FOUND", "Journal entry not found");
      }

      // Check authorization (only author can delete)
      if (entry.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "You are not authorized to delete this journal entry");
      }

      await app.prisma.journalEntry.delete({
        where: { id },
      });

      return { success: true, data: { deletedEntryId: id } };
    }
  );
}
