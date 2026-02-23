# Data Model: Voice Input for Strategy Dictation

**Feature**: 003-voice-input | **Date**: 2026-02-23

## Entities

### SpeechRecognitionState

The runtime state of the voice input feature within the `useSpeechRecognition` hook.

| Field | Type | Description |
|-------|------|-------------|
| `isSupported` | `boolean` | Whether the browser supports the Web Speech API. Determined once on mount. Immutable after initialization. |
| `isListening` | `boolean` | Whether the speech recognizer is actively capturing audio. `true` between `start()` and `end` event. |
| `interimTranscript` | `string` | Current partial transcription (in-progress words). Replaced on each `result` event. Cleared when listening stops. |
| `error` | `string \| null` | Human-readable error message from the last failed speech session. `null` when no error. Cleared on next `startListening()` call. |

### MicrophoneButtonState (derived)

The visual state of the microphone button, derived from `SpeechRecognitionState`. Not stored independently.

| Derived State | Condition | Visual Treatment |
|---------------|-----------|------------------|
| **hidden** | `isSupported === false` | Button not rendered. |
| **idle** | `isSupported && !isListening && !error` | Static mic icon, default button styling. |
| **listening** | `isListening === true` | Animated mic icon (pulsing ring), active color (red/indigo). |
| **error** | `error !== null` | Idle appearance + inline error message (auto-dismisses on next click or after 5s). |

## State Transitions

```
[mount] ──→ isSupported? ──No──→ HIDDEN (no button rendered)
                │
               Yes
                │
                ▼
             IDLE ◄──────────────────────────────────┐
                │                                     │
          user clicks mic                             │
                │                                     │
                ▼                                     │
           LISTENING                                  │
                │                                     │
        ┌───────┼───────────┐                         │
        │       │           │                         │
   user clicks  │     5s silence                      │
    mic again   │      timeout                        │
        │       │           │                         │
        │    error          │                         │
        │    occurs         │                         │
        │       │           │                         │
        │       ▼           │                         │
        │    ERROR ─────────┼─── auto-dismiss (5s) ───┘
        │                   │      or next click
        └───────────────────┘
                │
                ▼
             IDLE
```

## Transcript Flow

```
[existing textarea text] + [finalTranscript from current session] + [interimTranscript]
         ▲                           ▲                                      ▲
         │                           │                                      │
  preserved on                 accumulated from              replaced on each
  session start               isFinal === true               result event,
  (never modified              result segments                cleared on
   by voice input)                                            session end
```

**Lifecycle of a single dictation session**:

1. User clicks mic → `startListening()` → `isListening = true`
2. User speaks → `result` events fire with `interimTranscript` updates
3. Speech segment finalized → `isFinal = true` → text moves from interim to final buffer
4. More speech → repeat steps 2-3
5. Silence timer expires (5s) OR user clicks mic → `recognition.stop()` → `onend` fires
6. Final transcript appended to textarea's existing text
7. Hook resets: `isListening = false`, `interimTranscript = ''`

## Data Volume

- **Per session**: Typically 10-50 words (1-3 sentences). A single strategy description.
- **Persistence**: None. Speech sessions are ephemeral. Only the resulting text string persists (in the textarea's React state).
- **Memory**: SpeechRecognition instance (~negligible), one `setTimeout` timer. Cleaned up on unmount.
