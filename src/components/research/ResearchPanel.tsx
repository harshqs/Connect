"use client";

import { useState } from "react";
import { ExternalLink, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { researchDocument, ResearchResult } from "@/lib/api";

export function ResearchPanel({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!question.trim()) return;
    setLoading(true); setError("");
    try { setResult(await researchDocument(documentId, question)); }
    catch (err) { setError(err instanceof Error ? err.message : "Research failed"); }
    finally { setLoading(false); }
  };

  return <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#dce8df] bg-[#fffefa] shadow-2xl">
    <div className="flex items-center justify-between border-b border-[#e6ebe4] px-5 py-4"><div><div className="flex items-center gap-2 text-[#1d6954]"><Sparkles className="size-4" /><span className="text-sm font-extrabold">Research assistant</span></div><p className="mt-1 text-xs text-[#668077]">Web-backed answers with sources.</p></div><button onClick={onClose} className="rounded-lg p-2 text-[#668077] hover:bg-[#edf5ef]"><X className="size-4" /></button></div>
    <div className="border-b border-[#e6ebe4] p-5"><label className="text-xs font-bold text-[#466259]">What do you want to research?</label><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void run(); }} placeholder="Example: Compare solar and wind energy for a school presentation." className="mt-2 h-28 w-full resize-none rounded-xl border border-[#dce8df] bg-white p-3 text-sm text-[#25342e] outline-none focus:border-[#4db59d]" /><button disabled={loading || !question.trim()} onClick={() => void run()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#287d67] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}{loading ? "Researching the web…" : "Research with sources"}</button><p className="mt-2 text-center text-[11px] text-[#8aa096]">Press Ctrl/Cmd + Enter to run</p></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">{error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{error}</div>}{!result && !error && !loading && <div className="rounded-2xl border border-dashed border-[#dce8df] bg-[#f6faf7] p-5 text-sm leading-relaxed text-[#668077]">Ask a focused question. The assistant searches the web, summarizes the useful findings, and lists the sources it used.</div>}{result && <><article className="whitespace-pre-wrap text-sm leading-7 text-[#30453d]">{result.answer}</article><section className="mt-6 border-t border-[#e6ebe4] pt-4"><h3 className="text-xs font-extrabold uppercase tracking-wider text-[#668077]">Sources used</h3><div className="mt-3 space-y-2">{result.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-xl border border-[#dce8df] bg-white p-3 text-xs font-semibold text-[#287d67] hover:border-[#4db59d]"><ExternalLink className="mt-0.5 size-3.5 shrink-0" /><span className="line-clamp-2">{source.title}</span></a>)}</div></section></>}</div>
  </aside>;
}
