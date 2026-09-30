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
    neutral: { label: 'Neutral', emoji: '⚖️', text: 'Forecast: a calm market (NEUTRAL)',           rule: 'No bonus' },
    bull:    { label: 'Bull',    emoji: '\u{1F402}',   text: 'Forecast: the market looks set to rise (BULL)', rule: 'Plus tiles count 1 extra' },
    bear:    { label: 'Bear',    emoji: '\u{1F43B}',   text: 'Forecast: the market looks set to fall (BEAR)', rule: 'Minus tiles count 1 extra' }
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

// Average size of a tile number: bigger in shorter games (fewer landings) and smaller with many players (more landings).
// Beginner keeps its gentle tiles (max +/-3).
function tileAverage() {
    const m = modeCfg(); if (m.gentle) return 3;
    const n = APP_STATE.players.length, f = n <= 5 ? 1 : n <= 7 ? 0.85 : 0.75;
    return TILE_AVG[APP_STATE.settings.mode] * f;
}
const TILE_AVG = { long: 11, standard: 13, short: 20 };
const POOL_AVG = 2.35;   // average number in the built-in event sets; used to scale them to the wanted tile size

// Fill all 100 tiles: every event gets a + or - number (except Skip). The numbers are scaled to the tile average of the game length,
// and all + tiles together stay under a cap (and all - tiles over its negative) so the Market Tracker can stay inside 0 - 999.
function buildBalancedTiles() {
    const gentle = modeCfg().gentle, avg = tileAverage(), k = avg / POOL_AVG;
    let flip = Math.random() < 0.5 ? 1 : -1;
    const base = APP_STATE.eventPool.map(parseEvent).map(e => {
        if (e.sign === null) { e.sign = flip; flip = -flip; e.mag = rnd(1, 3); }
        if (gentle) { if (e.sign === 0) { e.sign = flip; flip = -flip; e.mag = 1; } e.mag = Math.min(e.mag, 3); }
        return e;
    });
    let order = [];
    while (order.length < 100) order = order.concat(shuffled(base.map((_, i) => i)));
    const picks = order.slice(0, 100).map(i => ({ ...base[i] }));
    if (!gentle) picks.forEach(p => { if (p.sign !== 0) p.mag = Math.max(1, Math.round(p.mag * k * (0.75 + Math.random() * 0.5))); });
    const cap = gentle ? 499 : Math.max(499, Math.round(avg * 52));
    [1, -1].forEach(sg => {
        const same = picks.filter(p => p.sign === sg), limit = sg > 0 ? cap : cap + 1;
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

// A phase is a FORECAST, not a promise. Bull / Bear deliver a random total (5-20% of the market value when the phase starts; Beginner 3-10%)
// in small uneven steps, one per finished turn. In 30% of the phases the forecast changes after the first real step: the rest of the phase
// goes the other way (70%) or stops (30%, Neutral). A Neutral phase can also turn into Bull or Bear (30%), with a fresh total.
// Steps never push the market outside the soft band (50 - 950).
const SOFT_LO = 50, SOFT_HI = 950, FLIP_CHANCE = 0.3, FLIP_REVERSE = 0.7;
const STEP_WEIGHTS = [0, 0, 1, 1, 2, 4];
const otherPhases = k => ['bull', 'bear', 'neutral'].filter(p => p !== k);

function planPhase(kind) {
    const S = APP_STATE, L = S.players.length * (kind === 'neutral' ? rnd(1, 2) : rnd(2, 4)), steps = new Array(L).fill(0);
    S.phaseLeft = S.phaseTotal = L; S.phaseFlipAt = -1; S.phaseFlipTo = '';
    if (kind === 'neutral') {
        if (L >= 2 && Math.random() < FLIP_CHANCE) { S.phaseFlipAt = rnd(1, L - 1); S.phaseFlipTo = Math.random() < 0.5 ? 'bull' : 'bear'; }
    } else {
        const pct = (modeCfg().gentle ? rnd(30, 100) : rnd(50, 200)) / 1000, sign = kind === 'bull' ? 1 : -1;
        const total = Math.max(2, Math.round(marketValue() * pct));
        const w = steps.map(() => STEP_WEIGHTS[rnd(0, STEP_WEIGHTS.length - 1)]);
        if (!w.some(x => x > 0)) w[rnd(0, L - 1)] = 1;
        const sw = w.reduce((a, b) => a + b, 0); let given = 0, last = 0;
        w.forEach((x, i) => { steps[i] = Math.floor(total * x / sw); given += steps[i]; if (x > 0) last = i; });
        steps[last] += total - given;
        steps.forEach((x, i) => { steps[i] = x * sign; });
        const first = steps.findIndex(x => x !== 0);
        if (first + 1 <= L - 1 && Math.random() < FLIP_CHANCE) {
            const at = rnd(first + 1, L - 1), reverse = Math.random() < FLIP_REVERSE;
            S.phaseFlipAt = at; S.phaseFlipTo = reverse ? (kind === 'bull' ? 'bear' : 'bull') : 'neutral';
            for (let j = at; j < L; j++) steps[j] = reverse ? -steps[j] : 0;
        }
    }
    S.phaseSteps = steps;
}

function startPhase() { const S = APP_STATE; S.marketPhase = 'neutral'; planPhase('neutral'); S.phaseSeq = 0; S.phaseNote = ''; }

// Called when a turn ends: maybe the forecast changes, then this turn's step moves the market, then maybe a new phase starts.
function advancePhase() {
    const S = APP_STATE;
    const i0 = S.phaseTotal - S.phaseLeft;
    if (S.phaseFlipAt === i0 && S.phaseFlipTo) {
        const to = S.phaseFlipTo, wasNeutral = S.marketPhase === 'neutral';
        S.phaseFlipAt = -1; S.phaseFlipTo = '';
        if (wasNeutral) { S.marketPhase = to; planPhase(to); S.phaseNote = 'swing'; }
        else { S.marketPhase = to; S.phaseNote = to === 'neutral' ? 'calm' : 'reverse'; }
        S.phaseSeq = nextEvt();
    }
    const i = S.phaseTotal - S.phaseLeft, step = S.phaseSteps[i] || 0;
    if (step) {
        const v = marketValue();
        let nv = v + step;
        if (step > 0) nv = Math.min(nv, Math.max(v, SOFT_HI)); else nv = Math.max(nv, Math.min(v, SOFT_LO));
        if (nv !== v) {
            setTrackerNumber(nv);
            S.lastEffect = { kind: 'phase', by: '', text: PHASES[S.marketPhase].label, delta: nv - v, before: v, after: nv, seq: nextEvt() };
        }
    }
    S.phaseLeft--;
    if (S.phaseLeft > 0) return;
    const next = otherPhases(S.marketPhase)[rnd(0, 1)];
    S.marketPhase = next; planPhase(next); S.phaseNote = 'start'; S.phaseSeq = nextEvt();
}

/* ---------- End of game ---------- */

function makeResults() {
    const mv = marketValue();
    return { seq: nextEvt(), ranking: rankedIds().map(id => { const p = APP_STATE.players.find(x => x.id === id); return { id, name: p.name, avatar: p.avatar, money: p.money, shares: p.shares, total: p.money + p.shares * mv }; }) };
}
