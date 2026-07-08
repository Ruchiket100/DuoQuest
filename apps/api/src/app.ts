import Fastify from "fastify";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./modules/index.js";

export async function buildApp() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Register all plugins (db, cors, auth, error handling)
  await registerPlugins(app);

  // Register all route modules
  await registerRoutes(app);

  return app;
}
