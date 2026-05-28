import { useState, useRef, useEffect, useCallback } from "react";
import { streamRequest } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";
import SendTo from "../components/SendTo";
import useVoice from "../hooks/useVoice";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go"];

const MODES = [
  { id: "simplify",   label: "Simplify",    desc: "Shorter, cleaner, less redundancy" },
  { id: "comments",   label: "Add Comments", desc: "Thorough explanatory comments" },
  { id: "production", label: "Production",   desc: "Error handling, logging, best practices" },
  { id: "beginner",   label: "Beginner",     desc: "Verbose names, heavy comments" },
];

export default function ImproveTab({ isActive = false }) {
  const [code, setCode]           = useState("");
  const [mode, setMode]           = useState("simplify");
  const [osProfile, setOsProfile] = useState("linux");
  const [language, setLanguage]   = useState("bash");
  const [result, setResult]         = useState(null);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const abortRef = useRef(null);
  const runRef   = useRef(null);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["improve"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.code)     setCode(incoming.code);
    if (incoming.language) setLanguage(incoming.language);
    consume("improve");
  }, [incoming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onVoiceResult = useCallback((text) => setCode(p => p ? `${p} ${text}` : text), []);
  const { recording, supported: voiceOk, toggle: toggleVoice } = useVoice(onVoiceResult);

  const improve = async () => {
    if (!code.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");
    try {
      for await (const chunk of streamRequest("/improve/stream",
        { code, mode, language, os_profile: osProfile },
        abortRef.current.signal
      )) {
        if (chunk.error) { setError(chunk.error); break; }
        if (chunk.done)  { setResult(chunk.result); setStreamText(""); }
        else             { setStreamText(prev => prev + chunk.text); }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

  runRef.current = improve;
  useEffect(() => {
    if (!isActive) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isActive]);

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Script Improver</div>

        <OsProfileSelector value={osProfile} onChange={setOsProfile} />

        <div className="form-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "auto" }}>
            {LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>Improvement Mode</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`os-chip${mode === m.id ? " active" : ""}`}
                onClick={() => setMode(m.id)}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="text-dim" style={{ fontSize: 11 }}>
            {MODES.find(m => m.id === mode)?.desc}
          </span>
        </div>

        <div className="form-row">
          <label>Code to improve</label>
          <CodeBlock code={code} language={language} readOnly={false} onChange={setCode} height={240} />
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={improve} disabled={loading || !code.trim()}>
            {loading
              ? <><span className="spinner" /> Improving…</>
              : <>✨ Improve <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>}
          </button>
          {voiceOk && (
            <button className={`btn btn-voice${recording ? " recording" : ""}`} onClick={toggleVoice}>
              {recording ? "⏹ Stop" : "🎤 Voice"}
            </button>
          )}
          {loading && (
            <button className="btn btn-danger btn-icon" onClick={() => abortRef.current?.abort()}>
              ✕ Cancel
            </button>
          )}
        </div>

        {error && (
          <div className="error-msg mt-12" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>{error}</span>
            <button className="btn btn-secondary btn-icon" style={{ flexShrink: 0 }} onClick={() => runRef.current?.()}>
              ↺ Retry
            </button>
          </div>
        )}
      </div>

      {streamText && (
        <div className="panel stream-panel">
          <span className="spinner" style={{ flexShrink: 0 }} />
          <span className="panel-title" style={{ marginBottom: 0 }}>Improving…</span>
          <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: "auto" }}>
            {streamText.length.toLocaleString()} chars
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">Improved Code</div>
            <CodeBlock code={result.improved_code} language={language} readOnly />
            <SendTo code={result.improved_code} language={language} />
          </div>

          {result.changes_made?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Changes Made</div>
              <ul className="result-list">
                {result.changes_made.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
