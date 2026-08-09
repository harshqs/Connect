"use client";

import React, { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FileText,
  Share2,
  History,
  MessageSquare,
  ArrowLeft,
  Lock,
  Globe,
  Check,
  UserRound,
} from "lucide-react";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { PresenceBar, ActiveUser } from "@/components/collaboration/PresenceBar";
import { ShareModal } from "@/components/collaboration/ShareModal";
import { VersionHistory } from "@/components/editor/VersionHistory";
import { CommentSidebar } from "@/components/editor/CommentSidebar";
import { DocumentItem, fetchDocumentById, updateDocument, Comment, DocumentVersion } from "@/lib/api";

export default function DocumentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: docId } = use(params);

  const [documentData, setDocumentData] = useState<DocumentItem | null>(null);
  const [title, setTitle] = useState("Untitled Document");
  const [isPublic, setIsPublic] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loadError, setLoadError] = useState("");
  const [currentUser, setCurrentUser] = useState({ name: "Guest", color: "#2b7c6a" });

  // Modals & Drawers
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);

  useEffect(() => {
    const savedName = window.sessionStorage.getItem("connect-guest-name");
    const name = savedName || `Guest ${Math.floor(100 + Math.random() * 900)}`;
    window.sessionStorage.setItem("connect-guest-name", name);
    setCurrentUser({ name, color: "#2b7c6a" });
  }, []);

  const handlePresenceUpdate = useCallback((users: ActiveUser[], connected: boolean) => {
    setActiveUsers(users);
    setIsConnected(connected);
  }, []);

  const changeDisplayName = () => {
    const name = window.prompt("Choose the name collaborators will see", currentUser.name)?.trim();
    if (!name) return;
    const nextUser = { ...currentUser, name: name.slice(0, 32) };
    window.sessionStorage.setItem("connect-guest-name", nextUser.name);
    setCurrentUser(nextUser);
  };

  useEffect(() => {
    async function loadDoc() {
      try {
        const doc = await fetchDocumentById(docId);
        setDocumentData(doc);
        setTitle(doc.title);
        setIsPublic(doc.isPublic);
        if (doc.comments) setComments(doc.comments);
        if (doc.versions) setVersions(doc.versions);
      } catch (err) {
        setLoadError("This document could not be loaded. Start the collaboration server and make sure the link is still active.");
      }
    }
    loadDoc();
  }, [docId]);

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    setTitleSaved(false);
    try {
      await updateDocument(documentData?.id || docId, { title: newTitle });
      setTitleSaved(true);
      setTimeout(() => setTitleSaved(false), 2000);
    } catch (err) {
      console.error("Failed to rename document", err);
    }
  };

  const handleTogglePublic = async (newPublicState: boolean) => {
    setIsPublic(newPublicState);
    try {
      await updateDocument(documentData?.id || docId, { isPublic: newPublicState });
    } catch (err) {
      console.error("Failed to update privacy settings", err);
    }
  };

  return (
    <div className="document-shell flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="document-header sticky top-0 z-30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back & Editable Title */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl text-[#668077] hover:text-[#183b31] hover:bg-[#e7f2eb] transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="bg-transparent font-extrabold text-lg text-[#19382f] hover:bg-[#edf5ef] focus:bg-white px-2 py-1 rounded-xl border border-transparent focus:border-[#8fd4af] focus:outline-none transition max-w-[220px] md:max-w-xs truncate"
            />
            {titleSaved && (
              <span className="flex items-center gap-1 text-[11px] text-[#287d67] font-semibold">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Center: Live Presence Bar */}
        <div className="flex items-center gap-3">
          <PresenceBar users={activeUsers} isConnected={isConnected} currentUser={currentUser} />
          <button onClick={changeDisplayName} className="hidden items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold text-[#466259] transition hover:bg-[#edf5ef] sm:flex" title="Change your display name"><UserRound className="size-3.5" />{currentUser.name}</button>
        </div>

        {/* Right: Actions (Share, History, Comments) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommentsOpen(!commentsOpen)}
            className="relative p-2.5 rounded-xl bg-white hover:bg-[#edf5ef] text-[#466259] transition border border-[#dfe5de] shadow-sm"
            title="Comments"
          >
            <MessageSquare className="w-4 h-4 text-[#287d67]" />
            {comments.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-cyan-500 text-[10px] font-extrabold flex items-center justify-center text-slate-950 shadow">
                {comments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="p-2.5 rounded-xl bg-white hover:bg-[#edf5ef] text-[#466259] transition border border-[#dfe5de] shadow-sm"
            title="Version History"
          >
            <History className="w-4 h-4 text-[#287d67]" />
          </button>

          <button
            onClick={() => setShareModalOpen(true)}
            className="primary-action flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* Main Editor Container */}
      <main className="w-full max-w-6xl mx-auto p-4 pt-8 md:p-10 md:pt-12 flex-1 editor-enter">
        {loadError ? <div className="editor-canvas grid min-h-[540px] place-items-center rounded-2xl p-8 text-center"><div><h2 className="text-lg font-bold text-[#183b31]">Document unavailable</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#668077]">{loadError}</p><Link href="/" className="primary-action mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-bold">Back to home</Link></div></div> : documentData ? <TipTapEditor
          documentId={documentData.id}
          currentUser={currentUser}
          onPresenceUpdate={handlePresenceUpdate}
        /> : <div className="editor-canvas grid min-h-[540px] place-items-center rounded-2xl text-sm text-[#668077]">Loading document…</div>}
      </main>

      {/* Modals & Drawers */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        documentTitle={title}
        shareToken={documentData?.shareToken || docId}
        isPublic={isPublic}
        onTogglePublic={handleTogglePublic}
      />

      <VersionHistory
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        documentId={documentData?.id || docId}
        versions={versions}
        currentContent={documentData?.content || ""}
        onRestoreVersion={(content) => {
          alert("Snapshot content restored!");
        }}
        onSnapshotSaved={(v) => setVersions([v, ...versions])}
      />

      <CommentSidebar
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        documentId={documentData?.id || docId}
        comments={comments}
        onCommentAdded={(c) => setComments([c, ...comments])}
      />
    </div>
  );
}
