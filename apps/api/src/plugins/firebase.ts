import fp from "fastify-plugin";
import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    sendPush: (
      token: string,
      payload: { title: string; body: string; data?: Record<string, string> }
    ) => Promise<void>;
  }
}

export default fp(async (app: FastifyInstance) => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.trim();
    privateKey = privateKey.replace(/^["']|["']$/g, "");
    privateKey = privateKey.replace(/^\\"|\\"$/g, "");
    privateKey = privateKey.replace(/\\n/g, "\n");
    privateKey = privateKey.replace(/\\\\n/g, "\n");
  }

  const isValidKey = privateKey && 
    privateKey.includes("-----BEGIN PRIVATE KEY-----") && 
    privateKey.includes("-----END PRIVATE KEY-----");

  if (!projectId || !clientEmail || !privateKey || !isValidKey) {
    app.log.warn(
      "⚠️  Firebase configuration missing or private key is invalid — Push Notifications will be disabled."
    );
    app.decorate("sendPush", async () => {
      app.log.info("Push notification skipped (Firebase disabled).");
    });
    return;
  }

  try {
    const firebaseApp = getApps().length === 0 
      ? initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        })
      : getApp();

    const messagingInstance = getMessaging(firebaseApp);

    app.decorate("sendPush", async (token: string, payload: { title: string; body: string; data?: Record<string, string> }) => {
      try {
        await messagingInstance.send({
          token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data,
        });
        app.log.info(`Push notification successfully sent to token: ${token.slice(0, 10)}...`);
      } catch (err) {
        app.log.error(err, "Failed to send push notification via FCM");
      }
    });

    app.log.info("🔥  Firebase Admin SDK initialized successfully");
  } catch (err) {
    app.log.error(err, "Failed to initialize Firebase Admin SDK");
    app.decorate("sendPush", async () => {});
  }
});
