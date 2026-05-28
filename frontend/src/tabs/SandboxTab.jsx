import { useState, useRef, useEffect, useCallback } from "react";
import { streamRequest } from "../api/client";
import CodeBlock from "../components/CodeBlock";
import useVoice from "../hooks/useVoice";

const LANGS = ["bash", "python", "javascript", "ruby"];
const MAX_HISTORY = 5;

const EXAMPLES = {
  bash: `#!/bin/sh
echo "=== System Info ==="
echo "Hostname: $(hostname)"
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo ""
echo "=== Files in /tmp ==="
ls /tmp 2>/dev/null || echo "(empty)"
echo ""
echo "=== Math ==="
echo $((6 * 7))`,

  python: `import sys, platform, math

print(f"Python {sys.version}")
print(f"Platform: {platform.system()}")
print()

# fibonacci
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        print(a, end=" ")
        a, b = b, a + b
    print()

print("Fibonacci(10):")
fib(10)
print(f"\\nπ ≈ {math.pi:.10f}")`,

  javascript: `const os = require('os');

console.log('Node.js', process.version);
console.log('Platform:', os.platform());
console.log('CPUs:', os.cpus().length);
console.log();

// async example
async function fetchSequence(n) {
  const results = [];
  for (let i = 1; i <= n; i++) {
    await new Promise(r => setTimeout(r, 0));
    results.push(i * i);
  }
  return results;
}

fetchSequence(8).then(sq => {
  console.log('Squares:', sq.join(', '));
});`,

  ruby: `puts "Ruby #{RUBY_VERSION}"
puts "Platform: #{RUBY_PLATFORM}"
puts

# Fibonacci
def fib(n)
  a, b = 0, 1
  n.times { print "#{a} "; a, b = b, a + b }
  puts
end

puts "Fibonacci(10):"
fib(10)

puts "\\nSquares 1-8: #{(1..8).map { |x| x**2 }.join(', ')}"`,
};

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn btn-secondary btn-icon"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        })
      }
    >
      {ok ? "✓" : "Copy"}
    </button>
  );
}

function TerminalOutput({ stdout, stderr, exitCode, durationMs, killed }) {
  const hasOutput = stdout || stderr;
  if (!hasOutput) return null;

  const combined = [stdout, stderr].filter(Boolean).join("\n");

  return (
    <div style={{
      background: "#050505", border: "1px solid var(--border)", borderRadius: 4,
      fontFamily: "var(--font-mono)", fontSize: 13, overflow: "hidden",
    }}>
      <div style={{
        background: "var(--bg3)", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px",
      }}>
        <span style={{ color: "var(--text-dim)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          Output
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}>
          <CopyBtn text={combined} />
          <span style={{ color: "var(--text-dim)" }}>{durationMs}ms</span>
          <span style={{
            padding: "2px 8px", borderRadius: 3,
            background: killed ? "rgba(255,51,51,0.15)" : exitCode === 0 ? "rgba(0,255,65,0.1)" : "rgba(255,179,0,0.1)",
            border: `1px solid ${killed ? "var(--red)" : exitCode === 0 ? "var(--green-dim)" : "var(--amber)"}`,
            color: killed ? "var(--red)" : exitCode === 0 ? "var(--green)" : "var(--amber)",
          }}>
            {killed ? "KILLED (timeout)" : `exit ${exitCode}`}
          </span>
        </div>
      </div>

      {stdout && (
        <pre style={{
          color: "var(--green)", margin: 0, padding: "12px 16px",
          whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 400, overflowY: "auto",
        }}>
          {stdout}
        </pre>
      )}

      {stderr && (
        <pre style={{
          color: "var(--amber)", margin: 0,
          padding: stdout ? "0 16px 12px" : "12px 16px",
          borderTop: stdout ? "1px solid var(--border)" : "none",
          whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflowY: "auto",
        }}>
          {stderr}
        </pre>
      )}
    </div>
  );
}

function HistoryRow({ item, onRestore }) {
  const [open, setOpen] = useState(false);
  const { code, lang, result, ts } = item;
  const preview = (code.split("\n").find(l => l.trim()) || code).slice(0, 58);
  const ok = !result.blocked && !result.killed && result.exit_code === 0;
  const statusColor = result.blocked
    ? "var(--red)"
    : result.killed
    ? "var(--red)"
    : ok
    ? "var(--green)"
    : "var(--amber)";
  const statusText = result.blocked
    ? "blocked"
    : result.killed
    ? "killed"
    : `exit ${result.exit_code}`;

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
        onMouseLeave={e => (e.currentTarget.style.background = "")}
      >
        <span style={{ color: "var(--text-dim)", fontSize: 11, minWidth: 68, flexShrink: 0 }}>{ts}</span>
        <span style={{
          background: "var(--green-faint)", border: "1px solid var(--green-dim)",
          borderRadius: 3, color: "var(--green)", fontSize: 10, letterSpacing: 1,
          padding: "1px 7px", textTransform: "uppercase", flexShrink: 0,
        }}>
          {lang}
        </span>
        <span style={{
          flex: 1, color: "var(--text-dim)", fontSize: 12,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {preview}
        </span>
        <span style={{ color: statusColor, fontSize: 11, flexShrink: 0 }}>{statusText}</span>
        <button
          className="btn btn-secondary btn-icon"
          style={{ fontSize: 10, padding: "2px 8px", flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onRestore(code, lang); }}
        >
          Restore
        </button>
        <span style={{ color: "var(--text-dim)", fontSize: 10, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <TerminalOutput
            stdout={result.stdout}
            stderr={result.stderr}
            exitCode={result.exit_code}
            durationMs={result.duration_ms}
            killed={result.killed}
          />
        </div>
      )}
    </div>
  );
}

export default function SandboxTab({ isActive = false }) {
  const [lang, setLang]           = useState("bash");
  const [code, setCode]           = useState(EXAMPLES.bash);
  const [timeout_, setTimeout_]   = useState(15);
  const [stdin, setStdin]         = useState("");
  const [showStdin, setShowStdin] = useState(false);
  const [result, setResult]         = useState(null);
  const [liveOutput, setLiveOutput] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [history, setHistory]       = useState([]);

  const abortRef  = useRef(null);
  const stdoutRef = useRef("");

  const onVoiceResult = useCallback((text) => {
    setStdin(p => p ? `${p} ${text}` : text);
    setShowStdin(true);
  }, []);
  const { recording, supported: voiceOk, toggle: toggleVoice } = useVoice(onVoiceResult);

  useEffect(() => () => abortRef.current?.abort(), []);

  const switchLang = (l) => {
    setLang(l);
    setCode(EXAMPLES[l] || "");
    setResult(null);
  };

  const run = async () => {
    if (!code.trim() || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setLiveOutput("");
    stdoutRef.current = "";
    try {
      for await (const chunk of streamRequest(
        "/sandbox/stream",
        { code, language: lang, timeout: timeout_, stdin },
        abortRef.current.signal
      )) {
        if (chunk.error)   { setError(chunk.error); break; }
        if (chunk.blocked) {
          const data = { blocked: true, block_reason: chunk.block_reason, stdout: "", stderr: "", exit_code: -1, duration_ms: 0, killed: false, warnings: [] };
          setResult(data);
          break;
        }
        if (chunk.stdout_chunk) {
          stdoutRef.current += chunk.stdout_chunk;
          setLiveOutput(stdoutRef.current);
        }
        if (chunk.done) {
          const data = {
            blocked: false, block_reason: "",
            stdout: stdoutRef.current,
            stderr: chunk.stderr,
            exit_code: chunk.exit_code,
            duration_ms: chunk.duration_ms,
            killed: chunk.killed,
            warnings: chunk.warnings || [],
          };
          setResult(data);
          setLiveOutput("");
          setHistory(prev =>
            [{ code, lang, result: data, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, MAX_HISTORY)
          );
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError("Backend error — is the server running?");
    }
    setLoading(false);
  };

  // keep a stable ref so the keydown effect doesn't need to re-register
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!isActive) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive]);

  const restore = (c, l) => {
    setCode(c);
    setLang(l);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <div className="panel">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>Live Sandbox</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span className="sec-badge low">Docker isolated</span>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>no network · 128 MB · 0.5 CPU</span>
          </div>
        </div>

        <div className="form-inline" style={{ marginBottom: 14 }}>
          <div className="form-row">
            <label>Language</label>
            <div style={{ display: "flex", gap: 6 }}>
              {LANGS.map((l) => (
                <button key={l} className={`os-chip${lang === l ? " active" : ""}`} onClick={() => switchLang(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row" style={{ minWidth: 180 }}>
            <label>Timeout — {timeout_}s</label>
            <input
              type="range" min={3} max={30} value={timeout_}
              onChange={(e) => setTimeout_(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--green)" }}
            />
          </div>
        </div>

        <div className="form-row">
          <label>Code</label>
          <CodeBlock code={code} language={lang} readOnly={false} onChange={setCode} height={280} />
        </div>

        <div className="form-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ marginBottom: 0 }}>Stdin</label>
            <button
              className={`os-chip${showStdin ? " active" : ""}`}
              style={{ fontSize: 10, padding: "2px 8px" }}
              onClick={() => setShowStdin(s => !s)}
            >
              {showStdin ? "hide" : "show"}
            </button>
            {stdin && !showStdin && (
              <span style={{ color: "var(--amber)", fontSize: 11 }}>● has input</span>
            )}
          </div>
          {showStdin && (
            <textarea
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              placeholder="Optional stdin — text passed to the script's standard input"
              style={{ minHeight: 70, marginTop: 6 }}
              spellCheck={false}
            />
          )}
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={run} disabled={loading || !code.trim()}>
            {loading ? (
              <><span className="spinner" /> Running…</>
            ) : (
              <>▶ Run in Sandbox <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>
            )}
          </button>
          {voiceOk && (
            <button className={`btn btn-voice${recording ? " recording" : ""}`} onClick={toggleVoice} title="Dictate stdin">
              {recording ? "⏹ Stop" : "🎤 Stdin"}
            </button>
          )}
          {loading && (
            <button className="btn btn-danger btn-icon" onClick={() => abortRef.current?.abort()}>
              ✕ Cancel
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => { setCode(EXAMPLES[lang] || ""); setResult(null); }}>
            Reset Example
          </button>
          {result && (
            <button className="btn btn-secondary" onClick={() => setResult(null)}>
              Clear Output
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

      {liveOutput && (
        <div style={{
          background: "#050505", border: "1px solid var(--border)", borderRadius: 4,
          fontFamily: "var(--font-mono)", fontSize: 13, overflow: "hidden",
        }}>
          <div style={{
            background: "var(--bg3)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
          }}>
            <span className="spinner" style={{ flexShrink: 0 }} />
            <span style={{ color: "var(--text-dim)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
              Live Output
            </span>
          </div>
          <pre style={{
            color: "var(--green)", margin: 0, padding: "12px 16px",
            whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 400, overflowY: "auto",
          }}>
            {liveOutput}
          </pre>
        </div>
      )}

      {result && (
        <>
          {result.blocked && (
            <div className="panel" style={{ borderColor: "var(--red)" }}>
              <div className="panel-title" style={{ color: "var(--red)" }}>Blocked</div>
              <p style={{ color: "var(--red)", fontSize: 13 }}>✕ {result.block_reason}</p>
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div className="panel" style={{ borderColor: "var(--amber)" }}>
              <div className="panel-title" style={{ color: "var(--amber)" }}>Security Notes</div>
              <ul className="result-list">
                {result.warnings.map((w, i) => <li key={i} className="warn">⚠ {w}</li>)}
              </ul>
            </div>
          )}

          {!result.blocked && (
            <TerminalOutput
              stdout={result.stdout}
              stderr={result.stderr}
              exitCode={result.exit_code}
              durationMs={result.duration_ms}
              killed={result.killed}
            />
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="panel-title" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
            Run History
          </div>
          {history.map((item, i) => (
            <HistoryRow key={i} item={item} onRestore={restore} />
          ))}
        </div>
      )}
    </div>
  );
}
