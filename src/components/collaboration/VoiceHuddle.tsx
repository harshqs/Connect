"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneCall, PhoneOff } from "lucide-react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

interface VoiceHuddleProps {
  documentId: string;
  currentUser: { name: string; color: string };
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

export function VoiceHuddle({ documentId, currentUser, onSpeakingChange }: VoiceHuddleProps) {
  const [isInHuddle, setIsInHuddle] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const peerRef = useRef<any>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const remoteAudioRefs = useRef<{ [peerId: string]: HTMLAudioElement }>({});

  const cleanupHuddle = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField("huddlePeerId", null);
      providerRef.current.destroy();
      providerRef.current = null;
    }
    
    // Stop all remote audio elements
    Object.values(remoteAudioRefs.current).forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    remoteAudioRefs.current = {};

    setIsInHuddle(false);
    setIsSpeaking(false);
    onSpeakingChange?.(false);
  };

  useEffect(() => {
    return () => cleanupHuddle();
  }, []);

  const toggleHuddle = async () => {
    if (isInHuddle) {
      cleanupHuddle();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setIsInHuddle(true);

        const PeerClass = (await import("peerjs")).default;
        const peer = new PeerClass();
        peerRef.current = peer;

        // When we get our peer ID
        peer.on("open", (id: string) => {
          const ydoc = new Y.Doc();
          const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://connect-y61u.onrender.com";
          const provider = new WebsocketProvider(wsUrl, "yjs", ydoc, {
            params: { docId: `voice-${documentId}` },
          });
          providerRef.current = provider;

          provider.awareness.setLocalStateField("huddlePeerId", id);

          provider.awareness.on("change", () => {
            const states = provider.awareness.getStates();
            states.forEach((state: any, clientId: number) => {
              if (clientId === provider.awareness.clientID) return;
              const remotePeerId = state.huddlePeerId;
              
              if (remotePeerId && !remoteAudioRefs.current[remotePeerId]) {
                // We have a new remote peer in the huddle. Let's call them!
                const call = peer.call(remotePeerId, stream);
                if (call) {
                  call.on("stream", (remoteStream: MediaStream) => {
                    playRemoteStream(remotePeerId, remoteStream);
                  });
                }
              }
            });
          });
        });

        // When someone calls us
        peer.on("call", (call: any) => {
          call.answer(stream);
          call.on("stream", (remoteStream: MediaStream) => {
            playRemoteStream(call.peer, remoteStream);
          });
        });

        setupAudioAnalyzer(stream);
      } catch (err) {
        console.error("Voice Huddle Mic Error:", err);
        alert("Microphone permission required to join Voice Huddle!");
      }
    }
  };

  const playRemoteStream = (remotePeerId: string, remoteStream: MediaStream) => {
    if (remoteAudioRefs.current[remotePeerId]) return;
    const audio = new Audio();
    audio.srcObject = remoteStream;
    audio.autoplay = true;
    audio.play().catch((e) => console.error("Audio playback failed", e));
    remoteAudioRefs.current[remotePeerId] = audio;
  };

  const setupAudioAnalyzer = (stream: MediaStream) => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    let isCancelled = false;
    audioContextRef.current.onstatechange = () => {
      if (audioContextRef.current?.state === "closed") {
        isCancelled = true;
      }
    };

    const checkAudio = () => {
      if (isCancelled || !analyserRef.current || !localStreamRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const avg = sum / dataArray.length;
      
      const speaking = avg > 5 && stream.getAudioTracks()[0]?.enabled;
      setIsSpeaking(speaking);
      onSpeakingChange?.(speaking);

      requestAnimationFrame(checkAudio);
    };
    checkAudio();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // if it was muted, we enable it. Wait!
      });
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isInHuddle ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-1 pl-3 text-xs shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 mr-1">
            <span className="relative flex size-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${isSpeaking ? "bg-emerald-400 animate-ping" : "bg-emerald-500"}`} />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-bold text-emerald-300">Voice Huddle</span>

            {/* Live Audio Equalizer Wave Animation */}
            <div className="flex items-end gap-0.5 h-3.5 px-1">
              <span className={`w-0.5 rounded-full bg-emerald-400 transition-all duration-75 ${isSpeaking ? "h-3.5 animate-pulse" : "h-1"}`} />
              <span className={`w-0.5 rounded-full bg-emerald-400 transition-all duration-75 ${isSpeaking ? "h-2.5 animate-pulse delay-75" : "h-1.5"}`} />
              <span className={`w-0.5 rounded-full bg-emerald-400 transition-all duration-75 ${isSpeaking ? "h-4 animate-pulse delay-150" : "h-1"}`} />
            </div>
          </div>

          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition ${
              isMuted ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" : "bg-white/10 text-emerald-300 hover:bg-white/20"
            }`}
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          </button>

          <button
            onClick={toggleHuddle}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition shadow"
            title="Leave Voice Huddle"
          >
            <PhoneOff className="size-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      ) : (
        <button
          onClick={toggleHuddle}
          className="flex items-center gap-2 rounded-xl border border-[#dfe5de] bg-white px-3 py-2 text-xs font-bold text-[#287d67] shadow-sm transition hover:bg-[#edf5ef]"
          title="Start or join Voice Huddle with collaborators"
        >
          <PhoneCall className="size-3.5 text-[#287d67]" />
          <span className="hidden md:inline">Voice Huddle</span>
        </button>
      )}
    </div>
  );
}
