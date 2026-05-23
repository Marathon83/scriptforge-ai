import { useState, useCallback, useRef, useEffect } from "react";
import { simulateScript, streamRequest } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";
import SecurityBadge from "../components/SecurityBadge";
import SendTo from "../components/SendTo";
import useVoice from "../hooks/useVoice";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go"];

export default function GenerateTab() {
  const [prompt, setPrompt]       = useState("");
  const [osProfile, setOsProfile] = useState("linux");
  const [language, setLanguage]   = useState("bash");
  const [result, setResult]       = useState(null);
  const [streamText, setStreamText] = useState("");
  const [sim, setSim]             = useState(null);
  const [loading, setLoading]     = useState(false);
  const [simLoading, setSimLoad]  = useState(false);
  const [error, setError]         = useState("");

  const abortRef = useRef(null);
  const runRef   = useRef(null);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["generate"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.prompt) setPrompt(incoming.prompt);
    consume("generate");
  }, [incoming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onVoiceResult = useCallback((text) => setPrompt(p => p ? `${p} ${text}` : text), []);
  const { recording, supported: voiceOk, toggle: toggleVoice } = useVoice(onVoiceResult);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setSim(null);
    setStreamText("");
    try {
      for await (const chunk of streamRequest("/generate/stream",
        { prompt, os_profile: osProfile, language },
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

  runRef.current = generate;
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const simulate = async () => {
    if (!prompt.trim()) return;
    setSimLoad(true);
    try {
      setSim(await simulateScript({ prompt }));
    } catch {
      setSim({ error: "Simulation failed" });
    }
    setSimLoad(false);
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Script Generator</div>

        <OsProfileSelector value={osProfile} onChange={setOsProfile} />

        <div className="form-inline">
          <div className="form-row" style={{ flex: 1 }}>
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>Describe what you want</label>
          <textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. backup /var/www to S3 every night, skip hidden files..."
          />
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={generate} disabled={loading || !prompt.trim()}>
            {loading
              ? <><span className="spinner" /> Generating…</>
              : <>⚡ Generate <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>}
          </button>
          <button className="btn btn-secondary" onClick={simulate} disabled={simLoading || !prompt.trim()}>
            {simLoading ? <><span className="spinner" /> Simulating…</> : "▷ Simulate"}
          </button>
          {voiceOk && (
            <button className={`btn btn-voice${recording ? " recording" : ""}`} onClick={toggleVoice}>
              {recording ? "⏹ Stop" : "🎤 Voice"}
            </button>
          )}
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

      {/* Live stream preview */}
      {streamText && (
        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="spinner" style={{ flexShrink: 0 }} />
            <span className="panel-title" style={{ marginBottom: 0 }}>Generating…</span>
          </div>
          <pre style={{ fontSize: 11, color: "var(--text-dim)", maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {streamText}
          </pre>
        </div>
      )}

      {sim && (
        <div className="panel">
          <div className="panel-title">Simulation</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <SecurityBadge level={sim.risk_level} />
            <span className="text-dim" style={{ fontSize: 13 }}>{sim.summary}</span>
          </div>
          {sim.steps?.length > 0 && (
            <ul className="result-list mt-8">
              {sim.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
          {sim.warnings?.length > 0 && (
            <ul className="result-list mt-8">
              {sim.warnings.map((w, i) => <li key={i} className="warn">⚠ {w}</li>)}
            </ul>
          )}
        </div>
      )}

      {result && (
        <>
          {result.plan?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Plan</div>
              <ol className="result-list">
                {result.plan.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}

          <div className="panel">
            <div className="panel-title">Generated Script</div>
            <CodeBlock code={result.script} language={language} readOnly />
            <SendTo code={result.script} language={language} />
          </div>

          {result.explanation && (
            <div className="panel">
              <div className="panel-title">Explanation</div>
              <p style={{ fontSize: 13, lineHeight: 1.7 }}>{result.explanation}</p>
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
            {result.security_flags?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Security Flags</div>
                <ul className="result-list">
                  {result.security_flags.map((f, i) => <li key={i} className="danger">✕ {f}</li>)}
                </ul>
              </div>
            )}
            {result.optimization_tips?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Optimization Tips</div>
                <ul className="result-list">
                  {result.optimization_tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
