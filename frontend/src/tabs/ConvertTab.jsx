import { useState, useRef, useEffect, useCallback } from "react";
import { streamRequest } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import CodeBlock from "../components/CodeBlock";
import SendTo from "../components/SendTo";
import useVoice from "../hooks/useVoice";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go", "zsh"];

export default function ConvertTab({ isActive = false }) {
  const [code, setCode]       = useState("");
  const [fromLang, setFrom]   = useState("bash");
  const [toLang, setTo]       = useState("python");
  const [result, setResult]       = useState(null);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const abortRef = useRef(null);
  const runRef   = useRef(null);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["convert"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.code)     setCode(incoming.code);
    if (incoming.language) setFrom(incoming.language);
    consume("convert");
  }, [incoming]);

  const onVoiceResult = useCallback((text) => setCode(p => p ? `${p} ${text}` : text), []);
  const { recording, supported: voiceOk, toggle: toggleVoice } = useVoice(onVoiceResult);

  const swap = () => {
    setFrom(toLang);
    setTo(fromLang);
    setResult(null);
  };

  const convert = async () => {
    if (!code.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");
    try {
      for await (const chunk of streamRequest("/convert/stream",
        { code, from_lang: fromLang, to_lang: toLang },
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

  runRef.current = convert;
  useEffect(() => {
    if (!isActive) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isActive]);

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Script Converter</div>

        <div className="form-inline" style={{ alignItems: "flex-end" }}>
          <div className="form-row">
            <label>From</label>
            <select value={fromLang} onChange={(e) => setFrom(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <button
            className="btn btn-secondary btn-icon"
            style={{ marginBottom: 14, padding: "8px 12px", fontSize: 16 }}
            onClick={swap}
            title="Swap languages"
          >
            ⇄
          </button>
          <div className="form-row">
            <label>To</label>
            <select value={toLang} onChange={(e) => setTo(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>Source code</label>
          <CodeBlock code={code} language={fromLang} readOnly={false} onChange={setCode} height={240} />
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={convert} disabled={loading || !code.trim()}>
            {loading
              ? <><span className="spinner" /> Converting…</>
              : <>⇄ Convert <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>}
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
          <span className="panel-title" style={{ marginBottom: 0 }}>Converting…</span>
          <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: "auto" }}>
            {streamText.length.toLocaleString()} chars
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">Converted Code ({toLang})</div>
            <CodeBlock code={result.converted_code} language={toLang} readOnly />
            <SendTo code={result.converted_code} language={toLang} />
          </div>

          {result.notes?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Conversion Notes</div>
              <ul className="result-list">
                {result.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          {result.dependencies?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Required Dependencies</div>
              <ul className="result-list">
                {result.dependencies.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
