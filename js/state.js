/* Capital Clash: shared game state. */

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

const APP_STATE = {
    boardMode: 'single', // 'single' or 'double'
    marketTracker: [0, 0, 0], // [Units, Tens, Hundreds]
    ringRotations: [0, 0, 0], // [Units, Tens, Hundreds]
    draggedRingIndex: null,
    dragStartAngle: 0,
    tiles: [],
    eventPool: [
        "Dividend Payout (+3)", "Bear Market (-2)", "Stock Split (+1)", "Tax Audit (-1)",
        "Bull Run (+2)", "Asset Swap", "Market Crash (-3)", "Interest Earned (+1)",
        "VC Investment (+4)", "Inflation Leak (-1)", "Portfolio Shield", "Crypto Rally (+5)",
        "Supply Halt (Skip)", "Dividend Yield", "Recession Dip (-2)", "IPO Launch",
        "Bubble Eruption (-4)", "Tech Boom (+3)", "Angel Bonus (+2)", "Reserve Vault"
    ],
    players: [],
    activePlayersCount: 4,
    currentPlayerIndex: 0
};

function initTiles() {
    APP_STATE.tiles = [];
    for (let i = 1; i <= 100; i++) {
        const randEvt = APP_STATE.eventPool[(i - 1) % APP_STATE.eventPool.length];
        APP_STATE.tiles.push({
            number: i,
            text: randEvt
        });
    }
}

