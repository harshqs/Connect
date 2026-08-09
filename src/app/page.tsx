"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText, Globe2, Radio, ShieldCheck, Users } from "lucide-react";
import { createDocument, fetchCurrentUser, googleSignInUrl } from "@/lib/api";
import { Suspense } from "react";

function LandingPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [createError, setCreateError] = useState("");
  const authFailed = params.get("auth") === "failed";

  useEffect(() => {
    // If a valid session exists, skip the landing page entirely
    fetchCurrentUser()
      .then(() => router.replace("/dashboard"))
      .catch(() => {}); // Not signed in — stay on landing page
  }, [router]);

  const handleCreateDocument = async () => {
    setCreateError("");
    try {
      const doc = await createDocument("Untitled note");
      router.push(`/doc/${doc.id}`);
    } catch {
      setCreateError("Connect to the collaboration server first, then try again.");
    }
  };

  return (
    <div className="app-shell min-h-screen text-[#f5f1e8]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="brand-mark grid size-10 place-items-center rounded-xl"><FileText className="size-5 text-[#10231f]" /></span>
          <span className="text-xl font-black tracking-[-.04em]">Connect</span>
        </Link>
        <div className="flex items-center gap-3">
          <a href={googleSignInUrl} className="secondary-action rounded-xl px-4 py-2 text-sm font-semibold">Sign in with Google</a>
        </div>
      </header>

      {authFailed && (
        <div className="mx-auto max-w-7xl px-6 md:px-10 mt-4">
          <div className="rounded-xl border border-[#efc0b4] bg-[#fff4f0]/20 px-4 py-3 text-sm text-[#ffd0c5]">
            Sign-in failed or was cancelled. Please try again.
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 pb-14 pt-14 md:px-10 md:pt-24">
        <section className="grid items-center gap-14 lg:grid-cols-[1fr_.9fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#8fd4af]/20 bg-[#8fd4af]/10 px-3 py-1.5 text-xs font-bold tracking-wide text-[#a8e3c7]">
              <Radio className="size-3.5" /> COLLABORATION, WITHOUT THE NOISE
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.065em] md:text-7xl">
              The shared space for work that is still taking shape.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#b8c9bd]">
              Connect keeps ideas, comments, and every contributor together in one calm, live document—so your team can think in the open.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={googleSignInUrl} className="primary-action inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-bold">
                Get started with Google <ArrowRight className="size-4" />
              </a>
              <button onClick={handleCreateDocument} className="secondary-action inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold">
                <Globe2 className="size-4" /> Try without signing in
              </button>
            </div>
            {createError && <p className="mt-4 text-sm font-medium text-[#ffd0c5]">{createError}</p>}
            <div className="mt-10 flex items-center gap-3 text-sm text-[#a9bdb0]">
              <div className="flex -space-x-2"><span className="grid size-7 place-items-center rounded-full border-2 border-[#17332c] bg-[#ef866c] text-[10px] font-bold text-[#10231f]">A</span><span className="grid size-7 place-items-center rounded-full border-2 border-[#17332c] bg-[#8fd4af] text-[10px] font-bold text-[#10231f]">R</span><span className="grid size-7 place-items-center rounded-full border-2 border-[#17332c] bg-[#d9b46e] text-[10px] font-bold text-[#10231f]">M</span></div>
              Live presence for every collaborator
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-4 md:p-5">
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-4 text-xs text-[#a9bdb0]"><span className="font-semibold text-[#edf2e9]">Design sprint notes</span><span className="rounded-full bg-[#8fd4af]/15 px-2.5 py-1 font-bold text-[#a8e3c7]">● Live</span></div>
            <div className="rounded-2xl bg-[#f5f1e8] p-6 text-[#18342c] md:p-8">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#5f786d]">Thursday, 10:30 AM</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-.045em]">Make the handoff feel effortless.</h2>
              <p className="mt-4 leading-relaxed text-[#547066]">The best ideas came from the quick sketch exercise. Let&apos;s turn those patterns into a simple first flow.</p>
              <div className="mt-7 space-y-3 border-t border-[#d9e3da] pt-5 text-sm"><p><span className="mr-2 rounded bg-[#d2f1df] px-1.5 py-0.5 font-bold text-[#276d5b]">Rahul</span> Added a note about onboarding</p><p><span className="mr-2 rounded bg-[#ffe0d7] px-1.5 py-0.5 font-bold text-[#a44a35]">Anant</span> is editing the action items</p></div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-4 md:grid-cols-3">
          {[
            [Radio, "Always in sync", "Yjs keeps every change aligned, even when several people edit at once."],
            [Users, "Presence with purpose", "See who is here, where they are working, and when they are actively typing."],
            [ShieldCheck, "Share with control", "Invite editors, grant view access, and keep a clear record of every version."],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof Radio;
            return <div key={title as string} className="panel rounded-2xl p-6"><FeatureIcon className="size-5 text-[#8fd4af]" /><h3 className="mt-5 text-lg font-bold">{title as string}</h3><p className="mt-2 text-sm leading-relaxed text-[#b8c9bd]">{text as string}</p></div>;
          })}
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl justify-between border-t border-white/10 px-6 py-7 text-xs text-[#8ca49a] md:px-10"><span>Connect · Real-time collaborative notes</span><span>Built for focused teams</span></footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="app-shell min-h-screen text-[#f5f1e8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#8fd4af]/40 border-t-[#8fd4af] rounded-full animate-spin" />
      </div>
    }>
      <LandingPageInner />
    </Suspense>
  );
}
