"use client";

import React, { useEffect, useState, useRef } from "react";
import { Smile } from "lucide-react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

interface LiveReactionsProps {
  documentId: string;
  currentUser: { name: string; color: string };
  onSendReaction?: (emoji: string) => void;
}

const EMOJIS = ["❤️", "🔥", "🚀", "👏", "🎉", "💡"];

export function LiveReactions({ documentId, currentUser, onSendReaction }: LiveReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState<FloatingEmoji[]>([]);
  
  const providerRef = useRef<WebsocketProvider | null>(null);
  const processedReactions = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://connect-y61u.onrender.com";
    const provider = new WebsocketProvider(wsUrl, "yjs", ydoc, {
      params: { docId: `reactions-${documentId}` },
    });
    providerRef.current = provider;

    const handleAwarenessChange = ({ added, updated }: any) => {
      const states = provider.awareness.getStates();
      [...added, ...updated].forEach((clientId: number) => {
        if (clientId === provider.awareness.clientID) return;
        const state: any = states.get(clientId);
        if (state && state.reaction) {
          const id = state.reaction.id;
          if (!processedReactions.current.has(id)) {
            processedReactions.current.add(id);
            triggerLocalEmoji(state.reaction.emoji, id);
          }
        }
      });
    };

    provider.awareness.on("change", handleAwarenessChange);

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  const triggerLocalEmoji = (emoji: string, id: string) => {
    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      x: Math.random() * 60 + 20, // percentage from left
      y: Math.random() * 30 + 60, // percentage from top
    };
    setActiveEmojis((prev) => [...prev, newEmoji]);
    
    setTimeout(() => {
      setActiveEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
      processedReactions.current.delete(id);
    }, 3000);
  };

  const triggerEmoji = (emoji: string) => {
    const id = Math.random().toString();
    // Show locally
    triggerLocalEmoji(emoji, id);
    onSendReaction?.(emoji);

    // Broadcast to peers
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField("reaction", { emoji, id });
    }
  };

  return (
    <>
      {/* Floating Emoji Animations Overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {activeEmojis.map((item) => (
          <div
            key={item.id}
            className="absolute animate-bounce text-4xl transition-all duration-1000 ease-out"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              animation: "floatUp 2.5s ease-out forwards",
            }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Reaction Toolbar */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-xl border border-[#dfe5de] bg-white px-3 py-2 text-xs font-bold text-[#287d67] shadow-sm transition hover:bg-[#edf5ef]"
          title="Send live emoji reaction"
        >
          <Smile className="size-3.5 text-[#287d67]" />
          <span className="hidden sm:inline">React</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 z-50 flex items-center gap-1 rounded-2xl border border-[#dfe5de] bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  triggerEmoji(emoji);
                  setIsOpen(false);
                }}
                className="grid size-8 place-items-center rounded-xl text-lg hover:bg-[#edf5ef] hover:scale-125 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translateY(-80px) scale(1.3);
          }
          100% {
            opacity: 0;
            transform: translateY(-160px) scale(1);
          }
        }
      `}</style>
    </>
  );
}
