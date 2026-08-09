"use client";

import React, { useState } from "react";
import { X, Copy, Check, Share2, Globe, Lock } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  shareToken: string;
  isPublic: boolean;
  onTogglePublic: (isPublic: boolean) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  shareToken,
  isPublic,
  onTogglePublic,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/doc/${shareToken || "demo"}`
    : `http://localhost:3000/doc/${shareToken || "demo"}`;

  const handleCopy = () => {
    if (!isPublic) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md glass-panel bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Share Document</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{documentTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shareable Link Section */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              {isPublic ? <Globe className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
              <span>{isPublic ? "Anyone with this link can edit" : "Turn on sharing to activate the link"}</span>
            </div>
            <button
              onClick={() => onTogglePublic(!isPublic)}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              {isPublic ? "Make Private" : "Make Public"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate focus:outline-none"
            />
            <button
              onClick={handleCopy}
              disabled={!isPublic}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 text-slate-200 text-xs font-medium rounded-xl transition border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
