"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, ArrowRight, Loader2 } from "lucide-react";
import { fetchCurrentUser, updateProfile, User } from "@/lib/api";

const PRESET_COLORS = [
  "#2b7c6a", "#6366f1", "#e85d3a", "#d97706",
  "#0891b2", "#7c3aed", "#be185d", "#15803d",
];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2b7c6a");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        setName(u.name);
        setColor(u.color || "#2b7c6a");
      })
      .catch(() => router.replace("/"));
  }, [router]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateProfile({ name: name.trim(), color });
      router.replace("/dashboard");
    } catch {
      setError("Could not save profile. Please try again.");
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f1eb]">
        <Loader2 className="size-8 animate-spin text-[#2b7c6a]" />
      </main>
    );
  }

  const initials = name.trim() ? name.trim()[0].toUpperCase() : "?";

  return (
    <main className="min-h-screen bg-[#f3f1eb] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(29,56,46,.12)] border border-[#dfe5de] p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black tracking-[-0.04em] text-[#19382f]">Set up your profile</h1>
            <p className="mt-2 text-sm text-[#668077]">Choose how collaborators will see you</p>
          </div>

          {/* Avatar preview */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={name}
                  className="size-24 rounded-full object-cover ring-4 ring-white shadow-lg"
                  style={{ boxShadow: `0 0 0 4px ${color}40` }}
                />
              ) : (
                <div
                  className="size-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-lg ring-4 ring-white"
                  style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}40` }}
                >
                  {initials}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white border border-[#dfe5de] flex items-center justify-center shadow-sm">
                <Pencil className="size-3.5 text-[#668077]" />
              </div>
            </div>
          </div>

          {/* Display name */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#668077] mb-2">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="Your name"
              className="w-full rounded-xl border border-[#d8e1d9] bg-[#f8faf8] px-4 py-3 text-sm text-[#19382f] font-semibold outline-none transition focus:border-[#4db59d] focus:bg-white focus:ring-4 focus:ring-[#4db59d]/10"
            />
            <p className="mt-1.5 text-xs text-[#8aa096]">
              Shown next to your cursor and in comments
            </p>
          </div>

          {/* Color picker */}
          <div className="mb-8">
            <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#668077] mb-3">
              Your color
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="size-9 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : "none" }}
                  aria-label={`Pick color ${c}`}
                >
                  {color === c && <Check className="size-4 text-white mx-auto" />}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-[#efc0b4] bg-[#fff4f0] px-4 py-3 text-sm text-[#943e29]">
              {error}
            </p>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="primary-action w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 className="size-4 animate-spin" /> Saving…</>
            ) : (
              <>Go to my workspace <ArrowRight className="size-4" /></>
            )}
          </button>

          {/* Skip */}
          <button
            onClick={() => router.replace("/dashboard")}
            className="mt-3 w-full text-center text-xs text-[#8aa096] hover:text-[#466259] transition py-2"
          >
            Skip for now
          </button>
        </div>

        {/* Signed in as */}
        <p className="mt-4 text-center text-xs text-[#8aa096]">
          Signed in as <span className="font-semibold text-[#466259]">{user.email}</span>
        </p>
      </div>
    </main>
  );
}
