# Implementation Plan: Voice Input for Strategy Dictation

**Branch**: `003-voice-input` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-voice-input/spec.md`

## Summary

Add a browser-native voice-to-text input to the strategy textarea using the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). A microphone button is placed inside the textarea (right-aligned). Users click to start dictating; real-time interim transcription appears in the textarea. Listening auto-stops after ~5 seconds of silence (custom timer over `continuous = true` mode). The button is hidden via progressive enhancement on unsupported browsers (Firefox). No new dependencies — only a 2-line TypeScript declaration for `webkitSpeechRecognition`.

## Technical Context

**Language/Version**: TypeScript 5, strict mode, Next.js 16 (App Router)
**Primary Dependencies**: React 19, Tailwind CSS 4, shadcn/ui, lucide-react (icons), Web Speech API (browser-native, zero npm packages)
**Storage**: N/A (ephemeral speech sessions, no persistence)
**Testing**: Vitest (unit tests for hook logic with mocked SpeechRecognition)
**Target Platform**: Modern browsers (Chrome, Edge, Safari). Progressive enhancement — hidden on Firefox.
**Project Type**: Web application (Next.js)
**Performance Goals**: State transitions < 300ms, transcription visible within 2s of speech end (SC-001, SC-002)
**Constraints**: Client-side only, no server-side speech processing, no new npm dependencies
**Scale/Scope**: Single component enhancement (StrategyInput), 1 custom hook, 1 type declaration file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | AI-Math Boundary | PASS | Voice input feeds text into textarea → existing AI parse flow. No AI involvement in speech recognition. Browser-native API only. |
| II | TypeScript Strict & Zod | PASS | All new code in strict TypeScript. No Zod needed — voice input produces a string (textarea value), not a schema boundary. |
| III | Pure Functions & Layered Dependencies | PASS | Hook encapsulates browser API side effects. Textarea string flows through existing `prompt` state → `onParse` → API. No new layer dependencies. |
| IV | Math-First Testing | PASS | No math modules affected. Hook logic (state transitions, timer behavior) can be unit-tested with mocked SpeechRecognition. |
| V | Demo Resilience | PASS | Voice input is additive. If browser doesn't support speech recognition, button is hidden. Typing, presets, and demo mode all work unchanged. |
| VI | Professional UX & Charting | PASS | Feature adds idle/listening/error states with visual feedback. Follows existing dark theme + indigo accent patterns. |
| VII | Scope Discipline | PASS | Voice input enhances the 3-minute demo (speak a strategy instead of typing). Contributes to Creativity and Usefulness judging criteria. |
| VIII | Phased Implementation | PASS | This is a Phase 3 polish/feature. Core engine and UI v1 are already complete. |

No violations. Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-voice-input/
├── plan.md              # This file
├── research.md          # Phase 0: Web Speech API research
├── data-model.md        # Phase 1: State model for speech recognition
├── quickstart.md        # Phase 1: Implementation quickstart
├── contracts/           # Phase 1: Hook interface contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── speech-recognition.d.ts   # NEW: webkitSpeechRecognition type declaration
├── hooks/
│   └── useSpeechRecognition.ts   # NEW: Custom hook wrapping Web Speech API
└── components/
    └── StrategyInput.tsx          # MODIFIED: Add mic button + voice input integration
```

**Structure Decision**: Follows existing project layout. One new hook in `src/hooks/`, one type declaration in `src/types/`, and modifications to the existing `StrategyInput` component. No new UI components needed — the mic button uses the existing `Button` component from shadcn/ui with a lucide-react `Mic` icon.
