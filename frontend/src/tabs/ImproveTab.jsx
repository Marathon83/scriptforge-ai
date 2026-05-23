import { useState, useRef, useEffect } from "react";
import { improveScript } from "../api/client";
import { useTabCtx } from "../context/TabContext";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";
import SendTo from "../components/SendTo";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go"];

const MODES = [
  { id: "simplify",   label: "Simplify",    desc: "Shorter, cleaner, less redundancy" },
  { id: "comments",   label: "Add Comments", desc: "Thorough explanatory comments" },
  { id: "production", label: "Production",   desc: "Error handling, logging, best practices" },
  { id: "beginner",   label: "Beginner",     desc: "Verbose names, heavy comments" },
];

export default function ImproveTab() {
  const [code, setCode]           = useState("");
  const [mode, setMode]           = useState("simplify");
  const [osProfile, setOsProfile] = useState("linux");
  const [language, setLanguage]   = useState("bash");
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const runRef = useRef(null);

  const { inbox, consume } = useTabCtx();
  const incoming = inbox["improve"];
  useEffect(() => {
    if (!incoming) return;
    if (incoming.code)     setCode(incoming.code);
    if (incoming.language) setLanguage(incoming.language);
    consume("improve");
  }, [incoming]);

  const improve = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await improveScript({ code, mode, language, os_profile: osProfile }));
    } catch {
      setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

  runRef.current = improve;
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

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
