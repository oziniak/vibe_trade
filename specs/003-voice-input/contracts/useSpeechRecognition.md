# Contract: useSpeechRecognition Hook

**Feature**: 003-voice-input | **Date**: 2026-02-23

## Interface

```typescript
/** Options for the useSpeechRecognition hook. */
interface UseSpeechRecognitionOptions {
  /** Silence timeout in milliseconds before auto-stopping. Default: 5000. */
  silenceTimeoutMs?: number;
  /** BCP 47 language tag. Default: 'en-US'. */
  lang?: string;
}

/** Return value of the useSpeechRecognition hook. */
interface UseSpeechRecognitionReturn {
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

/** Hook signature. */
function useSpeechRecognition(
  options?: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn;
```

## Callback Pattern

The hook does NOT accept an `onResult` callback. Instead, the consumer reads the final transcript from the `result` event via a ref-based callback pattern internal to the hook. The hook exposes `interimTranscript` for display and calls a `onFinalTranscript` callback passed as an option.

**Updated interface** (final design):

```typescript
interface UseSpeechRecognitionOptions {
  silenceTimeoutMs?: number;
  lang?: string;
  /** Called with each finalized transcript segment. Consumer appends to textarea. */
  onFinalTranscript: (transcript: string) => void;
}
```

## Behavioral Contract

| Action | Precondition | Effect |
|--------|-------------|--------|
| `startListening()` | `isSupported && !isListening` | Creates SpeechRecognition instance, starts listening. Sets `isListening = true`, clears `error`. |
| `startListening()` | `!isSupported \|\| isListening` | No-op. |
| `stopListening()` | `isListening` | Calls `recognition.stop()`. Triggers `onend` → `isListening = false`. |
| `stopListening()` | `!isListening` | No-op. |
| Speech detected | `isListening` | `interimTranscript` updated with partial text. Silence timer reset. |
| Speech finalized | `isListening` | `onFinalTranscript(text)` called. `interimTranscript` cleared for that segment. |
| Silence (5s) | `isListening` | `recognition.stop()` called automatically. Same effect as manual `stopListening()`. |
| Permission denied | User denies mic | `error = "Microphone access denied..."`, `isListening = false`. |
| Network error | Chrome speech service fails | `error = "Network error..."`, `isListening = false`. Existing transcript preserved. |
| Component unmount | Any | `recognition.abort()` called. All timers cleared. No state updates after unmount. |

## Integration in StrategyInput

```typescript
// Pseudocode — StrategyInput.tsx integration
const { isSupported, isListening, interimTranscript, error, startListening, stopListening } =
  useSpeechRecognition({
    silenceTimeoutMs: 5000,
    onFinalTranscript: (text) => setPrompt((prev) => prev + (prev ? ' ' : '') + text),
  });

// Textarea value = prompt + (isListening ? interimTranscript : '')
// Mic button: onClick = isListening ? stopListening : startListening
// Mic button: hidden if !isSupported
```
