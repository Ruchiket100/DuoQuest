import { z } from "zod";

// ─── Auth Schemas ───────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  displayName: z.string().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
  theme: z.string().optional(),
});

// ─── Duo Space Schemas ──────────────────────────────────
export const createDuoSpaceSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(30, "Name must be at most 30 characters"),
});

export const joinDuoSpaceSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
});

// ─── Goal Schemas ───────────────────────────────────────
export const createGoalSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be at most 100 characters"),
  description: z.string().max(500).optional(),
  type: z.enum(["personal", "shared"]),
  dueDate: z.string().datetime().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  progress: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const createMilestoneSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be at most 100 characters"),
  order: z.number().int().min(0).optional(),
});

export const createGoalNoteSchema = z.object({
  content: z
    .string()
    .min(1, "Note content is required")
    .max(1000, "Note must be at most 1000 characters"),
});

// ─── Task Schemas ───────────────────────────────────────
export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  type: z.enum(["personal", "shared"]),
  recurring: z.enum(["daily", "weekly"]).nullable().optional(),
  dueDate: z.string().optional(),
  goalId: z.string().optional(),
  daysOfWeek: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

// ─── Message Schemas ────────────────────────────────────
export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000),
  type: z.enum(["text", "image", "nudge"]).optional().default("text"),
});

export const addReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

// ─── Challenge Schemas ──────────────────────────────────
export const createChallengeSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be at most 100 characters"),
  description: z.string().max(500).optional(),
  type: z.enum(["fitness", "coding", "reading", "custom"]),
  targetDays: z.number().int().min(1).max(365),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// ─── Check-In Schemas ───────────────────────────────────
export const createCheckInSchema = z.object({
  answer1: z
    .string()
    .min(1, "This field is required")
    .max(1000, "Answer is too long"),
  answer2: z
    .string()
    .min(1, "This field is required")
    .max(1000, "Answer is too long"),
  answer3: z
    .string()
    .min(1, "This field is required")
    .max(1000, "Answer is too long"),
});

// ─── Inferred Types ─────────────────────────────────────
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateDuoSpaceInput = z.infer<typeof createDuoSpaceSchema>;
export type JoinDuoSpaceInput = z.infer<typeof joinDuoSpaceSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type CreateGoalNoteInput = z.infer<typeof createGoalNoteSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type AddReactionInput = z.infer<typeof addReactionSchema>;
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;

// ─── Journal Schemas ─────────────────────────────────────
export const createJournalSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be at most 100 characters"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["shared", "private"]),
});

export const updateJournalSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().optional(),
  type: z.enum(["shared", "private"]).optional(),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;

