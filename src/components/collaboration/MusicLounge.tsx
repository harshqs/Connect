"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Music,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Video,
  Radio,
  Search,
  Sparkles,
  X,
  Disc,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

interface MusicLoungeProps {
  documentId: string;
  currentUser: { name: string; color: string };
}

interface MusicState {
  source: "youtube" | "spotify" | "preset";
  youtubeId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  isPlaying: boolean;
  djName: string;
}

const PRESET_STREAMS = [
  {
    id: "jfKfPfyJRdk",
    title: "Lofi Hip Hop Radio - Beats to Relax/Study to",
    artist: "Lofi Girl",
    type: "youtube" as const,
  },
  {
    id: "4xDzrJKXOOY",
    title: "synthwave radio - chill beats to code to",
    artist: "Lofi Girl Synthwave",
    type: "youtube" as const,
  },
  {
    id: "5qap5aO4i9A",
    title: "Lofi Study Beats 24/7",
    artist: "ChilledCow",
    type: "youtube" as const,
  },
  {
    id: "0W0j9Z3s0nQ",
    title: "Deep Focus Ambient Music",
    artist: "Relaxing Station",
    type: "youtube" as const,
  },
];

export function MusicLounge({ documentId, currentUser }: MusicLoungeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const [state, setState] = useState<MusicState>({
    source: "youtube",
    youtubeId: PRESET_STREAMS[0].id,
    spotifyUri: "",
    title: PRESET_STREAMS[0].title,
    artist: PRESET_STREAMS[0].artist,
    isPlaying: false,
    djName: currentUser.name,
  });

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // Yjs real-time sync across room participants
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://connect-y61u.onrender.com";
    const provider = new WebsocketProvider(wsUrl, "yjs", ydoc, {
      params: { docId: `music-${documentId}` },
    });
    providerRef.current = provider;

    const musicMap = ydoc.getMap<any>("music-room-state");

    const syncState = () => {
      const remoteSource = musicMap.get("source") || "youtube";
      const remoteYtId = musicMap.get("youtubeId") || PRESET_STREAMS[0].id;
      const remoteSpotify = musicMap.get("spotifyUri") || "";
      const remoteTitle = musicMap.get("title") || PRESET_STREAMS[0].title;
      const remoteArtist = musicMap.get("artist") || PRESET_STREAMS[0].artist;
      const remoteIsPlaying = musicMap.get("isPlaying") ?? false;
      const remoteDj = musicMap.get("djName") || "Collaborator";

      setState({
        source: remoteSource,
        youtubeId: remoteYtId,
        spotifyUri: remoteSpotify,
        title: remoteTitle,
        artist: remoteArtist,
        isPlaying: remoteIsPlaying,
        djName: remoteDj,
      });
    };

    musicMap.observe(syncState);
    syncState();

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  const updateRoomMusic = (newState: Partial<MusicState>) => {
    if (ydocRef.current) {
      const musicMap = ydocRef.current.getMap<any>("music-room-state");
      ydocRef.current.transact(() => {
        Object.entries(newState).forEach(([k, v]) => musicMap.set(k, v));
        musicMap.set("djName", currentUser.name);
      });
    }
  };

  const parseInputUrl = (url: string) => {
    if (!url.trim()) return;

    // Check YouTube URL patterns
    const ytMatch = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      updateRoomMusic({
        source: "youtube",
        youtubeId: videoId,
        title: `YouTube Track (${videoId})`,
        artist: `DJ ${currentUser.name}`,
        isPlaying: true,
      });
      setCustomInput("");
      return;
    }

    // Check Spotify URL patterns
    const spotifyMatch = url.match(/open\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/);
    if (spotifyMatch && spotifyMatch[1] && spotifyMatch[2]) {
      const embedUri = `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}?utm_source=generator&theme=0`;
      updateRoomMusic({
        source: "spotify",
        spotifyUri: embedUri,
        title: `Spotify ${spotifyMatch[1]}`,
        artist: `DJ ${currentUser.name}`,
        isPlaying: true,
      });
      setCustomInput("");
      return;
    }

    // Fallback search term as YouTube video
    alert("Please paste a valid YouTube or Spotify link.");
  };

  const togglePlay = () => {
    updateRoomMusic({ isPlaying: !state.isPlaying });
  };

  return (
    <div className="relative z-40 font-sans">
      {/* Top Header Pill Trigger & Quick Controls */}
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-slate-900/95 p-1 pl-3 text-xs font-bold text-white shadow-lg backdrop-blur-md">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-left hover:text-[#7be3c4] transition"
          title="Click to open Music Lounge"
        >
          <Music className={`size-3.5 text-[#4db59d] ${state.isPlaying ? "animate-bounce" : ""}`} />
          <span className="max-w-[120px] md:max-w-[150px] truncate">{state.title}</span>
        </button>

        {/* Equalizer & Quick Play/Pause button */}
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
          {state.isPlaying && (
            <span className="flex items-center gap-0.5 mr-1" title="Music active in background">
              <span className="h-3 w-0.5 bg-[#4db59d] animate-pulse" />
              <span className="h-4 w-0.5 bg-[#7be3c4] animate-ping" />
              <span className="h-2.5 w-0.5 bg-[#4db59d] animate-pulse" />
            </span>
          )}

          <button
            onClick={togglePlay}
            className="grid size-6 place-items-center rounded-full bg-[#4db59d] text-[#081512] hover:bg-[#7be3c4] transition shadow-sm"
            title={state.isPlaying ? "Pause music" : "Play music"}
          >
            {state.isPlaying ? <Pause className="size-3" /> : <Play className="size-3 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Persistent Audio Media Player (Mounted always so music continues when drawer closes) */}
      <div
        className={
          isOpen
            ? "hidden" // Rendered inside drawer when open
            : "fixed -top-[9999px] left-0 size-1 overflow-hidden opacity-0 pointer-events-none"
        }
      >
        {!isOpen && state.source === "youtube" && (
          <iframe
            src={`https://www.youtube.com/embed/${state.youtubeId}?autoplay=${state.isPlaying ? 1 : 0}&enablejsapi=1&mute=${isMuted ? 1 : 0}`}
            title="Background YouTube Audio"
            allow="autoplay; encrypted-media"
            className="size-1 border-none"
          />
        )}
        {!isOpen && state.source === "spotify" && (
          <iframe
            src={state.spotifyUri}
            title="Background Spotify Audio"
            allow="autoplay; encrypted-media"
            className="size-1 border-none"
          />
        )}
      </div>

      {/* Floating Glassmorphic Music Lounge Drawer */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-96 rounded-2xl border border-white/10 bg-[#091310]/95 p-4 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-lg bg-[#4db59d]/20 text-[#7be3c4]">
                <Radio className="size-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white leading-none">Collaborative Music VC</h3>
                <p className="text-[10px] text-[#8fa79b] mt-0.5">
                  DJ: <span className="font-semibold text-[#7be3c4]">{state.djName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Hide pop-up (music stays playing)"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Active Player Media View */}
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-inner mb-3">
            {state.source === "youtube" && (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${state.youtubeId}?autoplay=${state.isPlaying ? 1 : 0}&enablejsapi=1&mute=${isMuted ? 1 : 0}`}
                  title="YouTube Music Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  className="h-full w-full border-none"
                />
              </div>
            )}

            {state.source === "spotify" && (
              <div className="h-40 w-full">
                <iframe
                  src={state.spotifyUri}
                  title="Spotify Player"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  className="h-full w-full border-none"
                />
              </div>
            )}
          </div>

          {/* Currently Playing Track Info & Controls */}
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/5 mb-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Disc className={`size-6 text-[#4db59d] ${state.isPlaying ? "animate-spin" : ""}`} />
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{state.title}</p>
                <p className="text-[10px] text-[#8fa79b] truncate">{state.artist}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                {isMuted ? <VolumeX className="size-4 text-rose-400" /> : <Volume2 className="size-4 text-[#4db59d]" />}
              </button>
              <button
                onClick={togglePlay}
                className="grid size-8 place-items-center rounded-full bg-gradient-to-r from-[#287d67] to-[#4db59d] text-white shadow-md hover:scale-105 transition"
              >
                {state.isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Paste YouTube / Spotify Link Box */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 focus-within:border-[#4db59d]">
              <Video className="size-4 text-rose-400 shrink-0" />
              <input
                type="text"
                placeholder="Paste YouTube or Spotify link..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && parseInputUrl(customInput)}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
              />
              <button
                onClick={() => parseInputUrl(customInput)}
                className="rounded-lg bg-[#4db59d] px-2 py-1 text-[10px] font-bold text-[#081512] hover:bg-[#7be3c4] transition"
              >
                Play
              </button>
            </div>
          </div>

          {/* Quick Presets Chips */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fa79b] mb-1.5">
              Quick Live Radio Stations
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_STREAMS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() =>
                    updateRoomMusic({
                      source: "youtube",
                      youtubeId: preset.id,
                      title: preset.title,
                      artist: preset.artist,
                      isPlaying: true,
                    })
                  }
                  className={`rounded-lg border p-2 text-left transition ${
                    state.youtubeId === preset.id
                      ? "border-[#4db59d] bg-[#4db59d]/15 text-white"
                      : "border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <p className="text-[11px] font-bold truncate">{preset.artist}</p>
                  <p className="text-[9px] text-[#8fa79b] truncate">{preset.title}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
