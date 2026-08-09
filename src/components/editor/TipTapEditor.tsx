"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  Sparkles,
} from "lucide-react";
import { ActiveUser } from "@/components/collaboration/PresenceBar";

interface TipTapEditorProps {
  documentId: string;
  initialContent?: string;
  currentUser: { name: string; color: string; avatar?: string };
  onPresenceUpdate: (users: ActiveUser[], isConnected: boolean) => void;
  readOnly?: boolean;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  documentId,
  initialContent,
  currentUser,
  onPresenceUpdate,
  readOnly = false,
}) => {
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingNames, setTypingNames] = useState<string[]>([]);

  // Initialize Yjs Document and WebSocket Provider
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";
    const wsProvider = new WebsocketProvider(wsUrl, "yjs", ydoc, {
      params: { docId: documentId },
    });

    // Offline caching with IndexedDB
    const indexeddbProvider = new IndexeddbPersistence(documentId, ydoc);

    // Awareness setup for user presence & cursors
    const awareness = wsProvider.awareness;
    awareness.setLocalStateField("user", {
      name: currentUser.name,
      color: currentUser.color,
      avatar: currentUser.avatar,
    });

    const updateTypingNames = () => {
      const names: string[] = [];
      awareness.getStates().forEach((state: any) => {
        if (state.isTyping && state.user?.name && state.user.name !== currentUser.name) names.push(state.user.name);
      });
      setTypingNames(names);
    };

    wsProvider.on("status", (event: { status: "connected" | "disconnected" | "connecting" }) => {
      const connected = event.status === "connected";
      setIsConnected(connected);
    });

    // Listen to awareness changes
    const updateAwareness = () => {
      const states = awareness.getStates();
      const activeUsers: ActiveUser[] = [];

      states.forEach((state: any, clientID: number) => {
        if (state.user) {
          activeUsers.push({
            id: String(clientID),
            name: state.user.name || "Collaborator",
            color: state.user.color || "#6366f1",
            avatar: state.user.avatar,
            isTyping: !!state.isTyping,
          });
        }
      });

      onPresenceUpdate(activeUsers, wsProvider.wsconnected);
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
  }, [documentId, ydoc, currentUser, onPresenceUpdate]);

  // TipTap Editor instance
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
      Collaboration.configure({
        document: ydoc,
      }),
      provider
        ? CollaborationCursor.configure({
            provider: provider,
            user: {
              name: currentUser.name,
              color: currentUser.color,
            },
          })
        : [],
    ].filter(Boolean) as any,
  });

  // Handle typing status broadcasting
  useEffect(() => {
    if (!editor || !provider) return;

    let timeout: NodeJS.Timeout;
    const handleUpdate = () => {
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

  if (!editor) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-slate-400">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-lg shadow-cyan-500/20"></div>
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
      {/* Rich Text Formatting Toolbar */}
      {!readOnly && (
        <div className="editor-toolbar flex flex-wrap items-center justify-between gap-2 p-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("bold")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("italic")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("underline")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("strike")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("highlight")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Highlight Text"
            >
              <Highlighter className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-800 mx-1.5" />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("heading", { level: 1 })
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("heading", { level: 2 })
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-800 mx-1.5" />

            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("bulletList")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("orderedList")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("blockquote")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Blockquote"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                editor.isActive("codeBlock")
                  ? "tool-button is-active" : "tool-button"
              }`}
              title="Code Block"
            >
              <Code className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-800 mx-1.5" />

            <button
              onClick={() => editor.chain().focus().undo().run()}
              className="tool-button p-2 rounded-xl"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              className="tool-button p-2 rounded-xl"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>

          {/* Word / Char Counter */}
          <div className="flex items-center gap-3 px-3.5 py-1 rounded-full bg-[#eff5f0] border border-[#dce8df] text-xs text-[#668077] font-mono">
            <span>{characterCount} chars</span>
            <span className="text-slate-700">•</span>
            <span>{wordCount} words</span>
          </div>
        </div>
      )}

      {/* Editor Main Content Area */}
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
};
