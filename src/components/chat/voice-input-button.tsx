"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
}

export default function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const sentRef = useRef(false);

  // Reset sent flag when listening starts
  useEffect(() => {
    if (isListening) {
      sentRef.current = false;
    }
  }, [isListening]);

  // Send transcript once when listening ends
  useEffect(() => {
    if (!isListening && transcript && !sentRef.current) {
      sentRef.current = true;
      onTranscript(transcript);
    }
  }, [isListening, transcript, onTranscript]);

  if (!isSupported) return null;

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={disabled}
        title={isListening ? "Stop recording" : "Voice input"}
        className={`rounded-xl p-3 transition-all ${
          isListening
            ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/40 animate-recording-pulse"
            : "bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10 border border-white/10"
        } disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {isListening ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
}
