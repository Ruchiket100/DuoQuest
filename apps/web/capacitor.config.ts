import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.duoquest",
  appName: "DuoQuest",
  webDir: "dist",
  server: process.env.CAPACITOR_LIVE_RELOAD
    ? {
        url: process.env.CAPACITOR_LIVE_RELOAD,
        cleartext: true,
      }
    : {
        androidScheme: "https",
      },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
