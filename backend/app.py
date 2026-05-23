from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import anthropic
import json
import asyncio
import subprocess
import re
import time

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5173",
                   "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
client  = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
aclient = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-6"

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
        # strip opening fence (```json, ```bash, ``` etc.)
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
        if text.endswith("```"):
            text = "\n".join(text.split("\n")[:-1])
        text = text.strip()
        # find the outermost JSON object even when there's leading prose
        start = text.find("{")
        end   = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end + 1]
        # first try strict parse; fall back to repair for common LLM issues
        # (unescaped quotes in string values, truncated JSON, etc.)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return json.loads(repair_json(text))
    except Exception:
        return fallback


# ── Request models ────────────────────────────────────────────────────────────

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
    timeout: int = 15  # seconds, max 30
    stdin: str = ""


# ── Streaming helpers ─────────────────────────────────────────────────────────

async def _sse_stream(system_prompt: str, user_content, fallback: dict):
    """Async generator yielding SSE lines. Sends text chunks then a final done+result."""
    try:
        accumulated = ""
        async with aclient.messages.stream(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            async for text in stream.text_stream:
                accumulated += text
                yield f"data: {json.dumps({'text': text})}\n\n"
        result = parse_json(accumulated, fallback)
        yield f"data: {json.dumps({'done': True, 'result': result})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


def sse_response(gen):
    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/generate/stream")
async def generate_stream(req: GenerateReq):
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
    return sse_response(_sse_stream(system, req.prompt, fallback))


@app.post("/debug/stream")
async def debug_stream(req: DebugReq):
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
    return sse_response(_sse_stream(system, content, fallback))


@app.post("/analyze/stream")
async def analyze_stream(req: AnalyzeReq):
    system = f"""{os_ctx(req.os_profile)}

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
    return sse_response(_sse_stream(system, req.code, fallback))


@app.post("/convert/stream")
async def convert_stream(req: ConvertReq):
    system = f"""You are ScriptForge AI script converter.
Convert the code from {req.from_lang} to {req.to_lang}, preserving all functionality.

Return ONLY valid JSON with no markdown or backticks:
{{
  "converted_code": "the complete converted code",
  "notes": ["important behavioral difference or note"],
  "dependencies": ["required package or tool"]
}}"""
    fallback = {"converted_code": "", "notes": [], "dependencies": []}
    return sse_response(_sse_stream(system, req.code, fallback))


@app.post("/improve/stream")
async def improve_stream(req: ImproveReq):
    instructions = {
        "simplify":    "Simplify and streamline the code. Make it shorter, cleaner, and remove redundancy.",
        "comments":    "Add thorough, helpful comments explaining every section and non-obvious line.",
        "production":  "Make it production-ready: add error handling, input validation, logging, and follow best practices.",
        "beginner":    "Rewrite for beginners: simple logic, verbose variable names, explain everything in comments.",
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

    async def _improve_stream():
        accumulated = ""
        try:
            async with aclient.messages.stream(
                model=MODEL, max_tokens=4096, system=system,
                messages=[{"role": "user", "content": req.code}],
            ) as stream:
                async for text in stream.text_stream:
                    accumulated += text
                    yield f"data: {json.dumps({'text': text})}\n\n"
            result = parse_json(accumulated, {"improved_code": accumulated, "changes_made": []})
            # unwrap nested JSON if model wrapped improved_code in a code fence
            ic = result.get("improved_code", "")
            if isinstance(ic, str) and ic.strip().startswith("```"):
                inner = parse_json(ic, {})
                if inner.get("improved_code"):
                    result["improved_code"] = inner["improved_code"]
                    if not result.get("changes_made") and inner.get("changes_made"):
                        result["changes_made"] = inner["changes_made"]
            yield f"data: {json.dumps({'done': True, 'result': result})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return sse_response(_improve_stream())


# ── Sandbox config ────────────────────────────────────────────────────────────

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

# Per-language persistent containers (started once at server startup)
_sandbox_containers: dict[str, str] = {}  # lang -> container_id


def _container_name(lang: str) -> str:
    return f"sfai-sandbox-{lang}"


def _ensure_container(lang: str) -> str:
    """Return running container id for lang, starting it if needed."""
    name = _container_name(lang)
    # Check if already running
    check = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", name],
        capture_output=True, text=True,
    )
    if check.returncode == 0 and check.stdout.strip() == "true":
        return name

    # Remove stale container if it exists but isn't running
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
        except Exception:
            pass  # non-fatal — will retry on first request


# Start persistent containers when the module loads
_start_all_containers()


# Patterns that are blocked outright — too dangerous even inside a container
BLOCK_PATTERNS = [
    (r":\(\)\s*\{.*\}", "Fork bomb detected"),
    (r"dd\s+if=/dev/(zero|urandom).*of=/dev", "Disk destruction command blocked"),
    (r"mkfs\b", "Filesystem formatter blocked"),
    (r">\s*/dev/sd", "Direct device write blocked"),
]

# Patterns that generate warnings but still run
WARN_PATTERNS = [
    (r"\brm\s+-[^\s]*r", "Recursive delete — will only affect the container"),
    (r"\bchmod\b", "Permission change — contained to sandbox"),
    (r"\bcurl\b|\bwget\b|\bfetch\b", "Network access is disabled in sandbox"),
    (r"\bsudo\b|\bsu\b", "Privilege escalation has no effect — running as root inside container"),
    (r"os\.system|subprocess|exec\(", "Shell execution detected"),
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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/generate")
def generate(req: GenerateReq):
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

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": req.prompt}]
    )
    raw = response.content[0].text
    return parse_json(raw, {
        "script": raw, "explanation": "", "plan": [],
        "dependencies": [], "security_flags": [], "optimization_tips": []
    })


@app.post("/simulate")
def simulate(req: SimulateReq):
    system = """You are ScriptForge AI in simulation mode. Simulate what a script would do WITHOUT executing it.

Return ONLY valid JSON with no markdown or backticks:
{
  "summary": "one-sentence summary",
  "steps": ["step 1", "step 2"],
  "risk_level": "low",
  "warnings": ["warning1"]
}
risk_level must be exactly: low, medium, or high."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": req.prompt}]
    )
    raw = response.content[0].text
    return parse_json(raw, {"summary": raw, "steps": [], "risk_level": "unknown", "warnings": []})


@app.post("/simulate/stream")
async def simulate_stream(req: SimulateReq):
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
    return sse_response(_sse_stream(system, user_content, fallback))


@app.post("/debug")
def debug(req: DebugReq):
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

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": content}]
    )
    raw = response.content[0].text
    return parse_json(raw, {
        "explanation": raw, "fixed_code": req.code,
        "problematic_lines": [], "why_it_occurred": "",
        "prevention_tips": [], "security_flags": []
    })


@app.post("/analyze")
def analyze(req: AnalyzeReq):
    system = f"""{os_ctx(req.os_profile)}

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

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": req.code}]
    )
    raw = response.content[0].text
    return parse_json(raw, {
        "summary": raw, "line_by_line": [], "dependencies": [],
        "security_risks": [], "suspicious_behavior": [],
        "optimization_suggestions": [], "security_flags": []
    })


@app.post("/convert")
def convert(req: ConvertReq):
    system = f"""You are ScriptForge AI script converter.
Convert the code from {req.from_lang} to {req.to_lang}, preserving all functionality.

Return ONLY valid JSON with no markdown or backticks:
{{
  "converted_code": "the complete converted code",
  "notes": ["important behavioral difference or note"],
  "dependencies": ["required package or tool"]
}}"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": req.code}]
    )
    raw = response.content[0].text
    return parse_json(raw, {"converted_code": raw, "notes": [], "dependencies": []})


@app.post("/improve")
def improve(req: ImproveReq):
    instructions = {
        "simplify":    "Simplify and streamline the code. Make it shorter, cleaner, and remove redundancy.",
        "comments":    "Add thorough, helpful comments explaining every section and non-obvious line.",
        "production":  "Make it production-ready: add error handling, input validation, logging, and follow best practices.",
        "beginner":    "Rewrite for beginners: simple logic, verbose variable names, explain everything in comments.",
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

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": req.code}]
    )
    raw = response.content[0].text
    result = parse_json(raw, {"improved_code": raw, "changes_made": []})
    # if the model embedded a nested JSON in improved_code, unwrap it
    ic = result.get("improved_code", "")
    if isinstance(ic, str) and ic.strip().startswith("```"):
        inner = parse_json(ic, {})
        if inner.get("improved_code"):
            result["improved_code"] = inner["improved_code"]
            if not result.get("changes_made") and inner.get("changes_made"):
                result["changes_made"] = inner["changes_made"]
    return result


@app.post("/cheatsheet")
def cheatsheet(req: CheatReq):
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

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user_text}]
    )
    raw = response.content[0].text
    return parse_json(raw, {
        "command_string": raw, "explanation": "",
        "examples": [], "warnings": []
    })


@app.post("/tutor")
def tutor(req: TutorReq):
    level_ctx = (
        "Explain as if talking to a complete beginner. Use simple analogies, avoid jargon, define every term."
        if req.level == "beginner"
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

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": req.code}]
    )
    raw = response.content[0].text
    return parse_json(raw, {
        "title": "Script Analysis",
        "overview": raw,
        "annotated_lines": [],
        "key_concepts": [],
        "common_mistakes": [],
        "exercises": [],
        "next_steps": [],
    })


@app.post("/cheatsheet/stream")
async def cheatsheet_stream(req: CheatReq):
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
    return sse_response(_sse_stream(system, user_text, fallback))


@app.post("/tutor/stream")
async def tutor_stream(req: TutorReq):
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
    return sse_response(_sse_stream(system, req.code, fallback))


@app.post("/sandbox")
def sandbox(req: SandboxReq):
    lang = req.language.lower()
    if lang not in SANDBOX_IMAGES:
        return {
            "blocked": True,
            "block_reason": f"Language '{lang}' not supported. Supported: {', '.join(SANDBOX_IMAGES)}",
            "stdout": "", "stderr": "", "exit_code": -1,
            "duration_ms": 0, "killed": False, "warnings": [],
        }

    status, detail = scan_code(req.code)
    if status == "blocked":
        return {
            "blocked": True, "block_reason": detail,
            "stdout": "", "stderr": "", "exit_code": -1,
            "duration_ms": 0, "killed": False, "warnings": [],
        }

    warnings = detail
    timeout = max(3, min(req.timeout, 30))
    entrypoint = SANDBOX_ENTRYPOINTS[lang]

    try:
        container = _ensure_container(lang)
    except Exception as e:
        return {
            "blocked": False, "block_reason": "",
            "stdout": "", "stderr": f"[sandbox] Could not start container: {e}",
            "exit_code": -1, "duration_ms": 0, "killed": False, "warnings": warnings,
        }

    # Use docker exec into the persistent container — fast (~70ms vs ~15s for docker run)
    # -i keeps stdin pipe open so we can pass optional input
    exec_cmd = ["docker", "exec", "-i", container, *entrypoint, req.code]

    start = time.time()
    killed = False
    try:
        proc = subprocess.run(
            exec_cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            input=req.stdin,
        )
        stdout = proc.stdout
        stderr = proc.stderr
        exit_code = proc.returncode
    except subprocess.TimeoutExpired:
        killed = True
        stdout = ""
        stderr = f"[sandbox] Process killed — exceeded {timeout}s timeout"
        exit_code = -1
    except Exception as e:
        stdout = ""
        stderr = f"[sandbox] Exec error: {e}"
        exit_code = -1

    duration_ms = int((time.time() - start) * 1000)

    return {
        "blocked": False,
        "block_reason": "",
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
        "duration_ms": duration_ms,
        "killed": killed,
        "warnings": warnings,
    }


@app.post("/sandbox/stream")
async def sandbox_stream(req: SandboxReq):
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

        timeout = max(3, min(req.timeout, 30))
        entrypoint = SANDBOX_ENTRYPOINTS[lang]

        try:
            container = await asyncio.to_thread(_ensure_container, lang)
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Could not start container: {e}'})}\n\n"
            return

        exec_cmd = ["docker", "exec", "-i", container, *entrypoint, req.code]
        start = time.time()
        killed = False

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

            # Kill the process after timeout without blocking the read loop
            async def _kill_after(secs):
                await asyncio.sleep(secs)
                if proc.returncode is None:
                    proc.kill()

            kill_task = asyncio.create_task(_kill_after(timeout))

            async for line in proc.stdout:
                yield f"data: {json.dumps({'stdout_chunk': line.decode(errors='replace')})}\n\n"

            kill_task.cancel()
            killed = proc.returncode is None or (proc.returncode == -9)
            stderr_bytes = await proc.stderr.read()
            await proc.wait()
            exit_code = proc.returncode if proc.returncode is not None else -1
            stderr = (
                f"[sandbox] Process killed — exceeded {timeout}s timeout"
                if killed else
                stderr_bytes.decode(errors="replace")
            )

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        duration_ms = int((time.time() - start) * 1000)
        yield f"data: {json.dumps({'done': True, 'exit_code': exit_code, 'killed': killed, 'stderr': stderr, 'duration_ms': duration_ms, 'warnings': warnings})}\n\n"

    return sse_response(_gen())
