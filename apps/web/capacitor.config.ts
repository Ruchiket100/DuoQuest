import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.duoquest",
  appName: "DuoQuest",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
