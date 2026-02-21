import Anthropic from '@anthropic-ai/sdk';
import { StrategyRuleSetSchema, validateRuleSetInvariants, type StrategyRuleSet } from '@/types/strategy';

const SUGGESTIONS = [
  "Buy BTC when RSI drops below 30, sell when it goes above 70",
  "Buy when 50-day moving average crosses above 200-day moving average",
  "DCA $100 into BTC every week",
  "Buy when price drops 10% in a week, sell at 20% profit or 5% loss",
];

const SYSTEM_PROMPT = `You are a strict compiler that converts user trading strategy descriptions
into RuleSet JSON. You respond with ONLY valid JSON. No markdown. No code
fences. No explanation. No preamble. No trailing text.

Your output must conform EXACTLY to this schema:

{
  "id": "string (generate a unique short ID like 'vt_abc123')",
  "name": "string (short descriptive name)",
  "description": "string (1-2 sentence plain English summary)",
  "mode": { "type": "standard" } OR { "type": "dca", "intervalDays": N, "amountUsd": N },
  "entry": {
    "op": "AND" or "OR",
    "conditions": [ ...Condition objects... ]
  },
  "exit": {
    "op": "AND" or "OR" (usually OR for exits),
    "conditions": [ ...Condition objects... ]
  },
  "sizing": { "type": "percent_equity", "valuePct": N } or { "type": "fixed_amount", "valueUsd": N },
  "metadata": {
    "originalPrompt": "the user's original input text",
    "parserConfidence": "low" | "medium" | "high",
    "confidenceScore": 0.0-1.0,
    "warnings": ["string array of ambiguities or assumptions"]
  }
}

CRITICAL RULES FOR MODE:
- If the user describes a DCA/dollar-cost-averaging strategy:
  Set mode to { "type": "dca", "intervalDays": N, "amountUsd": N }.
  Set entry.conditions to [] (empty array).
  Set exit.conditions to [] (empty array).
  Set sizing to { "type": "fixed_amount", "valueUsd": same as mode.amountUsd }.
- For ALL other strategies:
  Set mode to { "type": "standard" }.
  entry.conditions MUST have at least 1 condition.
  exit.conditions may be empty (but add a warning if so).

CONDITION SCHEMA:
{
  "id": "string (unique like 'entry_1', 'exit_2')",
  "label": "string (human-readable like 'RSI(14) < 30')",
  "scope": "candle" (default) or "position",
  "left": { "kind": "indicator", "indicator": { "type": "...", ...params } } or { "kind": "number", "value": N },
  "op": "lt" | "lte" | "gt" | "gte" | "eq" | "crosses_above" | "crosses_below",
  "right": { "kind": "indicator", "indicator": { "type": "...", ...params } } or { "kind": "number", "value": N }
}

AVAILABLE INDICATOR TYPES:
- price_close, price_open, price_high, price_low (raw OHLC)
- sma (params: period) — Simple Moving Average
- ema (params: period) — Exponential Moving Average
- rsi (params: period, default 14) — Relative Strength Index
- macd_line (params: fastPeriod=12, slowPeriod=26, signalPeriod=9)
- macd_signal (same params as macd_line)
- macd_hist (same params as macd_line)
- bb_upper, bb_middle, bb_lower (params: period=20, stdDev=2) — Bollinger Bands
- atr (params: period) — Average True Range
- pct_change (params: period) — % change over N candles
- volume
- pnl_pct (scope: "position") — current trade P&L as percentage
- bars_in_trade (scope: "position") — candles since entry

TAKE-PROFIT / STOP-LOSS: Express as position-scope conditions:
  - Take profit 15%: { "scope": "position", "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } }, "op": "gte", "right": { "kind": "number", "value": 15 } }
  - Stop loss 5%: { "scope": "position", "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } }, "op": "lte", "right": { "kind": "number", "value": -5 } }

DEFAULTS (when user doesn't specify):
- RSI period: 14
- "moving average" without type: SMA
- MACD: fast=12, slow=26, signal=9
- Bollinger: period=20, stdDev=2
- Position sizing: { "type": "percent_equity", "valuePct": 100 }
- Entry logic: AND. Exit logic: OR.
- "buy the dip" with no %: pct_change(7) < -5, add warning.
- No exit conditions specified (non-DCA): add warning "No exit conditions. Positions held until end."

CONFIDENCE GUIDE:
- "high" (0.85-1.0): Unambiguous, maps directly to known indicators
- "medium" (0.5-0.85): Minor assumptions (default periods, inferred types)
- "low" (0.0-0.5): Significant ambiguity or not a trading strategy

UNSUPPORTED FEATURES — if the user mentions any of these:
- Shorting / short-selling → ignore, add warning: "Short selling is not supported. Strategy uses long-only positions."
- Intraday / hourly / minute timeframes → ignore, add warning: "Only daily timeframe is supported."
- Trailing stop → approximate as a fixed stop-loss with a warning
- Multiple simultaneous positions → ignore, add warning: "Only one position at a time is supported."
- Specific order types (limit, market, stop-limit) → ignore, all orders execute at next open.
- Portfolio / multiple assets at once → ignore, add warning: "Single-asset backtesting only."
In ALL cases: output the BEST-EFFORT strategy within MVP constraints, and list every dropped/approximated feature in metadata.warnings. Never refuse to output a RuleSet — always try.

If the input is NOT a trading strategy: return confidenceScore: 0, parserConfidence: "low",
empty conditions arrays, mode: { "type": "standard" }, and a warning explaining the issue.`;

// Few-shot examples embedded in the system prompt
const FEW_SHOT_EXAMPLES = `
EXAMPLES:

USER: "Buy when RSI is below 30, sell when RSI goes above 70"
OUTPUT:
{"id":"vt_rsi_mr","name":"RSI Mean Reversion","description":"Buy when RSI indicates oversold, sell when overbought","mode":{"type":"standard"},"entry":{"op":"AND","conditions":[{"id":"entry_1","label":"RSI(14) < 30","scope":"candle","left":{"kind":"indicator","indicator":{"type":"rsi","period":14}},"op":"lt","right":{"kind":"number","value":30}}]},"exit":{"op":"OR","conditions":[{"id":"exit_1","label":"RSI(14) > 70","scope":"candle","left":{"kind":"indicator","indicator":{"type":"rsi","period":14}},"op":"gt","right":{"kind":"number","value":70}}]},"sizing":{"type":"percent_equity","valuePct":100},"metadata":{"originalPrompt":"Buy when RSI is below 30, sell when RSI goes above 70","parserConfidence":"high","confidenceScore":0.95,"warnings":[]}}

USER: "DCA $100 into BTC every week"
OUTPUT:
{"id":"vt_dca_weekly","name":"Weekly DCA","description":"Invest $100 every 7 days regardless of price","mode":{"type":"dca","intervalDays":7,"amountUsd":100},"entry":{"op":"AND","conditions":[]},"exit":{"op":"OR","conditions":[]},"sizing":{"type":"fixed_amount","valueUsd":100},"metadata":{"originalPrompt":"DCA $100 into BTC every week","parserConfidence":"high","confidenceScore":0.85,"warnings":["DCA mode: buys every 7 days, holds until end of backtest period"]}}

USER: "Buy when MACD crosses above signal line and RSI is below 50. Sell at 15% profit or 8% loss."
OUTPUT:
{"id":"vt_macd_rsi","name":"MACD + RSI Confirmation with TP/SL","description":"Enter on MACD bullish crossover confirmed by RSI below 50, exit at TP or SL","mode":{"type":"standard"},"entry":{"op":"AND","conditions":[{"id":"entry_1","label":"MACD crosses above signal","scope":"candle","left":{"kind":"indicator","indicator":{"type":"macd_line","fastPeriod":12,"slowPeriod":26,"signalPeriod":9}},"op":"crosses_above","right":{"kind":"indicator","indicator":{"type":"macd_signal","fastPeriod":12,"slowPeriod":26,"signalPeriod":9}}},{"id":"entry_2","label":"RSI(14) < 50","scope":"candle","left":{"kind":"indicator","indicator":{"type":"rsi","period":14}},"op":"lt","right":{"kind":"number","value":50}}]},"exit":{"op":"OR","conditions":[{"id":"exit_1","label":"Take profit at 15%","scope":"position","left":{"kind":"indicator","indicator":{"type":"pnl_pct"}},"op":"gte","right":{"kind":"number","value":15}},{"id":"exit_2","label":"Stop loss at 8%","scope":"position","left":{"kind":"indicator","indicator":{"type":"pnl_pct"}},"op":"lte","right":{"kind":"number","value":-8}}]},"sizing":{"type":"percent_equity","valuePct":100},"metadata":{"originalPrompt":"Buy when MACD crosses above signal line and RSI is below 50. Sell at 15% profit or 8% loss.","parserConfidence":"high","confidenceScore":0.92,"warnings":[]}}`;

export interface ParseResult {
  success: true;
  ruleSet: StrategyRuleSet;
}

export interface ParseError {
  success: false;
  error: string;
  suggestions: string[];
}

export type ParseResponse = ParseResult | ParseError;

/** Strip markdown code fences from a string */
function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

/** Parse a trading strategy prompt into a validated RuleSet */
export async function parseStrategy(prompt: string): Promise<ParseResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'AI parser is not configured. Please set ANTHROPIC_API_KEY.',
      suggestions: SUGGESTIONS,
    };
  }

  const client = new Anthropic({ apiKey });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const userMessage = attempt === 0
        ? prompt
        : `Your previous response was not valid JSON. Please try again. Convert this trading strategy to the RuleSet JSON format: ${prompt}`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT + '\n\n' + FEW_SHOT_EXAMPLES,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const cleaned = stripFences(text);

      // Step 1: JSON.parse
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        if (attempt === 0) continue; // retry
        return {
          success: false,
          error: 'AI returned invalid JSON. Please try rephrasing your strategy.',
          suggestions: SUGGESTIONS,
        };
      }

      // Step 2: Zod validation
      const zodResult = StrategyRuleSetSchema.safeParse(parsed);
      if (!zodResult.success) {
        if (attempt === 0) continue; // retry
        return {
          success: false,
          error: `Strategy structure is invalid: ${zodResult.error.issues.map(i => i.message).join(', ')}`,
          suggestions: SUGGESTIONS,
        };
      }

      const ruleSet = zodResult.data;

      // Step 3: Invariant validation
      const invariants = validateRuleSetInvariants(ruleSet);
      if (!invariants.valid) {
        return {
          success: false,
          error: `Strategy validation failed: ${invariants.errors.join('; ')}`,
          suggestions: SUGGESTIONS,
        };
      }

      // Step 4: Confidence check
      const confidence = ruleSet.metadata?.confidenceScore ?? 0;
      if (confidence < 0.3) {
        return {
          success: false,
          error: "Couldn't parse this as a trading strategy. Try one of these examples:",
          suggestions: SUGGESTIONS,
        };
      }

      // Add invariant warnings to metadata
      if (invariants.warnings.length > 0 && ruleSet.metadata) {
        ruleSet.metadata.warnings = [...ruleSet.metadata.warnings, ...invariants.warnings];
      }

      return { success: true, ruleSet };

    } catch (err) {
      if (attempt === 0) continue; // retry on API error
      return {
        success: false,
        error: 'AI parser is temporarily unavailable. Try a preset strategy.',
        suggestions: SUGGESTIONS,
      };
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: 'Failed to parse strategy after retries.',
    suggestions: SUGGESTIONS,
  };
}
