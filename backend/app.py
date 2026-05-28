from fastapi import FastAPI, Request, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import sys
import anthropic
import json
import asyncio
import subprocess
import re
import time
import logging
from logging.handlers import RotatingFileHandler
from collections import defaultdict

load_dotenv()

# ── Logging ────────────────────────────────────────────────────────────────────
logger = logging.getLogger("scriptforge")
logger.setLevel(logging.INFO)
_fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
_ch  = logging.StreamHandler(sys.stdout)
_ch.setFormatter(_fmt)
logger.addHandler(_ch)
try:
    _fh = RotatingFileHandler("scriptforge.log", maxBytes=10 * 1024 * 1024, backupCount=5)
    _fh.setFormatter(_fmt)
    logger.addHandler(_fh)
except OSError:
    pass  # read-only FS — stdout only

_DEV_ORIGINS = [
    "http://localhost:5174", "http://localhost:5173",
    "http://127.0.0.1:5173", "http://127.0.0.1:5174",
    "capacitor://localhost", "https://localhost",
]
_extra = os.getenv("CORS_ORIGINS", "")
_ALLOWED_ORIGINS = _DEV_ORIGINS + [o.strip() for o in _extra.split(",") if o.strip()]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
MODEL = "claude-sonnet-4-6"

# ── Rate limiting (in-memory, per IP) ─────────────────────────────────────────
class _RateLimiter:
    def __init__(self, calls: int, period: int):
        self.calls  = calls
        self.period = period
        self._store: dict[str, list[float]] = defaultdict(list)
        self._lock  = asyncio.Lock()

    async def is_allowed(self, key: str) -> bool:
        async with self._lock:
            now      = time.time()
            filtered = [t for t in self._store.get(key, []) if now - t < self.period]
            if len(filtered) >= self.calls:
                self._store[key] = filtered
                return False
            filtered.append(now)
            self._store[key] = filtered
            return True

_ai_limiter      = _RateLimiter(calls=60, period=3600)   # 60 AI requests/hour per IP
_sandbox_limiter = _RateLimiter(calls=20, period=3600)   # 20 sandbox runs/hour per IP

# ── Auth — BYOK (user provides their own Anthropic key) ───────────────────────
async def _require_key(x_api_key: str = Header(default=None)) -> str:
    if not x_api_key or not x_api_key.strip().startswith("sk-ant-"):
        raise HTTPException(
            status_code=401,
            detail="Anthropic API key required. Add it in ScriptForge ⚙ Settings.",
        )
    return x_api_key.strip()

def _client(api_key: str) -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=api_key)

# ── Request logging middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def _log_requests(request: Request, call_next):
    start    = time.perf_counter()
    response = await call_next(request)
    ms = int((time.perf_counter() - start) * 1000)
    ip = (request.headers.get("X-Forwarded-For", "") or
          (request.client.host if request.client else "?")).split(",")[0].strip()
    logger.info("%s %s %s %d %dms", ip, request.method, request.url.path, response.status_code, ms)
    return response

def _client_ip(request: Request) -> str:
    return (request.headers.get("X-Forwarded-For", "") or
            (request.client.host if request.client else "?")).split(",")[0].strip()

async def _check_ai_rate(request: Request):
    if not await _ai_limiter.is_allowed(_client_ip(request)):
        raise HTTPException(status_code=429, detail="Rate limit exceeded (60 AI requests/hour). Try again later.")

# ── OS context ─────────────────────────────────────────────────────────────────
OS_CONTEXT = {
    "linux":   "Target OS: Linux (Ubuntu/Debian). Use bash, apt, systemctl.",
    "macos":   "Target OS: macOS. Use zsh/bash, brew, launchctl.",
    "windows": "Target OS: Windows. Use PowerShell 7+, winget, sc.exe.",
    "kali":    "Target OS: Kali Linux. Use bash. Prefer tools available in Kali (nmap, netcat, metasploit, etc.).",
    "docker":  "Target environment: Docker container. Use bash, Alpine/Debian base.",
}

def os_ctx(profile: str) -> str:
    return OS_CONTEXT.get(profile, OS_CONTEXT["linux"])

def parse_json(raw: str, fallback: dict) -> dict:
    from json_repair import repair_json
    try:
        text = raw.strip()
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
        if text.endswith("```"):
            text = "\n".join(text.split("\n")[:-1])
        text  = text.strip()
        start = text.find("{")
        end   = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end + 1]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return json.loads(repair_json(text))
    except Exception:
        return fallback

# ── Request models ─────────────────────────────────────────────────────────────
class GenerateReq(BaseModel):
    prompt: str
    os_profile: str = "linux"
    language: str = "bash"

class SimulateReq(BaseModel):
    prompt: str = ""
    code: str = ""
    language: str = "bash"
    os_profile: str = "linux"

class DebugReq(BaseModel):
    code: str
    error: str = ""
    language: str = "bash"
    os_profile: str = "linux"
    screenshot_b64: str = ""
    image_type: str = "image/png"

class AnalyzeReq(BaseModel):
    code: str
    os_profile: str = "linux"
    language: str = "shell"

class ConvertReq(BaseModel):
    code: str
    from_lang: str
    to_lang: str

class ImproveReq(BaseModel):
    code: str
    mode: str
    language: str = "bash"
    os_profile: str = "linux"

class CheatReq(BaseModel):
    category: str
    command: str
    params: dict = {}
    os_profile: str = "linux"

class TutorReq(BaseModel):
    code: str
    language: str = "bash"
    level: str = "beginner"

class SandboxReq(BaseModel):
    code: str
    language: str = "bash"
    timeout: int = 15
    stdin: str = ""

# ── Sandbox config ─────────────────────────────────────────────────────────────
SANDBOX_IMAGES = {
    "bash":       "alpine:latest",
    "shell":      "alpine:latest",
    "python":     "python:3.12-alpine",
    "javascript": "node:20-alpine",
    "ruby":       "ruby:3-alpine",
}

SANDBOX_ENTRYPOINTS = {
    "bash":       ["sh", "-c"],
    "shell":      ["sh", "-c"],
    "python":     ["python3", "-c"],
    "javascript": ["node", "-e"],
    "ruby":       ["ruby", "-e"],
}

def _container_name(lang: str) -> str:
    return f"sfai-sandbox-{lang}"

def _ensure_container(lang: str) -> str:
    name  = _container_name(lang)
    check = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", name],
        capture_output=True, text=True,
    )
    if check.returncode == 0 and check.stdout.strip() == "true":
        return name
    subprocess.run(["docker", "rm", "-f", name], capture_output=True)
    image = SANDBOX_IMAGES[lang]
    subprocess.run([
        "docker", "run", "-d",
        "--name", name,
        "--network", "none",
        "--memory", "128m",
        "--security-opt", "no-new-privileges",
        "--tmpfs", "/tmp:size=16m,mode=1777",
        image,
        "sleep", "infinity",
    ], capture_output=True, check=True)
    return name

def _start_all_containers():
    for lang in SANDBOX_IMAGES:
        try:
            _ensure_container(lang)
            logger.info("sandbox container ready: %s", lang)
        except Exception as e:
            logger.warning("sandbox container failed to start (%s): %s", lang, e)

_start_all_containers()

BLOCK_PATTERNS = [
    (r":\(\)\s*\{.*:\s*\|.*:.*&",          "Fork bomb detected"),
    (r":\(\)\s*\{.*\}",                    "Fork bomb pattern detected"),
    (r"dd\s+if=/dev/(zero|urandom).*of=/dev", "Disk destruction command blocked"),
    (r"mkfs\b",                             "Filesystem formatter blocked"),
    (r">\s*/dev/sd[a-z]",                   "Direct device write blocked"),
    (r"\bnsenter\b",                        "Namespace escape attempt blocked"),
    (r"\bunshare\b.*--(?:mount|pid|net)",   "Namespace escape blocked"),
    (r"docker\s+(run|exec|pull|build)\b",   "Docker CLI inside sandbox blocked"),
    (r"/proc/self/exe",                     "Process self-reference blocked"),
    (r"chmod\s+[0-9]*[67][0-9]{2}\s+/",    "Dangerous permission change on root path blocked"),
]

WARN_PATTERNS = [
    (r"\brm\s+-[^\s]*r",                                    "Recursive delete — affects only container"),
    (r"\bchmod\b",                                          "Permission change — contained to sandbox"),
    (r"\bcurl\b|\bwget\b|\bfetch\b",                        "Network access is disabled in sandbox"),
    (r"\bsudo\b|\bsu\b",                                    "Privilege escalation has no effect — already root inside container"),
    (r"os\.system|subprocess\.(?:run|call|check_output|Popen)", "Shell execution detected"),
    (r"\beval\s*\(|\bexec\s*\(",                            "Dynamic code execution detected"),
    (r"base64\s+-d\s*\|.*(?:bash|sh)\b",                    "Encoded command execution pattern"),
    (r"__import__\s*\(\s*['\"]os['\"]",                     "Dynamic OS module import detected"),
]

def scan_code(code: str):
    for pattern, reason in BLOCK_PATTERNS:
        if re.search(pattern, code, re.IGNORECASE | re.DOTALL):
            return "blocked", reason
    warnings = []
    for pattern, reason in WARN_PATTERNS:
        if re.search(pattern, code, re.IGNORECASE):
            warnings.append(reason)
    return "ok", warnings

# ── Streaming helpers ──────────────────────────────────────────────────────────
async def _sse_stream(
    ac: anthropic.AsyncAnthropic,
    system_prompt: str,
    user_content,
    fallback: dict,
    max_tokens: int = 4096,
):
    try:
        accumulated = ""
        async with ac.messages.stream(
            model=MODEL,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            async for text in stream.text_stream:
                accumulated += text
                yield f"data: {json.dumps({'text': text})}\n\n"
        result = parse_json(accumulated, fallback)
        yield f"data: {json.dumps({'done': True, 'result': result})}\n\n"
    except anthropic.AuthenticationError:
        yield f"data: {json.dumps({'error': 'Invalid API key. Check your key in ⚙ Settings.'})}\n\n"
    except anthropic.RateLimitError:
        yield f"data: {json.dumps({'error': 'Anthropic rate limit reached on your key. Wait a moment and retry.'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

def sse_response(gen):
    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL}

# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.post("/generate/stream")
async def generate_stream(request: Request, req: GenerateReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    system = f"""{os_ctx(req.os_profile)}
Language: {req.language}

You are ScriptForge AI. Generate a complete, working script based on the user's description.
Keep the script focused and production-quality. Avoid unnecessary verbosity in comments.

Return ONLY valid JSON with no markdown or backticks:
{{
  "script": "the complete script",
  "explanation": "clear explanation of what it does",
  "plan": ["step 1", "step 2"],
  "dependencies": ["dep1"],
  "security_flags": ["warning if dangerous command detected"],
  "optimization_tips": ["tip1"]
}}"""
    fallback = {
        "script": "", "explanation": "", "plan": [],
        "dependencies": [], "security_flags": [], "optimization_tips": []
    }
    return sse_response(_sse_stream(_client(api_key), system, req.prompt, fallback))


@app.post("/debug/stream")
async def debug_stream(request: Request, req: DebugReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    system = f"""{os_ctx(req.os_profile)}
Language: {req.language}

You are ScriptForge AI debugger. Analyze the code and error, then return ONLY valid JSON with no markdown or backticks:
{{
  "explanation": "what caused the error",
  "fixed_code": "the corrected, complete code",
  "problematic_lines": ["description of each problematic section"],
  "why_it_occurred": "root cause explanation",
  "prevention_tips": ["tip1"],
  "security_flags": ["any security issues found"]
}}"""
    content = []
    if req.screenshot_b64:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": req.image_type, "data": req.screenshot_b64}
        })
        content.append({"type": "text", "text": "Above is a screenshot of the error. Analyze it and the code below."})
    user_text = f"Code:\n{req.code}"
    if req.error:
        user_text += f"\n\nError output:\n{req.error}"
    content.append({"type": "text", "text": user_text})
    fallback = {
        "explanation": "", "fixed_code": req.code,
        "problematic_lines": [], "why_it_occurred": "",
        "prevention_tips": [], "security_flags": []
    }
    return sse_response(_sse_stream(_client(api_key), system, content, fallback))


@app.post("/analyze/stream")
async def analyze_stream(request: Request, req: AnalyzeReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    system = f"""{os_ctx(req.os_profile)}
Language: {req.language}

You are ScriptForge AI reverse analyzer. Thoroughly analyze the provided code.

Return ONLY valid JSON with no markdown or backticks:
{{
  "summary": "overall explanation of what the script does",
  "line_by_line": ["Line 1: explanation", "Line 2: explanation"],
  "dependencies": ["dep1"],
  "security_risks": ["risk1"],
  "suspicious_behavior": ["behavior1"],
  "optimization_suggestions": ["suggestion1"],
  "security_flags": ["critical security issue if any"]
}}"""
    fallback = {
        "summary": "", "line_by_line": [], "dependencies": [],
        "security_risks": [], "suspicious_behavior": [],
        "optimization_suggestions": [], "security_flags": []
    }
    return sse_response(_sse_stream(_client(api_key), system, req.code, fallback))


@app.post("/convert/stream")
async def convert_stream(request: Request, req: ConvertReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    system = f"""You are ScriptForge AI script converter.
Convert the code from {req.from_lang} to {req.to_lang}, preserving all functionality.

Return ONLY valid JSON with no markdown or backticks:
{{
  "converted_code": "the complete converted code",
  "notes": ["important behavioral difference or note"],
  "dependencies": ["required package or tool"]
}}"""
    fallback = {"converted_code": "", "notes": [], "dependencies": []}
    return sse_response(_sse_stream(_client(api_key), system, req.code, fallback))


@app.post("/improve/stream")
async def improve_stream(request: Request, req: ImproveReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    ac = _client(api_key)
    instructions = {
        "simplify":   "Simplify and streamline the code. Make it shorter, cleaner, and remove redundancy.",
        "comments":   "Add thorough, helpful comments explaining every section and non-obvious line.",
        "production": "Make it production-ready: add error handling, input validation, logging, and follow best practices.",
        "beginner":   "Rewrite for beginners: simple logic, verbose variable names, explain everything in comments.",
    }
    instruction = instructions.get(req.mode, "Improve the code.")
    system = f"""{os_ctx(req.os_profile)}
Language: {req.language}

You are ScriptForge AI code improver. {instruction}

CRITICAL: Return ONLY a single raw JSON object. No markdown, no backticks, no code fences anywhere.
The improved_code field must contain the raw script text (use \\n for newlines inside the JSON string).
{{
  "improved_code": "raw script text here with \\n for newlines",
  "changes_made": ["change 1", "change 2"]
}}"""

    async def _gen():
        accumulated = ""
        try:
            async with ac.messages.stream(
                model=MODEL, max_tokens=4096, system=system,
                messages=[{"role": "user", "content": req.code}],
            ) as stream:
                async for text in stream.text_stream:
                    accumulated += text
                    yield f"data: {json.dumps({'text': text})}\n\n"
            result = parse_json(accumulated, {"improved_code": accumulated, "changes_made": []})
            ic = result.get("improved_code", "")
            if isinstance(ic, str) and ic.strip().startswith("```"):
                inner = parse_json(ic, {})
                if inner.get("improved_code"):
                    result["improved_code"] = inner["improved_code"]
                    if not result.get("changes_made") and inner.get("changes_made"):
                        result["changes_made"] = inner["changes_made"]
            yield f"data: {json.dumps({'done': True, 'result': result})}\n\n"
        except anthropic.AuthenticationError:
            yield f"data: {json.dumps({'error': 'Invalid API key. Check your key in ⚙ Settings.'})}\n\n"
        except anthropic.RateLimitError:
            yield f"data: {json.dumps({'error': 'Anthropic rate limit reached on your key. Wait a moment and retry.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return sse_response(_gen())


@app.post("/simulate/stream")
async def simulate_stream(request: Request, req: SimulateReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    system = f"""{os_ctx(req.os_profile)}
Language: {req.language}

You are ScriptForge AI in dry-run simulation mode. Walk through what this script does step by step WITHOUT executing it.

Return ONLY valid JSON with no markdown or backticks:
{{
  "summary": "one-sentence summary of what this script does",
  "steps": [
    {{"action": "short action label", "detail": "what exactly happens here"}}
  ],
  "risk_level": "low",
  "side_effects": ["creates file X", "modifies registry key Y"],
  "warnings": ["dangerous pattern: rm -rf without guard"]
}}
risk_level must be exactly: low, medium, or high.
Be thorough — cover every meaningful operation."""
    user_content = f"Code:\n```{req.language}\n{req.code or req.prompt}\n```"
    fallback = {"summary": "", "steps": [], "risk_level": "low", "side_effects": [], "warnings": []}
    return sse_response(_sse_stream(_client(api_key), system, user_content, fallback, max_tokens=1024))


@app.post("/cheatsheet/stream")
async def cheatsheet_stream(request: Request, req: CheatReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    system = f"""{os_ctx(req.os_profile)}

You are ScriptForge AI command builder. Build a complete command for the given tool and parameters.

Return ONLY valid JSON with no markdown or backticks:
{{
  "command_string": "the complete ready-to-run command",
  "explanation": "what each part of the command does",
  "examples": ["example 1", "example 2"],
  "warnings": ["warning if dangerous"]
}}"""
    params_str = json.dumps(req.params) if req.params else "default usage"
    user_text = f"Category: {req.category}\nCommand/Tool: {req.command}\nParameters: {params_str}"
    fallback = {"command_string": "", "explanation": "", "examples": [], "warnings": []}
    return sse_response(_sse_stream(_client(api_key), system, user_text, fallback, max_tokens=1024))


@app.post("/tutor/stream")
async def tutor_stream(request: Request, req: TutorReq, api_key: str = Depends(_require_key)):
    await _check_ai_rate(request)
    level_ctx = (
        "Explain as if talking to a complete beginner. Use simple analogies, avoid jargon, define every term."
        if req.level == "beginner"
        else "Assume expert-level knowledge. Discuss performance implications, edge cases, idiomatic patterns, and non-obvious behaviour. Skip basics entirely."
        if req.level == "expert"
        else "Explain for an intermediate programmer who knows basics but wants deeper understanding."
    )
    system = f"""You are ScriptForge AI Tutor. {level_ctx}
Language: {req.language}

Analyze the code and return ONLY valid JSON with no markdown or backticks:
{{
  "title": "short descriptive title for what this script does",
  "overview": "1-2 sentence plain-English summary of what the whole script accomplishes",
  "annotated_lines": [
    {{
      "line_range": "1",
      "code": "the exact line(s) of code",
      "explanation": "plain English explanation of what this line does",
      "concept": "the programming concept demonstrated (e.g. variable, loop, function call)"
    }}
  ],
  "key_concepts": ["concept 1 taught by this script", "concept 2"],
  "common_mistakes": ["mistake beginners make with this pattern"],
  "exercises": ["exercise 1 to reinforce understanding", "exercise 2"],
  "next_steps": ["what to learn next"]
}}
Group consecutive lines that work together into a single annotated_lines entry. Aim for 5-15 entries."""
    fallback = {
        "title": "Script Analysis", "overview": "", "annotated_lines": [],
        "key_concepts": [], "common_mistakes": [], "exercises": [], "next_steps": [],
    }
    return sse_response(_sse_stream(_client(api_key), system, req.code, fallback))


@app.post("/sandbox/stream")
async def sandbox_stream(request: Request, req: SandboxReq, api_key: str = Depends(_require_key)):
    ip = _client_ip(request)
    if not await _sandbox_limiter.is_allowed(ip):
        async def _limited():
            yield f"data: {json.dumps({'error': 'Sandbox rate limit exceeded (20 runs/hour). Try again later.'})}\n\n"
        return sse_response(_limited())

    async def _gen():
        lang = req.language.lower()
        if lang not in SANDBOX_IMAGES:
            yield f"data: {json.dumps({'error': f'Language {lang!r} not supported'})}\n\n"
            return

        status, detail = scan_code(req.code)
        if status == "blocked":
            yield f"data: {json.dumps({'blocked': True, 'block_reason': detail})}\n\n"
            return

        warnings = detail
        if warnings:
            yield f"data: {json.dumps({'warnings': warnings})}\n\n"

        timeout    = max(3, min(req.timeout, 30))
        entrypoint = SANDBOX_ENTRYPOINTS[lang]

        try:
            container = await asyncio.to_thread(_ensure_container, lang)
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Could not start container: {e}'})}\n\n"
            return

        exec_cmd = ["docker", "exec", "-i", container, *entrypoint, req.code]
        start    = time.time()

        try:
            proc = await asyncio.create_subprocess_exec(
                *exec_cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            if req.stdin:
                proc.stdin.write(req.stdin.encode())
            proc.stdin.close()

            kill_fired = False

            async def _kill_after(secs):
                nonlocal kill_fired
                await asyncio.sleep(secs)
                if proc.returncode is None:
                    proc.kill()
                    kill_fired = True

            kill_task = asyncio.create_task(_kill_after(timeout))

            async for line in proc.stdout:
                yield f"data: {json.dumps({'stdout_chunk': line.decode(errors='replace')})}\n\n"

            kill_task.cancel()
            await asyncio.gather(kill_task, return_exceptions=True)
            stderr_bytes = await proc.stderr.read()
            await proc.wait()
            killed    = kill_fired
            exit_code = proc.returncode if proc.returncode is not None else -1
            stderr    = (
                f"[sandbox] Process killed — exceeded {timeout}s timeout"
                if killed else
                stderr_bytes.decode(errors="replace")
            )

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        duration_ms = int((time.time() - start) * 1000)
        logger.info("sandbox run: ip=%s lang=%s exit=%d duration=%dms", ip, lang, exit_code, duration_ms)
        yield f"data: {json.dumps({'done': True, 'exit_code': exit_code, 'killed': killed, 'stderr': stderr, 'duration_ms': duration_ms, 'warnings': warnings})}\n\n"

    return sse_response(_gen())
