import { useState } from "react";
import { tutorCode } from "../api/client";
import CodeBlock from "../components/CodeBlock";

const LANGS = ["bash", "powershell", "python", "javascript", "ruby", "go", "sql"];

const CONCEPTS_COLOR = {
  "variable":        "var(--green)",
  "loop":            "var(--amber)",
  "function call":   "#7b9fff",
  "conditional":     "#cc88ff",
  "pipe":            "var(--green-dim)",
  "redirection":     "var(--amber)",
  "array":           "#ff9966",
  "string":          "var(--green)",
  "import":          "#7b9fff",
  "error handling":  "var(--red)",
};

function ConceptTag({ concept }) {
  const color = Object.entries(CONCEPTS_COLOR).find(([k]) =>
    concept.toLowerCase().includes(k)
  )?.[1] || "var(--text-dim)";
  return (
    <span style={{
      background: `${color}18`, border: `1px solid ${color}44`,
      borderRadius: 3, color, fontSize: 10, letterSpacing: 1,
      padding: "2px 6px", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      {concept}
    </span>
  );
}

export default function TutorTab() {
  const [code, setCode]       = useState("");
  const [language, setLang]   = useState("bash");
  const [level, setLevel]     = useState("beginner");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const explain = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await tutorCode({ code, language, level }));
    } catch {
      setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">AI Tutor</div>

        <div className="form-inline">
          <div className="form-row">
            <label>Language</label>
            <select value={language} onChange={(e) => setLang(e.target.value)} style={{ width: "auto" }}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Level</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["beginner", "intermediate"].map((lv) => (
                <button
                  key={lv}
                  className={`os-chip${level === lv ? " active" : ""}`}
                  onClick={() => setLevel(lv)}
                >
                  {lv}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-row">
          <label>Paste code to learn from</label>
          <CodeBlock code={code} language={language} readOnly={false} onChange={setCode} height={220} />
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={explain} disabled={loading || !code.trim()}>
            {loading ? <><span className="spinner" /> Analyzing…</> : "🎓 Explain This"}
          </button>
        </div>

        {error && <div className="error-msg mt-12">{error}</div>}
      </div>

      {result && (
        <>
          {/* Title + overview */}
          <div className="panel">
            <div className="panel-title">{result.title}</div>
            <p style={{ fontSize: 13, lineHeight: 1.8 }}>{result.overview}</p>
          </div>

          {/* Annotated line-by-line */}
          {result.annotated_lines?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Line-by-Line Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.annotated_lines.map((item, i) => (
                  <div key={i} style={{
                    background: "var(--bg3)", borderRadius: 4,
                    border: "1px solid var(--border)", overflow: "hidden",
                  }}>
                    {/* code line */}
                    <div style={{
                      background: "#0d0d0d", borderBottom: "1px solid var(--border)",
                      padding: "6px 12px", display: "flex", alignItems: "center",
                      justifyContent: "space-between", gap: 8,
                    }}>
                      <code style={{ color: "var(--green)", fontSize: 12, fontFamily: "var(--font-mono)", flex: 1 }}>
                        {item.code}
                      </code>
                      {item.concept && <ConceptTag concept={item.concept} />}
                    </div>
                    {/* explanation */}
                    <div style={{ padding: "8px 12px", fontSize: 13, lineHeight: 1.7, color: "var(--text)" }}>
                      {item.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom panels row */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {result.key_concepts?.length > 0 && (
              <div className="panel" style={{ flex: 1, minWidth: 220 }}>
                <div className="panel-title">Key Concepts</div>
                <ul className="result-list">
                  {result.key_concepts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {result.common_mistakes?.length > 0 && (
              <div className="panel" style={{ flex: 1, minWidth: 220 }}>
                <div className="panel-title">Common Mistakes</div>
                <ul className="result-list">
                  {result.common_mistakes.map((m, i) => <li key={i} className="warn">⚠ {m}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {result.exercises?.length > 0 && (
              <div className="panel" style={{ flex: 1, minWidth: 220 }}>
                <div className="panel-title">Practice Exercises</div>
                <ol className="result-list">
                  {result.exercises.map((ex, i) => <li key={i}>{ex}</li>)}
                </ol>
              </div>
            )}
            {result.next_steps?.length > 0 && (
              <div className="panel" style={{ flex: 1, minWidth: 220 }}>
                <div className="panel-title">What to Learn Next</div>
                <ul className="result-list">
                  {result.next_steps.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
