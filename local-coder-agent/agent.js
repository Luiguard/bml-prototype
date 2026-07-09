const fs = require('fs/promises');
const fsSync = require('fs');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

let vscode;
try { vscode = require('vscode'); } catch(e) { vscode = null; }
const execAsync = util.promisify(exec);

try {
    const envPath = path.join(__dirname, '.env');
    if (fsSync.existsSync(envPath)) {
        fsSync.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const [key, ...val] = line.split('=');
            if (key && val.length > 0) process.env[key.trim()] = val.join('=').trim();
        });
    }
} catch(e) {}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 5: OBSERVABILITY — Tracing, Cost Tracking, Evaluation
// ═══════════════════════════════════════════════════════════════════════
class Tracer {
    constructor() {
        this.traces = [];
        this.currentTrace = null;
        this.totalTokens = 0;
        this.totalCalls = 0;
        this.startTime = null;
    }

    startTrace(taskId, prompt) {
        this.currentTrace = {
            id: taskId,
            prompt,
            startTime: Date.now(),
            steps: [],
            errors: [],
            tokensUsed: 0,
            toolCalls: 0
        };
        this.startTime = Date.now();
    }

    logStep(type, data) {
        if (!this.currentTrace) return;
        this.currentTrace.steps.push({
            type,
            timestamp: Date.now() - this.currentTrace.startTime,
            ...data
        });
    }

    logLLMCall(model, promptTokens, completionTokens) {
        this.totalCalls++;
        const tokens = (promptTokens || 0) + (completionTokens || 0);
        this.totalTokens += tokens;
        if (this.currentTrace) this.currentTrace.tokensUsed += tokens;
        this.logStep('llm_call', { model, promptTokens, completionTokens });
    }

    logToolCall(name, args, result, durationMs) {
        if (this.currentTrace) this.currentTrace.toolCalls++;
        this.logStep('tool_call', { name, argsSummary: JSON.stringify(args).slice(0, 100), resultLength: result?.length || 0, durationMs });
    }

    logError(error) {
        if (this.currentTrace) this.currentTrace.errors.push({ timestamp: Date.now(), message: error });
        this.logStep('error', { message: error });
    }

    endTrace() {
        if (!this.currentTrace) return null;
        this.currentTrace.endTime = Date.now();
        this.currentTrace.durationMs = this.currentTrace.endTime - this.currentTrace.startTime;
        this.traces.push(this.currentTrace);
        const trace = this.currentTrace;
        this.currentTrace = null;
        return trace;
    }

    getSummary() {
        return {
            totalTraces: this.traces.length,
            totalLLMCalls: this.totalCalls,
            totalTokens: this.totalTokens,
            avgDuration: this.traces.length ? Math.round(this.traces.reduce((a, t) => a + t.durationMs, 0) / this.traces.length) : 0,
            errorRate: this.traces.length ? (this.traces.filter(t => t.errors.length > 0).length / this.traces.length * 100).toFixed(1) + '%' : '0%'
        };
    }

    async saveTrace(dir) {
        if (!this.currentTrace && this.traces.length === 0) return;
        const trace = this.traces[this.traces.length - 1];
        if (!trace) return;
        try {
            await fs.mkdir(dir, { recursive: true });
            const file = path.join(dir, `trace_${trace.id}.json`);
            await fs.writeFile(file, JSON.stringify(trace, null, 2));
        } catch(e) {}
    }
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 3: MEMORY — Working, Episodic, Semantic (3-Tier)
// ═══════════════════════════════════════════════════════════════════════
class AgentMemory {
    constructor(memoryDir) {
        this.memoryDir = memoryDir;
        this.working = {};        // Current task context (volatile)
        this.episodic = [];       // Past task summaries (persisted)
        this.semantic = new Map(); // File knowledge index (persisted)
    }

    async load() {
        try {
            await fs.mkdir(this.memoryDir, { recursive: true });
            const epFile = path.join(this.memoryDir, 'episodic.json');
            if (fsSync.existsSync(epFile)) {
                this.episodic = JSON.parse(await fs.readFile(epFile, 'utf-8'));
            }
            const semFile = path.join(this.memoryDir, 'semantic.json');
            if (fsSync.existsSync(semFile)) {
                const data = JSON.parse(await fs.readFile(semFile, 'utf-8'));
                this.semantic = new Map(Object.entries(data));
            }
        } catch(e) {}
    }

    async save() {
        try {
            await fs.mkdir(this.memoryDir, { recursive: true });
            await fs.writeFile(path.join(this.memoryDir, 'episodic.json'), JSON.stringify(this.episodic.slice(-50), null, 2));
            await fs.writeFile(path.join(this.memoryDir, 'semantic.json'), JSON.stringify(Object.fromEntries(this.semantic)));
        } catch(e) {}
    }

    addEpisode(task, result, filesChanged) {
        this.episodic.push({
            timestamp: new Date().toISOString(),
            task: task.slice(0, 200),
            result: result.slice(0, 200),
            filesChanged,
            id: crypto.randomUUID?.() || Date.now().toString()
        });
    }

    indexFile(filePath, summary) {
        this.semantic.set(filePath, { summary: summary.slice(0, 300), indexedAt: Date.now() });
    }

    getRelevantMemory(prompt) {
        const keywords = prompt.toLowerCase().split(/\s+/);
        // Search episodic memory
        const relevant = this.episodic
            .filter(ep => keywords.some(k => ep.task.toLowerCase().includes(k)))
            .slice(-3)
            .map(ep => `[${ep.timestamp}] Task: ${ep.task} → ${ep.result}`);
        // Search semantic memory
        const files = [...this.semantic.entries()]
            .filter(([fp]) => keywords.some(k => fp.toLowerCase().includes(k)))
            .slice(0, 5)
            .map(([fp, info]) => `${fp}: ${info.summary}`);
        
        let ctx = '';
        if (relevant.length) ctx += `\nPast related tasks:\n${relevant.join('\n')}`;
        if (files.length) ctx += `\nKnown files:\n${files.join('\n')}`;
        return ctx;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════
const tools = [
  { type: "function", function: { name: "read_file", description: "Read file contents (max 15000 chars). ALWAYS call before edit_file.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "write_file", description: "Create NEW file or FULLY REPLACE existing. Content = COMPLETE file. For edits use edit_file.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "edit_file", description: "Replace exact text block in existing file. MUST read_file first.", parameters: { type: "object", properties: { path: { type: "string" }, target_text: { type: "string" }, replacement_text: { type: "string" } }, required: ["path", "target_text", "replacement_text"] } } },
  { type: "function", function: { name: "run_command", description: "Run non-interactive bash command.", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
  { type: "function", function: { name: "list_files", description: "List files recursively (max 3 levels). '.' = root.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "search_files", description: "Grep all code files for text. Returns matching lines.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "fetch_url", description: "Fetch text/HTML from URL for documentation/research.", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
  { type: "function", function: { name: "recall_memory", description: "Search your memory for past tasks, known files, and project context.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } }
];

// ═══════════════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════
function fetchUrl(url) {
    const mod = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        mod.get(url, { timeout: 10000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
                return fetchUrl(res.headers.location).then(resolve).catch(reject);
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data.slice(0, 20000)));
        }).on('error', reject);
    });
}

function getCwd() {
    return vscode?.workspace?.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : process.cwd();
}

function safePath(cwd, p) {
    const abs = path.resolve(cwd, p);
    if (!abs.startsWith(cwd)) throw new Error('SECURITY: Path outside workspace.');
    return abs;
}

async function executeTool(state, name, args, onMessage, memory) {
    const cwd = getCwd();
    const t0 = Date.now();
    const shortArgs = name === 'write_file' ? `${args.path} [${(args.content?.length||0)}ch]`
        : name === 'edit_file' ? `${args.path} [${(args.target_text?.length||0)}→${(args.replacement_text?.length||0)}ch]`
        : JSON.stringify(args).slice(0, 150);
    onMessage({ text: `🛠️ ${name}(${shortArgs})`, isTool: true });

    try {
        let result;
        switch (name) {
            case 'read_file': {
                const content = (await fs.readFile(safePath(cwd, args.path), 'utf-8')).slice(0, 15000);
                if (memory) memory.indexFile(args.path, content.slice(0, 200));
                result = content;
                break;
            }
            case 'write_file': {
                if (!args.content || args.content.length < 50) { result = 'ERROR: Content too short. write_file needs COMPLETE file.'; break; }
                const abs = safePath(cwd, args.path);
                await fs.mkdir(path.dirname(abs), { recursive: true });
                await fs.writeFile(abs, args.content);
                if (memory) memory.indexFile(args.path, `Created/overwritten (${args.content.length} chars)`);
                result = `OK: wrote ${args.content.length} chars → ${args.path}`;
                break;
            }
            case 'edit_file': {
                const abs = safePath(cwd, args.path);
                let content = await fs.readFile(abs, 'utf-8');
                if (!content.includes(args.target_text)) { result = `ERROR: target_text not found. read_file first.`; break; }
                content = content.replace(args.target_text, args.replacement_text);
                await fs.writeFile(abs, content);
                result = `OK: edited ${args.path}`;
                break;
            }
            case 'run_command': {
                const { stdout, stderr } = await execAsync(typeof args.command === 'string' ? args.command : String(args.command), { cwd, timeout: 30000 });
                result = (stdout || stderr || 'OK').slice(0, 5000);
                break;
            }
            case 'search_files': {
                const q = args.query.replace(/"/g, '\\"');
                const { stdout } = await execAsync(`grep -rnI "${q}" . --include="*.html" --include="*.css" --include="*.js" --include="*.py" --include="*.json" | head -30`, { cwd });
                result = stdout || 'No results.';
                break;
            }
            case 'list_files': {
                const target = safePath(cwd, args.path || '.');
                async function walk(dir, depth = 0) {
                    if (depth > 3) return '';
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    let r = '';
                    for (const e of entries) {
                        if (['node_modules', '.git', '__pycache__', '.next', '.local-coder-audit.log', '.agent-memory'].includes(e.name)) continue;
                        const indent = '  '.repeat(depth);
                        if (e.isDirectory()) { r += `${indent}📁 ${e.name}/\n`; r += await walk(path.join(dir, e.name), depth + 1); }
                        else { const s = await fs.stat(path.join(dir, e.name)); r += `${indent}📄 ${e.name} (${s.size}b)\n`; }
                    }
                    return r;
                }
                result = (await walk(target)) || 'Empty directory.';
                break;
            }
            case 'fetch_url':
                result = await fetchUrl(args.url);
                break;
            case 'recall_memory':
                result = memory ? (memory.getRelevantMemory(args.query) || 'No relevant memories found.') : 'Memory not available.';
                break;
            default:
                result = `ERROR: Unknown tool '${name}'.`;
        }
        state.tracer?.logToolCall(name, args, result, Date.now() - t0);
        return result;
    } catch (err) {
        state.tracer?.logError(`${name}: ${err.message}`);
        return `ERROR: ${err.message}`;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 1: INFERENCE — Ollama API with observability
// ═══════════════════════════════════════════════════════════════════════
async function callOllama(endpoint, messages, model, toolsList, opts = {}, tracer) {
    const hour = new Date().getHours();
    const isWhisperMode = hour >= 20 || hour < 7;
    
    let gpuLayers = 5;
    let threads = undefined;
    
    if (isWhisperMode) {
        gpuLayers = 1; // Minimale GPU Last
        threads = 2;   // CPU stark limitieren
    }

    const options = { 
        num_predict: opts.num_predict || 16384, 
        temperature: opts.temperature || 0.4, 
        num_gpu: gpuLayers 
    };
    if (threads) options.num_thread = threads;

    const body = { model, messages, stream: false, options };
    if (toolsList) body.tools = toolsList;

    const t0 = Date.now();
    const response = await fetch(`${endpoint}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));

    const msg = data.message;
    if (!msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) msg.content = '(analyzing...)';

    // Observability: log tokens
    tracer?.logLLMCall(model, data.prompt_eval_count || 0, data.eval_count || 0);
    return msg;
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 2: AGENT ORCHESTRATION — State Graph with Checkpointing
// ═══════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You are an autonomous AI coding agent with persistent memory and internet access.

## AGENTIC WORKFLOW (THINK → ACT → OBSERVE → REPEAT)
1. THINK: Analyze state. What's done? What remains? Errors?
2. ACT: Call tools to make progress.
3. OBSERVE: Check results. Errors? Fix them.
4. REPEAT until complete.
5. FINISH: Say TASK_COMPLETE when verified.

## MEMORY
You have persistent memory across sessions. Use recall_memory to check past tasks and known files.
After completing work, your results are automatically saved for future reference.

## TOOL STRATEGY
- Start with list_files('.') + recall_memory('project context')
- EXISTING files: read_file → edit_file (surgical changes)
- NEW files: write_file (COMPLETE content, never fragments)
- NEVER create header.html/footer.html fragments. One page = one file.
- After writing, read_file to VERIFY correctness.
- On ERROR: analyze message, fix the problem, retry.
- Use fetch_url to read documentation when unsure about APIs/libraries.

## WEB QUALITY STANDARD
- Bootstrap 5 CDN + Inter font + dark premium CSS variables
- Bootstrap grid for ALL layouts. Responsive mobile-first.
- 350+ lines per HTML page. Realistic content only. Zero lorem ipsum.
- Smooth transitions, hover effects, gradient accents.

## ANTI-PATTERNS (NEVER)
- Fragment files, duplicate sections, <table> layout, lorem ipsum, [placeholders]
- Code in markdown (use write_file/edit_file)
- Half-written files`;

async function runLocalAgent(prompt, state, onMessage, onRequestApproval) {
    const endpoint = state.config?.ollamaEndpoint || 'http://127.0.0.1:11434';
    // upgraded to 32B model (Qwen 2.5 Coder 32B with Q4_K_M quantization)
    const MODEL = 'qwen2.5-coder:32b';
    const cwd = getCwd();

    // Initialize layers
    const tracer = new Tracer();
    state.tracer = tracer;
    const taskId = Date.now().toString(36);
    tracer.startTrace(taskId, prompt);

    const memoryDir = path.join(cwd, '.agent-memory');
    const memory = new AgentMemory(memoryDir);
    await memory.load();

    onMessage({ text: `🚀 Agentic AI v4 (${MODEL}) | Task: ${taskId}`, isTool: true });

    // Gather context
    let dirTree = '';
    try { dirTree = await executeTool(state, 'list_files', { path: '.' }, onMessage, memory); } catch(e) { dirTree = '(empty)'; }
    const memoryContext = memory.getRelevantMemory(prompt);

    let messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Workspace:\n${dirTree}${memoryContext ? '\n' + memoryContext : ''}\n\nTask: ${prompt}` }
    ];

    // State graph checkpoints
    let iterations = 0;
    const MAX = 50;
    let consecutiveEmpty = 0;
    let filesChanged = [];

    // ── THE AUTONOMOUS LOOP ─────────────────────────────────────────
    while (iterations < MAX) {
        iterations++;
        tracer.logStep('iteration', { n: iterations });

        let msg;
        try {
            msg = await callOllama(endpoint, messages, MODEL, tools, {}, tracer);
        } catch(e) {
            tracer.logError(e.message);
            onMessage({ text: `❌ ${e.message}`, isTool: true });
            if (iterations < MAX) { onMessage({ text: '🔄 Retrying...', isTool: true }); continue; }
            break;
        }
        messages.push(msg);

        if (msg.content) {
            const text = msg.content.trim();
            if (text && text !== '(analyzing...)') onMessage({ text, isTool: false, agent: '🤖 Agent' });
            if (text.includes('TASK_COMPLETE')) {
                // Save to episodic memory
                memory.addEpisode(prompt, `Completed in ${iterations} iterations`, filesChanged);
                await memory.save();
                const trace = tracer.endTrace();
                await tracer.saveTrace(path.join(memoryDir, 'traces'));
                onMessage({ text: `✅ Complete (${iterations} iters, ${trace?.tokensUsed || 0} tokens, ${trace?.toolCalls || 0} tool calls)`, isTool: true });
                return 'DONE';
            }
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            consecutiveEmpty = 0;
            for (const tc of msg.tool_calls) {
                let args;
                try { args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments || {}; } catch { args = {}; }

                let approved = true;
                if (onRequestApproval) { try { approved = await onRequestApproval({ name: tc.function.name, args }); } catch { approved = true; } }

                if (approved === true || approved === 'ESCALATE') {
                    const result = await executeTool(state, tc.function.name, args, onMessage, memory);
                    if (tc.function.name === 'write_file' || tc.function.name === 'edit_file') filesChanged.push(args.path);
                    messages.push({ role: 'tool', tool_call_id: tc.id || `c_${iterations}`, name: tc.function.name, content: String(result) });
                } else if (approved === false) {
                    messages.push({ role: 'tool', tool_call_id: tc.id || `c_${iterations}`, name: tc.function.name, content: 'Denied.' });
                } else if (typeof approved === 'string') {
                    messages.push({ role: 'tool', tool_call_id: tc.id || `c_${iterations}`, name: tc.function.name, content: `User: "${approved}"` });
                }
            }
        } else {
            consecutiveEmpty++;
            if (consecutiveEmpty >= 3) { onMessage({ text: '✅ Agent finished.', isTool: true }); break; }
            messages.push({ role: 'user', content: 'Continue. If done and verified, say TASK_COMPLETE.' });
        }

        if (messages.length > 50) messages = [messages[0], messages[1], ...messages.slice(-40)];
    }

    // Save memory even on incomplete
    memory.addEpisode(prompt, `Stopped after ${iterations} iterations`, filesChanged);
    await memory.save();
    tracer.endTrace();
    await tracer.saveTrace(path.join(memoryDir, 'traces'));
    return 'DONE';
}

// ═══════════════════════════════════════════════════════════════════════
// ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════════
async function runAgent(prompt, state, onMessage, onRequestApproval) {
    return await runLocalAgent(prompt, state, onMessage, onRequestApproval);
}

if (require.main === module) {
    const prompt = process.argv.slice(2).join(' ');
    if (!prompt) { console.log("Usage: node agent.js 'task'"); process.exit(1); }
    const state = { config: { ollamaEndpoint: 'http://127.0.0.1:11434' } };
    const onMessage = (m) => {
        if (m.agent) console.log(`\n[${m.agent}] ${m.text}`);
        else if (m.isTool) console.log(`  ${m.text}`);
        else console.log(m.text);
    };
    runAgent(prompt, state, onMessage, async () => true).then(() => {
        console.log('\n📊 Session Stats:', JSON.stringify(state.tracer?.getSummary() || {}));
    }).catch(console.error);
}

module.exports = { runAgent };
