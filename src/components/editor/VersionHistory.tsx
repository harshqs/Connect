"use client";

import React, { useState } from "react";
import { History, X, Clock, RotateCcw, Plus } from "lucide-react";
import { DocumentVersion, createVersionSnapshot } from "@/lib/api";

interface VersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  versions: DocumentVersion[];
  currentContent: string;
  onRestoreVersion: (content: string) => void;
  onSnapshotSaved: (v: DocumentVersion) => void;
  currentUserName?: string;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  isOpen,
  onClose,
  documentId,
  versions,
  currentContent,
  onRestoreVersion,
  onSnapshotSaved,
  currentUserName = "Collaborator",
}) => {
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveSnapshot = async () => {
    try {
      setSaving(true);
      const title = `Version ${versions.length + 1}`;
      const newVersion = await createVersionSnapshot(documentId, title, currentContent, currentUserName);
      onSnapshotSaved(newVersion);
    } catch (err) {
      console.error("Failed to save snapshot", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 w-80 glass-panel bg-slate-900/95 border-l border-slate-800 p-5 shadow-2xl flex flex-col justify-between text-slate-200 animate-in slide-in-from-right">
      <div className="space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Version History</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={handleSaveSnapshot}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? "Saving Snapshot..." : "Save Current Snapshot"}</span>
        </button>

        <div className="space-y-3 pt-2">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No history snapshots saved yet.
            </div>
          ) : (
            versions.map((ver) => (
              <div
                key={ver.id}
                className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2 hover:border-indigo-500/40 transition"
              >
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span className="text-white font-semibold">{ver.title}</span>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(ver.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 italic font-mono bg-slate-900/50 p-1.5 rounded">
                  {ver.content || "Empty content"}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-indigo-400">Edited by {ver.editedBy}</span>
                  <button
                    onClick={() => onRestoreVersion(ver.content)}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-700/60 hover:bg-indigo-600 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
