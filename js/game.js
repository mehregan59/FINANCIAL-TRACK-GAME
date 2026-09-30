/* Capital Clash: turn flow (roll -> accept -> hop), player panel and turn glow.

   One rule keeps everyone in sync: a single "authority" decides what happens.
   - Online: the room host is the authority (guests send 'roll' / 'accept' requests to the host).
   - Solo (one screen): this browser is its own authority.
   The authority changes the shared state, publishes it, and every client (including the
   authority itself) plays the same dice animation and avatar hop from that state. */

const STEP_MS = 340; // time for an avatar to hop one space

const G = {
    solo: false,            // playing on one screen
    seenRoll: 0, seenMove: 0, // last dice / move animation this client has already played
    diceReady: true,        // false while the dice are still tumbling
    rollPending: false, acceptPending: false, // request sent to the host, waiting for its answer
    finishTimer: null, animTimer: null, prevMine: false
};

const curPlayer = () => APP_STATE.players[APP_STATE.currentPlayerIndex] || null;
const isGameActive = () => (MP.on ? MP.phase === 'playing' : G.solo);
// Online you act only for yourself; on one screen whoever's turn it is uses the shared dice.
const isMyTurn = () => { const c = curPlayer(); return !!c && (MP.on ? c.id === MP.id : true); };
const nextEvt = () => ++APP_STATE.evtSeq;
// True when the current player's last move came from a 6 (they roll again).
const rolledSix = () => { const m = APP_STATE.lastMove, c = curPlayer(); return !!(m && c && m.n === 6 && m.by === c.id); };

/* ---------- Setup (solo) ---------- */

function resetTurnState() {
    clearTimeout(G.finishTimer); stopAnim();
    Object.assign(APP_STATE, { turnPhase: 'roll', pending: null, lastRoll: null, lastMove: null });
    G.seenRoll = G.seenMove = APP_STATE.evtSeq;
    G.rollPending = G.acceptPending = false; G.diceReady = true;
}

function changePlayerCount(val) {
    APP_STATE.activePlayersCount = parseInt(val);
    APP_STATE.players = [];
    for (let i = 1; i <= APP_STATE.activePlayersCount; i++) {
        APP_STATE.players.push({ id: i, name: `Investor ${i}`, position: 1, avatar: AVATARS[i - 1].id, ...newWallet() });
    }
    APP_STATE.currentPlayerIndex = 0; // player 1 starts, then one after the other
    resetTurnState();
    renderPlayersList(); drawBoard(); updateTurnUI();
}

function startSoloGame() {
    G.solo = true;
    APP_STATE.settings = readSettingsForm();
    setTrackerNumber(APP_STATE.settings.market);
    applyChosenPreset(chosenPreset());
    APP_STATE.activePlayersCount = clampInt($('setSoloPlayers').value, 2, 10, 4);
    $('setSoloPlayers').value = APP_STATE.activePlayersCount;
    changePlayerCount(APP_STATE.activePlayersCount); // new wallets, player 1 starts
    updateMarketTrackerUI(); drawBoard();
    syncEffects(true);
}

function initDock() {
    Dice.init();
    const b = $('soundBtn');
    if (b) b.textContent = Sound.muted ? '\u{1F507}' : '\u{1F50A}';
}

function toggleSound() {
    Sound.setMuted(!Sound.muted);
    $('soundBtn').textContent = Sound.muted ? '\u{1F507}' : '\u{1F50A}';
}

/* ---------- What the local player does ---------- */

function onDiceClick() {
    Sound.unlock();
    if ($('diceBtn').disabled) return;
    if (MP.on && !isHost()) { // guests ask the host to roll
        G.rollPending = true; updateTurnUI();
        setTimeout(() => { if (G.rollPending) { G.rollPending = false; updateTurnUI(); } }, 3000);
        MP.t.send('roll', { from: MP.id });
        return;
    }
    authRoll(curPlayer().id);
}

function onAcceptClick() {
    Sound.unlock();
    if ($('acceptBtn').disabled) return;
    if (MP.on && !isHost()) {
        G.acceptPending = true; updateTurnUI();
        setTimeout(() => { if (G.acceptPending) { G.acceptPending = false; updateTurnUI(); } }, 3000);
        MP.t.send('accept', { from: MP.id });
        return;
    }
    authAccept(curPlayer().id);
}

/* ---------- The authority (host, or this browser when solo) ---------- */

function publish() {
    if (MP.on) broadcastState();
    syncEffects(false);
}

function authRoll(fromId) {
    const cur = curPlayer();
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'roll') return;
    const n = rollD6();
    APP_STATE.pending = n;
    APP_STATE.turnPhase = 'accept';
    APP_STATE.lastRoll = { n, by: cur.id, seq: nextEvt() };
    publish();
}

function authAccept(fromId) {
    const cur = curPlayer();
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'accept' || !APP_STATE.pending) return;
    const from = cur.position, to = Math.min(100, from + APP_STATE.pending);
    const rolled = APP_STATE.pending;
    cur.position = to;
    APP_STATE.pending = null;
    APP_STATE.turnPhase = 'moving';
    APP_STATE.lastMove = { by: cur.id, from, to, n: rolled, seq: nextEvt() };
    publish();
    scheduleFinish((to - from) * STEP_MS + 500);
}

function scheduleFinish(ms) { clearTimeout(G.finishTimer); G.finishTimer = setTimeout(authFinishTurn, ms); }

// After the hop has finished on every screen, pass the turn on.
function authFinishTurn() {
    if (APP_STATE.turnPhase !== 'moving' || (MP.on && !isHost())) return;
    // A 6 earns another roll; any other number passes the turn on, one player after the other.
    if (!rolledSix()) APP_STATE.currentPlayerIndex = nextPlayerIndex(APP_STATE.currentPlayerIndex);
    APP_STATE.turnPhase = 'roll';
    publish();
    watchCurrentPlayer();
}

// A new host that inherits a move in progress finishes it.
function resumeAfterTakeover() { if (APP_STATE.turnPhase === 'moving') scheduleFinish(1500); }

// Used when a disconnected player's turn is skipped.
function authSkipTurn() {
    clearTimeout(G.finishTimer);
    APP_STATE.pending = null;
    APP_STATE.turnPhase = 'roll';
    APP_STATE.currentPlayerIndex = nextPlayerIndex(APP_STATE.currentPlayerIndex);
    publish();
}

/* ---------- What every screen plays (driven by the shared state) ---------- */

// fresh = we just joined / refreshed: show the current dice, do not replay old animations.
function syncEffects(fresh) {
    const r = APP_STATE.lastRoll, m = APP_STATE.lastMove;
    if (fresh) {
        stopAnim();
        G.seenRoll = r ? r.seq : 0; G.seenMove = m ? m.seq : 0;
        G.diceReady = true; G.rollPending = G.acceptPending = false;
        Dice.show(APP_STATE.pending || (r ? r.n : 1));
    } else {
        if (r && r.seq > G.seenRoll) { G.seenRoll = r.seq; startDiceRoll(r); }
        if (m && m.seq > G.seenMove) { G.seenMove = m.seq; startPawnMove(m); }
    }
    updateTurnUI();
}

function startDiceRoll(r) {
    G.rollPending = false; G.diceReady = false;
    Dice.roll(r.n, () => { G.diceReady = true; updateTurnUI(); });
}

function startPawnMove(m) {
    G.acceptPending = false;
    stopAnim();
    if (!APP_STATE.players.some(p => p.id === m.by) || m.to <= m.from) return;
    const steps = m.to - m.from, t0 = performance.now();
    let lastK = -1;
    APP_STATE.anim = { id: m.by, pos: m.from, lift: 0, count: 0 };
    // Time-based (not frame-based) so it also completes correctly in background tabs.
    G.animTimer = setInterval(() => {
        const elapsed = performance.now() - t0;
        if (elapsed >= steps * STEP_MS) { stopAnim(); Sound.arrive(); updateTurnUI(); return; }
        const k = Math.floor(elapsed / STEP_MS), f = (elapsed - k * STEP_MS) / STEP_MS;
        const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        const a = APP_STATE.anim;
        a.pos = m.from + k + ease; a.lift = Math.sin(Math.PI * f); a.count = k + 1;
        if (k !== lastK) { lastK = k; Sound.step(k); renderPlayersList(); }
        renderPawnLayer();
    }, 16);
}

function stopAnim() {
    clearInterval(G.animTimer); G.animTimer = null;
    APP_STATE.anim = null;
    renderPawnLayer();
}

/* ---------- Screen: dice dock, banner, player list ---------- */

function updateTurnUI() {
    const active = isGameActive();
    $('diceDock').classList.toggle('dock-hidden', !active);
    $('leftRail').classList.toggle('dock-hidden', !active);
    $('turnBanner').classList.toggle('hidden', !active);
    if (!active) { document.title = 'Capital Clash'; return; }
    const cur = curPlayer(); if (!cur) return;

    const mine = isMyTurn(), phase = APP_STATE.turnPhase, idx = APP_STATE.currentPlayerIndex;
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const online = MP.on;

    $('diceBtn').disabled = !(mine && phase === 'roll' && !G.rollPending && !Dice.rolling);

    let msg;
    const again = rolledSix();
    if (phase === 'roll') msg = mine ? (again ? 'A 6! Roll again' : online ? 'Your turn! Tap the dice' : `${cur.name}: tap the dice`) : (again ? `${cur.name} rolled a 6 and goes again` : `${cur.name} is about to roll...`);
    else if (phase === 'accept') msg = !G.diceReady ? 'Rolling...' : (mine && online ? `You rolled ${APP_STATE.pending}!` : `${cur.name} rolled ${APP_STATE.pending}`);
    else msg = `${cur.name} is moving...`;
    $('diceStatus').textContent = msg;

    const ab = $('acceptBtn');
    ab.classList.toggle('hidden', !(mine && phase === 'accept' && G.diceReady));
    ab.disabled = G.acceptPending;
    ab.textContent = `Accept: move ${APP_STATE.pending || ''}`;

    $('diceDock').classList.toggle('yourturn', mine && phase !== 'moving');

    const banner = $('turnBanner');
    banner.style.setProperty('--pc', color);
    banner.classList.toggle('mine', mine && online);
    banner.innerHTML = `<span class="banner-avatar">${avatarEmoji(cur.avatar)}</span><span>${(mine && online ? 'Your turn!' : escapeHtml(cur.name) + "'s turn") + (again && phase === 'roll' ? ' (6: again!)' : '')}</span>`;

    if (online && mine && !G.prevMine) Sound.chime();
    G.prevMine = online && mine;
    document.title = online && mine ? '\u{1F3B2} Your turn - Capital Clash' : 'Capital Clash';

    if (online) {
        const can = canControlTracker(), panel = $('trackerPanel');
        panel.classList.toggle('opacity-60', !can); panel.classList.toggle('pointer-events-none', !can);
    }
    renderPlayersList(); renderWallet(); renderPawnLayer();
}

// The player list and the wallet are one card now.
function renderPlayersList() { renderWallet(); }

/* ---------- Wallet table under the dice: avatar | shares | money | total ---------- */

const fmtNum = n => Number(n).toLocaleString('en-US');

function renderWallet() {
    const box = $('walletRows');
    if (!box) return;
    const mv = marketValue();
    $('walletMarket').textContent = mv;
    const keepScroll = box.scrollTop;
    box.innerHTML = '';
    APP_STATE.players.forEach((p, idx) => {
        const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
        const turn = idx === APP_STATE.currentPlayerIndex && isGameActive();
        const isMe = MP.on && p.id === MP.id;
        const offline = MP.on && MP.phase === 'playing' && !isPresent(p);
        const a = APP_STATE.anim && APP_STATE.anim.id === p.id ? APP_STATE.anim : null;
        const shownPos = a ? Math.floor(a.pos + 0.5) : p.position; // counts up while the avatar hops
        const row = document.createElement('div');
        row.className = 'wallet-row player-row' + (turn ? ' turn turn-glow' : '') + (offline ? ' offline' : '');
        row.style.setProperty('--pc', color);
        row.innerHTML = `<div class="wallet-top">
                <span class="avatar-chip" style="--pc:${color}">${avatarEmoji(p.avatar)}</span>
                <span class="wallet-name">${escapeHtml(p.name)}${isMe ? '<small style="color:#86f0b4">(you)</small>' : ''}${p.bot ? '<small style="color:#ffd54a">(test)</small>' : ''}${offline ? '<small style="color:#ff9b9b">(offline)</small>' : ''}</span>
                <span class="wallet-space">Space ${shownPos}</span>
            </div>
            <div class="wallet-cells">
                <span class="wallet-cell sh" data-label="Shares">${fmtNum(p.shares)}</span>
                <span class="wallet-cell mo" data-label="Money">${fmtNum(p.money)}</span>
                <span class="wallet-cell to" data-label="Total">${fmtNum(p.money + p.shares * mv)}</span>
            </div>`;
        box.appendChild(row);
    });
    box.scrollTop = keepScroll;
    const cur = box.children[APP_STATE.currentPlayerIndex];
    if (cur && isGameActive() && G.lastScrolled !== APP_STATE.currentPlayerIndex) { // bring the active player into view
        G.lastScrolled = APP_STATE.currentPlayerIndex;
        if (cur.offsetTop < box.scrollTop || cur.offsetTop + cur.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = cur.offsetTop - 4;
    }
}

// Bank buttons: only the sounds for now (trading gets wired later).
function bankAction(kind) {
    Sound.unlock();
    if (kind === 'buy') Sound.buy(); else Sound.sell();
    const b = document.querySelector('.bank-btn.' + kind);
    if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 160); }
    showToast(kind === 'buy' ? 'Bank: buying shares is coming soon' : 'Bank: selling shares is coming soon');
}

function toggleMenu() {
    const bar = $('menuBar'); bar.classList.toggle('hidden');
    $('menuBtn').setAttribute('aria-expanded', String(!bar.classList.contains('hidden')));
}
