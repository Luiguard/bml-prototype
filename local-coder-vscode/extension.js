const vscode = require('vscode');
const { runAgent } = require('./agent');

class ChatViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        let currentApprovalResolver = null;
        let agentState = { useDeepseek: false, escalateRequested: false };

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'prompt':
                    {
                        try {
                            const config = vscode.workspace.getConfiguration('localCoder');
                            agentState.config = {
                                plannerModel: config.get('plannerModel') || 'qwen2.5-coder:7b',
                                coderModel: config.get('coderModel') || 'qwen2.5-coder:7b',
                                ollamaEndpoint: config.get('ollamaEndpoint') || 'http://127.0.0.1:11434',
                                enableAuditLogging: config.get('enableAuditLogging') !== false
                            };

                            agentState.useDeepseek = data.useDeepseek;
                            agentState.escalateRequested = false;

                            await runAgent(data.value, agentState, 
                                (msg) => {
                                    this._view.webview.postMessage({ type: 'addResponse', value: msg });
                                },
                                (toolRequest) => {
                                    return new Promise(resolve => {
                                        currentApprovalResolver = resolve;
                                        this._view.webview.postMessage({ 
                                            type: 'requestApproval', 
                                            value: toolRequest 
                                        });
                                    });
                                }
                            );
                        } catch(e) {
                            this._view.webview.postMessage({ type: 'addResponse', value: { text: "Error: " + e.message, isTool: false } });
                        }
                        break;
                    }
                case 'approvalResponse':
                    if (currentApprovalResolver) {
                        currentApprovalResolver(data.value);
                        currentApprovalResolver = null;
                    }
                    break;
                case 'escalateToDeepseek':
                    agentState.escalateRequested = true;
                    if (currentApprovalResolver) {
                        currentApprovalResolver("ESCALATE");
                        currentApprovalResolver = null;
                    }
                    break;
            }
        });
    }

    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Chat</title>
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); padding: 10px; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; margin: 0; }
        #chat { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; display: flex; flex-direction: column; gap: 10px; padding-right: 5px; }
        .msg { padding: 8px; border-radius: 5px; background: var(--vscode-editor-inactiveSelectionBackground); font-size: 13px; line-height: 1.4; word-wrap: break-word;}
        .user-msg { background: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; max-width: 85%; }
        .agent-msg { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); align-self: flex-start; max-width: 90%; }
        .tool-msg { font-size: 11px; opacity: 0.7; font-style: italic; background: transparent; border: none; padding: 2px 8px; }
        .approval-box { border: 1px solid var(--vscode-editorWarning-foreground); border-left: 4px solid var(--vscode-editorWarning-foreground); }
        .agent-badge { font-weight: bold; font-size: 11px; margin-bottom: 4px; opacity: 0.8; display: block; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 2px; }
        
        #input-box { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--vscode-widget-border); }
        textarea { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; resize: vertical; min-height: 60px; font-family: inherit;}
        
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px; cursor: pointer; border-radius: 2px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .deny-btn { background: var(--vscode-errorForeground); color: white; }
        .deny-btn:hover { opacity: 0.8; }
        .escalate-btn { background: var(--vscode-statusBarItem-warningBackground); color: var(--vscode-statusBarItem-warningForeground); font-weight: bold; font-size: 11px; padding: 4px 8px; margin-left: auto; border-radius: 4px;}
        
        .controls { display: flex; gap: 10px; align-items: center; font-size: 12px; }
        pre { background: var(--vscode-editor-background); padding: 5px; border-radius: 3px; font-size: 11px; overflow-x: auto; margin: 5px 0;}
    </style>
</head>
<body>
    <div id="chat">
        <div class="msg agent-msg">Hello! I'm your multi-agent VSCode assistant.</div>
    </div>
    <div id="input-box">
        <div class="controls">
            <label><input type="checkbox" id="autoApproveCb" checked> ⚡ Auto-Approve</label>
            <label><input type="checkbox" id="useDeepseek"> Use DeepSeek</label>
            <button id="escalateBtn" class="escalate-btn" title="Interrupt local AI and switch to DeepSeek">🚀 Escalate</button>
        </div>
        <textarea id="prompt" placeholder="Ask something or provide feedback..."></textarea>
        <button id="sendBtn">Send</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chat = document.getElementById('chat');
        const promptInput = document.getElementById('prompt');
        const sendBtn = document.getElementById('sendBtn');
        const useDeepseekCb = document.getElementById('useDeepseek');
        const autoApproveCb = document.getElementById('autoApproveCb');
        const escalateBtn = document.getElementById('escalateBtn');
        
        let pendingApproval = false;

        function addMessage(text, className, agentName) {
            const div = document.createElement('div');
            div.className = 'msg ' + className;
            
            if (agentName && className.includes('agent-msg')) {
                const badge = document.createElement('span');
                badge.className = 'agent-badge';
                badge.innerText = agentName;
                div.appendChild(badge);
            }
            
            const content = document.createElement('div');
            content.innerText = text;
            div.appendChild(content);
            
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        function escapeHtml(unsafe) {
            return (unsafe || "").toString()
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }

        function addSuggestionsBox(ideas) {
            const div = document.createElement('div');
            div.className = 'msg agent-msg';
            
            let html = \`
                <div class="agent-badge">💡 Future Suggestions</div>
                <div style="margin-bottom: 10px;">Select the ideas you want to build next:</div>
            \`;
            
            ideas.forEach((idea, index) => {
                html += \`
                    <div style="margin-bottom: 5px; display: flex; align-items: flex-start; gap: 5px;">
                        <input type="checkbox" id="idea-\${index}" class="idea-cb" value="\${escapeHtml(idea.desc)}" checked>
                        <label for="idea-\${index}"><strong>\${escapeHtml(idea.title)}</strong>: \${escapeHtml(idea.desc)}</label>
                    </div>
                \`;
            });
            
            html += \`
                <button class="build-ideas-btn" style="margin-top: 10px; background: #007acc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 2px;">Build Selected Ideas</button>
            \`;
            
            div.innerHTML = html;
            
            div.querySelector('.build-ideas-btn').addEventListener('click', () => {
                const selected = [];
                div.querySelectorAll('.idea-cb:checked').forEach(cb => selected.push(cb.value));
                if (selected.length > 0) {
                    const prompt = "Please build the following features:\\n- " + selected.join('\\n- ');
                    vscode.postMessage({ type: 'prompt', value: prompt });
                    div.innerHTML = '<em>Building selected ideas...</em>';
                } else {
                    div.innerHTML = '<em>No ideas selected.</em>';
                }
            });
            
            document.getElementById('chat-history').appendChild(div);
            div.scrollIntoView({ behavior: 'smooth' });
        }

        function addApprovalBox(toolReq) {
            const div = document.createElement('div');
            div.className = 'msg agent-msg approval-box';
            
            if (toolReq.name === 'CONFIRM_PLAN') {
                div.innerHTML = \`
                    <div class="agent-badge">📐 Architect</div>
                    <div style="font-weight: bold; margin-bottom: 5px;">Do you approve this plan?</div>
                    <div style="font-size: 11px; margin: 8px 0;">Click Approve to start coding, Reject to stop, or type feedback below to adjust the plan.</div>
                    <div style="display: flex; gap: 10px;">
                        <button class="allow-btn">Approve Plan</button>
                        <button class="deny-btn">Reject</button>
                    </div>
                \`;
            } else {
                div.innerHTML = \`
                    <div class="agent-badge">💻 Coder</div>
                    <div style="font-weight: bold; margin-bottom: 5px;">Agent wants to run: <code>\${escapeHtml(toolReq.name)}</code></div>
                    <pre>\${escapeHtml(JSON.stringify(toolReq.args, null, 2))}</pre>
                    <div style="font-size: 11px; margin: 8px 0;">Click Allow/Deny, or type feedback in the box below to intervene.</div>
                    <div style="display: flex; gap: 10px;">
                        <button class="allow-btn">Allow</button>
                        <button class="deny-btn">Deny</button>
                    </div>
                \`;
            }
            
            const allowBtn = div.querySelector('.allow-btn');
            const denyBtn = div.querySelector('.deny-btn');

            allowBtn.onclick = () => {
                if (!pendingApproval) return;
                pendingApproval = false;
                allowBtn.disabled = true; denyBtn.disabled = true;
                div.style.opacity = '0.7';
                vscode.postMessage({ type: 'approvalResponse', value: true });
            };

            denyBtn.onclick = () => {
                if (!pendingApproval) return;
                pendingApproval = false;
                allowBtn.disabled = true; denyBtn.disabled = true;
                div.style.opacity = '0.7';
                vscode.postMessage({ type: 'approvalResponse', value: false });
            };

            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        sendBtn.addEventListener('click', () => {
            const text = promptInput.value.trim();
            if (text) {
                addMessage(text, 'user-msg');
                promptInput.value = '';
                
                if (pendingApproval) {
                    pendingApproval = false;
                    document.querySelectorAll('.allow-btn, .deny-btn').forEach(b => b.disabled = true);
                    document.querySelectorAll('.approval-box').forEach(b => b.style.opacity = '0.7');
                    vscode.postMessage({
                        type: 'approvalResponse',
                        value: text
                    });
                } else {
                    vscode.postMessage({
                        type: 'prompt',
                        value: text,
                        useDeepseek: useDeepseekCb.checked
                    });
                }
            }
        });
        
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });

        escalateBtn.addEventListener('click', () => {
            useDeepseekCb.checked = true; // visually update
            if (pendingApproval) {
                pendingApproval = false;
                document.querySelectorAll('.allow-btn, .deny-btn').forEach(b => b.disabled = true);
                document.querySelectorAll('.approval-box').forEach(b => b.style.opacity = '0.7');
            }
            vscode.postMessage({ type: 'escalateToDeepseek' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'addResponse':
                    if (message.value.type === 'suggestions') {
                        addSuggestionsBox(message.value.ideas);
                    } else {
                        addMessage(message.value.text, message.value.isTool ? 'tool-msg' : 'agent-msg', message.value.agent);
                    }
                    break;
                case 'requestApproval':
                    if (autoApproveCb.checked) {
                        addMessage(\`⚡ Auto-approved: \${escapeHtml(message.value.name)}\`, 'tool-msg');
                        vscode.postMessage({ type: 'approvalResponse', value: true });
                    } else {
                        pendingApproval = true;
                        addApprovalBox(message.value);
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}

function activate(context) {
    const provider = new ChatViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('localCoderAgent.chatView', provider)
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
