"use client";

import React, { useState } from "react";
import { MessageSquare, X, Send, CheckCircle2 } from "lucide-react";
import { Comment, addComment } from "@/lib/api";

interface CommentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  comments: Comment[];
  onCommentAdded: (c: Comment) => void;
  currentUserName?: string;
}

export const CommentSidebar: React.FC<CommentSidebarProps> = ({
  isOpen,
  onClose,
  documentId,
  comments,
  onCommentAdded,
  currentUserName = "Collaborator",
}) => {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setIsSubmitting(true);
      const newComment = await addComment(documentId, commentText.trim());
      onCommentAdded(newComment);
      setCommentText("");
    } catch (err) {
      console.error("Failed to add comment", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 w-80 glass-panel bg-slate-900/95 border-l border-slate-800 p-5 shadow-2xl flex flex-col justify-between text-slate-200 animate-in slide-in-from-right">
      <div className="flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Document Comments</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {comments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No comments yet. Start a discussion!
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: c.user?.color || "#6366f1" }}
                    >
                      {c.user?.name ? c.user.name.charAt(0) : "C"}
                    </div>
                    <span className="font-semibold text-slate-200">{c.user?.name || "Collaborator"}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{c.text}</p>
              </div>
            ))
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isSubmitting || !commentText.trim()}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
