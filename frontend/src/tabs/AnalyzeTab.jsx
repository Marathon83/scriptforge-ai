import { useState, useRef, useEffect, useCallback } from "react";
import { streamRequest } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";
import SendTo from "../components/SendTo";
import useVoice from "../hooks/useVoice";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go", "sql", "shell"];

export default function AnalyzeTab({ isActive = false }) {
  const [code, setCode]           = useState("");
  const [osProfile, setOsProfile] = useState("linux");
  const [language, setLanguage]   = useState("shell");
  const [result, setResult]       = useState(null);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const abortRef = useRef(null);
  const runRef   = useRef(null);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["analyze"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.code)     setCode(incoming.code);
    if (incoming.language) setLanguage(incoming.language);
    consume("analyze");
  }, [incoming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onVoiceResult = useCallback((text) => setCode(p => p ? `${p} ${text}` : text), []);
  const { recording, supported: voiceOk, toggle: toggleVoice } = useVoice(onVoiceResult);

  const analyze = async () => {
    if (!code.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");
    try {
      for await (const chunk of streamRequest("/analyze/stream",
        { code, os_profile: osProfile },
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

  runRef.current = analyze;
  useEffect(() => {
    if (!isActive) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isActive]);

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Reverse Analyzer</div>

        <div className="form-inline">
          <div style={{ flex: 2 }}>
            <OsProfileSelector value={osProfile} onChange={setOsProfile} />
          </div>
          <div className="form-row" style={{ minWidth: 140 }}>
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>Paste script to analyze</label>
          <CodeBlock code={code} language={language} readOnly={false} onChange={setCode} height={260} />
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={analyze} disabled={loading || !code.trim()}>
            {loading
              ? <><span className="spinner" /> Analyzing…</>
              : <>🔬 Analyze <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>}
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
          <span className="panel-title" style={{ marginBottom: 0 }}>Analyzing…</span>
          <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: "auto" }}>
            {streamText.length.toLocaleString()} chars
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">Summary</div>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{result.summary}</p>
            <SendTo code={code} language={language} />
          </div>

          {result.line_by_line?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Line-by-Line</div>
              <ul className="result-list">
                {result.line_by_line.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {result.dependencies?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Dependencies</div>
                <ul className="result-list">
                  {result.dependencies.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {result.security_risks?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Security Risks</div>
                <ul className="result-list">
                  {result.security_risks.map((r, i) => <li key={i} className="warn">⚠ {r}</li>)}
                </ul>
              </div>
            )}
            {result.suspicious_behavior?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Suspicious Behavior</div>
                <ul className="result-list">
                  {result.suspicious_behavior.map((b, i) => <li key={i} className="danger">✕ {b}</li>)}
                </ul>
              </div>
            )}
            {result.optimization_suggestions?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Optimization Suggestions</div>
                <ul className="result-list">
                  {result.optimization_suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {result.security_flags?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Critical Security Issues</div>
                <ul className="result-list">
                  {result.security_flags.map((f, i) => <li key={i} className="danger">✕ {f}</li>)}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
