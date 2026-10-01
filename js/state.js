/* Capital Clash: shared game state. */

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

// Player avatars. Each player in a room picks a different one.
const AVATARS = [
    { id: 'fox', emoji: '\u{1F98A}', label: 'Fox' }, { id: 'panda', emoji: '\u{1F43C}', label: 'Panda' },
    { id: 'lion', emoji: '\u{1F981}', label: 'Lion' }, { id: 'tiger', emoji: '\u{1F42F}', label: 'Tiger' },
    { id: 'frog', emoji: '\u{1F438}', label: 'Frog' }, { id: 'monkey', emoji: '\u{1F435}', label: 'Monkey' },
    { id: 'unicorn', emoji: '\u{1F984}', label: 'Unicorn' }, { id: 'octopus', emoji: '\u{1F419}', label: 'Octopus' },
    { id: 'owl', emoji: '\u{1F989}', label: 'Owl' }, { id: 'penguin', emoji: '\u{1F427}', label: 'Penguin' },
    { id: 'dragon', emoji: '\u{1F432}', label: 'Dragon' }, { id: 'rocket', emoji: '\u{1F680}', label: 'Rocket' }
];
const isAvatarId = id => AVATARS.some(a => a.id === id);
const avatarEmoji = id => { const a = AVATARS.find(x => x.id === id); return a ? a.emoji : '\u{1F464}'; };

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
    // Starting values chosen on the landing page (host's choice is what the room uses).
    settings: { market: 500, money: 5000, shares: 9, mode: 'long', theme: 'classic' },
    players: [],
    activePlayersCount: 4,
    currentPlayerIndex: 0,
    // Turn flow: 'roll' (waiting for the dice) -> 'accept' (dice shown, waiting for Accept) -> 'moving' (avatar hops) -> 'trade' (bank open, then End turn); 'over' when the game has ended.
    turnPhase: 'roll',
    pending: null,     // dice value waiting to be accepted
    lastRoll: null,    // { n, by, seq }  (seq lets every client play each roll exactly once)
    lastMove: null,    // { by, from, to, seq }
    // Market phase (bull / bear / neutral) changes at random turns; rank = player ids from richest to poorest (updated when a turn ends).
    marketPhase: 'neutral', phaseLeft: 0, phaseSeq: 0, rank: [],
    phaseTotal: 0, phaseSteps: [], phaseFlipAt: -1, phaseFlipTo: '', phaseNote: '',   // forecast plan: one market step per finished turn
    finalBy: '', finalSeq: 0,   // id of the player who reached the finish first: everyone else then gets one last turn
    gameOver: null,             // { seq, ranking: [{ id, name, total, money, shares }] } once the game has ended
    lastEffect: null,  // { kind: 'tile'|'reset'|'phase', by, text, delta, before, after, seq }  Market Tracker change
    lastTrade: null,   // { by, kind: 'buy'|'sell', qty, price, seq }
    evtSeq: 0,
    anim: null         // local only: { id, pos, lift, count } while an avatar is hopping
};

const SETTING_LIMITS = { market: [0, 999, 500], money: [0, 1000000, 5000], shares: [0, 1000, 9] };
const MODE_IDS = ['long', 'standard', 'short', 'beginner'];
// Board themes: the host picks one, everybody sees it. 'meadow' (blocks around a pond) comes later.
const THEME_IDS = ['classic', 'city'];
const THEMES = {
    classic: { label: 'Standard wheel', tag: 'The round board', tip: 'The classic Capital Clash wheel: 100 spaces around the Market value. Bank and market card sit on the right.' },
    city: { label: 'City path', tag: 'Winding town road', tip: 'A winding road through a little town. Players, dice and Market value are on the left; the Bank and the Market are buildings on the board. Click a building to use it.' }
};
function cleanSettings(s) {
    s = s || {};
    const o = {};
    for (const k in SETTING_LIMITS) { const [lo, hi, def] = SETTING_LIMITS[k]; o[k] = clampInt(s[k], lo, hi, def); }
    o.mode = MODE_IDS.includes(s.mode) ? s.mode : 'long';
    o.theme = THEME_IDS.includes(s.theme) ? s.theme : 'classic';
    return o;
}
// Current Market Tracker value (0-999) as a number.
const marketValue = () => APP_STATE.marketTracker[2] * 100 + APP_STATE.marketTracker[1] * 10 + APP_STATE.marketTracker[0];
const newWallet = () => ({ money: APP_STATE.settings.money, shares: APP_STATE.settings.shares });
// Put the Market Tracker dials on a value.
function setTrackerNumber(num) {
    const v = clampInt(num, 0, 999, 0), h = Math.floor(v / 100), t = Math.floor((v % 100) / 10), u = v % 10;
    APP_STATE.marketTracker = [u, t, h]; APP_STATE.ringRotations = [-u * 36, -t * 36, -h * 36];
}

function initTiles() { buildBalancedTiles(); }

