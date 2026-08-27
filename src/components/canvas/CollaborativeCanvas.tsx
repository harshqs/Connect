"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Download, Copy, Trash2, Edit2 } from "lucide-react";

type ShapeType = "select" | "eraser" | "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "freehand" | "text" | "start" | "process" | "decision" | "input" | "end";
type DrawableType = Exclude<ShapeType, "select" | "eraser">;
type Shape = { id: string; type: DrawableType; x: number; y: number; width: number; height: number; text?: string; points?: string; color?: string };
type User = { name: string; color: string; avatar?: string };

const W = 1200, H = 720;
const tools: Array<[ShapeType, string]> = [
  ["select", "Select"], ["rectangle", "Rectangle"], ["ellipse", "Ellipse"], 
  ["diamond", "Diamond"], ["arrow", "Arrow"], ["line", "Line"], 
  ["freehand", "Draw"], ["text", "Text"], ["eraser", "Eraser"]
];
const flowTools: Array<[DrawableType, string]> = [
  ["start", "Start"], ["process", "Process"], ["decision", "Decision"], 
  ["input", "Input / Output"], ["end", "End"]
];

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Array<{ id: number; name: string; color: string; x: number; y: number }>>([]);
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null);
  const [draft, setDraft] = useState<{ type: DrawableType; start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const sessionRef = useRef<string | null>(null);
  
  if (!sessionRef.current && typeof window !== "undefined") sessionRef.current = sessionFor(documentId);
  
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://connect-y61u.onrender.com";
    const nextProvider = new WebsocketProvider(wsUrl, "yjs", ydoc, { params: { docId: `canvas-${documentId}` } });
    const map = ydoc.getMap<Shape>("canvas-shapes");
    
    const refresh = () => setShapes(Array.from(map.values()));
    map.observe(refresh); 
    refresh();
    
    nextProvider.awareness.setLocalStateField("user", { ...currentUser, sessionId: sessionRef.current });
    
    const refreshCursors = () => {
      const cursors: Array<{ id: number; name: string; color: string; x: number; y: number }> = [];
      nextProvider.awareness.getStates().forEach((state: any, id) => {
        if (state.user?.sessionId !== sessionRef.current && state.canvasCursor) {
          cursors.push({ id, name: state.user?.name || "Collaborator", color: state.user?.color || "#6366f1", ...state.canvasCursor });
        }
      });
      setRemoteCursors(cursors);
    };
    
    nextProvider.awareness.on("change", refreshCursors); 
    setProvider(nextProvider);
    
    return () => { 
      map.unobserve(refresh); 
      nextProvider.awareness.off("change", refreshCursors); 
      nextProvider.destroy(); 
      ydoc.destroy(); 
    };
  }, [documentId, ydoc, currentUser]);

  const map = () => ydoc.getMap<Shape>("canvas-shapes");
  
  const point = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { 
      x: Math.max(0, Math.min(W, (event.clientX - rect.left) * W / rect.width)), 
      y: Math.max(0, Math.min(H, (event.clientY - rect.top) * H / rect.height)) 
    };
  };

  const put = (shape: Shape) => ydoc.transact(() => map().set(shape.id, shape));
  const selected = shapes.find((shape) => shape.id === selectedId);

  const makeShape = (type: DrawableType, start: { x: number; y: number }, end: { x: number; y: number }, id = crypto.randomUUID()): Shape => {
    const line = type === "arrow" || type === "line";
    const x = line ? start.x : Math.min(start.x, end.x), y = line ? start.y : Math.min(start.y, end.y);
    const width = line ? end.x - start.x : Math.abs(end.x - start.x);
    const height = line ? end.y - start.y : Math.abs(end.y - start.y);
    const text = id === "draft" ? "" : type === "text" ? "" : type === "start" ? "Start" : type === "end" ? "End" : type === "process" ? "Process" : type === "decision" ? "Decision?" : type === "input" ? "Input / Output" : "";
    return { id, type, x, y, width: type === "text" ? 100 : width, height: type === "text" ? 40 : height, text, color: "#1e6b58" };
  };

  const addNode = (type: DrawableType, start: { x: number; y: number }, end: { x: number; y: number }) => {
    const next = makeShape(type, start, end);
    put(next);
    
    if (["start", "process", "decision", "input", "end"].includes(type) && selected && selected.type !== "arrow" && selected.type !== "line") {
      put({ 
        id: crypto.randomUUID(), 
        type: "arrow", 
        x: selected.x + selected.width, 
        y: selected.y + selected.height / 2, 
        width: next.x - (selected.x + selected.width), 
        height: next.y + next.height / 2 - (selected.y + selected.height / 2), 
        text: "" 
      });
    }
    
    setSelectedId(next.id); 
    setTool("select");
    
    if (type === "text" || ["start", "process", "decision", "input", "end"].includes(type)) {
      setEditingId(next.id);
    }
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (editingId) return; // Disable drawing/selecting while inline editing

    const target = (event.target as Element).closest("[data-shape-id]");
    const p = point(event);
    
    if (tool === "eraser") {
      setEraserCursor(p);
      if (target) map().delete(target.getAttribute("data-shape-id")!);
      setSelectedId(null);
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    
    if (tool === "select" && target) {
      const id = target.getAttribute("data-shape-id")!; 
      const shape = shapes.find((item) => item.id === id);
      if (shape) { 
        setSelectedId(id); 
        dragRef.current = { id, dx: p.x - shape.x, dy: p.y - shape.y }; 
        svgRef.current?.setPointerCapture(event.pointerId); 
      }
      return;
    }
    
    if (tool === "freehand") { 
      setDrawing([p]); 
      svgRef.current?.setPointerCapture(event.pointerId); 
      return; 
    }
    
    if (tool !== "select") { 
      setDraft({ type: tool, start: p, end: p }); 
      svgRef.current?.setPointerCapture(event.pointerId); 
    } else {
      setSelectedId(null);
    }
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (editingId) return;

    const p = point(event);
    provider?.awareness.setLocalStateField("canvasCursor", p);
    
    if (tool === "eraser") {
      setEraserCursor(p);
      if (event.buttons === 1) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-shape-id]");
        if (target) map().delete(target.getAttribute("data-shape-id")!);
      }
      return;
    }
    
    if (drawing) { 
      setDrawing([...drawing, p]); 
      return; 
    }
    if (draft) { 
      setDraft({ ...draft, end: p }); 
      return; 
    }
    if (dragRef.current) { 
      const shape = shapes.find((item) => item.id === dragRef.current!.id); 
      if (shape) put({ ...shape, x: p.x - dragRef.current.dx, y: p.y - dragRef.current.dy }); 
    }
  };

  const onPointerUp = () => { 
    if (editingId) return;

    if (drawing && drawing.length > 1) { 
      const xs = drawing.map((p) => p.x), ys = drawing.map((p) => p.y); 
      put({ 
        id: crypto.randomUUID(), 
        type: "freehand", 
        x: Math.min(...xs), y: Math.min(...ys), 
        width: Math.max(...xs) - Math.min(...xs), 
        height: Math.max(...ys) - Math.min(...ys), 
        points: drawing.map((p) => `${p.x},${p.y}`).join(" ") 
      }); 
    } 
    
    if (draft) {
      if (draft.type === "text" || Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) > 8) {
        addNode(draft.type, draft.start, draft.end); 
      }
    }
    
    setDrawing(null); 
    setDraft(null); 
    dragRef.current = null; 
  };

  const updateSelected = (partial: Partial<Shape>) => selected && put({ ...selected, ...partial });
  
  const removeSelected = () => { 
    if (selectedId) { 
      map().delete(selectedId); 
      setSelectedId(null); 
      setEditingId(null);
    } 
  };
  
  const duplicateSelected = () => selected && put({ ...selected, id: crypto.randomUUID(), x: selected.x + 24, y: selected.y + 24 });
  
  const loadTemplate = () => { 
    ydoc.transact(() => { map().clear(); }); 
    setSelectedId(null); 
    setEditingId(null);
    
    [["start",100,300,"Start"],["process",340,300,"Collect request"],["decision",600,300,"Approved?"],["end",900,180,"End"],["process",900,420,"Revise"]].forEach(([type,x,y,text], index) => {
      put({ id: `template-${index}`, type: type as Shape["type"], x: x as number, y: y as number, width: 160, height: 80, text: text as string });
    }); 
    
    [[260,340,80,0],[500,340,100,0],[760,320,140,-100],[680,360,220,100]].forEach(([x,y,width,height], index) => {
      put({ id: `arrow-${index}`, type: "arrow", x: x as number, y: y as number, width: width as number, height: height as number });
    }); 
  };

  const exportPng = async () => { 
    const svg = svgRef.current; 
    if (!svg) return; 
    const source = new XMLSerializer().serializeToString(svg); 
    const image = new Image(); 
    image.onload = () => { 
      const canvas = document.createElement("canvas"); 
      canvas.width = W; canvas.height = H; 
      canvas.getContext("2d")?.drawImage(image, 0, 0); 
      const a = document.createElement("a"); 
      a.download = "connect-flowchart.png"; 
      a.href = canvas.toDataURL("image/png"); 
      a.click(); 
      URL.revokeObjectURL(image.src); 
    }; 
    image.src = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" })); 
  };

  const renderShape = (shape: Shape) => { 
    const active = selectedId === shape.id; 
    const common = { 
      stroke: active ? "#0c9a7a" : "#1e6b58", 
      strokeWidth: active ? 3 : 2, 
      fill: shape.type === "text" || shape.type === "arrow" || shape.type === "line" || shape.type === "freehand" ? "none" : "#f7fcf8",
      style: { cursor: tool === "select" ? "pointer" : "crosshair" }
    }; 
    
    const isEditing = editingId === shape.id;
    const label = (shape.text && !isEditing) && (
      <text 
        x={shape.type === "text" ? shape.x : shape.x + shape.width / 2} 
        y={shape.type === "text" ? shape.y + 18 : shape.y + shape.height / 2 + 5} 
        textAnchor={shape.type === "text" ? "start" : "middle"} 
        fontSize={shape.type === "text" ? "18" : "15"} 
        fill="#183b31" 
        fontWeight={shape.type === "text" ? "500" : "600"}
        style={{ pointerEvents: 'none' }}
      >
        {shape.text}
      </text>
    );

    let shapeElement = null;

    if (shape.type === "freehand") {
      shapeElement = <polyline key={shape.id} data-shape-id={shape.id} points={shape.points} fill="none" stroke="#1e6b58" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
    } else if (shape.type === "arrow" || shape.type === "line") {
      shapeElement = (
        <g key={shape.id} data-shape-id={shape.id}>
          <line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} {...common} markerEnd={shape.type === "arrow" ? "url(#canvas-arrow)" : undefined} />
          {label}
        </g>
      );
    } else if (shape.type === "ellipse" || shape.type === "start" || shape.type === "end") {
      shapeElement = (
        <g key={shape.id} data-shape-id={shape.id}>
          <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.type === "ellipse" ? shape.height / 2 : 26} {...common} />
          {label}
        </g>
      );
    } else if (shape.type === "diamond" || shape.type === "decision") {
      shapeElement = (
        <g key={shape.id} data-shape-id={shape.id}>
          <polygon points={`${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height / 2} ${shape.x + shape.width / 2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height / 2}`} {...common} />
          {label}
        </g>
      );
    } else if (shape.type === "input") {
      shapeElement = (
        <g key={shape.id} data-shape-id={shape.id}>
          <polygon points={`${shape.x + 20},${shape.y} ${shape.x + shape.width},${shape.y} ${shape.x + shape.width - 20},${shape.y + shape.height} ${shape.x},${shape.y + shape.height}`} {...common} />
          {label}
        </g>
      );
    } else if (shape.type === "text") {
      shapeElement = (
        <g key={shape.id} data-shape-id={shape.id}>
          <rect x={shape.x - 4} y={shape.y - 4} width={shape.width + 8} height={shape.height + 8} fill={active ? "rgba(77, 181, 157, 0.1)" : "transparent"} stroke={active ? "#4db59d" : "transparent"} strokeDasharray="4 4" rx="4" />
          {label}
        </g>
      );
    } else {
      shapeElement = (
        <g key={shape.id} data-shape-id={shape.id}>
          <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx="10" {...common} />
          {label}
        </g>
      );
    }

    return (
      <g 
        key={`wrap-${shape.id}`}
        onDoubleClick={() => {
          if (tool === "select") {
            setSelectedId(shape.id);
            setEditingId(shape.id);
          }
        }}
      >
        {shapeElement}
      </g>
    );
  };

  return (
    <div className="editor-canvas overflow-hidden rounded-2xl flex flex-col h-[calc(100vh-140px)] border border-[#dfe5de] shadow-lg">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e6ebe4] bg-[#fbfcf9] p-3">
        <div className="flex flex-wrap gap-1">
          {tools.map(([id, label]) => (
            <button 
              key={id} 
              onClick={() => { setTool(id); setEditingId(null); setSelectedId(null); }} 
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${tool === id ? "bg-[#287d67] text-white shadow-sm" : "text-[#466259] hover:bg-[#e7f2eb]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="h-6 w-px bg-[#dce8df]" />
        <div className="flex flex-wrap gap-1">
          {flowTools.map(([id, label]) => (
            <button 
              key={id} 
              onClick={() => { setTool(id); setEditingId(null); setSelectedId(null); }} 
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${tool === id ? "border-[#287d67] bg-[#e7f2eb] text-[#1d6954]" : "border-[#dce8df] bg-white text-[#466259] hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[#668077] ml-2 font-medium hidden md:block">
          {tool === "eraser" ? "Drag across shapes to erase." : "Choose a tool, then click or drag on canvas."}
        </span>
        
        <div className="ml-auto flex items-center gap-2">
          <button onClick={loadTemplate} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#287d67] hover:bg-[#e7f2eb] transition">
            Flow Template
          </button>
          <button onClick={exportPng} className="flex items-center gap-1.5 rounded-lg bg-[#287d67] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#1e6b58] transition">
            <Download className="size-3.5" /> Export
          </button>
        </div>
      </div>
      
      {selected && !editingId && (
        <div className="flex flex-wrap items-center gap-4 border-b border-[#e6ebe4] bg-white px-4 py-2.5 text-xs text-[#466259] animate-in fade-in slide-in-from-top-2 shadow-sm relative z-20">
          <span className="font-bold text-[#183b31] uppercase tracking-wider text-[10px] bg-[#e7f2eb] px-2 py-1 rounded-md">
            {selected.type}
          </span>
          
          <label className="flex items-center gap-2 font-semibold">
            W 
            <input 
              type="number" 
              value={Math.round(selected.width)} 
              onChange={(e) => updateSelected({ width: Math.max(20, Number(e.target.value)) })} 
              className="w-16 rounded-md border border-[#dce8df] px-2 py-1 focus:outline-none focus:border-[#4db59d] focus:ring-1 focus:ring-[#4db59d]" 
            />
          </label>
          <label className="flex items-center gap-2 font-semibold">
            H 
            <input 
              type="number" 
              value={Math.round(selected.height)} 
              onChange={(e) => updateSelected({ height: Math.max(20, Number(e.target.value)) })} 
              className="w-16 rounded-md border border-[#dce8df] px-2 py-1 focus:outline-none focus:border-[#4db59d] focus:ring-1 focus:ring-[#4db59d]" 
            />
          </label>
          
          <span className="w-px h-4 bg-[#dce8df]" />
          
          <button onClick={() => setEditingId(selected.id)} className="flex items-center gap-1.5 font-bold text-[#287d67] hover:bg-[#e7f2eb] px-2 py-1 rounded-md transition">
            <Edit2 className="size-3.5" /> Edit Text
          </button>
          <button onClick={duplicateSelected} className="flex items-center gap-1.5 font-bold text-[#287d67] hover:bg-[#e7f2eb] px-2 py-1 rounded-md transition">
            <Copy className="size-3.5" /> Duplicate
          </button>
          <button onClick={removeSelected} className="flex items-center gap-1.5 font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-md transition">
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      )}
      
      <div className="relative flex-1 overflow-auto bg-[#eef4ef] p-4 group">
        <div className="relative mx-auto bg-white shadow-sm" style={{ width: W, height: H }}>
          {/* HTML Overlay for Inline Editing */}
          {editingId && shapes.find(s => s.id === editingId) && (() => {
            const shape = shapes.find(s => s.id === editingId)!;
            const isText = shape.type === "text";
            
            return (
              <div 
                className="absolute z-10 p-1"
                style={{
                  left: isText ? shape.x - 4 : shape.x,
                  top: isText ? shape.y - 4 : shape.y + shape.height / 2 - 20,
                  width: isText ? Math.max(150, shape.width) : shape.width,
                }}
              >
                <textarea
                  autoFocus
                  defaultValue={shape.text}
                  onBlur={(e) => {
                    updateSelected({ text: e.target.value });
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      updateSelected({ text: e.currentTarget.value });
                      setEditingId(null);
                    }
                    if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  className={`w-full resize-none rounded-md border-2 border-[#4db59d] bg-white px-2 py-1 shadow-xl focus:outline-none focus:ring-4 focus:ring-[#4db59d]/20 ${
                    isText ? "text-[18px] font-medium text-left" : "text-[15px] font-bold text-center"
                  } text-[#183b31]`}
                  rows={isText ? 3 : 1}
                  placeholder="Type text here..."
                />
              </div>
            );
          })()}

          <svg 
            ref={svgRef} 
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`} 
            className={`w-full h-full touch-none transition-shadow ${tool === "eraser" ? "cursor-none" : ""}`} 
            onPointerDown={onPointerDown} 
            onPointerMove={onPointerMove} 
            onPointerUp={onPointerUp} 
            onPointerLeave={() => { 
              provider?.awareness.setLocalStateField("canvasCursor", null); 
              setEraserCursor(null); 
            }}
          >
            <defs>
              <marker id="canvas-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="#1e6b58" />
              </marker>
              <pattern id="canvas-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e5eee8" strokeWidth="1" />
              </pattern>
            </defs>
            
            <rect width={W} height={H} fill="url(#canvas-grid)" />
            
            {shapes.map(renderShape)}
            
            {draft && renderShape(makeShape(draft.type, draft.start, draft.end, "draft"))}
            
            {drawing && (
              <polyline 
                points={drawing.map((p) => `${p.x},${p.y}`).join(" ")} 
                fill="none" 
                stroke="#1e6b58" 
                strokeWidth="3" 
              />
            )}
            
            {eraserCursor && tool === "eraser" && (
              <g transform={`translate(${eraserCursor.x} ${eraserCursor.y}) rotate(-20)`} pointerEvents="none">
                <rect x="-11" y="-9" width="22" height="18" rx="3" fill="#f97316" stroke="#9a3412" strokeWidth="2" />
                <path d="M-5 -9 L11 -9 L11 -2 L-5 -2 Z" fill="#fed7aa" />
              </g>
            )}
            
            {remoteCursors.map((cursor) => (
              <g key={cursor.id} transform={`translate(${cursor.x} ${cursor.y})`} pointerEvents="none">
                <path d="M0 0 L0 18 L5 13 L10 22 L14 20 L9 11 L16 11 Z" fill={cursor.color} />
                <text x="12" y="-4" fontSize="12" fontWeight="700" fill={cursor.color} style={{ textShadow: "1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff" }}>
                  {cursor.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
