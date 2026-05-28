import { useState, useRef, useEffect, useCallback } from "react";
import { streamRequest } from "../api/client";
import OsProfileSelector from "../components/OsProfileSelector";
import CodeBlock from "../components/CodeBlock";
import useVoice from "../hooks/useVoice";

const CHEATSHEET_PARAMS = {
  Networking: {
    nmap:       { target: "192.168.1.0/24", flags: "-sV -sC", ports: "1-1000" },
    netstat:    { flags: "-tulpn" },
    ss:         { flags: "-tulpn" },
    curl:       { url: "https://example.com", method: "GET", headers: "" },
    wget:       { url: "https://example.com", output: "file.html" },
    ping:       { host: "8.8.8.8", count: "4" },
    traceroute: { host: "8.8.8.8" },
    ssh:        { user: "admin", host: "192.168.1.1", port: "22", key: "" },
    dig:        { domain: "example.com", type: "A", server: "" },
  },
  "File Operations": {
    find:  { path: ".", name: "*.log", type: "f", days: "7" },
    rsync: { src: "/src/", dst: "user@host:/dst/", flags: "-avz" },
    tar:   { action: "create", file: "archive.tar.gz", path: "." },
    chmod: { permissions: "755", target: "script.sh", recursive: false },
    chown: { owner: "user:group", target: "/var/www", recursive: true },
    grep:  { pattern: "ERROR", path: "/var/log", flags: "-rn", after: "2" },
    sed:   { find: "old", replace: "new", file: "file.txt", inplace: true },
    awk:   { field: "$1", separator: ":", file: "file.txt", condition: "" },
  },
  "System Admin": {
    systemctl:  { action: "status", service: "nginx" },
    journalctl: { unit: "nginx", lines: "100", follow: false },
    cron:       { schedule: "0 2 * * *", command: "/opt/backup.sh" },
    ps:         { flags: "aux", grep: "python" },
    kill:       { signal: "SIGTERM", pid: "1234" },
    df:         { flags: "-h", path: "/" },
    du:         { path: "/var", depth: "1" },
  },
  "Process & Performance": {
    top:    { interval: "2", user: "" },
    htop:   {},
    strace: { pid: "1234", output: "trace.log" },
    lsof:   { port: "8080" },
    iotop:  {},
  },
  Python: {
    requests:        { url: "https://api.example.com/data", method: "GET", headers: '{"Authorization": "Bearer TOKEN"}', timeout: "10" },
    "pandas read":   { file: "data.csv", sep: ",", encoding: "utf-8", nrows: "" },
    "pandas filter": { dataframe: "df", column: "age", operator: ">", value: "30" },
    "pandas groupby":{ dataframe: "df", column: "category", agg: "sum" },
    regex:           { pattern: "\\d{3}-\\d{4}", string: "text", flags: "re.IGNORECASE" },
    "file read":     { path: "file.txt", mode: "r", encoding: "utf-8" },
    "file write":    { path: "output.txt", mode: "w", encoding: "utf-8" },
    "list comprehension": { expression: "x * 2", iterable: "range(10)", condition: "x % 2 == 0" },
    "dict comprehension": { key: "k", value: "v.upper()", iterable: "my_dict.items()" },
    subprocess:      { command: "ls -la", capture: true, shell: false },
  },
  PowerShell: {
    "Get-Process":       { name: "", id: "", sortBy: "CPU" },
    "Get-Service":       { name: "wuauserv", status: "Running" },
    "Invoke-WebRequest": { uri: "https://example.com", method: "GET", outFile: "output.html" },
    "Get-EventLog":      { logName: "System", newest: "50", entryType: "Error" },
    "Set-ExecutionPolicy":{ policy: "RemoteSigned", scope: "CurrentUser" },
    "Get-ChildItem":     { path: "C:\\Users", filter: "*.log", recurse: true },
    "Where-Object":      { property: "Status", operator: "-eq", value: "Running" },
    "Select-Object":     { properties: "Name,CPU,Id", first: "10" },
    "Export-Csv":        { inputObject: "$processes", path: "out.csv", noTypeInfo: true },
    "Start-Job":         { scriptBlock: "Get-Process", name: "MyJob" },
  },
  JavaScript: {
    fetch:          { url: "https://api.example.com/data", method: "GET", body: "", headers: '{"Content-Type":"application/json"}' },
    "async/await":  { functionName: "fetchData", url: "https://api.example.com", errorHandling: true },
    "array.map":    { array: "items", transform: "item => item.name" },
    "array.filter": { array: "items", condition: "item => item.active === true" },
    "array.reduce": { array: "numbers", accumulator: "sum", initial: "0", expression: "sum + num" },
    "Promise.all":  { promises: "fetch(url1), fetch(url2), fetch(url3)" },
    "localStorage": { action: "setItem", key: "user", value: '{"name":"Alice"}' },
    "EventListener":{ element: "document", event: "click", selector: ".btn" },
    regex:          { pattern: "\\d+", flags: "gi", string: "text123" },
    "setTimeout":   { delay: "1000", repeat: false },
  },
  SQL: {
    SELECT:        { table: "users", columns: "id, name, email", where: "active = 1", orderBy: "name ASC", limit: "100" },
    "SELECT JOIN": { table1: "orders", table2: "users", joinType: "INNER", on: "orders.user_id = users.id", columns: "*" },
    INSERT:        { table: "users", columns: "name, email, role", values: "'Alice', 'alice@example.com', 'admin'" },
    UPDATE:        { table: "users", set: "status = 'inactive'", where: "last_login < '2024-01-01'" },
    DELETE:        { table: "users", where: "id = 42" },
    "CREATE TABLE":{ table: "products", columns: "id INT PRIMARY KEY, name VARCHAR(255), price DECIMAL(10,2)" },
    "CREATE INDEX":{ index: "idx_email", table: "users", column: "email", unique: true },
    "GROUP BY":    { table: "orders", groupCol: "status", aggFunc: "COUNT(*)", having: "COUNT(*) > 5" },
    "EXPLAIN":     { query: "SELECT * FROM users WHERE email = 'x@example.com'" },
  },
  "Security / Kali": {
    sqlmap:     { url: "http://target/page?id=1", level: "3", risk: "2" },
    nikto:      { host: "http://target.com", port: "80" },
    hydra:      { host: "192.168.1.1", service: "ssh", user: "admin", wordlist: "/usr/share/wordlists/rockyou.txt" },
    gobuster:   { url: "http://target.com", wordlist: "/usr/share/wordlists/dirb/common.txt", threads: "20" },
    msfconsole: { module: "exploit/multi/handler", payload: "linux/x64/meterpreter/reverse_tcp" },
    netcat:     { mode: "listen", port: "4444" },
    openssl:    { action: "genrsa", bits: "4096", output: "private.key" },
  },
  Docker: {
    "docker run":     { image: "nginx", name: "web", ports: "80:80", detach: true },
    "docker exec":    { container: "web", command: "bash", interactive: true },
    "docker logs":    { container: "web", follow: true, tail: "100" },
    "docker build":   { tag: "myapp:latest", context: ".", dockerfile: "Dockerfile" },
    "docker-compose": { action: "up", flags: "-d --build" },
  },
  Git: {
    "git log":    { format: "oneline", n: "20", author: "" },
    "git diff":   { from: "HEAD~1", to: "HEAD", file: "" },
    "git stash":  { action: "push", message: "WIP" },
    "git rebase": { onto: "main", interactive: true },
    "git bisect": { bad: "HEAD", good: "v1.0.0" },
    "git cherry-pick": { commit: "abc1234" },
  },
};

const CATEGORIES = Object.keys(CHEATSHEET_PARAMS);

export default function CheatSheetsTab({ isActive = false }) {
  const [category, setCategory]   = useState(CATEGORIES[0]);
  const [command, setCommand]     = useState(Object.keys(CHEATSHEET_PARAMS[CATEGORIES[0]])[0]);
  const [osProfile, setOsProfile] = useState("linux");
  const [params, setParams]       = useState({});
  const [result, setResult]         = useState(null);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const abortRef = useRef(null);
  const runRef   = useRef(null);
  const [focusedParam, setFocusedParam] = useState(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onVoiceResult = useCallback((text) => {
    if (!focusedParam) return;
    setParams(p => ({ ...p, [focusedParam]: p[focusedParam] ? `${p[focusedParam]} ${text}` : text }));
  }, [focusedParam]);
  const { recording, supported: voiceOk, toggle: toggleVoice } = useVoice(onVoiceResult);

  const selectCategory = (cat) => {
    setCategory(cat);
    const firstCmd = Object.keys(CHEATSHEET_PARAMS[cat])[0];
    setCommand(firstCmd);
    setParams({});
    setResult(null);
    setFocusedParam(null);
  };

  const selectCommand = (cmd) => {
    setCommand(cmd);
    setParams({});
    setResult(null);
    setFocusedParam(null);
  };

  const currentDefaults = CHEATSHEET_PARAMS[category]?.[command] || {};
  const mergedParams = { ...currentDefaults, ...params };

  const build = async () => {
    if (loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");
    try {
      for await (const chunk of streamRequest("/cheatsheet/stream",
        { category, command, params: mergedParams, os_profile: osProfile },
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

  runRef.current = build;
  useEffect(() => {
    if (!isActive) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isActive]);

  const commands = Object.keys(CHEATSHEET_PARAMS[category] || {});

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Cheat Sheet Builder</div>

        <OsProfileSelector value={osProfile} onChange={setOsProfile} />

        <div className="form-row">
          <label>Category</label>
          <div className="cheat-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`cheat-chip${category === c ? " active" : ""}`}
                onClick={() => selectCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>Command / Tool</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {commands.map((cmd) => (
              <button
                key={cmd}
                className={`os-chip${command === cmd ? " active" : ""}`}
                onClick={() => selectCommand(cmd)}
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        {Object.keys(currentDefaults).length > 0 && (
          <div className="form-row">
            <label>Parameters</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(currentDefaults).map(([key, def]) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {key}
                    {voiceOk && focusedParam === key && (
                      <span style={{ fontSize: 9, color: "var(--green-dim)", letterSpacing: 1 }}>● focused</span>
                    )}
                  </label>
                  <input
                    value={mergedParams[key] ?? ""}
                    onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
                    onFocus={() => setFocusedParam(key)}
                    placeholder={String(def)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="btn-group">
          <button className="btn btn-primary" onClick={build} disabled={loading}>
            {loading
              ? <><span className="spinner" /> Building…</>
              : <>⚙ Build Command <span style={{ color: "var(--green-dim)", fontSize: 10, marginLeft: 6 }}>Ctrl+↵</span></>}
          </button>
          {voiceOk && (
            <button
              className={`btn btn-voice${recording ? " recording" : ""}`}
              onClick={toggleVoice}
              title={focusedParam ? `Dictate into "${focusedParam}"` : "Focus a parameter field first"}
              disabled={!focusedParam}
            >
              {recording ? "⏹ Stop" : "🎤 Voice"}
            </button>
          )}
          {loading && (
            <button className="btn btn-danger btn-icon" onClick={() => abortRef.current?.abort()}>
              ✕ Cancel
            </button>
          )}
        </div>
        {voiceOk && !focusedParam && (
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
            Click a parameter field to enable voice input for it.
          </p>
        )}

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
          <span className="panel-title" style={{ marginBottom: 0 }}>Building…</span>
          <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: "auto" }}>
            {streamText.length.toLocaleString()} chars
          </span>
        </div>
      )}

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">Command</div>
            <CodeBlock code={result.command_string} language="shell" readOnly height={80} />
            {result.explanation && (
              <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>{result.explanation}</p>
            )}
          </div>

          {result.examples?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Examples</div>
              <ul className="result-list">
                {result.examples.map((ex, i) => <li key={i}>{ex}</li>)}
              </ul>
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div className="panel">
              <div className="panel-title">Warnings</div>
              <ul className="result-list">
                {result.warnings.map((w, i) => <li key={i} className="danger">✕ {w}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
