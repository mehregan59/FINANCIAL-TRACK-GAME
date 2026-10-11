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
    eventPool: [...EVENT_SETS.classic],   // 100 different events, see js/event-sets.js
    // Starting values chosen on the landing page (host's choice is what the room uses).
    settings: { market: 500, money: 5000, shares: 9, mode: 'long', currency: 'USD' },
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
    prevMarket: null,  // share price before the latest Market Tracker change (shown as 'Previous')
    evtSeq: 0,
    anim: null         // local only: { id, pos, lift, count } while an avatar is hopping
};

// Currencies the host can choose. Only the symbol changes: the numbers stay the same.
const CURRENCIES = { USD: { sym: '$', label: 'US Dollar' }, EUR: { sym: '\u20AC', label: 'Euro' }, GBP: { sym: '\u00A3', label: 'British Pound' }, JPY: { sym: '\u00A5', label: 'Japanese Yen' } };
const CURRENCY_IDS = Object.keys(CURRENCIES);
const curSym = () => (CURRENCIES[APP_STATE.settings.currency] || CURRENCIES.USD).sym;
// Money with the room's currency symbol, e.g. "$5,000".
const money = n => (n < 0 ? '-' : '') + curSym() + Math.abs(Number(n) || 0).toLocaleString('en-US');

const SETTING_LIMITS = { market: [0, 999, 500], money: [0, 1000000, 5000], shares: [0, 1000, 9] };
const MODE_IDS = ['long', 'standard', 'short', 'beginner'];
function cleanSettings(s) {
    s = s || {};
    const o = {};
    for (const k in SETTING_LIMITS) { const [lo, hi, def] = SETTING_LIMITS[k]; o[k] = clampInt(s[k], lo, hi, def); }
    o.mode = MODE_IDS.includes(s.mode) ? s.mode : 'long';
    o.currency = CURRENCY_IDS.includes(s.currency) ? s.currency : 'USD';
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

