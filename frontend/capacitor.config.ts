import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.scriptforge.ai",
  appName: "ScriptForge AI",
  webDir: "dist",

  // Server config for live-reload during native dev (comment out for production builds)
  // server: {
  //   url: "http://YOUR_DEV_MACHINE_IP:5173",
  //   cleartext: true,
  // },

  ios: {
    contentInset: "automatic",
    backgroundColor: "#0a0a0a",
  },

  android: {
    backgroundColor: "#0a0a0a",
    allowMixedContent: true,  // needed for http:// API calls on Android
    captureInput: true,
  },

  plugins: {
    // CapacitorHttp is intentionally disabled: it buffers entire responses and
    // breaks the SSE streaming used by all tabs. Instead, capacitor://localhost
    // is whitelisted in the backend CORS config so the WebView's native fetch
    // can stream directly.
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
