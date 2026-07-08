// ─── User ───────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  theme: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Duo Space ──────────────────────────────────────────
export interface DuoSpace {
  id: string;
  name: string;
  inviteCode: string;
  level: number;
  totalXp: number;
  createdAt: string;
  updatedAt: string;
  members?: DuoMember[];
}

export interface DuoMember {
  id: string;
  userId: string;
  duoSpaceId: string;
  role: "owner" | "member";
  joinedAt: string;
  user?: User;
}

// ─── Goals ──────────────────────────────────────────────
export type GoalType = "personal" | "shared";
export type GoalStatus = "active" | "completed" | "archived";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  type: GoalType;
  progress: number;
  status: GoalStatus;
  dueDate: string | null;
  userId: string;
  duoSpaceId: string;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  milestones?: Milestone[];
  user?: User;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  goalId: string;
  order: number;
  createdAt: string;
}

export interface GoalNote {
  id: string;
  content: string;
  goalId: string;
  userId: string;
  createdAt: string;
}

// ─── Tasks ──────────────────────────────────────────────
export type TaskType = "personal" | "shared";
export type RecurringType = "daily" | "weekly" | null;

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  recurring: RecurringType;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  userId: string;
  duoSpaceId: string;
  goalId: string | null;
  daysOfWeek: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  userId: string;
  completedAt: string;
}

// ─── Messages ───────────────────────────────────────────
export type MessageType = "text" | "image" | "system" | "nudge";

export interface Message {
  id: string;
  content: string;
  type: MessageType;
  senderId: string;
  duoSpaceId: string;
  createdAt: string;
  sender?: User;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
  createdAt: string;
}

// ─── Challenges ─────────────────────────────────────────
export type ChallengeType = "fitness" | "coding" | "reading" | "custom";
export type ChallengeStatus = "active" | "completed" | "failed";

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: ChallengeType;
  targetDays: number;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  duoSpaceId: string;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  createdAt: string;
  participants?: ChallengeParticipant[];
}

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  daysCompleted: number;
  lastCheckIn: string | null;
  user?: User;
}

// ─── Check-Ins ──────────────────────────────────────────
export interface CheckIn {
  id: string;
  userId: string;
  duoSpaceId: string;
  answer1: string;
  answer2: string;
  answer3: string;
  aiSummary: string | null;
  createdAt: string;
  user?: User;
}

// ─── Achievements ───────────────────────────────────────
export type AchievementCategory = "tasks" | "streaks" | "social" | "goals";

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  category: AchievementCategory;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: string;
  achievement?: Achievement;
}

// ─── Activity & Stats ───────────────────────────────────
export type ActivityAction =
  | "task_completed"
  | "goal_created"
  | "goal_completed"
  | "milestone_completed"
  | "achievement_unlocked"
  | "challenge_joined"
  | "challenge_completed"
  | "check_in"
  | "streak_milestone";

export interface ActivityLog {
  id: string;
  userId: string;
  duoSpaceId: string | null;
  action: ActivityAction;
  metadata: Record<string, unknown> | null;
  xpEarned: number;
  date: string;
  createdAt: string;
  user?: User;
}

export interface Streak {
  id: string;
  userId: string;
  duoSpaceId: string | null;
  currentDays: number;
  longestDays: number;
  lastActiveDate: string | null;
}

// ─── API Responses ──────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Home Page Aggregates ───────────────────────────────
export interface TodayProgress {
  userId: string;
  username: string;
  avatarUrl: string | null;
  completedTasks: number;
  totalTasks: number;
}

export interface DuoOverview {
  duoSpace: DuoSpace;
  members: (DuoMember & { user: User })[];
  streak: Streak;
  todayProgress: TodayProgress[];
  recentActivity: ActivityLog[];
  heatmap?: Record<string, { u1: boolean; u2: boolean }>;
  weeklyRecap?: {
    totalTasksCompleted: number;
    totalXpEarned: number;
    weeklyUserStats: {
      userId: string;
      username: string;
      avatarUrl: string | null;
      xpEarned: number;
    }[];
    weeklyMvp: {
      userId?: string;
      username?: string;
      avatarUrl?: string | null;
      xpEarned?: number;
      tie?: boolean;
      text?: string;
    } | null;
  };
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  type: "shared" | "private";
  userId: string;
  duoSpaceId: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

