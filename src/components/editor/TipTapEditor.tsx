"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Code,
  Highlighter,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Undo,
  Redo,
} from "lucide-react";
import { ActiveUser } from "@/components/collaboration/PresenceBar";

export interface TipTapEditorHandle {
  /** Replace the entire document content with plain text, propagating through Yjs to all peers. */
  restoreContent: (text: string) => void;
}

interface TipTapEditorProps {
  documentId: string;
  initialContent?: string;
  currentUser: { name: string; color: string; avatar?: string };
  onPresenceUpdate: (users: ActiveUser[], isConnected: boolean) => void;
  readOnly?: boolean;
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(
  function TipTapEditor(
    { documentId, initialContent, currentUser, onPresenceUpdate, readOnly = false },
    ref
  ) {
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [typingNames, setTypingNames] = useState<string[]>([]);

    // Stable session ID for this browser tab — survives React StrictMode double-mounts
    const sessionIdRef = React.useRef<string | null>(null);
    if (!sessionIdRef.current) sessionIdRef.current = Math.random().toString(36).slice(2);
    const sessionId = sessionIdRef.current;

    // Yjs document
    const ydoc = useMemo(() => new Y.Doc(), [documentId]);

    useEffect(() => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";
      const wsProvider = new WebsocketProvider(wsUrl, "yjs", ydoc, {
        params: { docId: documentId },
      });

      const indexeddbProvider = new IndexeddbPersistence(documentId, ydoc);

      const awareness = wsProvider.awareness;
      awareness.setLocalStateField("user", {
        name: currentUser.name,
        color: currentUser.color,
        avatar: currentUser.avatar,
        sessionId,
      });
      awareness.setLocalStateField("isTyping", false);

      wsProvider.on("status", (event: { status: "connected" | "disconnected" | "connecting" }) => {
        setIsConnected(event.status === "connected");
      });

      const updateAwareness = () => {
        const activeUsers: ActiveUser[] = [];
        awareness.getStates().forEach((state: any) => {
          if (state.user?.sessionId === sessionId) return;
          if (state.user) {
            activeUsers.push({
              id: state.user.sessionId || String(Math.random()),
              name: state.user.name || "Collaborator",
              color: state.user.color || "#6366f1",
              avatar: state.user.avatar,
              isTyping: !!state.isTyping,
            });
          }
        });
        onPresenceUpdate(activeUsers, wsProvider.wsconnected);
      };

      const updateTypingNames = () => {
        const names: string[] = [];
        awareness.getStates().forEach((state: any) => {
          if (state.user?.sessionId === sessionId) return;
          if (state.isTyping && state.user?.name) names.push(state.user.name);
        });
        setTypingNames(names);
      };

      awareness.on("change", updateAwareness);
      awareness.on("change", updateTypingNames);
      setProvider(wsProvider);

      return () => {
        awareness.off("change", updateAwareness);
        awareness.off("change", updateTypingNames);
        wsProvider.destroy();
        indexeddbProvider.destroy();
        ydoc.destroy();
      };
    }, [documentId, ydoc, onPresenceUpdate]);

    // Keep awareness user state in sync when currentUser prop changes
    useEffect(() => {
      if (!provider) return;
      provider.awareness.setLocalStateField("user", {
        name: currentUser.name,
        color: currentUser.color,
        avatar: currentUser.avatar,
        sessionId,
      });
      provider.awareness.setLocalStateField("isTyping", false);
    }, [provider, currentUser, sessionId]);

    const editor = useEditor({
      editable: !readOnly,
      extensions: [
        StarterKit.configure({}),
        Placeholder.configure({
          placeholder: "Type your notes here... Changes sync instantly across all online collaborators!",
        }),
        Underline,
        Highlight.configure({ multicolor: true }),
        CharacterCount,
        Link.configure({ openOnClick: false }),
        Collaboration.configure({ document: ydoc }),
        provider
          ? CollaborationCursor.configure({
              provider: provider,
              user: { name: currentUser.name, color: currentUser.color },
            })
          : [],
      ].filter(Boolean) as any,
    });

    // Handle typing status broadcasting — only for LOCAL edits (not remote Yjs syncs)
    useEffect(() => {
      if (!editor || !provider) return;

      let timeout: NodeJS.Timeout;
      const handleUpdate = ({ transaction }: { transaction: any }) => {
        // Skip remote updates synced via Yjs — only local keystrokes should broadcast "typing"
        if (transaction.getMeta("y-sync$")) return;

        provider.awareness.setLocalStateField("isTyping", true);
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          provider.awareness.setLocalStateField("isTyping", false);
        }, 1500);
      };

      editor.on("update", handleUpdate);
      return () => {
        editor.off("update", handleUpdate);
        clearTimeout(timeout);
      };
    }, [editor, provider]);

    // Expose restoreContent to the parent via ref
    useImperativeHandle(ref, () => ({
      restoreContent(text: string) {
        if (!editor || !ydoc) return;

        // Clear the Yjs XML fragment and set fresh content.
        // Wrapping in a single transaction keeps the CRDT diff minimal and
        // propagates the change to all connected peers automatically.
        const xmlFragment = ydoc.getXmlFragment("default");
        ydoc.transact(() => {
          xmlFragment.delete(0, xmlFragment.length);
        });

        // setContent replaces the ProseMirror doc; Collaboration will sync it.
        editor.commands.setContent(
          text
            ? text.split("\n").map((line) => `<p>${line || "<br/>"}</p>`).join("")
            : "<p></p>",
          { emitUpdate: true }
        );
      },
    }), [editor, ydoc]);

    if (!editor) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-slate-400">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-lg shadow-cyan-500/20" />
          <p className="text-sm font-semibold tracking-wide bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Connecting Real-Time Collaborative Engine...
          </p>
        </div>
      );
    }

    const characterCount = editor.storage.characterCount?.characters() || 0;
    const wordCount = editor.storage.characterCount?.words() || 0;

    return (
      <div className="editor-canvas w-full flex flex-col rounded-2xl overflow-hidden">
        {/* Toolbar */}
        {!readOnly && (
          <div className="editor-toolbar flex flex-wrap items-center justify-between gap-2 p-2.5">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("bold") ? "tool-button is-active" : "tool-button"}`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("italic") ? "tool-button is-active" : "tool-button"}`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("underline") ? "tool-button is-active" : "tool-button"}`}
                title="Underline (Ctrl+U)"
              >
                <UnderlineIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("strike") ? "tool-button is-active" : "tool-button"}`}
                title="Strikethrough"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("highlight") ? "tool-button is-active" : "tool-button"}`}
                title="Highlight Text"
              >
                <Highlighter className="w-4 h-4" />
              </button>

              <span className="w-px h-5 bg-slate-800 mx-1.5" />

              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("heading", { level: 1 }) ? "tool-button is-active" : "tool-button"}`}
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("heading", { level: 2 }) ? "tool-button is-active" : "tool-button"}`}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>

              <span className="w-px h-5 bg-slate-800 mx-1.5" />

              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("bulletList") ? "tool-button is-active" : "tool-button"}`}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("orderedList") ? "tool-button is-active" : "tool-button"}`}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("blockquote") ? "tool-button is-active" : "tool-button"}`}
                title="Blockquote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-2 rounded-xl transition-all text-xs font-bold ${editor.isActive("codeBlock") ? "tool-button is-active" : "tool-button"}`}
                title="Code Block"
              >
                <Code className="w-4 h-4" />
              </button>

              <span className="w-px h-5 bg-slate-800 mx-1.5" />

              <button onClick={() => editor.chain().focus().undo().run()} className="tool-button p-2 rounded-xl" title="Undo (Ctrl+Z)">
                <Undo className="w-4 h-4" />
              </button>
              <button onClick={() => editor.chain().focus().redo().run()} className="tool-button p-2 rounded-xl" title="Redo (Ctrl+Y)">
                <Redo className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 px-3.5 py-1 rounded-full bg-[#eff5f0] border border-[#dce8df] text-xs text-[#668077] font-mono">
              <span>{characterCount} chars</span>
              <span className="text-slate-700">•</span>
              <span>{wordCount} words</span>
            </div>
          </div>
        )}

        <div className="editor-workarea relative min-h-[520px]">
          {typingNames.length > 0 && (
            <div className="absolute right-6 top-5 z-10 flex items-center gap-2 rounded-full border border-[#d8e8dd] bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#287d67] shadow-sm backdrop-blur">
              <span className="flex gap-0.5"><i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" /></span>
              {typingNames.length === 1 ? `${typingNames[0]} is typing` : `${typingNames.length} people are typing`}
            </div>
          )}
          <EditorContent editor={editor} className="prose prose-invert max-w-none focus:outline-none" />
        </div>
      </div>
    );
  }
);
