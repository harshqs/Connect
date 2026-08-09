"use client";

import React from "react";
import { Users } from "lucide-react";

export interface ActiveUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  isTyping?: boolean;
}

interface PresenceBarProps {
  users: ActiveUser[];
  isConnected: boolean;
  currentUser?: { name: string };
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ users, isConnected, currentUser }) => {
  const typingUsers = users.filter((u) => u.isTyping && u.name !== currentUser?.name);

  return (
    <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white border border-[#dfe5de] shadow-sm">

      {/* Connection status */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#eff7f1] border border-[#dce8df] text-xs font-semibold">
        {isConnected ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4db59d] opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4db59d]" />
            </span>
            <span className="text-[#287d67]">Live sync</span>
          </>
        ) : (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-600">Connecting…</span>
          </>
        )}
      </div>

      {/* Avatar stack — each avatar shows a tooltip with name on hover */}
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-[#4db59d]" />
        <div className="flex -space-x-2">
          {users.map((user, idx) => (
            <div
              key={user.id || idx}
              className="relative group"
            >
              {/* Avatar circle */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white
                           ring-2 ring-white shadow-sm cursor-default
                           transition-transform duration-150 group-hover:scale-110 group-hover:z-20"
                style={{ backgroundColor: user.color || "#6366f1" }}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.name ? user.name.charAt(0).toUpperCase() : "?"
                )}

                {/* Typing dot badge */}
                {user.isTyping && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4db59d] opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4db59d] border border-white" />
                  </span>
                )}
              </div>

              {/* Tooltip — appears above avatar on hover */}
              <div
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                           opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30"
              >
                <div
                  className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-lg"
                  style={{ backgroundColor: user.color || "#6366f1" }}
                >
                  {user.name}
                  {user.isTyping && <span className="ml-1 opacity-80">· typing…</span>}
                </div>
                {/* Tooltip arrow */}
                <div
                  className="mx-auto mt-0.5 w-2 h-1 overflow-hidden flex justify-center"
                >
                  <div
                    className="w-2 h-2 rotate-45 -translate-y-1"
                    style={{ backgroundColor: user.color || "#6366f1" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typing indicator pill — only shown when someone else is typing */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-[#eff7f1] border border-[#dce8df] px-2.5 py-1 text-xs font-semibold text-[#287d67] animate-pulse">
          <span className="flex gap-0.5 items-end h-3">
            <span className="w-0.5 h-1.5 bg-[#4db59d] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-0.5 h-2.5 bg-[#4db59d] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-0.5 h-1.5 bg-[#4db59d] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
          {typingUsers.length === 1
            ? `${typingUsers[0].name} is typing`
            : `${typingUsers.length} people typing`}
        </div>
      )}
    </div>
  );
};
