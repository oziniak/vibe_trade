import type { AssetSymbol, StrategyRuleSet } from '@/types/strategy';
import type {
  AppState,
  AppPhase,
  BacktestResult,
  RunSnapshot,
} from '@/types/results';

export const ASSETS: AssetSymbol[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX'];

export type AppAction =
  | { type: 'SET_PHASE'; phase: AppPhase }
  | { type: 'SET_CONFIG'; config: AppState['config'] }
  | { type: 'SET_RULES'; rules: StrategyRuleSet }
  | { type: 'SET_RESULTS'; results: BacktestResult }
  | { type: 'SET_COMPARISON'; results: BacktestResult }
  | { type: 'CLEAR_COMPARISON' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_PROMPT'; prompt: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'ADD_HISTORY'; snapshot: RunSnapshot }
  | { type: 'RESTORE_RESULT'; result: BacktestResult };

export const initialConfig: AppState['config'] = {
  asset: 'BTC',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 10000,
  feeBps: 10,
  slippageBps: 5,
};

export const initialState: AppState = {
  phase: 'input',
  config: initialConfig,
  currentPrompt: '',
  currentRules: null,
  results: [null, null],
  runHistory: [],
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase, error: null };
    case 'SET_CONFIG':
      return { ...state, config: action.config };
    case 'SET_RULES':
      return { ...state, currentRules: action.rules };
    case 'SET_RESULTS':
      return { ...state, results: [action.results, null] };
    case 'SET_COMPARISON':
      return { ...state, results: [state.results[0], action.results], phase: 'comparing' };
    case 'CLEAR_COMPARISON':
      return { ...state, results: [state.results[0], null], phase: 'results' };
    case 'SET_ERROR':
      return { ...state, error: action.error, phase: state.phase === 'parsing' ? 'input' : state.phase };
    case 'SET_PROMPT':
      return { ...state, currentPrompt: action.prompt };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'ADD_HISTORY':
      return { ...state, runHistory: [action.snapshot, ...state.runHistory] };
    case 'RESTORE_RESULT':
      return {
        ...state,
        results: [action.result, null],
        currentRules: action.result.config.rules,
        config: {
          asset: action.result.config.asset,
          startDate: action.result.config.startDate,
          endDate: action.result.config.endDate,
          initialCapital: action.result.config.initialCapital,
          feeBps: action.result.config.feeBps,
          slippageBps: action.result.config.slippageBps,
        },
        phase: 'results',
        error: null,
      };
    default:
      return state;
  }
}
