# Quickstart: Voice Input for Strategy Dictation

**Feature**: 003-voice-input | **Date**: 2026-02-23

## Prerequisites

- Existing codebase on branch `003-voice-input`
- No new dependencies needed (Web Speech API is browser-native)
- Chrome or Edge browser for development/testing

## Files to Create

### 1. Type Declaration: `src/types/speech-recognition.d.ts`

Extends the `Window` interface with `webkitSpeechRecognition` for Safari compatibility. TypeScript's `lib.dom.d.ts` already includes `SpeechRecognition` and related event types.

### 2. Custom Hook: `src/hooks/useSpeechRecognition.ts`

Encapsulates all Web Speech API interaction:
- Feature detection (`isSupported`)
- SpeechRecognition instance lifecycle (create on start, abort on cleanup)
- `continuous = true` + `interimResults = true` configuration
- Custom 5-second silence timeout via `setTimeout` reset on each `result` event
- Two-buffer transcript management (final vs. interim)
- Error mapping (API error codes → user-friendly messages)
- React cleanup (abort recognition + clear timers on unmount)

See [contract](./contracts/useSpeechRecognition.md) for the full interface.

## Files to Modify

### 3. StrategyInput Component: `src/components/StrategyInput.tsx`

Changes:
- Import and call `useSpeechRecognition` hook
- Add mic button inside textarea wrapper (right-aligned, vertically centered)
- Show `interimTranscript` appended to textarea display value while listening
- Show inline error message when `error` is non-null (auto-dismiss after 5s)
- Conditionally render mic button only when `isSupported === true`
- Use `Mic` and `MicOff` icons from lucide-react
- Add listening state animation (pulsing ring via Tailwind `animate-pulse` or custom keyframes)

**Button placement**: Inside a `relative` wrapper around the textarea. Button positioned `absolute right-2 top-2` (or vertically centered). This follows the Google Search / ChatGPT input pattern.

**Visual states**:
- Idle: `text-slate-400 hover:text-slate-200` — subtle, non-intrusive
- Listening: `text-red-400` with animated pulsing ring (`ring-2 ring-red-400/50 animate-pulse`)
- Error: Inline message below textarea in red/amber

## Implementation Order

1. Create `src/types/speech-recognition.d.ts` (2 lines)
2. Create `src/hooks/useSpeechRecognition.ts` (hook logic)
3. Modify `src/components/StrategyInput.tsx` (integrate hook + add mic button)
4. Manual browser testing (Chrome: full flow, Safari: basic flow, Firefox: button hidden)
5. Add unit tests for hook state transitions (mock SpeechRecognition)

## Testing Notes

- **Unit tests**: Mock `window.SpeechRecognition` in Vitest. Test state transitions (idle → listening → idle), silence timeout behavior, error handling, cleanup on unmount.
- **Manual testing**: Must test in a real browser — Web Speech API cannot be fully simulated. Test mic permission flow, actual dictation, silence timeout, and error states.
- **No E2E tests**: Per constitution IV (math-first testing, no E2E).

## Key Decisions Reference

| Decision | Choice | See |
|----------|--------|-----|
| Speech API | Browser-native Web Speech API | [research.md](./research.md) R-001 |
| Silence timeout | Custom 5s timer over `continuous = true` | [research.md](./research.md) R-002 |
| Interim display | Two-buffer (final + interim) in textarea | [research.md](./research.md) R-003 |
| TypeScript types | Manual 2-line declaration, no `@types` package | [research.md](./research.md) R-004 |
| Error display | Existing inline alert pattern, auto-dismiss 5s | [research.md](./research.md) R-005 |
| Unsupported browsers | Hide button entirely (progressive enhancement) | [research.md](./research.md) R-006 |
