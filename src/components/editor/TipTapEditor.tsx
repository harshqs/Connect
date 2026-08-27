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
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
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
  ImageUp,
  AlignLeft,
  AlignCenter,
  AlignRight,
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
    const [fontSize, setFontSize] = useState("16px");
    const [imageUploadError, setImageUploadError] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const imageInputRef = React.useRef<HTMLInputElement>(null);

    // Stable session ID for this browser tab — survives React StrictMode double-mounts
    const sessionIdRef = React.useRef<string | null>(null);
    if (!sessionIdRef.current && typeof window !== "undefined") {
      const sessionKey = `connect-session:${documentId}`;
      sessionIdRef.current = window.sessionStorage.getItem(sessionKey) || Math.random().toString(36).slice(2);
      window.sessionStorage.setItem(sessionKey, sessionIdRef.current);
    }
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
        StarterKit.configure({
          link: false,
          underline: false,
        }),
        Placeholder.configure({
          placeholder: "Type your notes here... Changes sync instantly across all online collaborators!",
        }),
        Underline,
        Highlight.configure({ multicolor: true }),
        CharacterCount,
        Link.configure({ openOnClick: false }),
        TextStyle,
        FontFamily.configure({ types: ["textStyle"] }),
        FontSize.configure({ types: ["textStyle"] }),
        Color.configure({ types: ["textStyle"] }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Image.configure({
          allowBase64: false,
          HTMLAttributes: { class: "editor-image" },
          resize: {
            enabled: true,
            directions: ["bottom-right", "bottom-left"],
            minWidth: 160,
            minHeight: 100,
            alwaysPreserveAspectRatio: true,
          },
        }),
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

    const uploadImage = async (file: File) => {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        setImageUploadError("Image upload is not configured yet. Add the Cloudinary settings to Vercel first.");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setImageUploadError("Please choose an image file.");
        return;
      }

      if (file.size > 8 * 1024 * 1024) {
        setImageUploadError("Choose an image smaller than 8 MB.");
        return;
      }

      setImageUploadError(null);
      setIsUploadingImage(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });
        const result = (await response.json()) as { secure_url?: string; error?: { message?: string } };

        if (!response.ok || !result.secure_url) {
          throw new Error(result.error?.message || "Cloudinary could not upload this image.");
        }

        editor.chain().focus().setImage({ src: result.secure_url, alt: file.name }).run();
      } catch (error) {
        setImageUploadError(error instanceof Error ? error.message : "Image upload failed. Please try again.");
      } finally {
        setIsUploadingImage(false);
      }
    };

    return (
      <div className="editor-canvas w-full flex flex-col rounded-2xl overflow-hidden">
        {/* Toolbar */}
        {!readOnly && (
          <div className="editor-toolbar flex flex-wrap items-center justify-between gap-2 p-2.5">
            <div className="flex flex-wrap items-center gap-1">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                  const [file] = Array.from(event.target.files || []);
                  event.target.value = "";
                  if (file) void uploadImage(file);
                }}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploadingImage}
                className="tool-button flex items-center gap-1.5 p-2 rounded-xl disabled:cursor-wait disabled:opacity-60"
                title="Upload an image"
              >
                <ImageUp className="w-4 h-4" />
                <span className="text-xs font-semibold">{isUploadingImage ? "Uploading" : "Image"}</span>
              </button>
              <span className="w-px h-5 bg-slate-800 mx-1.5" />
              <select
                aria-label="Font family"
                value={editor.getAttributes("textStyle").fontFamily || "Inter"}
                onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
                className="h-8 max-w-30 rounded-lg border border-[#dce8df] bg-white px-2 text-xs font-semibold text-[#466259] outline-none focus:border-[#4db59d]"
              >
                <option value="Inter">Inter</option>
                <option value="Georgia">Georgia</option>
                <option value="Arial">Arial</option>
                <option value="Courier New">Courier New</option>
              </select>
              <select
                aria-label="Font size"
                value={fontSize}
                onChange={(event) => {
                  setFontSize(event.target.value);
                  editor.chain().focus().setFontSize(event.target.value).run();
                }}
                className="h-8 rounded-lg border border-[#dce8df] bg-white px-2 text-xs font-semibold text-[#466259] outline-none focus:border-[#4db59d]"
              >
                <option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="22px">22</option><option value="28px">28</option>
              </select>
              <label className="grid size-8 cursor-pointer place-items-center rounded-lg border border-[#dce8df] bg-white" title="Text color">
                <span className="size-3 rounded-full bg-[#287d67]" />
                <input aria-label="Text color" type="color" value={editor.getAttributes("textStyle").color || "#287d67"} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} className="sr-only" />
              </label>
              <button onClick={() => editor.chain().focus().setTextAlign("left").run()} className={`tool-button p-2 rounded-xl ${editor.isActive({ textAlign: "left" }) ? "is-active" : ""}`} title="Align left"><AlignLeft className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().setTextAlign("center").run()} className={`tool-button p-2 rounded-xl ${editor.isActive({ textAlign: "center" }) ? "is-active" : ""}`} title="Align centre"><AlignCenter className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().setTextAlign("right").run()} className={`tool-button p-2 rounded-xl ${editor.isActive({ textAlign: "right" }) ? "is-active" : ""}`} title="Align right"><AlignRight className="w-4 h-4" /></button>
              <span className="w-px h-5 bg-slate-800 mx-1.5" />
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
          {imageUploadError && (
            <div className="absolute left-6 top-5 z-10 max-w-md rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 shadow-sm">
              {imageUploadError}
            </div>
          )}
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
