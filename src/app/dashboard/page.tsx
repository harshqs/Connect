"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check, FileText, FolderOpen, Globe2, LockKeyhole, LogOut,
  MoreVertical, Pencil, Plus, Search, Star, Trash2, X, Loader2,
  FolderPlus, ChevronRight,
} from "lucide-react";
import {
  DocumentItem, Folder, User,
  createDocument, deleteDocument, fetchDocuments,
  fetchCurrentUser, updateProfile, googleSignInUrl,
  fetchFolders, createFolder, renameFolder, deleteFolder,
  toggleStar, moveToFolder,
} from "@/lib/api";

const PRESET_COLORS = [
  "#2b7c6a", "#6366f1", "#e85d3a", "#d97706",
  "#0891b2", "#7c3aed", "#be185d", "#15803d",
];

// ─── Profile dropdown + edit modal ───────────────────────────────────────────
function ProfileMenu({ user, onUpdated }: { user: User; onUpdated: (u: User) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.color || "#2b7c6a");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openEdit = () => { setOpen(false); setName(user.name); setColor(user.color || "#2b7c6a"); setSaveError(""); setEditing(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true); setSaveError("");
    try {
      const updated = await updateProfile({ name: name.trim(), color });
      onUpdated(updated); setEditing(false);
    } catch { setSaveError("Could not save. Please try again."); }
    finally { setSaving(false); }
  };

  const signOut = () => { window.localStorage.removeItem("connect-session"); router.replace("/"); };
  const initials = user.name ? user.name[0].toUpperCase() : "?";

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-2xl border border-[#dfe5de] bg-white px-3 py-2 shadow-sm transition hover:shadow-md"
          aria-label="Account menu"
        >
          {user.avatar
            ? <img src={user.avatar} alt={user.name} className="size-8 rounded-full object-cover" />
            : <div className="size-8 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ backgroundColor: color }}>{initials}</div>
          }
          <div className="hidden text-left sm:block">
            <p className="text-xs font-bold text-[#19382f] leading-tight max-w-[120px] truncate">{user.name}</p>
            <p className="text-[11px] text-[#8aa096] leading-tight max-w-[120px] truncate">{user.email}</p>
          </div>
          <svg className="size-3.5 text-[#8aa096] ml-1" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[#dfe5de] bg-white shadow-[0_16px_40px_rgba(29,56,46,.13)] z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#edf0eb]">
              <p className="text-xs font-bold text-[#19382f] truncate">{user.name}</p>
              <p className="text-[11px] text-[#8aa096] truncate">{user.email}</p>
            </div>
            <button onClick={openEdit} className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#19382f] hover:bg-[#f3f8f4] transition">
              <Pencil className="size-4 text-[#668077]" /> Edit profile
            </button>
            <div className="border-t border-[#edf0eb]" />
            <button onClick={signOut} className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#c6543d] hover:bg-[#fff4f0] transition">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-[#dfe5de] shadow-[0_24px_60px_rgba(29,56,46,.15)] p-7">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black tracking-[-0.04em] text-[#19382f]">Edit profile</h2>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-[#8aa096] hover:text-[#19382f] hover:bg-[#f3f8f4] transition"><X className="size-4" /></button>
            </div>
            <div className="flex justify-center mb-6">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="size-20 rounded-full object-cover ring-4 ring-white shadow-md" style={{ boxShadow: `0 0 0 4px ${color}40` }} />
                : <div className="size-20 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-md" style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}40` }}>{name.trim() ? name.trim()[0].toUpperCase() : "?"}</div>
              }
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#668077] mb-1.5">Display name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} className="w-full rounded-xl border border-[#d8e1d9] bg-[#f8faf8] px-4 py-2.5 text-sm text-[#19382f] font-semibold outline-none transition focus:border-[#4db59d] focus:bg-white focus:ring-4 focus:ring-[#4db59d]/10" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#668077] mb-2">Your color</label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className="size-8 rounded-full transition-transform hover:scale-110 focus:outline-none flex items-center justify-center" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none" }} aria-label={`Pick color ${c}`}>
                    {color === c && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            {saveError && <p className="mb-4 rounded-xl border border-[#efc0b4] bg-[#fff4f0] px-3 py-2 text-xs text-[#943e29]">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-[#dfe5de] px-4 py-2.5 text-sm font-semibold text-[#668077] hover:bg-[#f3f8f4] transition">Cancel</button>
              <button onClick={handleSave} disabled={saving || !name.trim()} className="primary-action flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                {saving ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</> : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Folder context menu ──────────────────────────────────────────────────────
function FolderContextMenu({
  folder,
  onRename,
  onDelete,
}: {
  folder: Folder;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (renaming) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onRename(folder.id, name.trim()); setRenaming(false); } }}
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-xs rounded-lg border border-[#4db59d] bg-white px-2 py-1 outline-none w-28"
          maxLength={64}
        />
        <button type="submit" className="p-1 rounded text-[#287d67] hover:bg-[#edf5ef]"><Check className="w-3 h-3" /></button>
        <button type="button" onClick={() => setRenaming(false)} className="p-1 rounded text-[#668077] hover:bg-[#f3f8f4]"><X className="w-3 h-3" /></button>
      </form>
    );
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} className="p-1 rounded-lg text-[#8aa096] hover:text-[#19382f] hover:bg-[#f3f8f4] transition opacity-0 group-hover:opacity-100">
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-full top-0 ml-1 w-36 rounded-xl border border-[#dfe5de] bg-white shadow-lg z-50 overflow-hidden">
          <button onClick={() => { setOpen(false); setRenaming(true); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-[#19382f] hover:bg-[#f3f8f4]">
            <Pencil className="w-3.5 h-3.5 text-[#668077]" /> Rename
          </button>
          <button onClick={() => { setOpen(false); onDelete(folder.id); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-[#c6543d] hover:bg-[#fff4f0]">
            <Trash2 className="w-3.5 h-3.5" /> Delete folder
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Move-to-folder dropdown on a doc card ────────────────────────────────────
function MoveToFolderMenu({
  doc,
  folders,
  onMove,
}: {
  doc: DocumentItem;
  folders: Folder[];
  onMove: (docId: string, folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded-lg p-2 text-[#8ca198] transition hover:bg-[#edf5ef] hover:text-[#287d67]"
        title="Move to folder"
      >
        <FolderOpen className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-44 rounded-xl border border-[#dfe5de] bg-white shadow-lg z-50 overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#8aa096] border-b border-[#edf0eb]">Move to folder</p>
          <button
            onClick={(e) => { e.stopPropagation(); onMove(doc.id, null); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs hover:bg-[#f3f8f4] ${!doc.folderId ? "text-[#287d67] font-semibold" : "text-[#19382f]"}`}
          >
            <FileText className="w-3.5 h-3.5" /> Root (no folder)
            {!doc.folderId && <Check className="w-3 h-3 ml-auto" />}
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={(e) => { e.stopPropagation(); onMove(doc.id, f.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs hover:bg-[#f3f8f4] ${doc.folderId === f.id ? "text-[#287d67] font-semibold" : "text-[#19382f]"}`}
            >
              <FolderOpen className="w-3.5 h-3.5" /> {f.name}
              {doc.folderId === f.id && <Check className="w-3 h-3 ml-auto" />}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#8aa096] italic">No folders yet</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // "all" | "starred" | folder id
  const [activeView, setActiveView] = useState<string>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const user = await fetchCurrentUser();
      setCurrentUser(user);
      const [docs, fols] = await Promise.all([fetchDocuments(), fetchFolders()]);
      setDocuments(docs);
      setFolders(fols);
    } catch (err: any) {
      if (err?.message?.includes("Sign in")) { window.location.assign(googleSignInUrl); return; }
      setError("Your workspace could not be reached. Start the collaboration server, then try again.");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const visibleDocuments = useMemo(() => {
    let filtered = documents;
    if (activeView === "starred") filtered = filtered.filter((d) => d.isStarred);
    else if (activeView !== "all") filtered = filtered.filter((d) => d.folderId === activeView);
    if (query) filtered = filtered.filter((d) => d.title.toLowerCase().includes(query.toLowerCase()));
    return filtered;
  }, [documents, activeView, query]);

  const createNew = async () => {
    try {
      const doc = await createDocument("Untitled document");
      window.location.assign(`/doc/${doc.id}`);
    } catch { setError("Could not create a document. Check that the collaboration server is running."); }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this document permanently?")) return;
    try { await deleteDocument(id); setDocuments((curr) => curr.filter((d) => d.id !== id)); }
    catch { setError("Could not delete this document. Please try again."); }
  };

  const handleToggleStar = async (doc: DocumentItem) => {
    try {
      const updated = await toggleStar(doc.id, !doc.isStarred);
      setDocuments((curr) => curr.map((d) => d.id === doc.id ? { ...d, isStarred: updated.isStarred } : d));
    } catch { setError("Could not update star. Please try again."); }
  };

  const handleMoveToFolder = async (docId: string, folderId: string | null) => {
    try {
      const updated = await moveToFolder(docId, folderId);
      setDocuments((curr) => curr.map((d) => d.id === docId ? { ...d, folderId: updated.folderId } : d));
    } catch { setError("Could not move document. Please try again."); }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const folder = await createFolder(newFolderName.trim());
      setFolders((curr) => [...curr, folder]);
      setNewFolderName(""); setShowNewFolderInput(false);
    } catch { setError("Could not create folder."); }
    finally { setCreatingFolder(false); }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      const updated = await renameFolder(id, name);
      setFolders((curr) => curr.map((f) => f.id === id ? { ...f, name: updated.name } : f));
    } catch { setError("Could not rename folder."); }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!window.confirm("Delete this folder? Documents inside will move back to root.")) return;
    try {
      await deleteFolder(id);
      setFolders((curr) => curr.filter((f) => f.id !== id));
      setDocuments((curr) => curr.map((d) => d.folderId === id ? { ...d, folderId: null } : d));
      if (activeView === id) setActiveView("all");
    } catch { setError("Could not delete folder."); }
  };

  return (
    <main className="min-h-screen bg-[#f3f1eb] text-[#1d2925]">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfe5de] pb-7 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="brand-mark grid size-12 place-items-center rounded-2xl">
              <FileText className="size-6 text-[#10231f]" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#668077]">Your workspace</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-.045em]">My documents</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && <ProfileMenu user={currentUser} onUpdated={(u) => setCurrentUser(u)} />}
            <button onClick={createNew} className="primary-action inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">
              <Plus className="size-4" /> New document
            </button>
          </div>
        </header>

        <div className="mt-8 flex gap-6">

          {/* ── Sidebar ── */}
          <aside className="hidden md:flex flex-col w-52 flex-shrink-0 gap-1">
            {/* All / Starred */}
            <button
              onClick={() => setActiveView("all")}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeView === "all" ? "bg-[#287d67] text-white shadow-sm" : "text-[#19382f] hover:bg-[#e7f2eb]"}`}
            >
              <FileText className="size-4" /> All documents
            </button>
            <button
              onClick={() => setActiveView("starred")}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeView === "starred" ? "bg-[#287d67] text-white shadow-sm" : "text-[#19382f] hover:bg-[#e7f2eb]"}`}
            >
              <Star className="size-4" /> Starred
            </button>

            {/* Folder list */}
            <div className="mt-3">
              <div className="flex items-center justify-between px-3 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8aa096]">Folders</p>
                <button onClick={() => setShowNewFolderInput((v) => !v)} className="p-0.5 rounded text-[#8aa096] hover:text-[#287d67] transition" title="New folder">
                  <FolderPlus className="size-3.5" />
                </button>
              </div>

              {showNewFolderInput && (
                <form onSubmit={handleCreateFolder} className="flex items-center gap-1 px-2 pb-2">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="flex-1 text-xs rounded-lg border border-[#4db59d] bg-white px-2 py-1.5 outline-none"
                    maxLength={64}
                  />
                  <button type="submit" disabled={creatingFolder || !newFolderName.trim()} className="p-1.5 rounded-lg bg-[#287d67] text-white disabled:opacity-50">
                    <Check className="w-3 h-3" />
                  </button>
                </form>
              )}

              <div className="space-y-0.5">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition ${activeView === folder.id ? "bg-[#287d67] text-white" : "text-[#19382f] hover:bg-[#e7f2eb]"}`}
                    onClick={() => setActiveView(folder.id)}
                  >
                    <FolderOpen className="size-4 flex-shrink-0" />
                    <span className="flex-1 text-sm font-semibold truncate">{folder.name}</span>
                    <span className={`text-[10px] mr-1 ${activeView === folder.id ? "text-white/70" : "text-[#8aa096]"}`}>{folder._count?.documents ?? 0}</span>
                    <FolderContextMenu folder={folder} onRename={handleRenameFolder} onDelete={handleDeleteFolder} />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Search bar */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center mb-6">
              <label className="relative block w-full max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#789087]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documents"
                  className="w-full rounded-xl border border-[#d8e1d9] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#4db59d] focus:ring-4 focus:ring-[#4db59d]/10"
                />
              </label>
              <p className="text-sm text-[#668077]">{visibleDocuments.length} {visibleDocuments.length === 1 ? "document" : "documents"}</p>
            </div>

            {error && <div className="mb-6 rounded-xl border border-[#efc0b4] bg-[#fff4f0] p-4 text-sm text-[#943e29]">{error}</div>}

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-white" />)}
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cbd8ce] bg-white px-6 py-20 text-center">
                <FileText className="mx-auto size-8 text-[#8aa096]" />
                <h2 className="mt-4 text-lg font-bold">No documents here</h2>
                <p className="mt-1 text-sm text-[#668077]">
                  {activeView === "starred" ? "Star a document to see it here." : activeView !== "all" ? "Move documents into this folder." : "Create a document to start collaborating."}
                </p>
                {activeView === "all" && (
                  <button onClick={createNew} className="primary-action mt-6 rounded-xl px-4 py-2.5 text-sm font-bold">Create document</button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleDocuments.map((doc, index) => (
                  <article
                    key={doc.id}
                    className="group rounded-2xl border border-[#dfe5de] bg-white p-5 shadow-[0_8px_30px_rgba(29,56,46,.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(29,56,46,.11)]"
                    style={{ animation: `editor-enter .45s ${index * 60}ms both` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-[#edf6ef] text-[#287d67]">
                        <FileText className="size-5" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        {doc.isPublic
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eff8f2] px-2 py-1 text-[11px] font-bold text-[#287d67]"><Globe2 className="size-3" /> Shared</span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f3f0] px-2 py-1 text-[11px] font-bold text-[#668077]"><LockKeyhole className="size-3" /> Private</span>
                        }
                        <button
                          onClick={(e) => { e.preventDefault(); handleToggleStar(doc); }}
                          className={`p-1 rounded-lg transition ${doc.isStarred ? "text-amber-400 hover:text-amber-500" : "text-[#c0ccc5] hover:text-amber-400"}`}
                          title={doc.isStarred ? "Unstar" : "Star"}
                        >
                          <Star className={`size-4 ${doc.isStarred ? "fill-amber-400" : ""}`} />
                        </button>
                      </div>
                    </div>
                    <h2 className="mt-5 truncate text-lg font-bold tracking-[-.025em]">{doc.title}</h2>
                    <p className="mt-2 line-clamp-3 min-h-[60px] text-sm leading-relaxed text-[#71867d]">
                      {doc.content || "A blank document, ready for your next idea."}
                    </p>
                    <div className="mt-6 flex items-center justify-between border-t border-[#edf0eb] pt-4">
                      <span className="text-xs text-[#82958c]">
                        {new Date(doc.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                      <div className="flex items-center gap-1">
                        <MoveToFolderMenu doc={doc} folders={folders} onMove={handleMoveToFolder} />
                        <button
                          onClick={() => remove(doc.id)}
                          className="rounded-lg p-2 text-[#8ca198] transition hover:bg-[#fff0ed] hover:text-[#c6543d]"
                          aria-label={`Delete ${doc.title}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                        <Link href={`/doc/${doc.id}`} className="rounded-lg bg-[#edf6ef] px-3 py-2 text-xs font-bold text-[#287d67] transition hover:bg-[#d9f0e1]">
                          Open
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
