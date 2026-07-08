import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import api from "./api.ts";

export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push notifications are only available on native platforms (iOS/Android).");
    return;
  }

  try {
    // Request permission to use push notifications
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== "granted") {
      console.warn("User denied push notification permissions.");
      return;
    }

    // Register with Apple / Google for a token
    await PushNotifications.register();

    // On success, send the token to our server
    await PushNotifications.addListener("registration", async (token) => {
      console.log("Push registration success, token: " + token.value);
      try {
        await api.post("/api/users/push-token", { token: token.value });
        console.log("Push token registered successfully on the server.");
      } catch (err) {
        console.error("Failed to register push token on the server:", err);
      }
    });

    // On error, log it
    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error: ", error);
    });

    // Show a local notification alert when the app is in the foreground
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push notification received in foreground: ", notification);
    });

    // Handle push notification click/tap actions
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push notification action performed: ", action);
    });
  } catch (err) {
    console.error("Error setting up Capacitor push notifications:", err);
  }
}
