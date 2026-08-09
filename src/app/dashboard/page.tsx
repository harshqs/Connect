"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check, FileText, Globe2, LockKeyhole, LogOut, Pencil,
  Plus, Search, Trash2, X, Loader2,
} from "lucide-react";
import {
  DocumentItem, User,
  createDocument, deleteDocument, fetchDocuments,
  fetchCurrentUser, updateProfile, googleSignInUrl,
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

  // Close dropdown on outside click
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
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateProfile({ name: name.trim(), color });
      onUpdated(updated);
      setEditing(false);
    } catch {
      setSaveError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    window.localStorage.removeItem("connect-session");
    router.replace("/");
  };

  const initials = user.name ? user.name[0].toUpperCase() : "?";

  return (
    <>
      {/* Avatar button */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-2xl border border-[#dfe5de] bg-white px-3 py-2 shadow-sm transition hover:shadow-md"
          aria-label="Account menu"
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="size-8 rounded-full object-cover" />
          ) : (
            <div
              className="size-8 rounded-full flex items-center justify-center text-sm font-black text-white"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
          )}
          <div className="hidden text-left sm:block">
            <p className="text-xs font-bold text-[#19382f] leading-tight max-w-[120px] truncate">{user.name}</p>
            <p className="text-[11px] text-[#8aa096] leading-tight max-w-[120px] truncate">{user.email}</p>
          </div>
          <svg className="size-3.5 text-[#8aa096] ml-1" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[#dfe5de] bg-white shadow-[0_16px_40px_rgba(29,56,46,.13)] z-50 overflow-hidden">
            {/* User info row */}
            <div className="px-4 py-3 border-b border-[#edf0eb]">
              <p className="text-xs font-bold text-[#19382f] truncate">{user.name}</p>
              <p className="text-[11px] text-[#8aa096] truncate">{user.email}</p>
            </div>
            <button
              onClick={openEdit}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#19382f] hover:bg-[#f3f8f4] transition"
            >
              <Pencil className="size-4 text-[#668077]" /> Edit profile
            </button>
            <div className="border-t border-[#edf0eb]" />
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#c6543d] hover:bg-[#fff4f0] transition"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        )}
      </div>

      {/* Edit profile modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-[#dfe5de] shadow-[0_24px_60px_rgba(29,56,46,.15)] p-7">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black tracking-[-0.04em] text-[#19382f]">Edit profile</h2>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-[#8aa096] hover:text-[#19382f] hover:bg-[#f3f8f4] transition">
                <X className="size-4" />
              </button>
            </div>

            {/* Avatar preview */}
            <div className="flex justify-center mb-6">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="size-20 rounded-full object-cover ring-4 ring-white shadow-md"
                  style={{ boxShadow: `0 0 0 4px ${color}40` }}
                />
              ) : (
                <div
                  className="size-20 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-md"
                  style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}40` }}
                >
                  {name.trim() ? name.trim()[0].toUpperCase() : "?"}
                </div>
              )}
            </div>

            {/* Display name */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#668077] mb-1.5">
                Display name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                className="w-full rounded-xl border border-[#d8e1d9] bg-[#f8faf8] px-4 py-2.5 text-sm text-[#19382f] font-semibold outline-none transition focus:border-[#4db59d] focus:bg-white focus:ring-4 focus:ring-[#4db59d]/10"
              />
            </div>

            {/* Color picker */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#668077] mb-2">
                Your color
              </label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="size-8 rounded-full transition-transform hover:scale-110 focus:outline-none flex items-center justify-center"
                    style={{
                      backgroundColor: c,
                      boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                    }}
                    aria-label={`Pick color ${c}`}
                  >
                    {color === c && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {saveError && (
              <p className="mb-4 rounded-xl border border-[#efc0b4] bg-[#fff4f0] px-3 py-2 text-xs text-[#943e29]">
                {saveError}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border border-[#dfe5de] px-4 py-2.5 text-sm font-semibold text-[#668077] hover:bg-[#f3f8f4] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="primary-action flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {saving ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</> : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      const user = await fetchCurrentUser();
      setCurrentUser(user);
      setDocuments(await fetchDocuments());
    } catch (err: any) {
      if (err?.message?.includes("Sign in")) {
        window.location.assign(googleSignInUrl);
        return;
      }
      setError("Your workspace could not be reached. Start the collaboration server, then try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocuments(); }, []);

  const visibleDocuments = useMemo(
    () => documents.filter((d) => d.title.toLowerCase().includes(query.toLowerCase())),
    [documents, query]
  );

  const createNew = async () => {
    try {
      const doc = await createDocument("Untitled document");
      window.location.assign(`/doc/${doc.id}`);
    } catch {
      setError("Could not create a document. Check that the collaboration server is running.");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this document permanently?")) return;
    try {
      await deleteDocument(id);
      setDocuments((curr) => curr.filter((d) => d.id !== id));
    } catch {
      setError("Could not delete this document. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f1eb] text-[#1d2925]">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">

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
            {currentUser && (
              <ProfileMenu
                user={currentUser}
                onUpdated={(u) => setCurrentUser(u)}
              />
            )}
            <button
              onClick={createNew}
              className="primary-action inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            >
              <Plus className="size-4" /> New document
            </button>
          </div>
        </header>

        {/* ── Search bar ── */}
        <section className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#789087]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents"
              className="w-full rounded-xl border border-[#d8e1d9] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#4db59d] focus:ring-4 focus:ring-[#4db59d]/10"
            />
          </label>
          <p className="text-sm text-[#668077]">
            {visibleDocuments.length} {visibleDocuments.length === 1 ? "document" : "documents"}
          </p>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-[#efc0b4] bg-[#fff4f0] p-4 text-sm text-[#943e29]">
            {error}
          </div>
        )}

        {/* ── Document grid ── */}
        {loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-white" />)}
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#cbd8ce] bg-white px-6 py-20 text-center">
            <FileText className="mx-auto size-8 text-[#8aa096]" />
            <h2 className="mt-4 text-lg font-bold">No documents yet</h2>
            <p className="mt-1 text-sm text-[#668077]">Create a document and invite someone to start collaborating.</p>
            <button onClick={createNew} className="primary-action mt-6 rounded-xl px-4 py-2.5 text-sm font-bold">
              Create document
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  {doc.isPublic
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eff8f2] px-2 py-1 text-[11px] font-bold text-[#287d67]"><Globe2 className="size-3" /> Shared</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f3f0] px-2 py-1 text-[11px] font-bold text-[#668077]"><LockKeyhole className="size-3" /> Private</span>
                  }
                </div>
                <h2 className="mt-5 truncate text-lg font-bold tracking-[-.025em]">{doc.title}</h2>
                <p className="mt-2 line-clamp-3 min-h-[60px] text-sm leading-relaxed text-[#71867d]">
                  {doc.content || "A blank document, ready for your next idea."}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-[#edf0eb] pt-4">
                  <span className="text-xs text-[#82958c]">
                    Updated {new Date(doc.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => remove(doc.id)}
                      className="rounded-lg p-2 text-[#8ca198] transition hover:bg-[#fff0ed] hover:text-[#c6543d]"
                      aria-label={`Delete ${doc.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <Link
                      href={`/doc/${doc.id}`}
                      className="rounded-lg bg-[#edf6ef] px-3 py-2 text-xs font-bold text-[#287d67] transition hover:bg-[#d9f0e1]"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
