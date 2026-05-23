# ScriptForge AI

AI-powered script generation, debugging, analysis, and sandboxed execution — built with FastAPI and React.

![ScriptForge AI](frontend/src/assets/hero.png)

## Features

| Tab | What it does |
|---|---|
| **Generate** | Describe what you need; get a complete, production-ready script |
| **Debugger** | Paste broken code + error output (or a screenshot) and get a fixed version |
| **Analyzer** | Reverse-engineer any script — line-by-line breakdown, security risks, dependencies |
| **Convert** | Translate scripts between bash, Python, JavaScript, Ruby, PowerShell, and more |
| **Improve** | Simplify, add comments, make production-ready, or rewrite for beginners |
| **Cheat Sheets** | Build ready-to-run commands for common tools with guided parameter selection |
| **AI Tutor** | Learn from your own code — annotated explanations, key concepts, exercises |
| **Sandbox** | Execute code in an isolated Docker container (no network, 128 MB RAM) |

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
- Python 3.11+
- Node.js 18+
- Docker (for sandbox execution)
- An [Anthropic API key](https://console.anthropic.com/)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn anthropic python-dotenv json-repair httpx[socks]
```

Create `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Start the server:
```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

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
