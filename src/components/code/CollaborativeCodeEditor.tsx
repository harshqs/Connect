"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Code2,
  Play,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FileCode,
  Eye,
  Sliders,
  Files,
  Search,
  GitBranch,
  Settings,
  Terminal,
  ChevronRight,
  ChevronDown,
  X,
  Radio,
  Cpu,
  Package,
  FileText,
} from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/themes/prism-tomorrow.css";

interface CollaborativeCodeEditorProps {
  documentId: string;
  currentUser: { name: string; color: string; avatar?: string };
}

const STARTER_TEMPLATES = {
  hero: {
    html: `<div class="container">
  <div class="badge">🚀 Powered by Connect Multiplayer</div>
  <h1>Build Together in Real-Time</h1>
  <p>Create stunning web experiences with zero latency collaboration.</p>
  <button id="cta-btn">Click Me!</button>
  <div id="counter-display">Clicks: 0</div>
</div>`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
body {
  min-height: 100vh;
  background: linear-gradient(135deg, #091310 0%, #12241f 50%, #08120e 100%);
  color: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.container {
  text-align: center;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(77, 181, 157, 0.2);
  border-radius: 24px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  max-width: 500px;
}
.badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(77, 181, 157, 0.15);
  color: #7be3c4;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 20px;
}
h1 {
  font-size: 2.2rem;
  background: linear-gradient(to right, #ffffff, #7be3c4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 12px;
}
p { color: #8fa79b; font-size: 14px; margin-bottom: 24px; line-height: 1.6; }
button {
  padding: 12px 28px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(90deg, #2b7c6a, #4db59d);
  color: #081512;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 10px 20px rgba(77, 181, 157, 0.3);
}
button:hover { transform: translateY(-2px) scale(1.03); filter: brightness(1.1); }
#counter-display { margin-top: 16px; font-weight: 700; color: #4db59d; font-size: 14px; }`,
    js: `let count = 0;
const btn = document.getElementById("cta-btn");
const display = document.getElementById("counter-display");

btn.addEventListener("click", () => {
  count++;
  display.textContent = \`Clicks: \${count}\`;
  btn.style.transform = "scale(0.95)";
  setTimeout(() => btn.style.transform = "none", 100);
});`,
  },
  particles: {
    html: `<canvas id="canvas"></canvas>
<div class="overlay">✨ Interactive Particle Canvas</div>`,
    css: `body { margin: 0; background: #050a08; overflow: hidden; font-family: sans-serif; }
#canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  color: #7be3c4;
  font-weight: 800;
  font-size: 14px;
  background: rgba(0,0,0,0.6);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(77,181,157,0.3);
}`,
    js: `const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

const particles = Array.from({ length: 60 }, () => ({
  x: Math.random() * width,
  y: Math.random() * height,
  vx: (Math.random() - 0.5) * 2,
  vy: (Math.random() - 0.5) * 2,
  radius: Math.random() * 3 + 1
}));

function animate() {
  ctx.fillStyle = "rgba(5, 10, 8, 0.2)";
  ctx.fillRect(0, 0, width, height);

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > width) p.vx *= -1;
    if (p.y < 0 || p.y > height) p.vy *= -1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#4db59d";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#7be3c4";
    ctx.fill();
  });

  requestAnimationFrame(animate);
}
animate();`,
  },
};

export function CollaborativeCodeEditor({ documentId, currentUser }: CollaborativeCodeEditorProps) {
  const [activeTab, setActiveTab] = useState<"html" | "css" | "js">("html");
  const [htmlCode, setHtmlCode] = useState(STARTER_TEMPLATES.hero.html);
  const [cssCode, setCssCode] = useState(STARTER_TEMPLATES.hero.css);
  const [jsCode, setJsCode] = useState(STARTER_TEMPLATES.hero.js);

  const [copied, setCopied] = useState(false);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [collaborators, setCollaborators] = useState<Array<{ name: string; color: string }>>([]);

  // VS Code Layout Controls
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeActivity, setActiveActivity] = useState<"explorer" | "search" | "git" | "extensions">("explorer");
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "Connect VS Code Environment initialized.",
    "Yjs multiplayer signaling provider active.",
    "Press Run or edit files to execute live preview.",
  ]);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // Synchronize with Yjs WebSocket server
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://connect-y61u.onrender.com";
    const provider = new WebsocketProvider(wsUrl, "yjs", ydoc, {
      params: { docId: `code-${documentId}` },
    });
    providerRef.current = provider;

    provider.awareness.setLocalStateField("user", {
      name: currentUser.name,
      color: currentUser.color,
    });

    const codeMap = ydoc.getMap<string>("playground-code");

    // Initialize map if empty
    if (!codeMap.has("html")) codeMap.set("html", STARTER_TEMPLATES.hero.html);
    if (!codeMap.has("css")) codeMap.set("css", STARTER_TEMPLATES.hero.css);
    if (!codeMap.has("js")) codeMap.set("js", STARTER_TEMPLATES.hero.js);

    setHtmlCode(codeMap.get("html") || STARTER_TEMPLATES.hero.html);
    setCssCode(codeMap.get("css") || STARTER_TEMPLATES.hero.css);
    setJsCode(codeMap.get("js") || STARTER_TEMPLATES.hero.js);

    codeMap.observe(() => {
      setHtmlCode(codeMap.get("html") || "");
      setCssCode(codeMap.get("css") || "");
      setJsCode(codeMap.get("js") || "");
    });

    const updatePresence = () => {
      const states = Array.from(provider.awareness.getStates().values()) as Array<{ user?: { name: string; color: string } }>;
      const active = states
        .map((s) => s.user)
        .filter((u): u is { name: string; color: string } => Boolean(u && u.name));
      setCollaborators(active);
    };

    provider.awareness.on("change", updatePresence);

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId, currentUser]);

  const updateCode = (type: "html" | "css" | "js", val: string) => {
    if (type === "html") setHtmlCode(val);
    if (type === "css") setCssCode(val);
    if (type === "js") setJsCode(val);

    if (ydocRef.current) {
      const codeMap = ydocRef.current.getMap<string>("playground-code");
      codeMap.set(type, val);
    }
  };

  const srcDoc = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <style>${cssCode}</style>
</head>
<body>
  ${htmlCode}
  <script>${jsCode}</script>
</body>
</html>`;
  }, [htmlCode, cssCode, jsCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(srcDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadTemplate = (key: keyof typeof STARTER_TEMPLATES) => {
    const t = STARTER_TEMPLATES[key];
    updateCode("html", t.html);
    updateCode("css", t.css);
    updateCode("js", t.js);
    setTerminalLogs((prev) => [...prev, `Loaded template: ${key}`]);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e] font-sans shadow-2xl">
      {/* Top VS Code Window Title Bar */}
      <div className="flex h-9 items-center justify-between border-b border-white/10 bg-[#181818] px-3 text-xs text-[#cccccc]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="size-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="font-semibold text-white/90">Visual Studio Code</span>
          <span className="text-white/40">—</span>
          <span className="text-[#9da5b4]">index.{activeTab} — connect-workspace</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Collaborators */}
          <div className="flex items-center -space-x-1.5 mr-1">
            {collaborators.map((c, idx) => (
              <div
                key={idx}
                className="grid size-5 place-items-center rounded-full border border-black/40 text-[9px] font-bold text-white shadow-sm"
                style={{ backgroundColor: c.color }}
                title={`${c.name} is editing in real-time`}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white/5 rounded-md px-2 py-0.5 border border-white/10">
            <button
              onClick={() => loadTemplate("hero")}
              className="text-[11px] font-medium text-[#8fa79b] hover:text-white transition px-1.5 py-0.5"
            >
              Hero
            </button>
            <span className="text-white/20">|</span>
            <button
              onClick={() => loadTemplate("particles")}
              className="text-[11px] font-medium text-[#8fa79b] hover:text-white transition px-1.5 py-0.5"
            >
              Particles
            </button>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 text-xs text-[#8fa79b] hover:text-white transition"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span className="hidden md:inline">{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={() => setIsFullPreview(!isFullPreview)}
            className="flex items-center gap-1 text-xs font-semibold text-[#4db59d] hover:text-[#7be3c4] transition"
          >
            {isFullPreview ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span>{isFullPreview ? "Editor" : "Preview"}</span>
          </button>
        </div>
      </div>

      {/* Main IDE Layout Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* VS Code Activity Bar (Far Left) */}
        <div className="flex w-12 flex-col items-center justify-between border-r border-white/10 bg-[#333333] py-2 text-[#858585]">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => {
                setActiveActivity("explorer");
                setShowSidebar(activeActivity !== "explorer" || !showSidebar);
              }}
              className={`p-2 rounded transition relative ${
                showSidebar && activeActivity === "explorer" ? "text-white border-l-2 border-[#4db59d]" : "hover:text-white"
              }`}
              title="Explorer (Ctrl+Shift+E)"
            >
              <Files className="size-5" />
            </button>
            <button
              onClick={() => {
                setActiveActivity("search");
                setShowSidebar(activeActivity !== "search" || !showSidebar);
              }}
              className={`p-2 rounded transition ${
                showSidebar && activeActivity === "search" ? "text-white border-l-2 border-[#4db59d]" : "hover:text-white"
              }`}
              title="Search"
            >
              <Search className="size-5" />
            </button>
            <button
              onClick={() => {
                setActiveActivity("git");
                setShowSidebar(activeActivity !== "git" || !showSidebar);
              }}
              className={`p-2 rounded transition ${
                showSidebar && activeActivity === "git" ? "text-white border-l-2 border-[#4db59d]" : "hover:text-white"
              }`}
              title="Source Control"
            >
              <GitBranch className="size-5" />
            </button>
            <button
              onClick={() => {
                setActiveActivity("extensions");
                setShowSidebar(activeActivity !== "extensions" || !showSidebar);
              }}
              className={`p-2 rounded transition ${
                showSidebar && activeActivity === "extensions" ? "text-white border-l-2 border-[#4db59d]" : "hover:text-white"
              }`}
              title="Extensions"
            >
              <Package className="size-5" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button className="p-2 hover:text-white transition" title="Settings">
              <Settings className="size-5" />
            </button>
          </div>
        </div>

        {/* VS Code Sidebar (Collapsible) */}
        {showSidebar && (
          <div className="flex w-52 flex-col border-r border-white/10 bg-[#252526] text-xs text-[#cccccc]">
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[11px] font-bold tracking-wider text-[#bbbbbb] uppercase">
              <span>{activeActivity}</span>
              <button onClick={() => setShowSidebar(false)} className="hover:text-white">
                <X className="size-3.5" />
              </button>
            </div>

            {activeActivity === "explorer" && (
              <div className="flex flex-col py-2">
                <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-[#bbbbbb] hover:bg-white/5 cursor-pointer">
                  <ChevronDown className="size-3.5" />
                  <span>CONNECT-WORKSPACE</span>
                </div>

                <div className="pl-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[#bbbbbb]">
                    <ChevronDown className="size-3 text-[#bbbbbb]" />
                    <span className="font-semibold text-amber-400">src</span>
                  </div>

                  <div className="pl-4 flex flex-col gap-0.5">
                    <button
                      onClick={() => setActiveTab("html")}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-left w-full transition ${
                        activeTab === "html" ? "bg-[#37373d] text-white font-semibold" : "hover:bg-white/5 text-[#cccccc]"
                      }`}
                    >
                      <span className="text-orange-400 font-mono font-bold text-[10px]">HTML</span>
                      <span>index.html</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("css")}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-left w-full transition ${
                        activeTab === "css" ? "bg-[#37373d] text-white font-semibold" : "hover:bg-white/5 text-[#cccccc]"
                      }`}
                    >
                      <span className="text-sky-400 font-mono font-bold text-[10px]">CSS</span>
                      <span>style.css</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("js")}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-left w-full transition ${
                        activeTab === "js" ? "bg-[#37373d] text-white font-semibold" : "hover:bg-white/5 text-[#cccccc]"
                      }`}
                    >
                      <span className="text-yellow-400 font-mono font-bold text-[10px]">JS</span>
                      <span>script.js</span>
                    </button>
                  </div>
                </div>

                <div className="pl-6 mt-2 flex flex-col gap-0.5 text-white/50">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Package className="size-3.5 text-rose-400" />
                    <span>package.json</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <FileText className="size-3.5 text-slate-400" />
                    <span>README.md</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Center Split: Code Editor & Preview */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* VS Code Tab Bar */}
          {!isFullPreview && (
            <div className="flex h-9 items-center border-b border-white/10 bg-[#2d2d2d] overflow-x-auto">
              {(["html", "css", "js"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 border-r border-white/10 px-4 h-full text-xs font-mono transition ${
                    activeTab === tab
                      ? "bg-[#1e1e1e] text-white border-t-2 border-t-[#4db59d]"
                      : "bg-[#2d2d2d] text-[#969696] hover:bg-[#252526] hover:text-white"
                  }`}
                >
                  <span
                    className={
                      tab === "html" ? "text-orange-400" : tab === "css" ? "text-sky-400" : "text-yellow-400"
                    }
                  >
                    {tab === "html" ? "</>" : tab === "css" ? "#" : "{ }"}
                  </span>
                  <span>index.{tab}</span>
                  <span className="size-1.5 rounded-full bg-[#4db59d] inline-block ml-1 opacity-80" />
                </button>
              ))}
            </div>
          )}

          {/* Breadcrumbs Bar */}
          {!isFullPreview && (
            <div className="flex items-center gap-1 border-b border-white/5 bg-[#1e1e1e] px-4 py-1 text-[11px] text-[#888888] font-mono">
              <span>connect-workspace</span>
              <ChevronRight className="size-3" />
              <span>src</span>
              <ChevronRight className="size-3" />
              <span className="text-[#cccccc]">index.{activeTab}</span>
            </div>
          )}

          {/* Main Editor & Output Split */}
          <div className="flex flex-1 overflow-hidden">
            {/* Editor Pane */}
            {!isFullPreview && (
              <div className="flex flex-1 flex-col bg-[#1e1e1e] border-r border-white/10">
                <div className="relative flex-1 font-mono text-xs overflow-auto">
                  <Editor
                    value={activeTab === "html" ? htmlCode : activeTab === "css" ? cssCode : jsCode}
                    onValueChange={(code) => updateCode(activeTab, code)}
                    highlight={(code) =>
                      Prism.highlight(
                        code,
                        Prism.languages[activeTab === "html" ? "markup" : activeTab === "js" ? "javascript" : "css"],
                        activeTab === "html" ? "markup" : activeTab === "js" ? "javascript" : "css"
                      )
                    }
                    padding={16}
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: 13,
                      backgroundColor: "transparent",
                      minHeight: "100%",
                    }}
                    className="w-full text-[#d4ece3] selection:bg-[#4db59d]/40"
                    textareaClassName="outline-none focus:outline-none focus:ring-0"
                  />
                </div>
              </div>
            )}

            {/* Live Output Preview Pane */}
            <div className="flex flex-1 flex-col bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-1 text-[11px] font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Eye className="size-3.5 text-[#2b7c6a]" />
                  <span>Live Output Preview</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Sandbox
                </span>
              </div>

              <iframe
                srcDoc={srcDoc}
                title="Live Preview"
                sandbox="allow-scripts allow-modals"
                className="h-full w-full border-none bg-white"
              />
            </div>
          </div>

          {/* Integrated VS Code Terminal Panel (Bottom) */}
          {showTerminal && (
            <div className="h-28 border-t border-white/10 bg-[#181818] flex flex-col text-xs font-mono text-[#cccccc]">
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-1 bg-[#252526]">
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="size-3.5 text-[#4db59d]" /> Terminal
                  </span>
                  <span className="text-[#888888] hover:text-white cursor-pointer">Output</span>
                  <span className="text-[#888888] hover:text-white cursor-pointer">Problems (0)</span>
                </div>
                <button onClick={() => setShowTerminal(false)} className="hover:text-white">
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="flex-1 p-2.5 overflow-auto text-[11px] leading-relaxed text-emerald-400/90 font-mono">
                {terminalLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sky-400">user@connect-ide:~$</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VS Code Bottom Status Bar */}
      <div className="flex h-6 items-center justify-between bg-[#007acc] px-3 text-[11px] text-white font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded text-[10px]">
            <Radio className="size-3 animate-pulse text-emerald-300" />
            <span>WS: Connected</span>
          </div>

          <div className="flex items-center gap-1">
            <GitBranch className="size-3" />
            <span>main*</span>
          </div>

          <span>0 🟢 0 ⚠️</span>
        </div>

        <div className="flex items-center gap-4">
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span className="uppercase font-bold">{activeTab}</span>
          <span className="flex items-center gap-1">
            <Cpu className="size-3" /> Yjs Multiplayer Live
          </span>
        </div>
      </div>
    </div>
  );
}
