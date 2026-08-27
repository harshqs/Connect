"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Code2,
  Sparkles,
  Users,
  Radio,
  ShieldCheck,
  Zap,
  PenTool,
  Layers,
  CheckCircle2,
  Lock,
  Globe,
  Flame,
} from "lucide-react";
import { createDocument, fetchCurrentUser, googleSignInUrl } from "@/lib/api";
import { Suspense } from "react";

function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function LandingPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const authFailed = params.get("auth") === "failed";

  useEffect(() => {
    // If a valid session already exists, jump straight to the dashboard
    fetchCurrentUser()
      .then(() => router.replace("/dashboard"))
      .catch(() => {});
  }, [router]);

  const handleCreateDocument = async () => {
    setCreateError("");
    setIsCreating(true);
    try {
      const doc = await createDocument("Untitled workspace");
      router.push(`/doc/${doc.id}`);
    } catch {
      // Fallback: Create instant guest sandbox workspace ID
      const sandboxId = `sandbox-${Math.random().toString(36).slice(2, 10)}`;
      router.push(`/doc/${sandboxId}`);
    }
  };

  return (
    <div className="app-shell min-h-screen text-[#f5f1e8] selection:bg-[#4db59d]/30 selection:text-white relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-gradient-to-b from-[#4db59d]/20 to-transparent blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -left-40 size-[500px] rounded-full bg-[#ef866c]/10 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-10 -right-40 size-[500px] rounded-full bg-[#2b7c6a]/20 blur-[130px]" />

      {/* Navbar */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="brand-mark grid size-10 place-items-center rounded-xl transition group-hover:scale-105">
            <Sparkles className="size-5 text-[#10231f]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight leading-none">Connect</span>
            <span className="text-[10px] font-semibold text-[#8fa79b] tracking-wider uppercase">Multiplayer Workspace</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateDocument}
            disabled={isCreating}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[#dfeae4] backdrop-blur-md transition hover:bg-white/10 hover:text-white"
          >
            <Zap className="size-3.5 text-[#4db59d]" /> Quick Sandbox
          </button>
          <a
            href={googleSignInUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#10231f] shadow-lg shadow-black/10 transition hover:bg-[#edf5ef] hover:scale-[1.02] active:scale-[0.98]"
          >
            <GoogleIcon className="size-4" />
            <span>Sign In</span>
          </a>
        </div>
      </header>

      {/* Error alert if OAuth fails */}
      {authFailed && (
        <div className="relative z-10 mx-auto max-w-2xl px-6 mt-4 animate-bounce">
          <div className="flex items-center gap-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 backdrop-blur-lg shadow-lg">
            <div className="size-2 rounded-full bg-rose-400 animate-pulse" />
            <span>Sign-in was cancelled or encountered an issue. Please try again.</span>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-10 md:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          
          {/* Left Column: Vision & Action */}
          <div className="flex flex-col items-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#4db59d]/30 bg-[#4db59d]/10 px-3.5 py-1.5 text-xs font-bold tracking-wide text-[#7be3c4] backdrop-blur-md shadow-sm">
              <Flame className="size-3.5 text-[#ef866c]" /> REAL-TIME COLLABORATIVE ECOSYSTEM
            </div>

            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-[-0.05em] sm:text-6xl lg:text-[4.2rem]">
              Where ideas, docs & code <span className="bg-gradient-to-r from-[#4db59d] via-[#8fd4af] to-[#ef866c] bg-clip-text text-transparent">sync live</span>.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#b9cdc2] sm:text-lg">
              No merge conflicts. No waiting for Git pushes. Connect gives you a multiplayer document editor, collaborative whiteboard canvas, and AI research engine—all in real-time.
            </p>

            {/* Quick Sign-In / Get Started Card */}
            <div className="mt-8 w-full max-w-lg rounded-2xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <p className="text-xs font-semibold text-[#8fa79b] uppercase tracking-wider mb-3">
                Instant Access — No credit card required
              </p>
              
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={googleSignInUrl}
                  className="flex-1 inline-flex items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-[#10231f] shadow-md transition hover:bg-[#edf5ef] hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                >
                  <GoogleIcon className="size-5" />
                  <span>Continue with Google</span>
                </a>
                
                <button
                  onClick={handleCreateDocument}
                  disabled={isCreating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-semibold text-[#f5f1e8] backdrop-blur-md transition hover:bg-white/15 hover:border-white/30 active:scale-[0.99] disabled:opacity-50"
                >
                  {isCreating ? (
                    <div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Zap className="size-4 text-[#4db59d]" />
                      <span>Guest Sandbox</span>
                    </>
                  )}
                </button>
              </div>

              {createError && (
                <p className="mt-3 text-xs font-medium text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                  {createError}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-[#8fa79b]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-[#4db59d]" /> Real-time Yjs CRDT
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-[#4db59d]" /> Zero lag sync
                </span>
                <span className="flex items-center gap-1.5">
                  <Lock className="size-3.5 text-[#4db59d]" /> Encrypted sessions
                </span>
              </div>
            </div>

            {/* Social Proof / Collaborators Counter */}
            <div className="mt-7 flex items-center gap-4 text-xs text-[#a0b6aa]">
              <div className="flex -space-x-2.5">
                <div className="grid size-8 place-items-center rounded-full border-2 border-[#10231f] bg-[#ef866c] font-bold text-[#10231f] shadow-sm">A</div>
                <div className="grid size-8 place-items-center rounded-full border-2 border-[#10231f] bg-[#4db59d] font-bold text-[#10231f] shadow-sm">H</div>
                <div className="grid size-8 place-items-center rounded-full border-2 border-[#10231f] bg-[#d9b46e] font-bold text-[#10231f] shadow-sm">R</div>
                <div className="grid size-8 place-items-center rounded-full border-2 border-[#10231f] bg-[#6366f1] font-bold text-white shadow-sm">+</div>
              </div>
              <div>
                <p className="font-semibold text-white">Live Multiplayer Presence</p>
                <p className="text-[11px] text-[#8fa79b]">Multi-cursor tracking & peer awareness</p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive App Preview Window */}
          <div className="relative">
            <div className="relative rounded-3xl border border-white/15 bg-[#17332c]/80 p-3 shadow-[0_30px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-3 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-[#ef6c6c]/80" />
                  <div className="size-3 rounded-full bg-[#e8c15d]/80" />
                  <div className="size-3 rounded-full bg-[#4db59d]/80" />
                  <span className="ml-2 font-mono text-[11px] text-[#9db4a8]">sprint-room.connect</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4db59d]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#7fe0c4]">
                    <span className="size-1.5 rounded-full bg-[#4db59d] animate-ping" /> 3 Online
                  </span>
                </div>
              </div>

              {/* Window Workspace Mockup */}
              <div className="mt-3 rounded-2xl bg-[#fffefa] p-5 text-[#18342c] shadow-inner">
                {/* Mock Tabs */}
                <div className="flex items-center gap-2 border-b border-[#e2e8e2] pb-3 text-xs">
                  <span className="flex items-center gap-1.5 rounded-lg bg-[#e7f3ec] px-3 py-1.5 font-bold text-[#216b57]">
                    <Code2 className="size-3.5" /> Project Note
                  </span>
                  <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[#647c72] hover:bg-slate-100">
                    <PenTool className="size-3.5" /> Canvas
                  </span>
                </div>

                {/* Content body */}
                <div className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#d5f0e1] px-2 py-0.5 text-[10px] font-bold text-[#216b57]">COLLAB ACTIVE</span>
                    <span className="text-[11px] text-[#7d968b]">Syncing across 2 peers</span>
                  </div>

                  <h3 className="text-xl font-black text-[#133027] tracking-tight">
                    Multiplayer Web Architecture & Flow
                  </h3>

                  <p className="text-xs leading-relaxed text-[#4f6b60]">
                    Real-time CRDT updates sync state over WebSockets directly into ProseMirror & vector maps. Zero merge conflicts or stale state.
                  </p>

                  {/* Simulated Live Cursor Tag */}
                  <div className="relative my-2 rounded-xl border border-[#dce8df] bg-[#f4faf6] p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-block size-2 rounded-full bg-[#ef866c]" />
                      <span className="font-bold text-[#b4482f]">Anant</span>
                      <span className="text-[#647c72]">is editing HTML structure...</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[#2b5447] bg-white p-2 rounded border border-[#e1eae3]">
                      &lt;<span className="text-[#ef866c]">div</span> <span className="text-[#4db59d]">className</span>=&quot;multiplayer-workspace&quot;&gt;
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#e2e8e2] pt-3 text-[11px] text-[#718b80]">
                    <span className="flex items-center gap-1">
                      <Users className="size-3 text-[#216b57]" /> Harsh (Editing CSS)
                    </span>
                    <span className="font-semibold text-[#216b57]">100% Synced</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Feature Grid Section */}
        <section className="mt-24 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md transition hover:border-[#4db59d]/40 hover:bg-white/[0.05]">
            <div className="grid size-11 place-items-center rounded-xl bg-[#4db59d]/15 text-[#4db59d]">
              <Radio className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Yjs CRDT Real-time Sync</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#a5bbb0]">
              Built with decentralized conflict-free replicated data types. Multiple users can type, format, and draw simultaneously without overwriting work.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md transition hover:border-[#ef866c]/40 hover:bg-white/[0.05]">
            <div className="grid size-11 place-items-center rounded-xl bg-[#ef866c]/15 text-[#ef866c]">
              <PenTool className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Infinite Vector Canvas</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#a5bbb0]">
              Switch instantly between text documents and an infinite whiteboard to sketch architectures, flowcharts, and system diagrams with teammates.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md transition hover:border-[#6366f1]/40 hover:bg-white/[0.05]">
            <div className="grid size-11 place-items-center rounded-xl bg-[#6366f1]/15 text-[#9195f6]">
              <Sparkles className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">AI Web Research Drawer</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#a5bbb0]">
              Query live web knowledge directly beside your document. Get structured synthesis and citations without context-switching into browser tabs.
            </p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between border-t border-white/10 px-6 py-8 text-xs text-[#7f998e] md:px-10 gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">Connect</span>
          <span>· Real-time Collaborative Workspace</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Google OAuth 2.0</span>
          <span>Yjs Binary Protocols</span>
          <span>Next.js 16 + Express</span>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell min-h-screen text-[#f5f1e8] flex items-center justify-center">
          <div className="size-8 border-4 border-[#4db59d]/40 border-t-[#4db59d] rounded-full animate-spin" />
        </div>
      }
    >
      <LandingPageInner />
    </Suspense>
  );
}

