# Research: Voice Input for Strategy Dictation

**Feature**: 003-voice-input | **Date**: 2026-02-23

## R-001: Speech Recognition API Choice

**Decision**: Use the browser-native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).

**Rationale**: The Web Speech API is built into Chrome, Edge, and Safari — no npm packages, no API keys, no server costs. It aligns with the constitution's principle of no unnecessary dependencies and client-side computation. The API provides real-time interim results and continuous listening mode, which are both required by the spec.

**Alternatives considered**:
- **Whisper.js (client-side WASM)**: Fully offline, consistent cross-browser. Rejected: ~40MB model download, high CPU usage, adds complexity and a large dependency.
- **Deepgram / AssemblyAI / Google Cloud Speech**: Superior accuracy, cross-browser. Rejected: Requires API keys, server-side proxy, ongoing cost, and violates the "no new network dependencies for compute" principle.
- **React Speech Recognition (npm)**: Wrapper around Web Speech API. Rejected: Adds an unnecessary abstraction layer over a simple browser API. The hook we need is ~60 lines.

## R-002: Extended Silence Timeout (~5 seconds)

**Decision**: Use `continuous = true` mode with a custom `setTimeout`-based silence timer that resets on every `result` event. After 5 seconds without a `result` event, call `recognition.stop()`.

**Rationale**: The Web Speech API has no configurable silence timeout. In non-continuous mode, it auto-stops after the first pause (~1-2 seconds), which is too aggressive for strategy dictation. Setting `continuous = true` prevents auto-stop entirely, so we implement our own timer. The `result` event is the most reliable "speech is happening" signal.

**Alternatives considered**:
- **Use `speechend` event**: Less reliable — Chrome fires `speechend` between phrases in continuous mode without actually stopping the session. The `result` event is more predictable.
- **No timeout (manual stop only)**: Simpler implementation but users may forget to stop, leaving the mic active indefinitely. The spec requires auto-stop (FR-007).

## R-003: Interim Results Display Strategy

**Decision**: Track two transcript buffers: `finalTranscript` (confirmed, won't change) and `interimTranscript` (current partial, replaced on each event). Set the textarea value to `existingText + finalTranscript + interimTranscript`. When a segment becomes final, move it from interim to final buffer.

**Rationale**: The Web Speech API replaces interim results on each `result` event (they are not additive). Final results are stable and won't change. By maintaining separate buffers, we can show real-time text without corrupting the confirmed transcription. The textarea always shows the latest state: existing text + confirmed dictation + in-progress words.

**Alternatives considered**:
- **Only show final results (no interim)**: Simpler but the textarea would appear empty while speaking, then text would "pop in" — poor UX, violates FR-003 and SC-001.
- **Append interim directly to textarea**: Would duplicate text when interim becomes final. The two-buffer approach avoids this.

## R-004: TypeScript Type Declarations

**Decision**: Add a manual 2-line type declaration in `src/types/speech-recognition.d.ts` extending `Window` with `webkitSpeechRecognition`. Do not install `@types/dom-speech-recognition`.

**Rationale**: TypeScript's `lib.dom.d.ts` already includes `SpeechRecognition`, `SpeechRecognitionEvent`, and `SpeechRecognitionErrorEvent` types. Only the `webkitSpeechRecognition` constructor on `Window` is missing. A 2-line manual declaration is simpler and avoids a dev dependency for a trivial type augmentation.

**Alternatives considered**:
- **`@types/dom-speech-recognition` package**: Comprehensive but adds a dependency for what amounts to 2 lines of code. Rejected per scope discipline.

## R-005: Error Notification Pattern

**Decision**: Use the existing inline error display pattern from StrategyInput (amber/red bordered alert box) for voice-specific errors. Auto-dismiss after 5 seconds or on next mic click.

**Rationale**: The app already uses inline error alerts (amber for validation, red for API errors). Adding a toast/snackbar system would require new UI infrastructure. Reusing the existing pattern maintains visual consistency and avoids scope creep.

**Alternatives considered**:
- **Add a toast/notification system (sonner, react-hot-toast)**: Better UX for transient notifications but adds a dependency and complexity. Rejected per constitution VII (scope discipline).
- **Browser alert()**: Blocking and disruptive. Rejected.

## R-006: Browser Compatibility Strategy

**Decision**: Feature-detect with `window.SpeechRecognition || window.webkitSpeechRecognition`. If absent, hide the mic button entirely (progressive enhancement). No polyfills.

**Rationale**: Firefox is the only major browser without support. Firefox users get the existing typing experience unchanged. Adding a polyfill (which would require a third-party speech API) adds cost and complexity for a small user segment.

**Browser support matrix**:
| Browser | Support | Prefix needed |
|---------|---------|---------------|
| Chrome (desktop + Android) | Yes | No (unprefixed since ~v106, `webkit` still works) |
| Edge | Yes | No |
| Safari (desktop + iOS) | Partial | Yes (`webkitSpeechRecognition`) |
| Firefox | No | N/A — button hidden |
| Opera | Yes | No |

**Safari caveats**: Uses on-device processing (no network needed, different accuracy). `continuous = true` may behave differently — requires testing. The silence timeout timer provides consistent behavior regardless of browser quirks.
