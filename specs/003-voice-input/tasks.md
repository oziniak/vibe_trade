# Tasks: Voice Input for Strategy Dictation

**Input**: Design documents from `/specs/003-voice-input/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested in feature specification. Constitution IV (Math-First Testing) does not apply — no math modules affected. Manual browser testing covers the Web Speech API integration.

**Organization**: Tasks are grouped by user story. US1 (Dictate a Strategy) and US2 (Visual Feedback) are combined into one phase because they are inseparable — the mic button IS both the input mechanism and the visual feedback. US3 (Error Handling) is a separate phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Type infrastructure for Web Speech API cross-browser support

- [x] T001 Create WebkitSpeechRecognition type declaration in `src/types/speech-recognition.d.ts`. Extend the global `Window` interface with `webkitSpeechRecognition: typeof SpeechRecognition` for Safari compatibility. TypeScript's `lib.dom.d.ts` already provides `SpeechRecognition`, `SpeechRecognitionEvent`, and `SpeechRecognitionErrorEvent` types — only the webkit-prefixed constructor is missing. See research.md R-004.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Custom React hook that wraps the Web Speech API. All user stories depend on this hook.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Implement `useSpeechRecognition` custom hook in `src/hooks/useSpeechRecognition.ts`. Follow the contract in `specs/003-voice-input/contracts/useSpeechRecognition.md` exactly. The hook must implement:
  - **Feature detection**: Check `window.SpeechRecognition || window.webkitSpeechRecognition` on mount (SSR-safe with `typeof window !== 'undefined'` guard). Expose as `isSupported: boolean`.
  - **Options**: Accept `{ silenceTimeoutMs?: number (default 5000), lang?: string (default 'en-US'), onFinalTranscript: (transcript: string) => void }`.
  - **SpeechRecognition config**: Set `continuous = true` and `interimResults = true` per research.md R-001 and R-002.
  - **Result processing**: On each `result` event, iterate from `event.resultIndex` to `event.results.length`. Accumulate `isFinal` segments into a local final buffer and call `onFinalTranscript` with the final text. Set `interimTranscript` state to the current non-final segment text. See research.md R-003 for the two-buffer strategy.
  - **Silence timeout**: Reset a `setTimeout(5000ms)` on every `result` event. When the timer fires, call `recognition.stop()`. Clear the timer in `onend` and on unmount. See research.md R-002.
  - **Start/stop**: `startListening()` creates a new SpeechRecognition instance, clears previous error, starts recognition, sets `isListening = true`. `stopListening()` calls `recognition.stop()`. Both are no-ops when inappropriate (already listening, not supported, etc.).
  - **Error handling**: Map `SpeechRecognitionErrorEvent.error` codes to user-friendly messages: `not-allowed` → "Microphone access denied. Please allow microphone permission in your browser settings.", `audio-capture` → "No microphone found. Please check your audio settings.", `network` → "Network error. Speech recognition requires an internet connection.". Treat `no-speech` and `aborted` as non-critical (no error state). Set `error: string | null` state.
  - **Cleanup**: On `onend` event, set `isListening = false`, clear `interimTranscript`, clear silence timer. On component unmount (useEffect cleanup), call `recognition.abort()` and clear all timers. Store the SpeechRecognition instance in a `useRef`. Store `onFinalTranscript` in a ref to avoid re-creating the recognition instance when the callback changes.
  - **Return**: `{ isSupported, isListening, interimTranscript, error, startListening, stopListening }`.
  - **JSDoc**: Add JSDoc comments on the exported hook function and all exported interfaces (`UseSpeechRecognitionOptions`, `UseSpeechRecognitionReturn`) per constitution II.

**Checkpoint**: Hook is complete and ready to be consumed by StrategyInput.

---

## Phase 3: User Story 1 + User Story 2 - Core Dictation with Visual Feedback (Priority: P1) MVP

**Goal**: Users can click a mic button on the strategy textarea, speak a strategy, and see real-time transcription appear. The button shows clear idle/listening visual states. On unsupported browsers, the button is hidden.

**Independent Test**: Click the mic button, speak "Buy when RSI drops below 30, sell when it rises above 70", verify the words appear in the textarea in real time. Click the button again or wait 5 seconds for auto-stop. Type additional text and verify it coexists with dictated text.

### Implementation

- [x] T003 [US1] Wire `useSpeechRecognition` hook into StrategyInput in `src/components/StrategyInput.tsx`. Import the hook from `@/hooks/useSpeechRecognition`. Call it with `{ silenceTimeoutMs: 5000, onFinalTranscript: (text) => setPrompt((prev) => prev + (prev ? ' ' : '') + text) }`. This connects finalized speech segments to the existing `prompt` state so the text flows through the existing `onParse` pipeline unchanged. Ensure the hook is called unconditionally (React rules of hooks) — conditional behavior is handled inside the hook via `isSupported`.

- [x] T004 [US1] Add mic button to the textarea area in `src/components/StrategyInput.tsx`. Wrap the existing `<Textarea>` in a `<div className="relative">` container. Add a `<Button>` using shadcn/ui Button component (variant `"ghost"`, size `"icon"`) positioned `absolute right-2 top-2` inside the container. Use the `Mic` icon from `lucide-react` for the button content. The button's `onClick` should toggle: `isListening ? stopListening : startListening`. Only render the button when `isSupported === true` (FR-008: progressive enhancement — hidden entirely on unsupported browsers). Add `aria-label` for accessibility: `isListening ? "Stop dictation" : "Start voice input"`. Add right padding to the textarea (`pr-10`) so text doesn't overlap the button.

- [x] T005 [US1] Display interim transcript in the textarea while listening in `src/components/StrategyInput.tsx`. When `isListening` is true and `interimTranscript` is non-empty, set the textarea's `value` to `prompt + (prompt ? ' ' : '') + interimTranscript`. When `isListening` is false, set the textarea's `value` to just `prompt` (the normal behavior). This gives users real-time feedback as they speak (FR-003). The textarea should remain editable — the `onChange` handler continues to update `prompt` state normally.

- [x] T006 [US2] Implement mic button visual states (idle/listening) in `src/components/StrategyInput.tsx`. Apply these Tailwind classes based on hook state:
  - **Idle** (`!isListening`): `text-slate-400 hover:text-slate-200` — subtle, matches existing UI.
  - **Listening** (`isListening`): `text-red-400 animate-pulse` with a pulsing ring effect: `ring-2 ring-red-400/50`. Keep the `Mic` icon in both states — the red color + pulse animation is sufficient differentiation. (`MicOff` implies "muted/disabled" which would be misleading.) The visual change must be immediately distinguishable from idle (SC-002: < 300ms transition).

**Checkpoint**: Core voice input works end-to-end. Users can dictate, see real-time text, and the button clearly shows when it's listening. This is a fully functional MVP.

---

## Phase 4: User Story 3 - Error Handling and Recovery (Priority: P2)

**Goal**: Users see clear, actionable error messages when voice input fails (permission denied, network error, audio capture failure). Errors auto-dismiss. The app never silently fails.

**Independent Test**: Deny microphone permission in browser settings, click mic button, verify error message appears. Reset permission, try again, verify it works. Test with no microphone connected.

### Implementation

- [x] T007 [US3] Add voice input error display UI in `src/components/StrategyInput.tsx`. Track voice errors in a local `voiceError` state (separate from the hook's `error`). Sync it from the hook: use a `useEffect` watching the hook's `error` — when it becomes non-null, set `voiceError` to the error string and start a 5-second `setTimeout` that clears `voiceError` back to `null` (auto-dismiss). Clicking the mic button again also clears it because `startListening` resets the hook's `error`, which triggers the effect to clear `voiceError`. When `voiceError` is non-null, render an inline error notification below the textarea using the existing app error pattern: `<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 flex items-center gap-2">` with error text in `text-sm text-red-300`. Ensure the error does not displace existing textarea content (FR-012: preserve transcribed text on error). Position the error between the textarea and the example buttons.

- [x] T008 [US3] Handle edge case: rapid mic button clicks (debounce) in `src/components/StrategyInput.tsx`. Ensure rapid sequential clicks don't create multiple SpeechRecognition instances or leave the hook in an inconsistent state. The hook's `startListening`/`stopListening` no-op guards (no-op if already listening / not listening) should handle this, but verify by reviewing the toggle logic: `onClick = isListening ? stopListening : startListening`. If needed, add a short debounce (100ms) on the button click handler to prevent race conditions between the `start()` call and the async `onstart` event.

**Checkpoint**: All three user stories are complete. Voice input works with proper error feedback.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify integration with existing features and ensure no regressions.

- [x] T009 Verify Cmd/Ctrl+Enter and Parse Strategy button still work in `src/components/StrategyInput.tsx` (FR-011). Ensure the `handleKeyDown` function and submit button are not affected by the new mic button or hook state. The mic button should not capture keyboard events or interfere with form submission.

- [x] T010 Verify component cleanup on navigation in `src/components/StrategyInput.tsx`. The hook's useEffect cleanup should abort recognition and clear timers when the component unmounts (FR-010). Verify this works when the app transitions from the `input` phase to `parsing` or `confirming` phases in `page.tsx` — StrategyInput is conditionally rendered and will unmount during phase transitions.

- [x] T011 Manual browser testing checklist:
  - Chrome: Full dictation flow (start → speak → interim text → final text → auto-stop after 5s silence). Verify append behavior with existing text.
  - Safari: Basic flow works with `webkitSpeechRecognition`. Verify silence timeout works despite Safari's on-device processing differences.
  - Firefox: Mic button is completely hidden. No console errors. Typing and presets work unchanged.
  - Mobile Chrome/Safari: Button hidden if unsupported, visible if supported. Touch interaction works.
  - Simultaneous typing + dictation: Start dictation, then type in the textarea while mic is active. Verify no text loss or duplication.
  - Non-English speech: Speak a non-English phrase while mic is active. Verify the system does not crash or show unhandled errors (transcription may be inaccurate — that is expected).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (type declaration must exist for hook to compile)
- **US1 + US2 (Phase 3)**: Depends on Phase 2 (hook must be complete)
- **US3 (Phase 4)**: Depends on Phase 3 (error display builds on the existing mic button UI)
- **Polish (Phase 5)**: Depends on Phase 4

### User Story Dependencies

- **US1 + US2 (P1)**: Can start after Foundational (Phase 2). These two stories are implemented together because the mic button is both the input mechanism and the visual feedback — they cannot be separated.
- **US3 (P2)**: Can start after Phase 3. Adds error handling to the already-working mic button. Could technically be done in parallel with Phase 3 since it modifies a different part of StrategyInput, but sequential is simpler for a single-file feature.

### Within Each Phase

- Phase 3: T003 → T004 → T005 → T006 (sequential — all modify `StrategyInput.tsx` in the same region)
- Phase 4: T007 → T008 (sequential — same file, T008 depends on T007's button being wired)
- Phase 5: T009, T010, T011 can run in parallel (independent verification tasks)

### Parallel Opportunities

```text
# Phase 1 and Phase 2 are sequential (2 depends on 1)
# Phase 3 tasks are sequential (same file, same region)
# Phase 4 tasks are sequential (same file)
# Phase 5 tasks can run in parallel:
T009: Verify keyboard shortcuts
T010: Verify cleanup on navigation
T011: Manual browser testing
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3)

1. Complete Phase 1: Type declaration (1 minute)
2. Complete Phase 2: Hook implementation (~30 minutes)
3. Complete Phase 3: StrategyInput integration (~30 minutes)
4. **STOP and VALIDATE**: Open Chrome, speak a strategy, verify text appears
5. This is a deployable MVP — voice input works with visual feedback

### Incremental Delivery

1. Phase 1 + 2 → Hook ready
2. Phase 3 → Core dictation works (MVP!)
3. Phase 4 → Error handling added (robust)
4. Phase 5 → Verified and polished (ship-ready)

### File Touch Summary

| File | Phases | Action |
|------|--------|--------|
| `src/types/speech-recognition.d.ts` | Phase 1 | NEW (2 lines) |
| `src/hooks/useSpeechRecognition.ts` | Phase 2 | NEW (~80 lines) |
| `src/components/StrategyInput.tsx` | Phase 3, 4, 5 | MODIFIED |

---

## Notes

- All tasks modify at most 1 file each (no cross-file conflicts)
- Phase 3 tasks are sequential because they all modify `StrategyInput.tsx` — do not parallelize
- The hook (T002) is the most complex task. Reference the contract doc for the exact interface
- No npm dependencies to install — Web Speech API is browser-native
- Total: 11 tasks across 3 files
