import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Hook to register native back button interceptors on Android platforms.
 */
export function useBackButton(callback: () => void) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let listener: any;

    async function registerListener() {
      try {
        listener = await App.addListener("backButton", () => {
          if (active) {
            callback();
          }
        });
      } catch (err) {
        console.warn("Failed to attach native backButton listener", err);
      }
    }

    registerListener();

    return () => {
      active = false;
      if (listener) {
        listener.remove();
      }
    };
  }, [callback]);
}
export default useBackButton;
