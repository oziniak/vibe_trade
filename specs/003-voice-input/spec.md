# Feature Specification: Voice Input for Strategy Dictation

**Feature Branch**: `003-voice-input`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Browser voice to text feature, so the users will be able not only type, but dictate strategies. Use best industry-wide UI/UX practices for button placement, correct states (listening, parsing, done, etc)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dictate a Strategy via Voice (Priority: P1)

A user wants to describe their trading strategy by speaking instead of typing. They click a microphone button adjacent to the strategy textarea, speak their strategy (e.g., "Buy when RSI drops below 30, sell when it rises above 70"), and the spoken words appear as text in the textarea in real time. Once they stop speaking, the transcribed text remains in the textarea, ready to be edited or submitted.

**Why this priority**: This is the core value proposition — enabling voice as an input method. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by clicking the microphone button, speaking a strategy phrase, and verifying the transcribed text appears in the textarea. Delivers immediate value as an alternative input method.

**Acceptance Scenarios**:

1. **Given** the user is on the strategy input screen with an empty textarea, **When** they click the microphone button and speak "Buy when RSI drops below 30", **Then** the spoken words appear as text in the textarea in real time as the user speaks.
2. **Given** the user has existing text in the textarea, **When** they click the microphone button and speak additional text, **Then** the new dictated text is appended to the existing text (not replacing it).
3. **Given** the user is actively dictating (microphone is listening), **When** they click the microphone button again, **Then** listening stops and the transcribed text remains in the textarea.
4. **Given** the user is actively dictating, **When** an extended silence (~5 seconds) is detected, **Then** the system finalizes the current speech segment and stops listening automatically. Short pauses (e.g., thinking mid-sentence) do not trigger auto-stop.

---

### User Story 2 - Visual Feedback During Dictation (Priority: P1)

A user needs clear visual cues to understand what the voice input system is doing. The microphone button and surrounding UI provide distinct visual states: idle (ready to listen), listening (actively capturing speech), and unavailable (browser doesn't support speech recognition).

**Why this priority**: Without visual feedback, users cannot tell if the system is listening or if their speech is being captured. This is essential for usability and is inseparable from the core dictation feature.

**Independent Test**: Can be tested by observing the microphone button's visual state transitions: idle → listening → idle. Each state should be visually distinct and immediately recognizable.

**Acceptance Scenarios**:

1. **Given** the voice input feature is available (browser supports speech recognition), **When** the page loads, **Then** the microphone button displays in its idle state (static microphone icon).
2. **Given** the microphone button is in idle state, **When** the user clicks it, **Then** the button transitions to the listening state with a visible animation (e.g., pulsing ring, color change to indicate active recording).
3. **Given** the microphone is in listening state, **When** the user clicks the button or speech ends, **Then** the button transitions back to idle state.
4. **Given** the browser does not support the speech recognition capability, **When** the page loads, **Then** the microphone button is hidden entirely (not rendered).

---

### User Story 3 - Error Handling and Recovery (Priority: P2)

A user encounters an issue while using voice input — such as denying microphone permission, network issues (for browsers requiring network for speech recognition), or the speech recognizer failing to understand their words. The system provides clear, actionable feedback and allows the user to retry or fall back to typing.

**Why this priority**: Error scenarios will occur in real usage. Graceful handling prevents user frustration and supports feature trust.

**Independent Test**: Can be tested by denying microphone permission in browser settings and verifying the error message appears. Also tested by speaking unintelligible audio and confirming the system handles it gracefully.

**Acceptance Scenarios**:

1. **Given** the user clicks the microphone button, **When** the browser prompts for microphone permission and the user denies it, **Then** the system displays a brief, non-intrusive error message explaining that microphone access is required and how to enable it.
2. **Given** speech recognition encounters a network or service error, **When** the error occurs during dictation, **Then** the system stops listening, preserves any text already transcribed, and displays a brief error message.
3. **Given** the speech recognizer produces no results (silence or unintelligible audio), **When** the listening session ends, **Then** the textarea remains unchanged and the system returns to idle state without showing an error.

---

### Edge Cases

- What happens when the user starts dictating and then navigates away from the page? Speech recognition stops and resources are cleaned up.
- What happens if the user clicks the microphone button rapidly multiple times? The system debounces and does not enter an inconsistent state.
- What happens when the user is dictating and simultaneously types in the textarea? The typed text and dictated text coexist without conflict; dictation appends at the end of existing content.
- What happens on mobile browsers where speech recognition support varies? The feature degrades gracefully — the button is hidden if unsupported.
- What happens if the user speaks in a language other than English? The system uses the browser's default language setting; non-English speech may produce unexpected transcription but does not cause errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a microphone button adjacent to the strategy prompt textarea, positioned inline at the right side of the textarea (following industry-standard placement patterns used by search engines, messaging apps, and dictation tools).
- **FR-002**: System MUST use the browser's built-in speech recognition capability to convert spoken words to text.
- **FR-003**: System MUST display real-time interim transcription results in the textarea as the user speaks, replacing interim text with final results once a phrase is confirmed by the speech recognizer.
- **FR-004**: System MUST support the following distinct visual states for the microphone button: **idle** (ready to accept input) and **listening** (actively capturing and transcribing speech). On unsupported browsers, the button is not rendered (see FR-008).
- **FR-005**: System MUST append dictated text to any existing content in the textarea rather than replacing it.
- **FR-006**: System MUST stop listening and finalize transcription when the user clicks the microphone button a second time (manual stop).
- **FR-007**: System MUST tolerate short pauses during dictation and only stop listening automatically after an extended silence (~5 seconds), allowing users to pause mid-thought without losing the active listening session.
- **FR-008**: System MUST detect browser support for speech recognition on component mount and hide the microphone button entirely if unsupported (progressive enhancement — no disabled/greyed-out state).
- **FR-009**: System MUST handle microphone permission denial gracefully by displaying a brief, dismissible notification explaining the issue.
- **FR-010**: System MUST clean up speech recognition resources when the component unmounts or the user navigates away.
- **FR-011**: System MUST NOT interfere with the existing keyboard submission (Cmd/Ctrl+Enter) or the "Parse Strategy" button functionality.
- **FR-012**: System MUST preserve all transcribed text in the textarea if an error occurs mid-dictation.

### Key Entities

- **Speech Session**: A single recording period from when the user starts listening to when listening stops (manually or automatically). Contains interim results and a final transcript.
- **Microphone State**: The current status of the voice input feature — one of: `idle`, `listening`, or `error`. On unsupported browsers, the feature is not rendered (no state needed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can dictate a strategy of at least 20 words and see the transcribed text appear in the textarea within 2 seconds of finishing speaking.
- **SC-002**: The microphone button state transitions (idle → listening → idle) are visually distinguishable and occur within 300ms of user action.
- **SC-003**: Users who encounter an unsupported browser see no broken UI elements — the microphone button is cleanly hidden.
- **SC-004**: Users can seamlessly combine typing and voice input within the same session without loss of previously entered text.
- **SC-005**: 100% of speech recognition errors (permission denied, network failure, no speech detected) result in a user-visible notification rather than a silent failure.

## Clarifications

### Session 2026-02-23

- Q: How should the system handle pauses during dictation — auto-stop on any silence, or tolerate short pauses? → A: Auto-stop on extended silence (~5 seconds) but tolerate short pauses, allowing users to think mid-sentence without losing the listening session.
- Q: Should the microphone button be hidden or shown disabled on unsupported browsers? → A: Hidden entirely (progressive enhancement). No disabled/greyed-out state.

## Assumptions

- The browser's built-in speech recognition capability is the appropriate approach. No third-party speech services are needed.
- English is the primary language for strategy dictation. The system uses the browser's default language locale.
- Interim (partial) transcription results are supported by the browser's speech recognition implementation and can be shown in real time.
- The microphone button follows the established visual language of the existing UI (dark theme, indigo accent colors, slate backgrounds).
- Mobile browser support for speech recognition is inconsistent; the feature gracefully degrades on unsupported platforms.
