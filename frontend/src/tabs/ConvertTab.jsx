import { useState, useRef, useEffect } from "react";
import { convertScript } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import CodeBlock from "../components/CodeBlock";
import SendTo from "../components/SendTo";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go", "zsh"];

export default function ConvertTab() {
  const [code, setCode]       = useState("");
  const [fromLang, setFrom]   = useState("bash");
  const [toLang, setTo]       = useState("python");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const runRef = useRef(null);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["convert"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.code)     setCode(incoming.code);
    if (incoming.language) setFrom(incoming.language);
    consume("convert");
  }, [incoming]);

  const swap = () => {
    setFrom(toLang);
    setTo(fromLang);
    setResult(null);
  };

  const convert = async () => {
    if (!code.trim() || loading) return;
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

  runRef.current = convert;
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

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
