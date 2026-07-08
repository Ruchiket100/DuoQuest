import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { createGoalSchema, updateGoalSchema, createMilestoneSchema, createGoalNoteSchema } from "@duoquest/shared";
import { AppError } from "../../plugins/error-handler.js";

export default async function goalsRoutes(app: FastifyInstance) {
  // Create a new goal inside a Duo Space
  app.post<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/goals",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const userId = request.user!.id;
      const { title, description, type, dueDate, icon, color, imageUrl } = createGoalSchema.parse(request.body);

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      // Create Goal
      const goal = await app.prisma.goal.create({
        data: {
          title,
          description,
          type,
          dueDate: dueDate ? new Date(dueDate) : null,
          icon: icon || null,
          color: color || null,
          imageUrl: imageUrl || null,
          userId,
          duoSpaceId,
        },
        include: {
          milestones: true,
        },
      });

      // Log Activity and reward XP (25 XP for creating a goal)
      await app.xpService.grantXp(
        userId,
        25,
        "goal_created",
        duoSpaceId,
        { goalId: goal.id, goalTitle: goal.title }
      );

      // Evaluate achievements
      await app.achievementsService.checkAndUnlock(userId, duoSpaceId);

      return { success: true, data: goal };
    }
  );

  // List goals for a Duo Space (Personal + Shared)
  app.get<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/goals",
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

      const goals = await app.prisma.goal.findMany({
        where: { duoSpaceId },
        include: {
          milestones: true,
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

      return { success: true, data: goals };
    }
  );

  // Get details of a goal
  app.get<{ Params: { id: string } }>(
    "/api/goals/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const goal = await app.prisma.goal.findUnique({
        where: { id },
        include: {
          milestones: { orderBy: { order: "asc" } },
          notes: {
            orderBy: { createdAt: "desc" },
          },
          tasks: {
            include: {
              user: {
                select: { id: true, username: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
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

      if (!goal) {
        throw new AppError(404, "NOT_FOUND", "Goal not found");
      }

      // Check membership in duo space
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId: goal.duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not authorized to view this goal");
      }

      return { success: true, data: goal };
    }
  );

  // Update goal
  app.patch<{ Params: { id: string } }>(
    "/api/goals/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;
      const updates = updateGoalSchema.parse(request.body);

      const goal = await app.prisma.goal.findUnique({
        where: { id },
      });

      if (!goal) {
        throw new AppError(404, "NOT_FOUND", "Goal not found");
      }

      // Only owner can update personal goals, either can update shared goals
      if (goal.type === "personal" && goal.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "Only the owner can edit this personal goal");
      }

      // Verify membership for shared goals
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId: goal.duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      // Update goal
      const updatedGoal = await app.prisma.goal.update({
        where: { id },
        data: {
          ...updates,
          dueDate: updates.dueDate ? new Date(updates.dueDate) : updates.dueDate === null ? null : undefined,
        },
      });

      // Award completion XP if status changed to completed
      if (updates.status === "completed" && goal.status !== "completed") {
        const isShared = goal.type === "shared";
        const xpReward = isShared ? 200 : 100;

        await app.xpService.grantXp(
          userId,
          xpReward,
          "goal_completed",
          goal.duoSpaceId,
          { goalId: goal.id, goalTitle: goal.title, type: goal.type }
        );

        // Evaluate achievements
        await app.achievementsService.checkAndUnlock(userId, goal.duoSpaceId);
      }

      return { success: true, data: updatedGoal };
    }
  );

  // Delete goal
  app.delete<{ Params: { id: string } }>(
    "/api/goals/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const goal = await app.prisma.goal.findUnique({
        where: { id },
      });

      if (!goal) {
        throw new AppError(404, "NOT_FOUND", "Goal not found");
      }

      if (goal.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "Only the goal creator can delete it");
      }

      await app.prisma.goal.delete({
        where: { id },
      });

      return { success: true, data: { id } };
    }
  );

  // Add a milestone to a goal
  app.post<{ Params: { id: string } }>(
    "/api/goals/:id/milestones",
    { preHandler: requireAuth },
    async (request) => {
      const { id: goalId } = request.params;
      const userId = request.user!.id;
      const { title, order } = createMilestoneSchema.parse(request.body);

      const goal = await app.prisma.goal.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new AppError(404, "NOT_FOUND", "Goal not found");
      }

      if (goal.type === "personal" && goal.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "Only the owner can modify this goal");
      }

      const milestone = await app.prisma.milestone.create({
        data: {
          title,
          order: order || 0,
          goalId,
        },
      });

      return { success: true, data: milestone };
    }
  );

  // Toggle milestone status
  app.patch<{ Params: { milestoneId: string } }>(
    "/api/milestones/:milestoneId",
    { preHandler: requireAuth },
    async (request) => {
      const { milestoneId } = request.params;
      const userId = request.user!.id;

      const milestone = await app.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });

      if (!milestone) {
        throw new AppError(404, "NOT_FOUND", "Milestone not found");
      }

      if (milestone.goal.type === "personal" && milestone.goal.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "Only the owner can modify this goal");
      }

      const nextCompletedState = !milestone.completed;

      const updatedMilestone = await app.prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          completed: nextCompletedState,
          completedAt: nextCompletedState ? new Date() : null,
        },
      });

      // Recalculate goal progress
      const allMilestones = await app.prisma.milestone.findMany({
        where: { goalId: milestone.goalId },
      });

      const completedCount = allMilestones.filter((m) => m.completed).length;
      const progress = allMilestones.length > 0 ? Math.round((completedCount / allMilestones.length) * 100) : 0;

      await app.prisma.goal.update({
        where: { id: milestone.goalId },
        data: { progress },
      });

      // Award/deduct XP for milestone completion
      if (nextCompletedState) {
        await app.xpService.grantXp(
          userId,
          15,
          "milestone_completed",
          milestone.goal.duoSpaceId,
          { goalId: milestone.goalId, milestoneId, title: milestone.title }
        );

        // Evaluate achievements
        await app.achievementsService.checkAndUnlock(userId, milestone.goal.duoSpaceId);
      } else {
        await app.xpService.grantXp(
          userId,
          -15,
          "milestone_completed",
          milestone.goal.duoSpaceId,
          { goalId: milestone.goalId, milestoneId, title: milestone.title, uncompleted: true }
        );
      }

      return { success: true, data: { milestone: updatedMilestone, goalProgress: progress } };
    }
  );

  // Add note / discussion comment on a goal
  app.post<{ Params: { id: string } }>(
    "/api/goals/:id/notes",
    { preHandler: requireAuth },
    async (request) => {
      const { id: goalId } = request.params;
      const userId = request.user!.id;
      const { content } = createGoalNoteSchema.parse(request.body);

      const goal = await app.prisma.goal.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new AppError(404, "NOT_FOUND", "Goal not found");
      }

      const note = await app.prisma.goalNote.create({
        data: {
          content,
          goalId,
          userId,
        },
      });

      return { success: true, data: note };
    }
  );
}
