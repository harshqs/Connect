"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Video,
  Radio,
  X,
  Disc,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface MusicLoungeProps {
  documentId: string;
  currentUser: { name: string; color: string };
}

interface MusicState {
  source: "youtube" | "spotify";
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

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const isYtApiReady = useRef(false);

  // Load YouTube IFrame API script dynamically once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        isYtApiReady.current = true;
        initYtPlayer();
      };
    } else {
      isYtApiReady.current = true;
      initYtPlayer();
    }
  }, []);

  const initYtPlayer = () => {
    if (iframeRef.current && window.YT && window.YT.Player && !ytPlayerRef.current) {
      try {
        ytPlayerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              if (state.isPlaying) ytPlayerRef.current?.playVideo();
            },
          },
        });
      } catch (e) {
        console.error("YT Player init error:", e);
      }
    }
  };

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

      setState((prevState) => {
        // Control YouTube Player via postMessage API without iframe reloads
        if (remoteSource === "youtube" && ytPlayerRef.current) {
          try {
            if (prevState.youtubeId !== remoteYtId) {
              ytPlayerRef.current.loadVideoById?.(remoteYtId);
            }
            if (remoteIsPlaying) {
              ytPlayerRef.current.playVideo?.();
            } else {
              ytPlayerRef.current.pauseVideo?.();
            }
          } catch (err) {
            console.error("YouTube sync error:", err);
          }
        }

        return {
          source: remoteSource,
          youtubeId: remoteYtId,
          spotifyUri: remoteSpotify,
          title: remoteTitle,
          artist: remoteArtist,
          isPlaying: remoteIsPlaying,
          djName: remoteDj,
        };
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

    alert("Please paste a valid YouTube or Spotify link.");
  };

  const togglePlay = () => {
    const nextPlay = !state.isPlaying;
    updateRoomMusic({ isPlaying: nextPlay });

    // Local instant action
    if (ytPlayerRef.current) {
      if (nextPlay) ytPlayerRef.current.playVideo?.();
      else ytPlayerRef.current.pauseVideo?.();
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (ytPlayerRef.current) {
      if (nextMute) ytPlayerRef.current.mute?.();
      else ytPlayerRef.current.unMute?.();
    }
  };

  return (
    <>
      {/* ALWAYS MOUNTED YouTube iFrame for Zero-Reload Audio & Sync */}
      <div className="fixed -top-[9999px] left-0 size-1 overflow-hidden opacity-0 pointer-events-none z-[-1]">
        <iframe
          ref={iframeRef}
          id="yt-player-iframe"
          src={`https://www.youtube.com/embed/${state.youtubeId}?enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
          title="Persistent YouTube Player"
          allow="autoplay; encrypted-media"
          className="size-1 border-none"
        />
      </div>

      {/* BOTTOM FLOATING DISCORD/SPOTIFY STYLE MUSIC BAR */}
      <div className="fixed bottom-4 right-6 z-50 font-sans">
        {/* Expanded Drawer (Pop-up above bottom bar) */}
        {isOpen && (
          <div className="mb-3 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#091310]/95 p-4 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-[#4db59d]/20 text-[#7be3c4]">
                  <Radio className="size-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white leading-none">Collaborative Music Lounge</h3>
                  <p className="text-[10px] text-[#8fa79b] mt-0.5">
                    DJ: <span className="font-semibold text-[#7be3c4]">{state.djName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Spotify Player or YouTube status */}
            {state.source === "spotify" && (
              <div className="h-36 w-full overflow-hidden rounded-xl border border-white/10 mb-3">
                <iframe
                  src={state.spotifyUri}
                  title="Spotify Player"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  className="h-full w-full border-none"
                />
              </div>
            )}

            {/* Paste Link Bar */}
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
                  className="rounded-lg bg-[#4db59d] px-2 py-1 text-[10px] font-bold text-[#081512] hover:bg-[#7be3c4] transition shrink-0"
                >
                  Play
                </button>
              </div>
            </div>

            {/* Quick Radio Presets */}
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

        {/* BOTTOM DOCK BAR (Always Visible at Bottom) */}
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#081310]/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl text-white">
          <div className="flex items-center gap-2.5 overflow-hidden max-w-[160px] sm:max-w-[220px]">
            <Disc className={`size-6 shrink-0 text-[#4db59d] ${state.isPlaying ? "animate-spin" : ""}`} />
            <div className="overflow-hidden leading-tight">
              <p className="text-xs font-bold text-white truncate">{state.title}</p>
              <p className="text-[10px] text-[#8fa79b] truncate">DJ: {state.djName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            {state.isPlaying && (
              <span className="hidden sm:flex items-center gap-0.5 mr-1" title="Music synced across collaborators">
                <span className="h-3 w-0.5 bg-[#4db59d] animate-pulse" />
                <span className="h-4 w-0.5 bg-[#7be3c4] animate-ping" />
                <span className="h-2.5 w-0.5 bg-[#4db59d] animate-pulse" />
              </span>
            )}

            <button
              onClick={toggleMute}
              className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white transition"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="size-4 text-rose-400" /> : <Volume2 className="size-4 text-[#4db59d]" />}
            </button>

            <button
              onClick={togglePlay}
              className="grid size-8 place-items-center rounded-full bg-gradient-to-r from-[#287d67] to-[#4db59d] text-white shadow-md hover:scale-105 transition"
              title={state.isPlaying ? "Pause for room" : "Play for room"}
            >
              {state.isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
            </button>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition ml-1"
              title={isOpen ? "Collapse Lounge" : "Expand Lounge"}
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

