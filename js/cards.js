/* Capital Clash: the 10 Event Cards.

   Some Tiles on the Space Board are "Event Card" Tiles (never closer than CARD_GAP Tiles to each other, also after
   Dynamic Tile Shuffling). Landing on one: the Event Card Deck glows with an arrow, the player taps it, the top card
   turns over in the middle of the screen and the player presses "Accept Event".
   If the player cannot fulfil the card (not enough cash or shares) nothing is paid or traded, and the penalty is:
   skip the next turn.

   The rules below are plain functions (no screen access) so they can be tested on their own. */

const CARD_TILE_TEXT = 'Event Card';
const CARD_TILE_COUNT = 10;   // Event Card Tiles on the 100-Tile Space Board
const CARD_GAP = 7;           // any two Event Card Tiles are at least this many Tiles apart
const isCardTile = t => String(t && t.text !== undefined ? t.text : t || '') === CARD_TILE_TEXT;

// kind: gain (green), loss (red), action (blue)
const EVENT_CARDS = [
    { id: 1, name: 'Dividend Bonus', kind: 'gain', rule: 'Receive {c}300 for every share you currently hold.' },
    { id: 2, name: 'Investment Tax', kind: 'loss', rule: 'Pay {c}300 for every share you currently hold.' },
    { id: 3, name: 'Shareholder Reward', kind: 'gain', rule: 'Receive {c}500 if you own at least 5 shares. Otherwise receive {c}200.' },
    { id: 4, name: 'Annual Holding Fee', kind: 'loss', rule: 'Pay {c}100 for every share you own.' },
    { id: 5, name: 'Investor Grant', kind: 'gain', rule: 'Receive {c}1,000 if you own at least 10 shares. Otherwise receive {c}300.' },
    { id: 6, name: 'Emergency Contribution', kind: 'loss', rule: 'Pay {c}50 for every share you own.' },
    { id: 7, name: 'Mandatory Hold', kind: 'action', rule: 'You must hold all your current shares until your next turn. You cannot buy or sell any shares.' },
    { id: 8, name: 'Forced Sale', kind: 'action', rule: 'Sell 3 shares immediately at the current market price.' },
    { id: 9, name: 'Forced Purchase', kind: 'action', rule: 'Buy 3 shares immediately at the current market price.' },
    { id: 10, name: 'Investor\u2019s Choice', kind: 'action', rule: 'Choose one: receive {c}2,500, buy 5 shares, or sell 5 shares at the current market price.' }
];
const cardById = id => EVENT_CARDS.find(c => c.id === id) || null;
const CHOICES = ['cash', 'buy', 'sell'];

// What a card does to one player. Returns { ok, dm (cash change), ds (share change), hold, need, have, needChoice }.
// ok = false: the player cannot fulfil it, so nothing changes and the player skips the next turn.
function cardOutcome(id, p, price, choice) {
    const sh = Math.max(0, p.shares | 0), cash = Number(p.money) || 0;
    const pay = amt => amt <= cash ? { ok: true, dm: -amt, ds: 0, need: amt, have: cash } : { ok: false, dm: 0, ds: 0, need: amt, have: cash, short: 'cash' };
    switch (id) {
        case 1: return { ok: true, dm: 300 * sh, ds: 0 };
        case 2: return pay(300 * sh);
        case 3: return { ok: true, dm: sh >= 5 ? 500 : 200, ds: 0 };
        case 4: return pay(100 * sh);
        case 5: return { ok: true, dm: sh >= 10 ? 1000 : 300, ds: 0 };
        case 6: return pay(50 * sh);
        case 7: return { ok: true, dm: 0, ds: 0, hold: true };
        case 8: return sh >= 3 ? { ok: true, dm: 3 * price, ds: -3 } : { ok: false, dm: 0, ds: 0, need: 3, have: sh, short: 'shares' };
        case 9: return 3 * price <= cash ? { ok: true, dm: -3 * price, ds: 3 } : { ok: false, dm: 0, ds: 0, need: 3 * price, have: cash, short: 'cash' };
        case 10:
            if (choice === 'cash') return { ok: true, dm: 2500, ds: 0 };
            if (choice === 'buy') return 5 * price <= cash ? { ok: true, dm: -5 * price, ds: 5 } : { ok: false, dm: 0, ds: 0, need: 5 * price, have: cash, short: 'cash' };
            if (choice === 'sell') return sh >= 5 ? { ok: true, dm: 5 * price, ds: -5 } : { ok: false, dm: 0, ds: 0, need: 5, have: sh, short: 'shares' };
            return { ok: true, dm: 0, ds: 0, needChoice: true };
        default: return { ok: true, dm: 0, ds: 0 };
    }
}

// Plain-language result for the player who drew the card, e.g. "You hold 9 shares: you receive $2,700."
function cardOutcomeText(id, p, price, choice, fmt) {
    fmt = fmt || (n => String(n));
    const o = cardOutcome(id, p, price, choice), sh = Math.max(0, p.shares | 0);
    if (o.needChoice) return 'Pick one of the three options below.';
    if (!o.ok) return o.short === 'shares'
        ? 'You need ' + o.need + ' shares but hold ' + o.have + '. Penalty: you must skip your next turn.'
        : 'You need ' + fmt(o.need) + ' but have ' + fmt(o.have) + '. Penalty: you must skip your next turn.';
    if (o.hold) return 'Your ' + sh + ' share' + (sh === 1 ? '' : 's') + ' stay frozen: The Bank is closed for you this turn.';
    if (id === 8 || (id === 10 && choice === 'sell')) return 'You sell ' + (-o.ds) + ' shares at ' + fmt(price) + ' and receive ' + fmt(o.dm) + '.';
    if (id === 9 || (id === 10 && choice === 'buy')) return 'You buy ' + o.ds + ' shares at ' + fmt(price) + ' and pay ' + fmt(-o.dm) + '.';
    const why = id === 1 || id === 2 || id === 4 || id === 6 ? 'You hold ' + sh + ' share' + (sh === 1 ? '' : 's') + ': ' : id === 3 || id === 5 ? 'You own ' + sh + ' share' + (sh === 1 ? '' : 's') + ': ' : '';
    if (o.dm > 0) return why + 'you receive ' + fmt(o.dm) + '.';
    if (o.dm < 0) return why + 'you pay ' + fmt(-o.dm) + '.';
    return why + 'nothing to pay.';
}

/* ---------- Where the Event Card Tiles go ---------- */

function shuffledCopy(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// k random indices inside [start, end] (inclusive), each at least gap apart. Spread like "stars and bars", so every layout is possible.
function spacedSlots(k, start, end, gap) {
    const span = end - start + 1 - (gap - 1) * (k - 1);
    if (k <= 0) return [];
    if (span < k) return null;   // does not fit
    const pick = shuffledCopy(Array.from({ length: span }, (_, i) => i)).slice(0, k).sort((a, b) => a - b);
    return pick.map((q, i) => start + q + i * (gap - 1));
}

// Shortest distance between two Event Card Tiles (Infinity if fewer than 2). Used by the tests and as a safety check.
function minCardGap(tiles) {
    const idx = tiles.map((t, i) => (isCardTile(t) ? i : -1)).filter(i => i >= 0);
    let m = Infinity; for (let i = 1; i < idx.length; i++) m = Math.min(m, idx[i] - idx[i - 1]);
    return m;
}

// Dynamic Tile Shuffling for the Tiles from index 'from' to the end, keeping the Event Card Tiles at least CARD_GAP apart
// (also from the last Event Card Tile that is already behind the pawns). texts = array of 100 Tile texts; returns a new array.
function shuffleAheadTexts(texts, from) {
    const out = [...texts];
    if (from >= out.length) return out;
    let lastBehind = -Infinity;
    for (let i = 0; i < from; i++) if (out[i] === CARD_TILE_TEXT) lastBehind = i;
    const ahead = out.slice(from), cards = ahead.filter(t => t === CARD_TILE_TEXT).length, normal = shuffledCopy(ahead.filter(t => t !== CARD_TILE_TEXT));
    const start = Math.max(from, lastBehind + CARD_GAP);
    const slots = spacedSlots(cards, start, out.length - 1, CARD_GAP);
    if (!slots) return out;   // cannot happen when the board was valid before; keep it unchanged to be safe
    const set = new Set(slots);
    let n = 0;
    for (let i = from; i < out.length; i++) out[i] = set.has(i) ? CARD_TILE_TEXT : normal[n++];
    return out;
}

/* ---------- Deck ---------- */

const freshDeck = () => shuffledCopy(EVENT_CARDS.map(c => c.id));
if (typeof module !== 'undefined') module.exports = { EVENT_CARDS, CARD_TILE_TEXT, CARD_TILE_COUNT, CARD_GAP, cardOutcome, cardOutcomeText, spacedSlots, minCardGap, shuffleAheadTexts, freshDeck };
