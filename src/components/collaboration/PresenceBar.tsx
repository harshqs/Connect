"use client";

import React from "react";
import { Users, Radio } from "lucide-react";

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
      {/* Connection Status Badge */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#eff7f1] border border-[#dce8df] text-xs font-semibold">
        {isConnected ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="presence-pulse relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4db59d]"></span>
            </span>
            <span className="text-[#287d67]">Live sync</span>
          </>
        ) : (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-amber-400">Connecting...</span>
          </>
        )}
      </div>

      {/* Online Users Avatar Stack */}
      <div className="flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-cyan-400" />
        <div className="flex -space-x-2 overflow-hidden">
          {users.map((user, idx) => (
            <div
              key={user.id || idx}
              title={`${user.name} ${user.isTyping ? "(Typing...)" : ""}`}
              className="relative inline-block group"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold text-white ring-2 ring-slate-950 shadow-md transform transition group-hover:scale-110 group-hover:z-10"
                style={{
                  backgroundColor: user.color || "#6366f1",
                  boxShadow: `0 0 10px ${user.color || "#6366f1"}55`,
                }}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  user.name ? user.name.charAt(0).toUpperCase() : "U"
                )}
              </div>
              {user.isTyping && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 text-[9px] text-white font-bold items-center justify-center">✍️</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Collaborator Names & Typing Status */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-slate-300 border-l border-slate-800 pl-3">
        {users.map((u, i) => (
          <span key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/50">
            <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: u.color }} />
            <span className="font-semibold text-slate-100">{u.name}</span>
          </span>
        ))}

        {typingUsers.length > 0 && (
          <span className="italic text-cyan-400 font-medium animate-pulse ml-2">
            {typingUsers.map((u) => u.name).join(", ")} is typing...
          </span>
        )}
      </div>
    </div>
  );
};
