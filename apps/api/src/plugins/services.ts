import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { XpService } from "../modules/xp/xp.service.js";
import { AchievementsService } from "../modules/achievements/achievements.service.js";

declare module "fastify" {
  interface FastifyInstance {
    xpService: XpService;
    achievementsService: AchievementsService;
  }
}

export default fp(async (app: FastifyInstance) => {
  const xpService = new XpService(app.prisma, (token, payload) => {
    if (app.sendPush) {
      return app.sendPush(token, payload);
    }
    return Promise.resolve();
  });
  const achievementsService = new AchievementsService(app.prisma, xpService);

  app.decorate("xpService", xpService);
  app.decorate("achievementsService", achievementsService);

  app.log.info("🎮 Gamification services initialized");
});
