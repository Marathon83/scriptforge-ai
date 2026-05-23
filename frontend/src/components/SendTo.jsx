import { useTabCtx } from "../context/TabContext";

export default function SendTo({ code, language, error = "" }) {
  const { sendToTab } = useTabCtx();
  if (!code) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
      <span style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
        Send to →
      </span>
      <button className="btn btn-secondary btn-icon" onClick={() => sendToTab("sandbox", { code, language })}>
        ▶ Sandbox
      </button>
      <button className="btn btn-secondary btn-icon" onClick={() => sendToTab("debug", { code, language, error })}>
        🔍 Debug
      </button>
      <button className="btn btn-secondary btn-icon" onClick={() => sendToTab("improve", { code, language })}>
        ✨ Improve
      </button>
      <button className="btn btn-secondary btn-icon" onClick={() => sendToTab("convert", { code, language })}>
        ⇄ Convert
      </button>
    </div>
  );
}
