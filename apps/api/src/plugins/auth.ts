import fp from "fastify-plugin";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { fromNodeHeaders } from "better-auth/node";
import { dash } from "@better-auth/infra";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Session, User } from "better-auth";

// Extend Fastify types for auth
declare module "fastify" {
  interface FastifyInstance {
    auth: any;
  }
  interface FastifyRequest {
    user: User | null;
    session: Session | null;
  }
}

export default fp(async (app: FastifyInstance) => {
  let betterAuthUrl = process.env.BETTER_AUTH_URL || "http://localhost:3001";
  let betterAuthSecret = process.env.BETTER_AUTH_SECRET || "dev-secret-change-me";
  let betterAuthApiKey = process.env.BETTER_AUTH_API_KEY;

  if (betterAuthUrl) {
    betterAuthUrl = betterAuthUrl.trim().replace(/^["']|["']$/g, "").replace(/^\\"|\\"$/g, "");
  }
  if (betterAuthSecret) {
    betterAuthSecret = betterAuthSecret.trim().replace(/^["']|["']$/g, "").replace(/^\\"|\\"$/g, "");
  }
  if (betterAuthApiKey) {
    betterAuthApiKey = betterAuthApiKey.trim().replace(/^["']|["']$/g, "").replace(/^\\"|\\"$/g, "");
  }
  const auth = betterAuth({
    database: prismaAdapter(app.prisma, { provider: "postgresql" }),
    baseURL: betterAuthUrl,
    secret: betterAuthSecret,
    trustedOrigins: [
      "http://localhost:5173",
      "http://localhost",
      "https://localhost",
      "capacitor://localhost",
      "https://duoquest-ap.onrender.com"
    ],
    plugins: [
      dash({
        apiKey: betterAuthApiKey,
      }),
    ],
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },
    user: {
      additionalFields: {
        username: {
          type: "string",
          required: true,
          unique: true,
        },
        displayName: {
          type: "string",
          required: false,
        },
        avatarUrl: {
          type: "string",
          required: false,
        },
        xp: {
          type: "number",
          required: false,
          defaultValue: 0,
        },
        level: {
          type: "number",
          required: false,
          defaultValue: 1,
        },
        theme: {
          type: "string",
          required: false,
          defaultValue: "default",
        },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
      },
      cookies: betterAuthUrl.startsWith("https://") ? {
        session_token: {
          attributes: {
            sameSite: "none",
            secure: true,
          },
        },
        session_data: {
          attributes: {
            sameSite: "none",
            secure: true,
          },
        },
      } : undefined,
    },
    logger: {
      level: "debug",
      to: (level, message, ...args) => {
        app.log.info({ level, args }, `[Better Auth]: ${message}`);
      },
    },
  });

  // Decorate Fastify instance with auth
  app.decorate("auth", auth);

  // Catch-all route for Better Auth
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request: FastifyRequest, reply: FastifyReply) {
      const url = new URL(
        request.url,
        `http://${request.headers.host || "localhost:3001"}`
      );

      const req = new Request(url.toString(), {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        body:
          request.method !== "GET" ? JSON.stringify(request.body) : undefined,
      });

      const response = await auth.handler(req);

      // Forward status
      reply.status(response.status);

      // Forward headers
      response.headers.forEach((value: string, key: string) => {
        reply.header(key, value);
      });

      // Forward body
      if (response.body) {
        const text = await response.text();
        return reply.send(text);
      }

      return reply.send(null);
    },
  });

  // Auth middleware — adds user and session to request
  app.decorateRequest("user", null);
  app.decorateRequest("session", null);

  app.log.info("🔐 Authentication configured");
});

/**
 * Pre-handler hook to require authentication on specific routes
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const app = request.server;

  try {
    const session = await app.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    request.user = session.user;
    request.session = session.session;
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid session",
      },
    });
  }
}
