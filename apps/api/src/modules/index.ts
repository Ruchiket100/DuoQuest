import type { FastifyInstance } from "fastify";
import usersRoutes from "./users/users.routes.js";
import duoSpacesRoutes from "./duo-spaces/duo-spaces.routes.js";
import goalsRoutes from "./goals/goals.routes.js";
import tasksRoutes from "./tasks/tasks.routes.js";
import messagesRoutes from "./messages/messages.routes.js";
import challengesRoutes from "./challenges/challenges.routes.js";
import notificationsRoutes from "./notifications/notifications.routes.js";
import journalRoutes from "./journal/journal.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(usersRoutes);
  await app.register(duoSpacesRoutes);
  await app.register(goalsRoutes);
  await app.register(tasksRoutes);
  await app.register(messagesRoutes);
  await app.register(challengesRoutes);
  await app.register(notificationsRoutes);
  await app.register(journalRoutes);
}
