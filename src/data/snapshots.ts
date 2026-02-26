import type { DemoSnapshot } from '@/types/results';

export const DEMO_SNAPSHOTS: DemoSnapshot[] = [
  {
    id: 'demo-rsi-btc',
    presetId: 'preset-rsi-mean-reversion',
    displayName: 'RSI Mean Reversion on BTC (2021-2024)',
    config: {
      asset: 'BTC',
      startDate: '2021-01-01',
      endDate: '2024-12-31',
      initialCapital: 10_000,
      feeBps: 10,
      slippageBps: 5,
    },
  },
  {
    id: 'demo-dca-btc',
    presetId: 'preset-weekly-dca',
    displayName: 'Weekly DCA on BTC (2021-2024)',
    config: {
      asset: 'BTC',
      startDate: '2021-01-01',
      endDate: '2024-12-31',
      initialCapital: 10_000,
      feeBps: 10,
      slippageBps: 5,
    },
  },
  {
    id: 'demo-rsi-eth',
    presetId: 'preset-rsi-mean-reversion',
    displayName: 'RSI Mean Reversion on ETH (2021-2024)',
    config: {
      asset: 'ETH',
      startDate: '2021-01-01',
      endDate: '2024-12-31',
      initialCapital: 10_000,
      feeBps: 10,
      slippageBps: 5,
    },
  },
  {
    id: 'demo-golden-cross-btc',
    presetId: 'preset-golden-cross',
    displayName: 'Golden Cross on BTC (2020-2024)',
    config: {
      asset: 'BTC',
      startDate: '2020-01-01',
      endDate: '2024-12-31',
      initialCapital: 10_000,
      feeBps: 10,
      slippageBps: 5,
    },
  },
];
