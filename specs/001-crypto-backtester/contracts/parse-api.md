# API Contract: POST /api/parse

**Date**: 2026-02-21
**Feature**: [spec.md](../spec.md)
**Source**: Extracted from [vibe-trade-final-spec-v3.md](../../../vibe-trade-final-spec-v3.md) §7

## Endpoint

```
POST /api/parse
Content-Type: application/json
```

Server-side only (Next.js App Router `route.ts`). API key never exposed to client.

## Request

```typescript
{
  prompt: string;       // user's natural language strategy description
  asset: string;        // selected asset symbol (passed through — AI doesn't pick the asset)
  timeframe: '1D';      // locked for MVP
}
```

## Response — Success

```typescript
{
  success: true;
  ruleSet: StrategyRuleSet;  // Zod-validated + invariant-checked
}
```

## Response — Failure

```typescript
{
  success: false;
  error: string;             // human-readable error message
  suggestions: string[];     // example prompts the user can try
}
```

## Validation Pipeline

```
Claude JSON response
  │
  ▼
Strip markdown fences if present
  │
  ▼
JSON.parse()  ──fail──►  retry once with correction prompt
  │                                │
  ▼                              fail──► return error + suggestions
Zod StrategyRuleSet.safeParse()
  │                                │
  ▼                              fail──► retry once
validateRuleSetInvariants()              │
  │                              fail──► return error + suggestions
  ▼
confidenceScore check
  │
  ├─ < 0.3 ──► return error: "Couldn't parse. Try: [suggestions]"
  ├─ 0.3–0.6 ──► return rules WITH prominent warnings
  └─ > 0.6 ──► return rules normally
```

## AI Model Configuration

- **Model**: `claude-sonnet-4-20250514`
- **Max tokens**: 2048
- **System prompt**: Full schema definition + 5 few-shot examples (see source spec §7.2-7.3)
- **Temperature**: Default (not specified — structured output task)

## Error Handling

| Scenario | Response |
|----------|----------|
| AI returns invalid JSON | Retry once with correction prompt; if still fails, return error + suggestions |
| Zod parse fails | Retry once; if still fails, return error listing schema violations |
| Invariant validation fails | Return error with specific invariant violations (e.g., "DCA mode must have empty entry conditions") |
| Confidence < 0.3 | Return error: "Couldn't parse" + example suggestions |
| AI API timeout/error | Return error: "AI parser is temporarily unavailable. Try a preset strategy." |
| Non-trading-strategy input | Return ruleSet with confidence 0, empty conditions, and warning explaining the issue |

## Example Suggestions (on failure)

```typescript
const SUGGESTIONS = [
  "Buy BTC when RSI drops below 30, sell when it goes above 70",
  "Buy when 50-day moving average crosses above 200-day moving average",
  "DCA $100 into BTC every week",
  "Buy when price drops 10% in a week, sell at 20% profit or 5% loss",
];
```

## Rate Limiting

No server-side rate limiting for MVP. The single AI call per parse is naturally rate-limited by user interaction speed.

## Security

- `ANTHROPIC_API_KEY` stored in `.env.local` (local) or Vercel Environment Variables (production).
- Server-side only — the API key is never sent to the browser.
- No user authentication required for MVP.
