import type { PrismaClient } from "@prisma/client";
import { ACHIEVEMENT_DEFINITIONS } from "@duoquest/shared";
import type { XpService } from "../xp/xp.service.js";

export class AchievementsService {
  constructor(
    private prisma: PrismaClient,
    private xpService: XpService
  ) {}

  /**
   * Evaluates all locked achievements for a user and unlocks any that meet requirements.
   */
  async checkAndUnlock(userId: string, duoSpaceId: string) {
    // 1. Fetch already unlocked achievements
    const unlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
    
    const unlockedKeys = new Set(unlocked.map((u) => u.achievement.key));

    // 2. Fetch stats for user
    const completedTasksCount = await this.prisma.task.count({
      where: { userId, completed: true },
    });

    const completedSharedTasksCount = await this.prisma.taskCompletion.count({
      where: {
        userId,
        task: {
          type: "shared",
        },
      },
    });

    const goalsCreatedCount = await this.prisma.goal.count({
      where: { userId },
    });

    const goalsCompletedCount = await this.prisma.goal.count({
      where: { userId, status: "completed" },
    });

    const streak = await this.prisma.streak.findUnique({
      where: {
        userId_duoSpaceId: {
          userId,
          duoSpaceId,
        },
      },
    });

    const currentStreak = streak?.currentDays || 0;
    const longestStreak = streak?.longestDays || 0;

    const challengesCompletedCount = await this.prisma.challengeParticipant.count({
      where: {
        userId,
        challenge: {
          status: "completed",
        },
      },
    });

    const membershipsCount = await this.prisma.duoMember.count({
      where: { userId },
    });

    // 3. Helper to unlock an achievement
    const unlock = async (key: string, title: string, rewardXp: number, desc: string) => {
      // Find or create the master achievement record
      let achievement = await this.prisma.achievement.findUnique({
        where: { key },
      });

      if (!achievement) {
        // Fallback fallback definition matching
        const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.key === key);
        achievement = await this.prisma.achievement.create({
          data: {
            key,
            title,
            description: desc,
            icon: def?.icon || "🏆",
            xpReward: rewardXp,
            category: def?.category || "tasks",
          },
        });
      }

      // Record unlock
      await this.prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
        },
      });

      // Grant Reward XP
      await this.xpService.grantXp(
        userId,
        rewardXp,
        "achievement_unlocked",
        duoSpaceId,
        { achievementKey: key, title }
      );

      // System notification message
      await this.prisma.message.create({
        data: {
          duoSpaceId,
          senderId: userId,
          content: `🏆 @${userId} unlocked "${title}" — ${desc}!`,
          type: "system",
        },
      });
    };

    // 4. Evaluate rules
    // Task Counts
    if (!unlockedKeys.has("first_task") && completedTasksCount >= 1) {
      await unlock("first_task", "First Step", 50, "Complete your first task");
    }
    if (!unlockedKeys.has("ten_tasks") && completedTasksCount >= 10) {
      await unlock("ten_tasks", "Getting Started", 100, "Complete 10 tasks");
    }
    if (!unlockedKeys.has("fifty_tasks") && completedTasksCount >= 50) {
      await unlock("fifty_tasks", "Productive", 250, "Complete 50 tasks");
    }
    if (!unlockedKeys.has("hundred_tasks") && completedTasksCount >= 100) {
      await unlock("hundred_tasks", "Builder", 500, "Complete 100 tasks");
    }

    // Streaks
    if (!unlockedKeys.has("3_day_streak") && longestStreak >= 3) {
      await unlock("3_day_streak", "Warming Up", 50, "Maintain a 3-day streak");
    }
    if (!unlockedKeys.has("7_day_streak") && longestStreak >= 7) {
      await unlock("7_day_streak", "Consistent", 150, "Maintain a 7-day streak");
    }
    if (!unlockedKeys.has("14_day_streak") && longestStreak >= 14) {
      await unlock("14_day_streak", "Dedicated", 300, "Maintain a 14-day streak");
    }
    if (!unlockedKeys.has("30_day_streak") && longestStreak >= 30) {
      await unlock("30_day_streak", "Unstoppable", 500, "Maintain a 30-day streak");
    }
    if (!unlockedKeys.has("100_day_streak") && longestStreak >= 100) {
      await unlock("100_day_streak", "Legendary", 1000, "Maintain a 100-day streak");
    }

    // Social
    if (!unlockedKeys.has("first_duo") && membershipsCount >= 1) {
      await unlock("first_duo", "Better Together", 50, "Create or join your first Duo Space");
    }
    if (!unlockedKeys.has("fifty_shared_tasks") && completedSharedTasksCount >= 50) {
      await unlock("fifty_shared_tasks", "Co-Founder Mode", 500, "Complete 50 shared tasks");
    }
    if (!unlockedKeys.has("first_challenge") && challengesCompletedCount >= 1) {
      await unlock("first_challenge", "Challenger", 100, "Complete your first challenge");
    }

    // Goals
    if (!unlockedKeys.has("first_goal") && goalsCreatedCount >= 1) {
      await unlock("first_goal", "Visionary", 25, "Create your first goal");
    }
    if (!unlockedKeys.has("goal_completed") && goalsCompletedCount >= 1) {
      await unlock("goal_completed", "Goal Crusher", 200, "Complete your first goal");
    }
    if (!unlockedKeys.has("five_goals") && goalsCompletedCount >= 5) {
      await unlock("five_goals", "Ambitious", 500, "Complete 5 goals");
    }
  }
}
