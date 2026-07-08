// ─── XP Values ──────────────────────────────────────────
export const XP_VALUES = {
  TASK_COMPLETED: 10,
  SHARED_TASK_COMPLETED: 20,
  MILESTONE_COMPLETED: 100,
  GOAL_COMPLETED: 250,
  CHALLENGE_DAY: 15,
  CHALLENGE_WON: 200,
  WEEKLY_STREAK: 250,
  CHECK_IN: 25,
} as const;

// ─── Level Thresholds ───────────────────────────────────
export interface LevelDefinition {
  level: number;
  title: string;
  xpRequired: number;
}

export const LEVEL_THRESHOLDS: LevelDefinition[] = [
  { level: 1, title: "Explorer", xpRequired: 0 },
  { level: 2, title: "Explorer", xpRequired: 100 },
  { level: 3, title: "Explorer", xpRequired: 250 },
  { level: 4, title: "Explorer", xpRequired: 400 },
  { level: 5, title: "Starter", xpRequired: 500 },
  { level: 6, title: "Starter", xpRequired: 750 },
  { level: 7, title: "Starter", xpRequired: 1000 },
  { level: 8, title: "Starter", xpRequired: 1400 },
  { level: 9, title: "Starter", xpRequired: 1800 },
  { level: 10, title: "Builder", xpRequired: 2000 },
  { level: 15, title: "Achiever", xpRequired: 5000 },
  { level: 20, title: "Warrior", xpRequired: 10000 },
  { level: 25, title: "Creator", xpRequired: 15000 },
  { level: 30, title: "Master", xpRequired: 25000 },
  { level: 40, title: "Champion", xpRequired: 50000 },
  { level: 50, title: "Legend", xpRequired: 75000 },
];

/**
 * Get level info for a given XP amount
 */
export function getLevelForXP(xp: number): LevelDefinition {
  let result = LEVEL_THRESHOLDS[0];
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.xpRequired) {
      result = threshold;
    } else {
      break;
    }
  }
  return result;
}

/**
 * Get XP required for the next level
 */
export function getNextLevelXP(currentXP: number): number | null {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (threshold.xpRequired > currentXP) {
      return threshold.xpRequired;
    }
  }
  return null; // Max level reached
}

/**
 * Get progress percentage to next level (0-100)
 */
export function getLevelProgress(xp: number): number {
  const currentLevel = getLevelForXP(xp);
  const nextXP = getNextLevelXP(xp);
  if (nextXP === null) return 100;
  const range = nextXP - currentLevel.xpRequired;
  const progress = xp - currentLevel.xpRequired;
  return Math.round((progress / range) * 100);
}

// ─── Achievement Definitions ────────────────────────────
export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  category: "tasks" | "streaks" | "social" | "goals";
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Task achievements
  {
    key: "first_task",
    title: "First Step",
    description: "Complete your first task",
    icon: "🎯",
    xpReward: 50,
    category: "tasks",
  },
  {
    key: "ten_tasks",
    title: "Getting Started",
    description: "Complete 10 tasks",
    icon: "✅",
    xpReward: 100,
    category: "tasks",
  },
  {
    key: "fifty_tasks",
    title: "Productive",
    description: "Complete 50 tasks",
    icon: "⚡",
    xpReward: 250,
    category: "tasks",
  },
  {
    key: "hundred_tasks",
    title: "Builder",
    description: "Complete 100 tasks",
    icon: "🏗️",
    xpReward: 500,
    category: "tasks",
  },

  // Streak achievements
  {
    key: "3_day_streak",
    title: "Warming Up",
    description: "Maintain a 3-day streak",
    icon: "🔥",
    xpReward: 50,
    category: "streaks",
  },
  {
    key: "7_day_streak",
    title: "Consistent",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    xpReward: 150,
    category: "streaks",
  },
  {
    key: "14_day_streak",
    title: "Dedicated",
    description: "Maintain a 14-day streak",
    icon: "💪",
    xpReward: 300,
    category: "streaks",
  },
  {
    key: "30_day_streak",
    title: "Unstoppable",
    description: "Maintain a 30-day streak",
    icon: "🏆",
    xpReward: 500,
    category: "streaks",
  },
  {
    key: "100_day_streak",
    title: "Legendary",
    description: "Maintain a 100-day streak",
    icon: "👑",
    xpReward: 1000,
    category: "streaks",
  },

  // Social achievements
  {
    key: "first_duo",
    title: "Better Together",
    description: "Create or join your first Duo Space",
    icon: "🤝",
    xpReward: 50,
    category: "social",
  },
  {
    key: "first_nudge",
    title: "Friendly Push",
    description: "Send your first nudge",
    icon: "👋",
    xpReward: 25,
    category: "social",
  },
  {
    key: "fifty_shared_tasks",
    title: "Co-Founder Mode",
    description: "Complete 50 shared tasks",
    icon: "🚀",
    xpReward: 500,
    category: "social",
  },
  {
    key: "first_challenge",
    title: "Challenger",
    description: "Complete your first challenge",
    icon: "⚔️",
    xpReward: 100,
    category: "social",
  },

  // Goal achievements
  {
    key: "first_goal",
    title: "Visionary",
    description: "Create your first goal",
    icon: "🎯",
    xpReward: 25,
    category: "goals",
  },
  {
    key: "goal_completed",
    title: "Goal Crusher",
    description: "Complete your first goal",
    icon: "🏅",
    xpReward: 200,
    category: "goals",
  },
  {
    key: "five_goals",
    title: "Ambitious",
    description: "Complete 5 goals",
    icon: "🌟",
    xpReward: 500,
    category: "goals",
  },
];

// ─── Nudge Templates ────────────────────────────────────
export const NUDGE_TEMPLATES = [
  "Need backup? 💪",
  "Let's finish today! 🚀",
  "Only a few tasks left! 🎯",
  "Don't break the streak! 🔥",
  "You got this! 💯",
  "Time to show up! ⏰",
  "Let's crush it together! 🤝",
  "Almost there! 🏁",
] as const;

// ─── Task Types ─────────────────────────────────────────
export const TASK_TYPES = ["personal", "shared"] as const;
export const GOAL_TYPES = ["personal", "shared"] as const;
export const RECURRING_TYPES = ["daily", "weekly"] as const;
export const CHALLENGE_TYPES = [
  "fitness",
  "coding",
  "reading",
  "custom",
] as const;

// ─── Duo Space Limits ───────────────────────────────────
export const MAX_DUO_MEMBERS = 2;
export const MAX_FREE_DUO_SPACES = 1;
