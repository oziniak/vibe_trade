<!--
  Sync Impact Report
  ───────────────────
  Version change: 1.0.0 → 1.1.0
  Modified principles:
    - VII. Scope Discipline — no rename, minor wording alignment
      (removed day-5 feature-freeze bullet, now covered by VIII)
  Added sections:
    - VIII. Phased Implementation (new principle)
  Removed sections: None
  Modified sections:
    - Timeline & Development Workflow — expanded with phase
      definitions, done-criteria, and post-freeze rules
  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ no updates needed
      (Constitution Check is dynamic; phases are plan-time concern)
    - .specify/templates/spec-template.md — ✅ no updates needed
      (spec template is domain-agnostic)
    - .specify/templates/tasks-template.md — ✅ no updates needed
      (task phases will be driven by Principle VIII at task-gen time;
       template structure is compatible)
  Follow-up TODOs: None
-->

# VibeTrade Constitution

## Core Principles

### I. AI-Math Boundary (NON-NEGOTIABLE)

The app has exactly ONE network call: an AI parser that translates
natural language into a validated JSON schema. Everything after that
is deterministic, client-side math.

- AI is the translator, not the engine. AI MUST NOT execute trades,
  make predictions, or produce market opinions.
- AI outputs a constrained JSON structure; a deterministic engine
  consumes it. The boundary between "AI step" and "math step" MUST
  be explicit in code architecture.
- No AI logic may leak into the engine, indicators, or metrics
  modules. No engine logic may depend on AI availability.
- If the AI parser is unavailable, the app MUST still function
  end-to-end via Demo Mode presets and known-good snapshots.

### II. TypeScript Strict & Zod Validation

All code MUST use TypeScript strict mode. No `any` types. No
`@ts-ignore`.

- Zod schemas are required for all external boundaries: AI parser
  output, URL params, and configuration objects.
- Use discriminated unions where applicable for type-safe branching.
- JSDoc comments MUST be present on every exported function and type.

### III. Pure Functions & Layered Dependencies

All computation (indicators, engine, metrics) MUST be implemented
as pure functions with zero side effects. Functions take data in,
return data out — no mutations, no global state.

- Module dependency flow MUST follow:
  `types → indicators → engine → metrics → UI`.
- No circular dependencies. UI may import from any layer; lower
  layers MUST NOT import from higher layers.
- Prefer explicit over clever. No magic. A junior developer MUST
  be able to follow the backtest engine loop by reading it top to
  bottom.

### IV. Math-First Testing

Unit tests (Vitest) are required for all pure-function modules:
indicators, engine loop, metrics calculator, Zod validators, and
invariant checks.

- Tests prove correctness of math, not UI rendering. No snapshot
  tests. No E2E tests.
- Every indicator MUST have at least one test with hand-calculated
  expected values.
- The engine MUST have a test proving determinism: same inputs
  produce identical outputs.
- Do NOT follow strict TDD. Write implementation and tests together
  or implementation-first — whichever is faster. The goal is
  coverage of critical math, not process purity.

### V. Demo Resilience

The app MUST work end-to-end without any network connection via
Demo Mode presets and known-good data snapshots.

- If the AI parser is down, users MUST still be able to run presets
  and see full results (charts, metrics, trade log).
- Client-side computation means "swap asset and re-run" MUST be
  instant — no loading spinners for backtest computation.
- Loading states, error messages, and empty states MUST all be
  handled. No blank screens, no unhandled promise rejections, no
  console errors during the demo.

### VI. Professional UX & Charting

All charts MUST look professional and communicate data clearly.

- Use TradingView lightweight-charts for candlestick display.
- Use Recharts for equity curves and analytics charts.
- Dark mode is the default and primary design target. Light mode
  is optional.
- Every UI state MUST be accounted for: loading, error, empty,
  and populated.

### VII. Scope Discipline

Every feature MUST justify its existence by contributing to either
the 3-minute demo script or a specific judging criterion
(Functionality, Usefulness, Code Quality, Creativity). If it does
neither, it does not get built.

- Prefer shipping ugly-but-working over beautiful-but-broken.
  Functionality > polish.
- No premature abstraction. No "framework within a framework."
  Use Next.js, shadcn, and Tailwind directly. Do not create wrapper
  libraries or custom design systems.

### VIII. Phased Implementation

Development proceeds in 3 phases. Each phase has explicit
done-criteria that MUST be verified before the next phase begins.

- **Phase 1 — ENGINE (Days 1-2)**: Zod schemas and types, all
  indicators with tests, condition evaluator, standard-mode and
  DCA-mode engine, benchmark computation, metrics calculator,
  AI parser API route, demo mode presets. ALL pure-function modules.
  No UI.
  **Done when**: all unit tests pass AND a backtest can be run
  programmatically with a preset RuleSet and produces correct
  metrics.
- **Phase 2 — UI v1 (Day 3)**: Data loader, input panel wired to
  API, rule confirmation UI, candlestick chart with trade markers,
  results dashboard with metrics and trade log, preset gallery.
  **Done when**: the full loop works end-to-end in the browser —
  type prompt → see rules → confirm → see charts and metrics.
  This is the **DAY 3 CHECKPOINT**. If Phase 2 is not complete by
  end of day 3, stop all other work and fix it.
- **Phase 3 — POLISH + FEATURES (Days 4-5)**: Equity curve chart,
  indicator overlays, dark mode polish, audit panel, loading states,
  comparison mode, swap asset, run history, edge cases and error UX,
  snapshot verification.
  **Done when**: the demo script from the spec can be executed
  without failure.
- **After Phase 3**: NO new features. Days 6-7 are exclusively:
  mobile responsiveness, export/share, Vercel deploy, README, code
  cleanup, stress testing, and demo video recording.

## Technology Stack & Constraints

- **Framework**: Next.js with TypeScript strict mode
- **UI**: shadcn/ui components + Tailwind CSS
- **Charts**: TradingView lightweight-charts (candlesticks),
  Recharts (equity curves, analytics)
- **Validation**: Zod for all external boundary schemas
- **Testing**: Vitest for unit tests on pure-function modules
- **AI**: Single network call for NL→JSON parsing; constrained
  output validated by Zod before consumption
- **Deployment**: Must support static/serverless hosting; no
  server-side computation required for backtesting
- **Performance**: All backtest computation is client-side and
  MUST complete without user-perceptible delay after initial
  data load

## Timeline & Development Workflow

This project follows a strict 7-day competition timeline
(Feb 20–27, 2026). Judging criteria: Functionality, Usefulness,
Code Quality, Creativity.

- **Days 1-2**: Phase 1 (Engine). Pure-function modules only.
- **Day 3 (CRITICAL CHECKPOINT)**: Phase 2 (UI v1). The engine
  MUST work end-to-end through the UI by end of day 3. If this
  fails, everything after is at risk — stop all other work and
  fix it.
- **Days 4-5**: Phase 3 (Polish + Features). Feature freeze at
  end of day 5. No new features after this point.
- **Days 6-7**: Mobile responsiveness, export/share, Vercel deploy,
  README, code cleanup, stress testing, and demo video recording
  only.
- Deliverables: working web app, GitHub repo, 2-3 minute demo
  video.
- Solo developer — no code review process; constitution compliance
  is self-enforced during development.

## Governance

This constitution is the highest-authority document for VibeTrade.
All implementation decisions, feature prioritization, and code
structure MUST comply with these principles.

- **Amendment procedure**: Update this file, increment version,
  and document the change in the Sync Impact Report comment block
  at the top of this file.
- **Versioning**: MAJOR for principle removals or redefinitions,
  MINOR for new principles or materially expanded guidance,
  PATCH for clarifications and wording fixes.
- **Compliance**: Every spec, plan, and task list generated by
  speckit commands MUST be checked against these principles.
  The Constitution Check section in plan.md MUST reference all
  8 principles by number.
- **Guidance file**: Use `CLAUDE.md` at the project root for
  runtime development guidance that supplements this constitution.

**Version**: 1.1.0 | **Ratified**: 2026-02-21 | **Last Amended**: 2026-02-21
