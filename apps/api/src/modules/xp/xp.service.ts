import type { PrismaClient } from "@prisma/client";
import { getLevelForXP, XP_VALUES } from "@duoquest/shared";

/**
 * Service to grant XP to a user and propagate leveling updates.
 */
export class XpService {
  constructor(
    private prisma: PrismaClient,
    private sendPush?: (token: string, payload: { title: string; body: string; data?: any }) => Promise<void>
  ) {}

  /**
   * Grant XP to a user and check for level updates.
   */
  async grantXp(
    userId: string,
    amount: number,
    action: string,
    duoSpaceId: string,
    metadata?: any
  ) {
    // 1. Fetch current user state
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    const oldXp = user.xp;
    const newXp = Math.max(oldXp + amount, 0); // Don't allow negative XP

    const oldLevel = user.level;
    const newLevelDef = getLevelForXP(newXp);
    const newLevel = newLevelDef.level;

    // 2. Update user XP and level
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: newLevel,
      },
    });

    // 3. Log Activity
    await this.prisma.activityLog.create({
      data: {
        userId,
        duoSpaceId,
        action,
        metadata: { ...metadata, xpBefore: oldXp, xpAfter: newXp },
        xpEarned: amount,
      },
    });

    // Helper to send push to partner
    const notifyPartner = async (title: string, body: string, data?: any) => {
      if (!this.sendPush) return;
      try {
        const partnerMember = await this.prisma.duoMember.findFirst({
          where: {
            duoSpaceId,
            userId: { not: userId },
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
          await this.sendPush(partnerMember.user.pushToken, { title, body, data });
        }
      } catch (err) {
        console.error("Failed to notify partner via push:", err);
      }
    };

    // 4. Handle User Level Up
    if (newLevel > oldLevel) {
      // Create system log for level up
      await this.prisma.activityLog.create({
        data: {
          userId,
          duoSpaceId,
          action: "level_up",
          metadata: { oldLevel, newLevel, title: newLevelDef.title },
          xpEarned: 0,
        },
      });

      // Insert system message into Duo Space Chat
      await this.prisma.message.create({
        data: {
          duoSpaceId,
          senderId: userId,
          content: `🎉 @${user.username} reached Level ${newLevel} (${newLevelDef.title})!`,
          type: "system",
        },
      });

      notifyPartner(
        "🎉 Partner Leveled Up!",
        `@${user.username} reached Level ${newLevel}! 🚀`
      ).catch(() => {});
    }

    // 5. Propagate XP to DuoSpace
    const duoSpace = await this.prisma.duoSpace.findUnique({
      where: { id: duoSpaceId },
    });

    if (duoSpace) {
      const oldDuoXp = duoSpace.totalXp;
      const newDuoXp = Math.max(oldDuoXp + amount, 0);
      
      const oldDuoLevel = duoSpace.level;
      const newDuoLevel = Math.floor(newDuoXp / 2000) + 1;

      await this.prisma.duoSpace.update({
        where: { id: duoSpaceId },
        data: {
          totalXp: newDuoXp,
          level: newDuoLevel,
        },
      });

      // Handle Duo Level Up
      if (newDuoLevel > oldDuoLevel) {
        await this.prisma.message.create({
          data: {
            duoSpaceId,
            senderId: userId,
            content: `🏰 Duo Space "${duoSpace.name}" leveled up to Level ${newDuoLevel}!`,
            type: "system",
          },
        });

        notifyPartner(
          "🏰 Duo Space Leveled Up!",
          `Your Duo Space leveled up to Level ${newDuoLevel}! Keep building consistency!`
        ).catch(() => {});
      }
    }

    // Dispatch push notifications based on gamification events
    const senderName = user.displayName || user.username || "Partner";
    if (action === "task_completion") {
      notifyPartner(
        "✅ Task Completed!",
        `${senderName} completed: "${metadata?.taskTitle || "a task"}" (+${amount} XP)`
      ).catch(() => {});
    } else if (action === "goal_completed") {
      notifyPartner(
        "🏆 Goal Achieved!",
        `${senderName} completed the goal: "${metadata?.goalTitle || "a goal"}"! 🎉`
      ).catch(() => {});
    } else if (action === "milestone_completed" && !metadata?.uncompleted) {
      notifyPartner(
        "🎯 Milestone Checked!",
        `${senderName} completed milestone: "${metadata?.title || "a milestone"}" under "${metadata?.goalTitle || "a goal"}"`
      ).catch(() => {});
    } else if (action === "achievement_unlocked") {
      notifyPartner(
        "🌟 Achievement Unlocked!",
        `${senderName} unlocked: "${metadata?.name || "an achievement"}"! 🏅`
      ).catch(() => {});
    }

    return updatedUser;
  }
}
