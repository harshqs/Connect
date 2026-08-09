"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Globe2, LockKeyhole, Plus, Search, Trash2 } from "lucide-react";
import { DocumentItem, createDocument, deleteDocument, fetchDocuments, fetchCurrentUser, googleSignInUrl } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      // Verify the user is signed in before loading documents
      await fetchCurrentUser();
      setDocuments(await fetchDocuments());
    } catch (err: any) {
      if (err?.message?.includes("401") || err?.message?.includes("Sign in")) {
        window.location.assign(googleSignInUrl);
        return;
      }
      setError("Your workspace could not be reached. Start the collaboration server, then try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadDocuments(); }, []);

  const visibleDocuments = useMemo(() => documents.filter((document) => document.title.toLowerCase().includes(query.toLowerCase())), [documents, query]);
  const createNew = async () => {
    try { const document = await createDocument("Untitled document"); window.location.assign(`/doc/${document.id}`); }
    catch { setError("Could not create a document. Check that the collaboration server is running."); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this document permanently?")) return;
    try { await deleteDocument(id); setDocuments((current) => current.filter((document) => document.id !== id)); }
    catch { setError("Could not delete this document. Please try again."); }
  };

  return (
    <main className="min-h-screen bg-[#f3f1eb] text-[#1d2925]">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
        <header className="flex flex-col justify-between gap-6 border-b border-[#dfe5de] pb-7 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4"><span className="brand-mark grid size-12 place-items-center rounded-2xl"><FileText className="size-6 text-[#10231f]" /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#668077]">Your workspace</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em]">My documents</h1></div></div>
          <button onClick={createNew} className="primary-action inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"><Plus className="size-4" /> New document</button>
        </header>

        <section className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <label className="relative block w-full max-w-md"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#789087]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" className="w-full rounded-xl border border-[#d8e1d9] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#4db59d] focus:ring-4 focus:ring-[#4db59d]/10" /></label>
          <p className="text-sm text-[#668077]">{visibleDocuments.length} {visibleDocuments.length === 1 ? "document" : "documents"}</p>
        </section>

        {error && <div className="mt-6 rounded-xl border border-[#efc0b4] bg-[#fff4f0] p-4 text-sm text-[#943e29]">{error}</div>}
        {loading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-white" />)}</div> : visibleDocuments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#cbd8ce] bg-white px-6 py-20 text-center"><FileText className="mx-auto size-8 text-[#8aa096]" /><h2 className="mt-4 text-lg font-bold">No documents yet</h2><p className="mt-1 text-sm text-[#668077]">Create a document and invite someone to start collaborating.</p><button onClick={createNew} className="primary-action mt-6 rounded-xl px-4 py-2.5 text-sm font-bold">Create document</button></div>
        ) : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleDocuments.map((document, index) => <article key={document.id} className="group rounded-2xl border border-[#dfe5de] bg-white p-5 shadow-[0_8px_30px_rgba(29,56,46,.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(29,56,46,.11)]" style={{ animation: `editor-enter .45s ${index * 60}ms both` }}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf6ef] text-[#287d67]"><FileText className="size-5" /></span>{document.isPublic ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eff8f2] px-2 py-1 text-[11px] font-bold text-[#287d67]"><Globe2 className="size-3" /> Shared</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f3f0] px-2 py-1 text-[11px] font-bold text-[#668077]"><LockKeyhole className="size-3" /> Private</span>}</div><h2 className="mt-5 truncate text-lg font-bold tracking-[-.025em]">{document.title}</h2><p className="mt-2 line-clamp-3 min-h-15 text-sm leading-relaxed text-[#71867d]">{document.content || "A blank document, ready for your next idea."}</p><div className="mt-6 flex items-center justify-between border-t border-[#edf0eb] pt-4"><span className="text-xs text-[#82958c]">Updated {new Date(document.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span><div className="flex items-center gap-1"><button onClick={() => remove(document.id)} className="rounded-lg p-2 text-[#8ca198] transition hover:bg-[#fff0ed] hover:text-[#c6543d]" aria-label={`Delete ${document.title}`}><Trash2 className="size-4" /></button><Link href={`/doc/${document.id}`} className="rounded-lg bg-[#edf6ef] px-3 py-2 text-xs font-bold text-[#287d67] transition hover:bg-[#d9f0e1]">Open</Link></div></div></article>)}</div>}
      </div>
    </main>
  );
}
