import axios from "axios";

// Each runtime environment needs a different address for the local backend:
//   Web dev              → 127.0.0.1 (same machine)
//   iOS simulator        → localhost  (simulator forwards to host)
//   Android emulator     → 10.0.2.2  (emulator's alias for the host)
//   Real device / custom → VITE_API_URL env var overrides all of the above
//
// window.Capacitor is used intentionally instead of the @capacitor/core module
// import. The module initialises with /*#__PURE__*/ at the top level, which
// lets Rollup evaluate isNativePlatform() as a build-time constant (false) and
// tree-shake the native branches out of the bundle entirely.
function resolveBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) {
    return cap.getPlatform() === "android"
      ? "http://10.0.2.2:8000"
      : "http://localhost:8000";
  }
  return "http://127.0.0.1:8000";
}

const BASE = resolveBase();
const api = axios.create({ baseURL: BASE });

export const generateScript  = (data) => api.post("/generate", data).then(r => r.data);
export const simulateScript  = (data) => api.post("/simulate", data).then(r => r.data);
export const debugScript     = (data) => api.post("/debug", data).then(r => r.data);
export const analyzeScript   = (data) => api.post("/analyze", data).then(r => r.data);
export const convertScript   = (data) => api.post("/convert", data).then(r => r.data);
export const improveScript   = (data) => api.post("/improve", data).then(r => r.data);
export const buildCheatsheet = (data) => api.post("/cheatsheet", data).then(r => r.data);
export const tutorCode       = (data) => api.post("/tutor", data).then(r => r.data);
export const runSandbox      = (data) => api.post("/sandbox", data).then(r => r.data);

// Async generator for SSE streaming endpoints.
// Yields { text } chunks while streaming, then { done: true, result } when complete.
export async function* streamRequest(endpoint, data, signal) {
  const response = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      if (part.startsWith("data: ")) {
        try { yield JSON.parse(part.slice(6)); } catch { /* skip malformed */ }
      }
    }
  }
}
