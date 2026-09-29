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
    players: [],
    activePlayersCount: 4,
    currentPlayerIndex: 0,
    // Turn flow: 'roll' (waiting for the dice) -> 'accept' (dice shown, waiting for Accept) -> 'moving' (avatar hops).
    turnPhase: 'roll',
    pending: null,     // dice value waiting to be accepted
    lastRoll: null,    // { n, by, seq }  (seq lets every client play each roll exactly once)
    lastMove: null,    // { by, from, to, seq }
    evtSeq: 0,
    anim: null         // local only: { id, pos, lift, count } while an avatar is hopping
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

