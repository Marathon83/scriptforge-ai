import { useState, useRef, useEffect } from "react";
import { streamRequest } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";
import SendTo from "../components/SendTo";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go"];

export default function DebugTab() {
  const [code, setCode]           = useState("");
  const [errorText, setErrorText] = useState("");
  const [osProfile, setOsProfile] = useState("linux");
  const [language, setLanguage]   = useState("bash");
  const [screenshot, setShot]     = useState(null);
  const [shotB64, setShotB64]     = useState("");
  const [shotType, setShotType]   = useState("image/png");
  const [result, setResult]       = useState(null);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const fileRef  = useRef();
  const abortRef = useRef(null);
  const runRef   = useRef(null);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["debug"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.code)     setCode(incoming.code);
    if (incoming.language) setLanguage(incoming.language);
    if (incoming.error)    setErrorText(incoming.error);
    consume("debug");
  }, [incoming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleImage = (file) => {
    if (!file) return;
    setShotType(file.type || "image/png");
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setShot(dataUrl);
      setShotB64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => { e.preventDefault(); handleImage(e.dataTransfer.files[0]); };

  const debug = async () => {
    if (!code.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");
    try {
      for await (const chunk of streamRequest("/debug/stream", {
        code, error: errorText, language, os_profile: osProfile,
        screenshot_b64: shotB64, image_type: shotType,
      }, abortRef.current.signal)) {
        if (chunk.error) { setError(chunk.error); break; }
        if (chunk.done)  { setResult(chunk.result); setStreamText(""); }
        else             { setStreamText(prev => prev + chunk.text); }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

  runRef.current = debug;
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div>
      <div className="panel">
        <div className="panel-title">AI Debugger</div>

        <OsProfileSelector value={osProfile} onChange={setOsProfile} />

        <div className="form-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "auto" }}>
            {LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>Code to debug</label>
          <CodeBlock code={code} language={language} readOnly={false} onChange={setCode} height={240} />
        </div>

        <div className="form-row">
          <label>Error output (optional)</label>
          <textarea
            rows={4}
            value={errorText}
            onChange={(e) => setErrorText(e.target.value)}
            placeholder="Paste error message or stack trace here..."
          />
        </div>

        <div className="form-row">
          <label>Screenshot (optional)</label>
          <div
            className="screenshot-zone"
            onClick={() => fileRef.current.click()}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {screenshot
              ? <img src={screenshot} alt="error screenshot" className="screenshot-preview" />
              : "Click or drag & drop an error screenshot"}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => handleImage(e.target.files[0])} />
          {screenshot && (
            <button className="btn btn-danger btn-icon mt-8" onClick={() => { setShot(null); setShotB64(""); }}>
              Remove screenshot
            </button>
          )}
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={debug} disabled={loading || !code.trim()}>
            {loading
              ? <><span className="spinner" /> Debugging…</>
              : <>🔍 Debug <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>}
          </button>
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

      {streamText && (
        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="spinner" style={{ flexShrink: 0 }} />
            <span className="panel-title" style={{ marginBottom: 0 }}>Debugging…</span>
          </div>
          <pre style={{ fontSize: 11, color: "var(--text-dim)", maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {streamText}
          </pre>
        </div>
      )}

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">Root Cause</div>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{result.explanation}</p>
            {result.why_it_occurred && (
              <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 8, color: "var(--text-dim)" }}>
                {result.why_it_occurred}
              </p>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">Fixed Code</div>
            <CodeBlock code={result.fixed_code} language={language} readOnly />
            <SendTo code={result.fixed_code} language={language} />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {result.problematic_lines?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Problematic Lines</div>
                <ul className="result-list">
                  {result.problematic_lines.map((l, i) => <li key={i} className="warn">{l}</li>)}
                </ul>
              </div>
            )}
            {result.prevention_tips?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Prevention Tips</div>
                <ul className="result-list">
                  {result.prevention_tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
            {result.security_flags?.length > 0 && (
              <div className="panel" style={{ flex: 1 }}>
                <div className="panel-title">Security Issues</div>
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
