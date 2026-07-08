import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export default fp(async (app: FastifyInstance) => {
  app.setErrorHandler(
    (error: Error, _request: FastifyRequest, reply: FastifyReply) => {
      // Zod validation errors
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: error.issues.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
        });
      }

      // App-level errors
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      // Fastify validation errors
      if ("validation" in error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
          },
        });
      }

      // Unknown errors
      app.log.error(error);
      return reply.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            process.env.NODE_ENV === "production"
              ? "An unexpected error occurred"
              : error.message,
        },
      });
    }
  );
});
