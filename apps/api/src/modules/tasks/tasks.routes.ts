import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { createTaskSchema, updateTaskSchema } from "@duoquest/shared";
import { AppError } from "../../plugins/error-handler.js";
import type { PrismaClient } from "@prisma/client";

export default async function tasksRoutes(app: FastifyInstance) {
  // Create task
  app.post<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/tasks",
    { preHandler: requireAuth },
    async (request) => {
      const { duoSpaceId } = request.params;
      const userId = request.user!.id;
      const { title, type, recurring, dueDate, goalId, daysOfWeek } = createTaskSchema.parse(request.body);

      // Verify membership
      const membership = await app.prisma.duoMember.findUnique({
        where: { userId_duoSpaceId: { userId, duoSpaceId } },
      });

      if (!membership) {
        throw new AppError(403, "FORBIDDEN", "You are not a member of this Duo Space");
      }

      // Create Task
      const task = await app.prisma.task.create({
        data: {
          title,
          type,
          recurring: recurring || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          goalId: goalId || null,
          daysOfWeek: daysOfWeek || null,
          userId,
          duoSpaceId,
        },
      });

      return { success: true, data: task };
    }
  );

  // List tasks for Duo Space (Active ones + completed today)
  app.get<{ Params: { duoSpaceId: string } }>(
    "/api/duo-spaces/:duoSpaceId/tasks",
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

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayDayName = new Date()
        .toLocaleDateString("en-US", { weekday: "short" })
        .toLowerCase();

      // Self-heal: Reset old completed recurring tasks
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

      const tasks = await app.prisma.task.findMany({
        where: {
          duoSpaceId,
          OR: [
            { completed: false },
            { completed: true, completedAt: { gte: todayStart } },
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
          goal: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Filter by daysOfWeek schedule / due date
      const filteredTasks = tasks.filter((task) => {
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

      return { success: true, data: filteredTasks };
    }
  );

  // Update task
  app.patch<{ Params: { id: string } }>(
    "/api/tasks/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;
      const updates = updateTaskSchema.parse(request.body);

      const task = await app.prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        throw new AppError(404, "NOT_FOUND", "Task not found");
      }

      if (task.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "Only the owner can edit this task");
      }

      const updatedTask = await app.prisma.task.update({
        where: { id },
        data: {
          ...updates,
          dueDate: updates.dueDate ? new Date(updates.dueDate) : updates.dueDate === null ? null : undefined,
        },
      });

      return { success: true, data: updatedTask };
    }
  );

  // Delete task
  app.delete<{ Params: { id: string } }>(
    "/api/tasks/:id",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const task = await app.prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        throw new AppError(404, "NOT_FOUND", "Task not found");
      }

      if (task.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "Only the owner can delete this task");
      }

      await app.prisma.task.delete({
        where: { id },
      });

      return { success: true, data: { id } };
    }
  );

  // Toggle task completion
  app.post<{ Params: { id: string } }>(
    "/api/tasks/:id/complete",
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const task = await app.prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        throw new AppError(404, "NOT_FOUND", "Task not found");
      }

      // If personal, only owner can complete. If shared, either user.
      if (task.type === "personal" && task.userId !== userId) {
        throw new AppError(403, "FORBIDDEN", "Only the owner can complete this personal task");
      }

      const nextState = !task.completed;
      const completedAt = nextState ? new Date() : null;

      // Update Task
      const updatedTask = await app.prisma.task.update({
        where: { id },
        data: {
          completed: nextState,
          completedAt,
        },
      });

      // Handle XP allocation, completions table, activity logging and streaks
      if (nextState) {
        // Record Completion
        await app.prisma.taskCompletion.create({
          data: {
            taskId: id,
            userId,
            completedAt: new Date(),
          },
        });

        // Calculate XP
        const isShared = task.type === "shared";
        const xpEarned = isShared ? 20 : 10;

        // Grant XP and Level Up checks (updates user and logs activity)
        await app.xpService.grantXp(
          userId,
          xpEarned,
          "task_completed",
          task.duoSpaceId,
          { taskId: id, title: task.title, type: task.type }
        );

        // Update Streaks
        await updateStreak(app.prisma, userId, task.duoSpaceId);

        // Evaluate achievements
        await app.achievementsService.checkAndUnlock(userId, task.duoSpaceId);
      } else {
        // Remove completion record
        await app.prisma.taskCompletion.deleteMany({
          where: { taskId: id, userId },
        });

        // Deduct XP
        const isShared = task.type === "shared";
        const xpDeducted = isShared ? 20 : 10;

        await app.xpService.grantXp(
          userId,
          -xpDeducted,
          "task_completed",
          task.duoSpaceId,
          { taskId: id, title: task.title, type: task.type, uncompleted: true }
        );
      }

      return { success: true, data: updatedTask };
    }
  );
}

// ─── Streak Calculation Helper ──────────────────────────
async function updateStreak(prisma: PrismaClient, userId: string, duoSpaceId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const streak = await prisma.streak.findUnique({
    where: {
      userId_duoSpaceId: {
        userId,
        duoSpaceId,
      },
    },
  });

  if (!streak) {
    await prisma.streak.create({
      data: {
        userId,
        duoSpaceId,
        currentDays: 1,
        longestDays: 1,
        lastActiveDate: today,
      },
    });
    return;
  }

  const lastActive = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null;
  if (!lastActive) {
    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        currentDays: 1,
        longestDays: Math.max(streak.longestDays, 1),
        lastActiveDate: today,
      },
    });
    return;
  }

  // Check days elapsed between last check-in/activity and today
  const diffTime = today.getTime() - lastActive.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day!
    const newCurrent = streak.currentDays + 1;
    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        currentDays: newCurrent,
        longestDays: Math.max(streak.longestDays, newCurrent),
        lastActiveDate: today,
      },
    });
  } else if (diffDays > 1) {
    // Streak broken, reset to 1
    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        currentDays: 1,
        lastActiveDate: today,
      },
    });
  }
  // If diffDays === 0, they already completed a task today, streak is already updated.
}
