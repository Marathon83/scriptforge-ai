# ScriptForge AI

AI-powered script generation, debugging, analysis, and sandboxed execution — built with FastAPI and React.

> **BYOK** — ScriptForge uses your own Anthropic API key, stored only in your browser. Nothing is logged or stored on the server.

![ScriptForge AI](frontend/src/assets/hero.png)

## Features

| Tab | What it does |
|---|---|
| **Generate** | Describe what you need; get a complete, production-ready script |
| **Debugger** | Paste broken code + error output (or a screenshot) and get a fixed version |
| **Analyzer** | Reverse-engineer any script — line-by-line breakdown, security risks, dependencies |
| **Convert** | Translate scripts between bash, Python, JavaScript, Ruby, PowerShell, and more |
| **Improve** | Simplify, add comments, make production-ready, or rewrite for beginners |
| **Simulate** | Dry-run a script — step-by-step breakdown, risk badge, side effects before you execute |
| **Cheat Sheets** | Build ready-to-run commands for common tools with guided parameter selection |
| **AI Tutor** | Learn from your own code — annotated explanations, key concepts, exercises |
| **Sandbox** | Execute code in an isolated Docker container (no network, 128 MB RAM) |
| **Security** | Static security scan — findings by severity, overall score, passed checks |
| **Workflow** | Describe a multi-step task in plain English; get individual + combined scripts |

### Sandbox highlights
- Supports **bash, Python, JavaScript (Node), Ruby**
- **Stdin input** — pass text to your script's standard input
- **Ctrl+Enter** shortcut to run
- **Run history** — last 5 runs with expandable output and one-click restore
- Dangerous commands are blocked or flagged before execution

## Stack

- **Backend** — Python, FastAPI, Anthropic Claude (`claude-sonnet-4-6`)
- **Frontend** — React, Vite, Monaco Editor
- **Sandbox** — Docker (persistent Alpine/Python/Node/Ruby containers)

## Getting started

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend dev server & build |
| Docker | any recent | Required for Sandbox tab |
| Anthropic API key | — | [Get one here](https://console.anthropic.com/settings/keys) |

---

### 1 — Clone the repo

```bash
git clone https://github.com/Marathon83/scriptforge-ai.git
cd scriptforge-ai
```

---

### 2 — Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

The backend is **BYOK** — no server-side API key is needed. Users supply their own key in the UI. If you want a server-side fallback key, create `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Start the server:

```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

The API will be available at `http://127.0.0.1:8000`. Verify with:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","model":"claude-sonnet-4-6"}
```

---

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). On first launch you'll be prompted to enter your Anthropic API key — it's stored in your browser only.

---

### 4 — Sandbox Docker images (optional but recommended)

Pre-pulling the sandbox images avoids a delay on the first Sandbox run:

```bash
docker pull alpine:latest
docker pull python:3.12-alpine
docker pull node:20-alpine
docker pull ruby:3-alpine
```

---

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(none)_ | Server-side fallback key (BYOK means this is optional) |
| `CORS_ORIGINS` | _(none)_ | Comma-separated extra origins to allow (e.g. your production domain) |

---

### Self-hosted deployment

See [`deploy/setup.sh`](deploy/setup.sh) for a one-command setup on Oracle Cloud Free Tier (Ubuntu 22.04). It installs nginx, Docker, Python, clones the repo, pulls sandbox images, opens ports 80/443, and installs a systemd service.

## OS profiles

The Generate, Debug, Improve, and Cheat Sheets tabs let you target a specific OS:

| Profile | Environment |
|---|---|
| `linux` | Ubuntu/Debian — bash, apt, systemctl |
| `macos` | macOS — zsh/bash, brew, launchctl |
| `windows` | PowerShell 7+, winget, sc.exe |
| `kali` | Kali Linux — bash, nmap, netcat, metasploit |
| `docker` | Alpine/Debian container — bash |

## Sandbox security

Code runs inside a persistent Docker container with:
- No network access (`--network none`)
- 128 MB memory cap
- No privilege escalation (`--security-opt no-new-privileges`)
- 16 MB `/tmp` tmpfs
- Configurable timeout (3–30 seconds)

Fork bombs, disk destruction commands, and filesystem formatters are blocked outright before execution.
