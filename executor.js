// executor.js
import { state, addPosition, save } from './state.js';
import { subscribePosition } from './websocket.js';

export function execute(markets, config) {
  const { PER_MARKET_PERCENT } = config;
  const W = state.wallet.balance;
  const N = markets.length;
  
  if (N === 0 || W <= 0) return;

  // Calculate total P&L
  const realizedPnL = state.closedPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalCapital = 50 + realizedPnL; // Starting capital + P&L
  
  // Base allocation: 4% of total capital
  const baseAlloc = totalCapital * PER_MARKET_PERCENT;
  
  // Limit by available wallet
  const allocPerMarket = Math.min(W / N, baseAlloc);

  for (const m of markets) {
    if (state.eventLocks.has(m.eventId)) {
      console.log(`⏭️  Skipping ${m.slug} - event ${m.eventId} already locked`);
      continue;
    }

    // Apply crypto market discount: 20% of normal allocation
    const marketAlloc = m.isCrypto ? allocPerMarket * 0.20 : allocPerMarket;

    const price = m.bestAsk;
    const maxSize = Math.min(marketAlloc / price, m.askSize);
    if (maxSize <= 0) continue;

    const cost = maxSize * price;
    if (cost > state.wallet.balance) continue;

    state.wallet.balance -= cost;
    
    addPosition({
      eventId: m.eventId,
      marketId: m.marketId,
      slug: m.slug,
      side: m.side,
      tokenId: m.tokenId,
      entryPrice: price,
      entryProb: m.probability,
      size: maxSize,
      cost,
      boughtAt: new Date().toISOString()
    });

    subscribePosition(m.tokenId);

    const marketType = m.isCrypto ? '💰' : '📊';
    console.log(`✅ BUY ${marketType} ${m.slug} ${m.side} @ ${price} | Size: ${maxSize.toFixed(2)} | Cost: $${cost.toFixed(2)}`);
  }

  save();
}