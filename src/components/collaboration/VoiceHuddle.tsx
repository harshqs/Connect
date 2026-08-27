"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, VolumeX, Sparkles } from "lucide-react";

interface VoiceHuddleProps {
  documentId: string;
  currentUser: { name: string; color: string };
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

export function VoiceHuddle({ documentId, currentUser, onSpeakingChange }: VoiceHuddleProps) {
  const [isInHuddle, setIsInHuddle] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Toggle Voice Huddle Connection
  const toggleHuddle = async () => {
    if (isInHuddle) {
      // Leave Huddle
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsInHuddle(false);
      setIsSpeaking(false);
      onSpeakingChange?.(false);
    } else {
      // Join Huddle
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setIsInHuddle(true);

        // Audio level analyzer
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudio = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length;
          const speaking = avg > 25 && !isMuted;
          setIsSpeaking(speaking);
          onSpeakingChange?.(speaking);

          if (localStreamRef.current) {
            requestAnimationFrame(checkAudio);
          }
        };
        checkAudio();
      } catch (err) {
        console.error("Voice Huddle Mic Error:", err);
        alert("Microphone permission required to join Voice Huddle!");
      }
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isInHuddle ? (
        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-1 pl-3 text-xs shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 mr-1">
            <span className="relative flex size-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${isSpeaking ? "bg-emerald-400 animate-ping" : "bg-emerald-500"}`} />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-bold text-emerald-300">Voice Huddle</span>
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
