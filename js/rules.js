/* Capital Clash: game rules that are not about the turn flow itself.
   - modes (Short / Standard / Long / Beginner): how far a dice roll moves, how gentle the tiles are
   - balanced tile numbers (+ and - never add up to more than +499 / -500 over the whole board)
   - reshuffling the tiles ahead of everyone, ranking by portfolio, Bull/Bear/Neutral market phases, end of game */

// The game length decides which die is used: the roll IS the number of spaces moved, so the 100 spaces get used.
// Long: normal die 1-6 (about 29 turns each), Standard: die 1-9 (about 20), Short: die 1-18 (about 10).
const MODES = {
    short:    { label: 'Short',    sides: 18, gentle: false, tag: 'Die 1-18', hint: 'Short: die with numbers 1-18, about 10 turns each' },
    standard: { label: 'Standard', sides: 9,  gentle: false, tag: 'Die 1-9',  hint: 'Standard: die with numbers 1-9, about 20 turns each' },
    long:     { label: 'Long',     sides: 6,  gentle: false, tag: 'Die 1-6',  hint: 'Long: normal die 1-6, about 29 turns each. The full game.' },
    beginner: { label: 'Beginner', sides: 18, gentle: true,  tag: 'Die 1-18', hint: 'Beginner: short game (die 1-18), gentle tiles (max +/-3, no Skip), guide on' }
};
const MODE_NOTE = 'In Short, Standard and Beginner the dice numbers change (bigger dice) so players can reach the end of the board.';
const modeCfg = () => MODES[APP_STATE.settings.mode] || MODES.long;
const diceSides = () => modeCfg().sides;
// Hop speed: a long move (up to 18 spaces) must not take forever.
const stepMsFor = steps => Math.max(110, Math.min(STEP_MS, 2400 / Math.max(1, steps)));

const PHASES = {
    neutral: { label: 'Neutral', emoji: '⚖️', text: 'The market is moving through NEUTRAL', rule: 'No bonus' },
    bull:    { label: 'Bull',    emoji: '\u{1F402}',   text: 'The market is moving toward BULL',     rule: 'Every + tile counts 1 extra' },
    bear:    { label: 'Bear',    emoji: '\u{1F43B}',   text: 'The market is moving toward BEAR',     rule: 'Every − tile counts 1 extra' }
};
const phaseBonus = delta => { const p = APP_STATE.marketPhase; return p === 'bull' && delta > 0 ? 1 : p === 'bear' && delta < 0 ? -1 : 0; };

/* ---------- Balanced tiles ---------- */

const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
function shuffled(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// "Crypto Rally (+5)" -> { name, sign: 1, mag: 5 };  "Supply Halt (Skip)" -> sign 0;  "Asset Swap" -> sign null (no number yet)
function parseEvent(text) {
    const m = /^(.*?)\s*\(([+-]\d+|Skip)\)\s*$/i.exec(String(text).trim());
    if (!m) return { name: String(text).trim(), sign: null, mag: 0 };
    if (/skip/i.test(m[2])) return { name: m[1], sign: 0, mag: 0 };
    const v = parseInt(m[2], 10);
    return { name: m[1], sign: v < 0 ? -1 : 1, mag: Math.abs(v) };
}
const fmtTile = (name, d) => name + ' (' + (d === 0 ? 'Skip' : d > 0 ? '+' + d : String(d)) + ')';

// Fill all 100 tiles: every event gets a + or - number (except Skip), and all + tiles together add up to at most +499
// and all - tiles to at least -500, so the Market Tracker can stay between 1 and 999 over a whole lap.
function buildBalancedTiles() {
    const gentle = modeCfg().gentle;
    let flip = Math.random() < 0.5 ? 1 : -1;
    const base = APP_STATE.eventPool.map(parseEvent).map(e => {
        if (e.sign === null) { e.sign = flip; flip = -flip; e.mag = rnd(1, 3); }
        if (gentle) { if (e.sign === 0) { e.sign = flip; flip = -flip; e.mag = 1; } e.mag = Math.min(e.mag, 3); }
        return e;
    });
    let order = [];
    while (order.length < 100) order = order.concat(shuffled(base.map((_, i) => i)));
    const picks = order.slice(0, 100).map(i => ({ ...base[i] }));
    [1, -1].forEach(sg => {
        const same = picks.filter(p => p.sign === sg), limit = sg > 0 ? 499 : 500;
        let sum = same.reduce((a, p) => a + p.mag, 0);
        while (sum > limit) { const big = same.reduce((a, p) => (p.mag > a.mag ? p : a), same[0]); big.mag--; sum--; if (big.mag < 1) big.mag = 1; }
    });
    APP_STATE.tiles = picks.map((p, i) => ({ number: i + 1, text: fmtTile(p.name, p.sign * p.mag) }));
}

// After every turn the tiles nobody has reached yet are shuffled, so the road ahead is never predictable.
function reshuffleAhead() {
    const maxPos = Math.max(1, ...APP_STATE.players.map(p => p.position));
    const idx = []; for (let i = maxPos; i < 100; i++) idx.push(i);
    const texts = shuffled(idx.map(i => APP_STATE.tiles[i].text));
    idx.forEach((i, k) => { APP_STATE.tiles[i].text = texts[k]; });
}

/* ---------- Ranking ---------- */

const playerTotal = p => p.money + p.shares * marketValue();
const rankedIds = () => APP_STATE.players.map((p, i) => ({ id: p.id, t: playerTotal(p), i })).sort((a, b) => b.t - a.t || a.i - b.i).map(x => x.id);
// Display order: richest first (set when a turn ends). Falls back to seating order.
function rankOrder() {
    const ids = APP_STATE.rank || [], ps = APP_STATE.players;
    if (ids.length !== ps.length || !ps.every(p => ids.includes(p.id))) return ps.map((_, i) => i);
    return ids.map(id => ps.findIndex(p => p.id === id));
}

/* ---------- Market phases (host decides, everyone sees the popup) ---------- */

function startPhase() { APP_STATE.marketPhase = 'neutral'; APP_STATE.phaseLeft = APP_STATE.players.length * rnd(1, 2); APP_STATE.phaseSeq = 0; }
function advancePhase() {
    APP_STATE.phaseLeft--;
    if (APP_STATE.phaseLeft > 0) return;
    const others = ['bull', 'bear', 'neutral'].filter(p => p !== APP_STATE.marketPhase);
    APP_STATE.marketPhase = others[rnd(0, 1)];
    APP_STATE.phaseLeft = APP_STATE.players.length * rnd(2, 4);
    APP_STATE.phaseSeq = nextEvt();
}

/* ---------- End of game ---------- */

function makeResults() {
    const mv = marketValue();
    return { seq: nextEvt(), ranking: rankedIds().map(id => { const p = APP_STATE.players.find(x => x.id === id); return { id, name: p.name, avatar: p.avatar, money: p.money, shares: p.shares, total: p.money + p.shares * mv }; }) };
}
