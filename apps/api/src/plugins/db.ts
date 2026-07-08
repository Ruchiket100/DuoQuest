import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV !== "production"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  await prisma.$connect();
  app.log.info("📦 Database connected");

  // Decorate Fastify instance
  app.decorate("prisma", prisma);

  // Disconnect on close
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
    app.log.info("📦 Database disconnected");
  });
});
