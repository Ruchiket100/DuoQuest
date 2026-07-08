import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export default fp(async (app: FastifyInstance) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost"
  ];

  await app.register(cors, {
    origin: (origin, cb) => {
      cb(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.log.info("🔒 CORS configured");
});
