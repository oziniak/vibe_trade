"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Options for the useSpeechRecognition hook. */
export interface UseSpeechRecognitionOptions {
  /** Silence timeout in milliseconds before auto-stopping. Default: 3000. */
  silenceTimeoutMs?: number;
  /** BCP 47 language tag. Default: 'en-US'. */
  lang?: string;
  /** Called with each finalized transcript segment. Consumer appends to textarea. */
  onFinalTranscript: (transcript: string) => void;
}

/** Return value of the useSpeechRecognition hook. */
export interface UseSpeechRecognitionReturn {
  /** Whether the browser supports the Web Speech API. */
  isSupported: boolean;
  /** Whether the recognizer is actively listening. */
  isListening: boolean;
  /** Current interim (partial) transcript. Empty when not listening. */
  interimTranscript: string;
  /** Human-readable error message, or null. Cleared on next startListening(). */
  error: string | null;
  /** Start listening. No-op if unsupported or already listening. */
  startListening: () => void;
  /** Stop listening and finalize transcript. No-op if not listening. */
  stopListening: () => void;
}

/**
 * Returns the SpeechRecognition constructor if available, or null.
 * SSR-safe: returns null when `window` is undefined.
 */
function getSpeechRecognitionAPI(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Maps a SpeechRecognitionErrorEvent error code to a user-friendly message.
 * Returns null for non-critical errors that should be silently ignored.
 */
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

/**
 * Custom hook that wraps the browser Web Speech API for voice-to-text input.
 *
 * Provides feature detection, start/stop controls, real-time interim transcription,
 * a configurable silence timeout, and error handling with user-friendly messages.
 * Cleans up all resources on unmount.
 *
 * @param options - Configuration for the speech recognition session
 * @returns State and controls for the speech recognition session
 */
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

  // Keep the callback ref current without re-creating recognition
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // Feature detection on mount
  useEffect(() => {
    setIsSupported(getSpeechRecognitionAPI() !== null);
  }, []);

  // Cleanup on unmount
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
      // Non-critical errors (no-speech, aborted) are silently ignored
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
      // Handle InvalidStateError if recognition is already started
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
    // Immediate state cleanup — don't wait for onend
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
