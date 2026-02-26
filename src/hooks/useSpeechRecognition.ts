"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSpeechRecognitionOptions {
  silenceTimeoutMs?: number;
  lang?: string;
  onFinalTranscript: (transcript: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
}

function getSpeechRecognitionAPI(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function mapErrorToMessage(errorCode: string): string | null {
  switch (errorCode) {
    case "not-allowed":
      return "Microphone access denied. Please allow microphone permission in your browser settings.";
    case "audio-capture":
      return "No microphone found. Please check your audio settings.";
    case "network":
      return "Network error. Speech recognition requires an internet connection.";
    case "service-not-allowed":
      return "Speech recognition service is not available in this browser.";
    case "language-not-supported":
      return "The selected language is not supported for speech recognition.";
    case "no-speech":
    case "aborted":
      return null; // Non-critical — no error state
    default:
      return `Speech recognition error: ${errorCode}`;
  }
}

export function useSpeechRecognition({
  silenceTimeoutMs = 3000,
  lang = "en-US",
  onFinalTranscript,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const lastInterimRef = useRef("");

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionAPI() !== null);
  }, []);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI || isListening) return;

    // Clear previous state
    setError(null);
    setInterimTranscript("");
    lastInterimRef.current = "";

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // Use abort() — stop() in continuous mode can hang in Chrome
        recognition.abort();
      }, silenceTimeoutMs);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      // Only reset silence timer when speech content actually changes,
      // not on repeated interim results from ambient noise
      if (finalText || interimText.trim() !== lastInterimRef.current.trim()) {
        lastInterimRef.current = interimText;
        resetSilenceTimer();
      }

      if (finalText) {
        lastInterimRef.current = "";
        onFinalTranscriptRef.current(finalText);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const message = mapErrorToMessage(event.error);
      if (message) {
        setError(message);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      lastInterimRef.current = "";
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      resetSilenceTimer();
    } catch {
      setError("Failed to start speech recognition. Please try again.");
    }
  }, [isListening, lang, silenceTimeoutMs]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (!recognition) return;
    // Null out handlers to prevent stale onend from interfering
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognitionRef.current = null;
    recognition.abort();
    setIsListening(false);
    setInterimTranscript("");
    lastInterimRef.current = "";
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    startListening,
    stopListening,
  };
}
