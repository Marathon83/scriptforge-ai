import { useState } from "react";
import { analyzeScript } from "../api/client";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";

export default function AnalyzeTab() {
  const [code, setCode]           = useState("");
  const [osProfile, setOsProfile] = useState("linux");
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const analyze = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await analyzeScript({ code, os_profile: osProfile }));
    } catch {
      setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Reverse Analyzer</div>

        <OsProfileSelector value={osProfile} onChange={setOsProfile} />

        <div className="form-row">
          <label>Paste script to analyze</label>
          <CodeBlock code={code} language="shell" readOnly={false} onChange={setCode} height={260} />
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={analyze} disabled={loading || !code.trim()}>
            {loading ? <><span className="spinner" /> Analyzing…</> : "🔬 Analyze"}
          </button>
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">Summary</div>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{result.summary}</p>
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
