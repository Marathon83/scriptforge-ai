import { useState, useRef } from "react";
import { debugScript } from "../api/client";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";

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
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const fileRef = useRef();

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

  const onDrop = (e) => {
    e.preventDefault();
    handleImage(e.dataTransfer.files[0]);
  };

  const debug = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await debugScript({
        code,
        error: errorText,
        language,
        os_profile: osProfile,
        screenshot_b64: shotB64,
        image_type: shotType,
      });
      setResult(data);
    } catch {
      setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleImage(e.target.files[0])}
          />
          {screenshot && (
            <button className="btn btn-danger btn-icon mt-8" onClick={() => { setShot(null); setShotB64(""); }}>
              Remove screenshot
            </button>
          )}
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={debug} disabled={loading || !code.trim()}>
            {loading ? <><span className="spinner" /> Debugging…</> : "🔍 Debug"}
          </button>
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

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
