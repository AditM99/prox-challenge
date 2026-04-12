"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

interface VoiceOutputButtonProps {
  text: string;
  isStreaming: boolean;
  language?: string;
}

export default function VoiceOutputButton({ text, isStreaming, language = "en" }: VoiceOutputButtonProps) {
  const { isSpeaking, speak, stop } = useSpeechSynthesis(language);

  if (!text || isStreaming) return null;

  const handleClick = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  };

  return (
    <button
      onClick={handleClick}
      title={isSpeaking ? "Stop reading" : "Read aloud"}
      className={`p-1 rounded-md transition-all ${
        isSpeaking
          ? "text-brand-400 bg-brand-500/10"
          : "text-white/20 hover:text-white/40 hover:bg-white/5"
      }`}
    >
      {isSpeaking ? (
        <VolumeX className="w-3.5 h-3.5" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
