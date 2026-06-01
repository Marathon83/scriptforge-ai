export default function AboutModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">ScriptForge AI — Feature Overview</div>

        <div className="about-section">
          <div className="about-heading">Installation</div>

          <div className="about-install-step">
            <span className="about-step-label">1. Prerequisites</span>
            <ul style={{ marginTop: 6 }}>
              <li>Python 3.11+</li>
              <li>Node.js 18+</li>
              <li>Docker (for Sandbox tab)</li>
              <li>An <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="about-link">Anthropic API key</a></li>
            </ul>
          </div>

          <div className="about-install-step">
            <span className="about-step-label">2. Clone the repo</span>
            <pre className="about-code">{`git clone https://github.com/Marathon83/scriptforge-ai.git\ncd scriptforge-ai`}</pre>
          </div>

          <div className="about-install-step">
            <span className="about-step-label">3. Start the backend</span>
            <pre className="about-code">{`cd backend\npython3 -m venv venv\nsource venv/bin/activate   # Windows: venv\\Scripts\\activate\npip install -r requirements.txt\nuvicorn app:app --host 127.0.0.1 --port 8000`}</pre>
          </div>

          <div className="about-install-step">
            <span className="about-step-label">4. Start the frontend</span>
            <pre className="about-code">{`cd frontend\nnpm install\nnpm run dev`}</pre>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Open <strong style={{ color: "var(--text)" }}>http://localhost:5173</strong> — enter your Anthropic API key when prompted.</span>
          </div>

          <div className="about-install-step">
            <span className="about-step-label">5. (Optional) Sandbox Docker images</span>
            <pre className="about-code">{`docker pull alpine:latest\ndocker pull python:3.12-alpine\ndocker pull node:20-alpine\ndocker pull ruby:3-alpine`}</pre>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Pre-pulling these speeds up first Sandbox run. Docker must be running.</span>
          </div>
        </div>

        <div className="about-section">
          <div className="about-heading">Core Infrastructure</div>
          <ul>
            <li><strong>BYOK</strong> — your Anthropic API key stays in your browser only, never logged server-side</li>
            <li><strong>SSE Streaming</strong> — all AI responses stream in real-time</li>
            <li><strong>Ctrl+Enter</strong> — run shortcut on every tab</li>
            <li><strong>Cancel</strong> — stop any in-progress AI request mid-stream</li>
            <li><strong>Voice input</strong> — microphone button on every tab for speech-to-text</li>
            <li><strong>SendTo</strong> — route output from any tab into 7 other tabs</li>
            <li><strong>OS Profiles</strong> — target Linux, macOS, Windows, Kali, or Docker</li>
            <li><strong>Rate limiting</strong> — 60 AI requests/hr and 20 sandbox runs/hr per IP</li>
            <li><strong>Tab tooltips</strong> — hover any tab for a quick description</li>
          </ul>
        </div>

        <div className="about-section">
          <div className="about-heading">11 Tabs</div>
          <div className="about-tabs">

            <div className="about-tab">
              <span className="about-tab-name">Generate</span>
              <span>Describe what you need in plain English — get a complete production-ready script. Language selector, OS profile, built-in Simulate button.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Debugger</span>
              <span>Paste broken code + error output (or a screenshot) and get a fixed version with explanation.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Analyzer</span>
              <span>Reverse-engineer any script — line-by-line breakdown, security risks, and dependencies.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Convert</span>
              <span>Translate scripts between bash, Python, JavaScript, Ruby, PowerShell, and more. Swap button (⇄) to flip languages instantly.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Improve</span>
              <span>4 modes: Simplify, Add Comments, Make Production-Ready, Rewrite for Beginners.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Simulate</span>
              <span>Dry-run a script before executing — step-by-step breakdown, risk badge (low/medium/high), side effects listed.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Cheat Sheets</span>
              <span>Build ready-to-run commands for common tools via a guided category → command → parameter grid.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">AI Tutor</span>
              <span>Learn from your own code — annotated explanations, key concepts, and exercises. 3 levels: Beginner, Intermediate, Expert.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Sandbox</span>
              <span>Execute code live in an isolated Docker container. Runtimes: bash, Python, Node, Ruby. Stdin input, live streaming output, last 5 runs with restore. No network, 128 MB RAM cap, dangerous commands blocked.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Security</span>
              <span>Static security scan — findings by severity (critical → info), overall score out of 10, passed checks listed.</span>
            </div>

            <div className="about-tab">
              <span className="about-tab-name">Workflow</span>
              <span>Describe a multi-step task in plain English — get individual scripts per step plus a single combined script.</span>
            </div>

          </div>
        </div>

        <div className="about-section">
          <div className="about-heading">Mobile</div>
          <ul>
            <li>iOS &amp; Android builds via Capacitor (<code>com.scriptforge.ai</code>)</li>
            <li>Microphone + speech recognition permissions wired for both platforms</li>
            <li>SSE streaming preserved — ready to sign and deploy via Xcode / Android Studio</li>
          </ul>
        </div>

        <div className="about-section">
          <div className="about-heading">Deployment</div>
          <ul>
            <li>One-command <code>setup.sh</code> for Oracle Cloud Free Tier (Ubuntu 22.04)</li>
            <li>systemd service with auto-restart, nginx reverse proxy (SSE-safe)</li>
            <li>HTTPS via Let's Encrypt / Certbot, CORS locked to production domain</li>
          </ul>
        </div>

        <div style={{ textAlign: "right", marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
