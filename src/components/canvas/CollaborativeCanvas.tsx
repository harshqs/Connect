"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Download, Copy, Trash2 } from "lucide-react";

type ShapeType = "select" | "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "freehand" | "text" | "start" | "process" | "decision" | "input" | "end";
type Shape = { id: string; type: Exclude<ShapeType, "select">; x: number; y: number; width: number; height: number; text?: string; points?: string; color?: string };
type User = { name: string; color: string; avatar?: string };
const W = 1200, H = 720;
const tools: Array<[ShapeType, string]> = [["select", "Select"], ["rectangle", "Rectangle"], ["ellipse", "Ellipse"], ["diamond", "Diamond"], ["arrow", "Arrow"], ["line", "Line"], ["freehand", "Draw"], ["text", "Text"]];
const flowTools: Array<[Exclude<ShapeType, "select">, string]> = [["start", "Start"], ["process", "Process"], ["decision", "Decision"], ["input", "Input / Output"], ["end", "End"]];

function sessionFor(documentId: string) {
  const key = `connect-session:${documentId}`;
  const saved = window.sessionStorage.getItem(key);
  if (saved) return saved;
  const id = Math.random().toString(36).slice(2);
  window.sessionStorage.setItem(key, id);
  return id;
}

export function CollaborativeCanvas({ documentId, currentUser }: { documentId: string; currentUser: User }) {
  const [tool, setTool] = useState<ShapeType>("select");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Array<{ id: number; name: string; color: string; x: number; y: number }>>([]);
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const sessionRef = useRef<string | null>(null);
  if (!sessionRef.current && typeof window !== "undefined") sessionRef.current = sessionFor(documentId);
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";
    const nextProvider = new WebsocketProvider(wsUrl, "yjs", ydoc, { params: { docId: documentId } });
    const map = ydoc.getMap<Shape>("canvas-shapes");
    const refresh = () => setShapes(Array.from(map.values()));
    map.observe(refresh); refresh();
    nextProvider.awareness.setLocalStateField("user", { ...currentUser, sessionId: sessionRef.current });
    const refreshCursors = () => {
      const cursors: Array<{ id: number; name: string; color: string; x: number; y: number }> = [];
      nextProvider.awareness.getStates().forEach((state: any, id) => {
        if (state.user?.sessionId !== sessionRef.current && state.canvasCursor) cursors.push({ id, name: state.user?.name || "Collaborator", color: state.user?.color || "#6366f1", ...state.canvasCursor });
      });
      setRemoteCursors(cursors);
    };
    nextProvider.awareness.on("change", refreshCursors); setProvider(nextProvider);
    return () => { map.unobserve(refresh); nextProvider.awareness.off("change", refreshCursors); nextProvider.destroy(); ydoc.destroy(); };
  }, [documentId, ydoc, currentUser]);

  const map = () => ydoc.getMap<Shape>("canvas-shapes");
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(W, (event.clientX - rect.left) * W / rect.width)), y: Math.max(0, Math.min(H, (event.clientY - rect.top) * H / rect.height)) };
  };
  const put = (shape: Shape) => ydoc.transact(() => map().set(shape.id, shape));
  const selected = shapes.find((shape) => shape.id === selectedId);
  const addNode = (type: Exclude<ShapeType, "select">, x = 130 + (shapes.length % 4) * 230, y = 110 + (Math.floor(shapes.length / 4) % 3) * 170) => {
    const text = type === "text" ? window.prompt("Text", "New text") || "Text" : type === "start" ? "Start" : type === "end" ? "End" : type === "process" ? "Process" : type === "decision" ? "Decision?" : type === "input" ? "Input / Output" : "";
    const isLine = type === "arrow" || type === "line";
    const next: Shape = { id: crypto.randomUUID(), type, x, y, width: isLine ? 170 : 160, height: isLine ? 0 : type === "text" ? 32 : 80, text, color: "#1e6b58" };
    put(next);
    if (["start", "process", "decision", "input", "end"].includes(type) && selected && selected.type !== "arrow" && selected.type !== "line") {
      put({ id: crypto.randomUUID(), type: "arrow", x: selected.x + selected.width, y: selected.y + selected.height / 2, width: next.x - (selected.x + selected.width), height: next.y + next.height / 2 - (selected.y + selected.height / 2), text: "" });
    }
    setSelectedId(next.id); setTool("select");
  };
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = (event.target as Element).closest("[data-shape-id]");
    const p = point(event);
    if (tool === "select" && target) {
      const id = target.getAttribute("data-shape-id")!; const shape = shapes.find((item) => item.id === id);
      if (shape) { setSelectedId(id); dragRef.current = { id, dx: p.x - shape.x, dy: p.y - shape.y }; svgRef.current?.setPointerCapture(event.pointerId); }
      return;
    }
    if (tool === "freehand") { setDrawing([p]); svgRef.current?.setPointerCapture(event.pointerId); return; }
    if (tool !== "select") addNode(tool, p.x, p.y);
    else setSelectedId(null);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const p = point(event);
    provider?.awareness.setLocalStateField("canvasCursor", p);
    if (drawing) { setDrawing([...drawing, p]); return; }
    if (dragRef.current) { const shape = shapes.find((item) => item.id === dragRef.current!.id); if (shape) put({ ...shape, x: p.x - dragRef.current.dx, y: p.y - dragRef.current.dy }); }
  };
  const onPointerUp = () => { if (drawing && drawing.length > 1) { const xs = drawing.map((p) => p.x), ys = drawing.map((p) => p.y); put({ id: crypto.randomUUID(), type: "freehand", x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points: drawing.map((p) => `${p.x},${p.y}`).join(" ") }); } setDrawing(null); dragRef.current = null; };
  const updateSelected = (partial: Partial<Shape>) => selected && put({ ...selected, ...partial });
  const removeSelected = () => { if (selectedId) { map().delete(selectedId); setSelectedId(null); } };
  const duplicateSelected = () => selected && put({ ...selected, id: crypto.randomUUID(), x: selected.x + 24, y: selected.y + 24 });
  const loadTemplate = () => { ydoc.transact(() => { map().clear(); }); setSelectedId(null); [["start",100,300,"Start"],["process",340,300,"Collect request"],["decision",600,300,"Approved?"],["end",900,180,"End"],["process",900,420,"Revise"]].forEach(([type,x,y,text], index) => put({ id: `template-${index}`, type: type as Shape["type"], x: x as number, y: y as number, width: 160, height: 80, text: text as string })); [[260,340,80,0],[500,340,100,0],[760,320,140,-100],[680,360,220,100]].forEach(([x,y,width,height], index) => put({ id: `arrow-${index}`, type: "arrow", x: x as number, y: y as number, width: width as number, height: height as number })); };
  const exportPng = async () => { const svg = svgRef.current; if (!svg) return; const source = new XMLSerializer().serializeToString(svg); const image = new Image(); image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H; canvas.getContext("2d")?.drawImage(image, 0, 0); const a = document.createElement("a"); a.download = "connect-flowchart.png"; a.href = canvas.toDataURL("image/png"); a.click(); URL.revokeObjectURL(image.src); }; image.src = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" })); };
  const renderShape = (shape: Shape) => { const active = selectedId === shape.id; const common = { stroke: active ? "#0c9a7a" : "#1e6b58", strokeWidth: active ? 3 : 2, fill: shape.type === "text" || shape.type === "arrow" || shape.type === "line" || shape.type === "freehand" ? "none" : "#f7fcf8" }; const label = shape.text && <text x={shape.x + shape.width / 2} y={shape.y + shape.height / 2 + 5} textAnchor="middle" fontSize="15" fill="#183b31" fontWeight="600">{shape.text}</text>;
    if (shape.type === "freehand") return <polyline key={shape.id} data-shape-id={shape.id} points={shape.points} fill="none" stroke="#1e6b58" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
    if (shape.type === "arrow" || shape.type === "line") return <g key={shape.id} data-shape-id={shape.id}><line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} {...common} markerEnd={shape.type === "arrow" ? "url(#canvas-arrow)" : undefined} />{shape.text && <text x={shape.x + shape.width / 2} y={shape.y + shape.height / 2 - 8} textAnchor="middle" fontSize="13" fill="#183b31">{shape.text}</text>}</g>;
    if (shape.type === "ellipse" || shape.type === "start" || shape.type === "end") return <g key={shape.id} data-shape-id={shape.id}><rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.type === "ellipse" ? shape.height / 2 : 26} {...common} />{label}</g>;
    if (shape.type === "diamond" || shape.type === "decision") return <g key={shape.id} data-shape-id={shape.id}><polygon points={`${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height / 2} ${shape.x + shape.width / 2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height / 2}`} {...common} />{label}</g>;
    if (shape.type === "input") return <g key={shape.id} data-shape-id={shape.id}><polygon points={`${shape.x + 20},${shape.y} ${shape.x + shape.width},${shape.y} ${shape.x + shape.width - 20},${shape.y + shape.height} ${shape.x},${shape.y + shape.height}`} {...common} />{label}</g>;
    if (shape.type === "text") return <text key={shape.id} data-shape-id={shape.id} x={shape.x} y={shape.y + 22} fontSize="18" fill="#183b31">{shape.text}</text>;
    return <g key={shape.id} data-shape-id={shape.id}><rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx="10" {...common} />{label}</g>;
  };
  return <div className="editor-canvas overflow-hidden rounded-2xl"><div className="flex flex-wrap items-center gap-2 border-b border-[#e6ebe4] bg-[#fbfcf9] p-3"><div className="flex flex-wrap gap-1">{tools.map(([id, label]) => <button key={id} onClick={() => setTool(id)} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${tool === id ? "bg-[#287d67] text-white" : "text-[#466259] hover:bg-[#e7f2eb]"}`}>{label}</button>)}</div><span className="h-6 w-px bg-[#dce8df]" /><div className="flex flex-wrap gap-1">{flowTools.map(([id, label]) => <button key={id} onClick={() => addNode(id)} className="rounded-lg border border-[#dce8df] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#466259] hover:border-[#4db59d]">{label}</button>)}</div><button onClick={loadTemplate} className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#287d67] hover:bg-[#e7f2eb]">Flow template</button><button onClick={exportPng} className="flex items-center gap-1 rounded-lg bg-[#287d67] px-2.5 py-1.5 text-xs font-bold text-white"><Download className="size-3.5" /> PNG</button></div>{selected && <div className="flex flex-wrap items-center gap-3 border-b border-[#e6ebe4] bg-white px-4 py-2 text-xs text-[#466259]"><span className="font-bold text-[#183b31]">Selected {selected.type}</span><label>W <input type="number" value={Math.round(selected.width)} onChange={(e) => updateSelected({ width: Math.max(20, Number(e.target.value)) })} className="ml-1 w-16 rounded border border-[#dce8df] px-1 py-0.5" /></label><label>H <input type="number" value={Math.round(selected.height)} onChange={(e) => updateSelected({ height: Math.max(0, Number(e.target.value)) })} className="ml-1 w-16 rounded border border-[#dce8df] px-1 py-0.5" /></label>{(selected.type === "arrow" || selected.type === "line") && <label>Label <input value={selected.text || ""} onChange={(e) => updateSelected({ text: e.target.value })} className="ml-1 rounded border border-[#dce8df] px-1 py-0.5" /></label>}<button onClick={duplicateSelected} className="flex items-center gap-1 font-semibold text-[#287d67]"><Copy className="size-3.5" /> Duplicate</button><button onClick={removeSelected} className="flex items-center gap-1 font-semibold text-rose-600"><Trash2 className="size-3.5" /> Delete</button></div>}<div className="overflow-auto bg-[#eef4ef] p-4"><svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="min-w-[800px] w-full rounded-xl bg-white shadow-inner touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => provider?.awareness.setLocalStateField("canvasCursor", null)}><defs><marker id="canvas-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#1e6b58" /></marker><pattern id="canvas-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e5eee8" strokeWidth="1" /></pattern></defs><rect width={W} height={H} fill="url(#canvas-grid)" />{shapes.map(renderShape)}{drawing && <polyline points={drawing.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#1e6b58" strokeWidth="3" />}{remoteCursors.map((cursor) => <g key={cursor.id} transform={`translate(${cursor.x} ${cursor.y})`} pointerEvents="none"><path d="M0 0 L0 18 L5 13 L10 22 L14 20 L9 11 L16 11 Z" fill={cursor.color} /><text x="12" y="-4" fontSize="12" fontWeight="700" fill={cursor.color}>{cursor.name}</text></g>)}</svg></div></div>;
}
