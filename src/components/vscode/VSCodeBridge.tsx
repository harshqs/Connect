"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Code2,
  ExternalLink,
  Minimize2,
  Maximize2,
  Terminal,
  Users,
  Radio,
  FileCode,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface VSCodeUser {
  name: string;
  color: string;
  activeFile?: string;
  activeLine?: number;
  snippet?: string;
  clientType?: "vscode" | "web";
}

interface VSCodeBridgeProps {
  documentId: string;
  currentUser: { name: string; color: string; avatar?: string };
}

export function VSCodeBridge({ documentId, currentUser }: { documentId: string; currentUser: { name: string; color: string } }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [vscodeUsers, setVscodeUsers] = useState<Array<{ id: number; user: VSCodeUser }>>([]);
  const [activeFiles, setActiveFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<string>("index.html");

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://connect-y61u.onrender.com";
    const p = new WebsocketProvider(wsUrl, "yjs", ydoc, { params: { docId: documentId } });

    // Announce web user state
    p.awareness.setLocalStateField("user", {
      ...currentUser,
      clientType: "web",
    });

    const updatePresence = () => {
      const states = p.awareness.getStates();
      const codeUsers: Array<{ id: number; user: VSCodeUser }> = [];
      states.forEach((state: any, id: number) => {
        if (state.user?.clientType === "vscode" || state.vscodeState) {
          codeUsers.push({
            id,
            user: {
              name: state.user?.name || "VS Code User",
              color: state.user?.color || "#6366f1",
              activeFile: state.vscodeState?.activeFile || "Untitled-1",
              activeLine: state.vscodeState?.activeLine || 1,
              snippet: state.vscodeState?.snippet || "",
              clientType: "vscode",
            },
          });
        }
      });
      setVscodeUsers(codeUsers);
    };

    p.awareness.on("change", updatePresence);
    updatePresence();

    // Listen to shared code files map
    const codeMap = ydoc.getMap<string>("code-files");
    const refreshFiles = () => {
      const files: Array<{ name: string; content: string }> = [];
      codeMap.forEach((content, name) => {
        files.push({ name, content });
      });
      if (files.length > 0) {
        setActiveFiles(files);
        if (!selectedFile || !files.some((f) => f.name === selectedFile)) {
          setSelectedFile(files[0].name);
        }
      }
    };

    codeMap.observe(refreshFiles);
    refreshFiles();
    setProvider(p);

    return () => {
      codeMap.unobserve(refreshFiles);
      p.awareness.off("change", updatePresence);
      p.destroy();
      ydoc.destroy();
    };
  }, [documentId, ydoc, currentUser]);

  const activeVSCodeUser = vscodeUsers[0]?.user;
  const deepLink = `vscode://connect-live/join?room=${documentId}&backend=${encodeURIComponent(
    process.env.NEXT_PUBLIC_WS_URL || "wss://connect-y61u.onrender.com"
  )}`;

  const currentFileContent =
    activeVSCodeUser?.snippet ||
    activeFiles.find((f) => f.name === selectedFile)?.content ||
    `// Live coding session ready\n// Connect with VS Code to collaborate live\nconsole.log("Connect ↔ VS Code Live Bridge active");`;

  return (
    <aside
      className={`fixed bottom-6 right-6 z-40 transition-all duration-300 ${
        isExpanded ? "w-[480px] max-w-[90vw]" : "w-[360px] max-w-[90vw]"
      }`}
      aria-label="Live VS Code Monitor"
    >
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-[#12241f]/95 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/[0.03]">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-lg bg-[#4db59d]/20 text-[#4db59d]">
              <Code2 className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-tight text-white">VS Code Live Bridge</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    vscodeUsers.length > 0
                      ? "bg-[#4db59d]/20 text-[#7be3c4]"
                      : "bg-white/10 text-[#8fa79b]"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      vscodeUsers.length > 0 ? "bg-[#4db59d] animate-ping" : "bg-white/40"
                    }`}
                  />
                  {vscodeUsers.length > 0 ? `${vscodeUsers.length} Dev Online` : "Standby"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-[#8fa79b] hover:bg-white/10 hover:text-white transition"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded-lg text-[#8fa79b] hover:bg-white/10 hover:text-white transition"
              title={isOpen ? "Minimize panel" : "Open panel"}
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Body */}
        {isOpen && (
          <div className="p-4 space-y-3">
            
            {/* All Active Collaborators List */}
            {vscodeUsers.length > 0 ? (
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {vscodeUsers.map((cu) => (
                  <div
                    key={cu.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.04] p-2 border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: cu.user.color }}
                      />
                      <span className="font-bold text-white text-[11px]">{cu.user.name}</span>
                      <span className="text-[#8fa79b] text-[10px]">editing</span>
                      <button
                        onClick={() => setSelectedFile(cu.user.activeFile || "index.html")}
                        className="font-mono text-[#7be3c4] bg-[#4db59d]/15 px-1.5 py-0.5 rounded text-[10px] hover:underline"
                        title="Click to view this file"
                      >
                        {cu.user.activeFile || "index.html"}:{cu.user.activeLine || 1}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/5 text-[11px] text-[#8fa79b] flex items-center justify-between">
                <span>Waiting for peer in VS Code...</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(documentId);
                    alert("Copied Room ID: " + documentId + "\nSend this to your friend!");
                  }}
                  className="font-mono text-[10px] text-[#4db59d] hover:underline bg-[#4db59d]/10 px-2 py-0.5 rounded flex items-center gap-1"
                  title="Click to copy Room ID"
                >
                  Room #{documentId.slice(0, 6)} (Copy)
                </button>
              </div>
            )}

            {/* Interactive File Tabs (index.html, style.css, etc.) */}
            {activeFiles.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {activeFiles.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFile(file.name)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono transition ${
                      selectedFile === file.name
                        ? "bg-[#4db59d]/20 text-[#7be3c4] font-bold border border-[#4db59d]/40"
                        : "bg-white/[0.04] text-[#8fa79b] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <FileCode className="size-3 text-[#4db59d]" />
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Code Snippet / Live Terminal Preview */}
            <div className="relative rounded-xl border border-black/40 bg-[#081512] p-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 text-[10px] text-[#6e8a7e]">
                <div className="flex items-center gap-1.5">
                  <FileCode className="size-3 text-[#4db59d]" />
                  <span className="font-bold text-white">{selectedFile}</span>
                </div>
                <span className="text-[#4db59d] font-semibold">Live Buffer</span>
              </div>
              <pre
                className={`overflow-x-auto text-[11px] leading-relaxed text-[#c3ded2] selection:bg-[#4db59d]/40 ${
                  isExpanded ? "max-h-60" : "max-h-28"
                }`}
              >
                <code>{currentFileContent}</code>
              </pre>
            </div>

            {/* 1-Click Action: Jump into VS Code */}
            <div className="pt-1 space-y-2">
              <a
                href={deepLink}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2b7c6a] to-[#4db59d] px-4 py-2.5 text-xs font-bold text-[#081512] shadow-lg shadow-[#4db59d]/20 transition hover:brightness-110 active:scale-[0.98]"
              >
                <Sparkles className="size-3.5 transition group-hover:rotate-12" />
                <span>Jump into VS Code</span>
                <ExternalLink className="size-3.5 opacity-80" />
              </a>
              
              <div className="flex items-center justify-between text-[10px] text-[#718b80] px-1">
                <span>First time?</span>
                <a
                  href="/connect-live.vsix"
                  download="connect-live.vsix"
                  className="font-semibold text-[#4db59d] hover:underline flex items-center gap-1"
                  title="Direct 1-click download of latest VS Code extension"
                >
                  Download Extension (.vsix)
                </a>
              </div>
            </div>

          </div>
        )}

      </div>
    </aside>
  );
}
