import { useState, useRef, useEffect, useCallback } from "react";
import { streamRequest } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";
import SecurityBadge from "../components/SecurityBadge";
import SendTo from "../components/SendTo";
import useVoice from "../hooks/useVoice";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go", "sql"];

export default function SimulateTab({ isActive = false }) {
  const [code, setCode]           = useState("");
  const [language, setLanguage]   = useState("bash");
  const [osProfile, setOsProfile] = useState("linux");
  const [result, setResult]         = useState(null);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const abortRef = useRef(null);
  const runRef   = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onVoiceResult = useCallback((text) => setCode(p => p ? `${p} ${text}` : text), []);
  const { recording, supported: voiceOk, toggle: toggleVoice } = useVoice(onVoiceResult);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["simulate"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.code)     setCode(incoming.code);
    if (incoming.language) setLanguage(incoming.language);
    consume("simulate");
  }, [incoming]);

  const simulate = async () => {
    if (!code.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");
    try {
      for await (const chunk of streamRequest("/simulate/stream",
        { code, language, os_profile: osProfile },
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

  runRef.current = simulate;
  useEffect(() => {
    if (!isActive) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isActive]);

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Dry Run Simulator</div>

        <OsProfileSelector value={osProfile} onChange={setOsProfile} />

        <div className="form-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "auto" }}>
            {LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>Paste script to simulate</label>
          <CodeBlock code={code} language={language} readOnly={false} onChange={setCode} height={240} />
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={simulate} disabled={loading || !code.trim()}>
            {loading
              ? <><span className="spinner" /> Simulating…</>
              : <>▷ Dry Run <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>}
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
          <span className="panel-title" style={{ marginBottom: 0 }}>Simulating…</span>
          <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: "auto" }}>
            {streamText.length.toLocaleString()} chars
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="panel">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <SecurityBadge level={result.risk_level} />
              <span style={{ fontSize: 13, lineHeight: 1.6 }}>{result.summary}</span>
            </div>
            <SendTo code={code} language={language} />
          </div>

          {result.steps?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Step-by-Step Execution</div>
              <ol className="result-list">
                {result.steps.map((s, i) => (
                  <li key={i}>
                    {typeof s === "object" ? (
                      <>
                        <span style={{ color: "var(--text)" }}>{s.action}</span>
                        {s.detail && (
                          <span style={{ color: "var(--text-dim)", display: "block", fontSize: 12, marginTop: 2 }}>
                            {s.detail}
                          </span>
                        )}
                      </>
                    ) : s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {result.side_effects?.length > 0 && (
              <div className="panel" style={{ flex: 1, minWidth: 220 }}>
                <div className="panel-title">Side Effects</div>
                <ul className="result-list">
                  {result.side_effects.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            {result.warnings?.length > 0 && (
              <div className="panel" style={{ flex: 1, minWidth: 220 }}>
                <div className="panel-title">Warnings</div>
                <ul className="result-list">
                  {result.warnings.map((w, i) => <li key={i} className="danger">✕ {w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
