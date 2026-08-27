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
  RefreshCw,
  Sparkles,
  Layers,
  FileCode,
  Eye,
  Sliders,
  Download,
  Share2,
} from "lucide-react";

interface CollaborativeCodeEditorProps {
  documentId: string;
  currentUser: { name: string; color: string; avatar?: string };
}

const STARTER_TEMPLATES = {
  hero: {
    html: `<div className="container">
  <div className="badge">🚀 Powered by Connect Multiplayer</div>
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
<div className="overlay">✨ Interactive Particle Canvas</div>`,
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [collaborators, setCollaborators] = useState<Array<{ name: string; color: string }>>([]);

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
  };

  return (
    <div className="flex h-[calc(100vh-140px)] w-full flex-col overflow-hidden rounded-2xl border border-[#dfe5de] bg-[#0c1815] shadow-2xl">
      {/* Code Editor Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#08120e] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-[#4db59d]/15 px-3 py-1.5 text-xs font-bold text-[#7be3c4]">
            <Code2 className="size-4 text-[#4db59d]" />
            <span>Live Code Sandbox</span>
          </div>

          {/* Language Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 border border-white/5">
            {(["html", "css", "js"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1 text-xs font-mono font-bold uppercase transition ${
                  activeTab === tab
                    ? "bg-[#4db59d] text-[#081512] shadow-sm"
                    : "text-[#8fa79b] hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Template Selector & Controls */}
        <div className="flex items-center gap-2">
          {/* Active Collaborators */}
          <div className="hidden sm:flex items-center -space-x-1.5 mr-2">
            {collaborators.map((c, idx) => (
              <div
                key={idx}
                className="grid size-6 place-items-center rounded-full border border-black/40 text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: c.color }}
                title={`${c.name} is editing`}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadTemplate("hero")}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[#8fa79b] hover:bg-white/10 hover:text-white transition"
            >
              Hero Template
            </button>
            <button
              onClick={() => loadTemplate("particles")}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[#8fa79b] hover:bg-white/10 hover:text-white transition"
            >
              Particle Canvas
            </button>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#c3ded2] hover:bg-white/10 transition"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span className="hidden md:inline">{copied ? "Copied" : "Copy Code"}</span>
          </button>

          <button
            onClick={() => setIsFullPreview(!isFullPreview)}
            className="flex items-center gap-1.5 rounded-lg bg-[#4db59d]/20 px-3 py-1.5 text-xs font-bold text-[#7be3c4] hover:bg-[#4db59d]/30 transition"
          >
            {isFullPreview ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span>{isFullPreview ? "Editor View" : "Full Preview"}</span>
          </button>
        </div>
      </div>

      {/* Editor & Preview Split Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code Input Panel */}
        {!isFullPreview && (
          <div className="flex flex-1 flex-col border-r border-white/10 bg-[#071310]">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-1.5 text-[11px] font-mono text-[#6e8a7e]">
              <span className="flex items-center gap-1.5">
                <FileCode className="size-3.5 text-[#4db59d]" />
                <span>index.{activeTab}</span>
              </span>
              <span className="text-[10px] text-[#4db59d] font-bold">Real-time Yjs Sync</span>
            </div>

            <div className="relative flex-1 p-2 font-mono text-xs">
              <textarea
                value={activeTab === "html" ? htmlCode : activeTab === "css" ? cssCode : jsCode}
                onChange={(e) => updateCode(activeTab, e.target.value)}
                placeholder={`Enter ${activeTab.toUpperCase()} code here...`}
                spellCheck={false}
                className="h-full w-full resize-none border-none bg-transparent p-2 font-mono text-xs leading-relaxed text-[#d4ece3] outline-none selection:bg-[#4db59d]/40 focus:ring-0"
              />
            </div>
          </div>
        )}

        {/* Live Output Preview Frame */}
        <div className="flex flex-1 flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-1.5 text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <Eye className="size-3.5 text-[#2b7c6a]" />
              <span>Live Output Preview</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
              Live Interactive
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
    </div>
  );
}
