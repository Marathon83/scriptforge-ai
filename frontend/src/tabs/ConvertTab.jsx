import { useState } from "react";
import { convertScript } from "../api/client";
import CodeBlock from "../components/CodeBlock";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go", "zsh"];

export default function ConvertTab() {
  const [code, setCode]         = useState("");
  const [fromLang, setFrom]     = useState("bash");
  const [toLang, setTo]         = useState("python");
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const convert = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await convertScript({ code, from_lang: fromLang, to_lang: toLang }));
    } catch {
      setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Script Converter</div>

        <div className="form-inline">
          <div className="form-row">
            <label>From</label>
            <select value={fromLang} onChange={(e) => setFrom(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", paddingTop: 22, color: "var(--green)" }}>→</div>
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
            {loading ? <><span className="spinner" /> Converting…</> : "⇄ Convert"}
          </button>
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">Converted Code ({toLang})</div>
            <CodeBlock code={result.converted_code} language={toLang} readOnly />
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
