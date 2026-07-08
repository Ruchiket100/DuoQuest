import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import dbPlugin from "./db.js";
import corsPlugin from "./cors.js";
import errorHandlerPlugin from "./error-handler.js";
import authPlugin from "./auth.js";
import supabasePlugin from "./supabase.js";
import firebasePlugin from "./firebase.js";
import servicesPlugin from "./services.js";

export async function registerPlugins(app: FastifyInstance) {
  // Order matters: db must come before auth (auth depends on prisma)
  await app.register(errorHandlerPlugin);
  await app.register(corsPlugin);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB
  await app.register(dbPlugin);
  await app.register(servicesPlugin);
  await app.register(authPlugin);
  await app.register(supabasePlugin);
  await app.register(firebasePlugin);
}
