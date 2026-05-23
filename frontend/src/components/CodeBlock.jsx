import { useState } from "react";
import Editor from "@monaco-editor/react";

const PASTE_RUNNERS = {
  bash: "bash", shell: "bash", zsh: "zsh", sh: "bash",
  python: "python3", javascript: "node", ruby: "ruby",
};

const MONACO_LANG = {
  bash: "shell", shell: "shell", powershell: "powershell",
  python: "python", javascript: "javascript", ruby: "ruby",
  go: "go", rust: "rust", sql: "sql",
};

function unescape(src) {
  if (src.includes("\\n") && !src.includes("\n")) {
    return src
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return src;
}

export default function CodeBlock({ code, language = "shell", readOnly = true, onChange, height = 320 }) {
  const [copied, setCopied]         = useState(false);
  const [pastecopied, setPasteCopied] = useState(false);

  const pasteRunner = PASTE_RUNNERS[language] || null;

  const copy = () => {
    navigator.clipboard.writeText(code || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const copyForPaste = () => {
    const src  = unescape(code || "");
    const safe = `${pasteRunner} << 'SFEOF'\n${src}\nSFEOF`;
    navigator.clipboard.writeText(safe).then(() => {
      setPasteCopied(true);
      setTimeout(() => setPasteCopied(false), 1500);
    });
  };

  const download = () => {
    const ext = { bash: "sh", shell: "sh", powershell: "ps1", python: "py", javascript: "js" }[language] || "txt";
    const blob = new Blob([unescape(code || "")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `script.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  const toolbar = (
    <div className="code-block-toolbar">
      <span className="code-block-lang">{language}</span>
      <div className="code-block-actions">
        <button className="btn btn-secondary btn-icon" onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
        {pasteRunner && (
          <button
            className="btn btn-secondary btn-icon"
            onClick={copyForPaste}
            title={`${pasteRunner} << 'SFEOF' — safe to paste into zsh`}
          >
            {pastecopied ? "✓ Ready" : "Copy (paste-safe)"}
          </button>
        )}
        <button className="btn btn-secondary btn-icon" onClick={download}>⬇ Save</button>
      </div>
    </div>
  );

  // Editable: plain textarea — reliable paste, no controlled-value conflicts
  if (!readOnly) {
    return (
      <div className="code-block-wrap">
        {toolbar}
        <textarea
          value={code || ""}
          onChange={(e) => onChange && onChange(e.target.value)}
          spellCheck={false}
          style={{
            background: "#1e1e1e",
            border: "none",
            borderRadius: 0,
            color: "#d4d4d4",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 13,
            height,
            lineHeight: 1.5,
            outline: "none",
            padding: "12px 16px",
            resize: "vertical",
            width: "100%",
          }}
          placeholder="Paste your code here…"
        />
      </div>
    );
  }

  // Read-only: Monaco with full syntax highlighting
  return (
    <div className="code-block-wrap">
      {toolbar}
      <Editor
        height={height}
        language={MONACO_LANG[language] || "shell"}
        value={unescape(code || "")}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      />
    </div>
  );
}
