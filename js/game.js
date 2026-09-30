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
    finishTimer: null, animTimer: null, prevMine: false,
    seenEffect: 0, seenTrade: 0, popKey: ''
};

const curPlayer = () => APP_STATE.players[APP_STATE.currentPlayerIndex] || null;
const isGameActive = () => (MP.on ? MP.phase === 'playing' : G.solo);
// Online you act only for yourself; on one screen whoever's turn it is uses the shared dice.
// TEST BOTS: the host presses the dice and Accept for a test bot by hand (bots never play on their own).
const isMyTurn = () => { const c = curPlayer(); return !!c && (MP.on ? (c.id === MP.id || (!!c.bot && isHost())) : true); };
const nextEvt = () => ++APP_STATE.evtSeq;
// True when the current player's last move came from a 6 (they roll again).
const rolledSix = () => { const m = APP_STATE.lastMove, c = curPlayer(); return !!(m && c && m.n === 6 && m.by === c.id); };

/* ---------- Setup (solo) ---------- */

function resetTurnState() {
    clearTimeout(G.finishTimer); stopAnim();
    Object.assign(APP_STATE, { turnPhase: 'roll', pending: null, lastRoll: null, lastMove: null, lastEffect: null, lastTrade: null });
    G.seenRoll = G.seenMove = G.seenEffect = G.seenTrade = APP_STATE.evtSeq; G.popKey = '';
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

function scheduleFinish(ms) { clearTimeout(G.finishTimer); G.finishTimer = setTimeout(authFinishMove, ms); }

// The number in a tile's name, e.g. "Crypto Rally (+5)" -> 5, "Bear Market (-2)" -> -2. "(Skip)" and anything else -> 0.
function tileDelta(text) { const m = /\(([+-]\d+)\)/.exec(String(text || '')); return m ? parseInt(m[1], 10) : 0; }

// After the hop has finished on every screen: the tile's number moves the Market Tracker, then the bank opens for this player.
function authFinishMove() {
    if (APP_STATE.turnPhase !== 'moving' || (MP.on && !isHost())) return;
    const cur = curPlayer(), m = APP_STATE.lastMove;
    if (cur && m && m.by === cur.id && m.to > m.from) {
        const tile = APP_STATE.tiles[m.to - 1], delta = tileDelta(tile && tile.text);
        const before = marketValue(), after = Math.max(0, Math.min(999, before + delta));
        setTrackerNumber(after);
        APP_STATE.lastEffect = { kind: 'tile', by: cur.id, text: tile ? tile.text : '', delta, before, after, seq: nextEvt() };
    }
    APP_STATE.turnPhase = 'trade';
    publish();
}

// The player is done at the bank: a 6 earns another roll; any other number passes the turn on, one player after the other.
function authEndTurn(fromId) {
    const cur = curPlayer();
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'trade') return;
    if (!rolledSix()) APP_STATE.currentPlayerIndex = nextPlayerIndex(APP_STATE.currentPlayerIndex);
    APP_STATE.turnPhase = 'roll';
    publish();
    watchCurrentPlayer();
}

// Buy or sell shares at the current Market Tracker value (only the player whose turn it is, only after moving).
function authTrade(fromId, kind, qty) {
    const cur = curPlayer();
    qty = parseInt(qty, 10);
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'trade' || !(qty >= 1 && qty <= 100000)) return false;
    const price = marketValue();
    if (kind === 'buy') { if (qty * price > cur.money) return false; cur.money -= qty * price; cur.shares += qty; }
    else if (kind === 'sell') { if (qty > cur.shares) return false; cur.money += qty * price; cur.shares -= qty; }
    else return false;
    APP_STATE.lastTrade = { by: cur.id, kind, qty, price, seq: nextEvt() };
    publish();
    return true;
}

// Start over: Market Tracker back to the starting value, every player back on Space 1 with the starting money and shares.
function authReset() {
    if (MP.on && !isHost()) return;
    clearTimeout(G.finishTimer); stopAnim();
    const s = APP_STATE.settings;
    setTrackerNumber(s.market);
    APP_STATE.players.forEach(p => { p.position = 1; p.money = s.money; p.shares = s.shares; });
    Object.assign(APP_STATE, { currentPlayerIndex: 0, turnPhase: 'roll', pending: null, lastRoll: null, lastMove: null, lastTrade: null });
    APP_STATE.lastEffect = { kind: 'reset', by: '', text: '', delta: 0, before: 0, after: s.market, seq: nextEvt() };
    publish();
    watchCurrentPlayer();
}

function requestReset() {
    if (MP.on && !isHost()) { showToast('Only the host can reset the game'); return; }
    if (!window.confirm('Reset the game? The Market Tracker goes back to ' + APP_STATE.settings.market + ' and every player goes back to Space 1 with the starting money and shares.')) return;
    authReset();
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
    G.endPending = false;
    const r = APP_STATE.lastRoll, m = APP_STATE.lastMove;
    if (fresh) {
        stopAnim();
        G.seenRoll = r ? r.seq : 0; G.seenMove = m ? m.seq : 0;
        G.seenEffect = APP_STATE.lastEffect ? APP_STATE.lastEffect.seq : 0; G.seenTrade = APP_STATE.lastTrade ? APP_STATE.lastTrade.seq : 0;
        G.diceReady = true; G.rollPending = G.acceptPending = false;
        Dice.show(APP_STATE.pending || (r ? r.n : 1));
    } else {
        if (r && r.seq > G.seenRoll) { G.seenRoll = r.seq; startDiceRoll(r); }
        if (m && m.seq > G.seenMove) { G.seenMove = m.seq; startPawnMove(m); }
        const ef = APP_STATE.lastEffect, tr = APP_STATE.lastTrade;
        if (ef && ef.seq > G.seenEffect) { G.seenEffect = ef.seq; announceEffect(ef); }
        if (tr && tr.seq > G.seenTrade) { G.seenTrade = tr.seq; announceTrade(tr); }
    }
    updateTurnUI();
}

const playerName = id => { const p = APP_STATE.players.find(x => x.id === id); return p ? p.name : 'Someone'; };

function announceEffect(ef) {
    if (ef.kind === 'reset') { showToast('Game reset: market ' + ef.after + ', everyone back on Space 1'); return; }
    const d = ef.delta ? (ef.delta > 0 ? '+' + ef.delta : String(ef.delta)) : 'no change';
    showToast(playerName(ef.by) + ' landed on ' + ef.text + ': market ' + ef.before + ' \u2192 ' + ef.after + (ef.delta ? ' (' + d + ')' : ' (' + d + ')'));
}

function announceTrade(tr) {
    if (tr.kind === 'buy') Sound.buy(); else Sound.sell();
    showToast(playerName(tr.by) + (tr.kind === 'buy' ? ' bought ' : ' sold ') + tr.qty + ' share' + (tr.qty > 1 ? 's' : '') + ' at ' + tr.price);
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

    const mine = isMyTurn(), own = MP.on && mine && !cur.bot, phase = APP_STATE.turnPhase, idx = APP_STATE.currentPlayerIndex;
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const online = MP.on;

    $('diceBtn').disabled = !(mine && phase === 'roll' && !G.rollPending && !Dice.rolling);

    let msg;
    const again = rolledSix();
    if (phase === 'roll') msg = mine ? (again ? (own || !online ? 'A 6! Roll again' : `${cur.name}: 6! roll again`) : own ? 'Your turn! Tap the dice' : `${cur.name}: tap the dice`) : (again ? `${cur.name} rolled a 6 and goes again` : `${cur.name} is about to roll...`);
    else if (phase === 'accept') msg = !G.diceReady ? 'Rolling...' : (own ? `You rolled ${APP_STATE.pending}!` : `${cur.name} rolled ${APP_STATE.pending}`);
    else msg = `${cur.name} is moving...`;
    $('diceStatus').textContent = msg;

    const ab = $('acceptBtn');
    ab.classList.toggle('hidden', !(mine && phase === 'accept' && G.diceReady));
    ab.disabled = G.acceptPending;
    ab.textContent = `Accept: move ${APP_STATE.pending || ''}`;

    $('diceDock').classList.toggle('yourturn', mine && phase !== 'moving');

    const banner = $('turnBanner');
    banner.style.setProperty('--pc', color);
    banner.classList.toggle('mine', own);
    banner.innerHTML = `<span class="banner-avatar">${avatarEmoji(cur.avatar)}</span><span>${(own ? 'Your turn!' : escapeHtml(cur.name) + "'s turn") + (again && phase === 'roll' ? ' (6: again!)' : '')}</span>`;

    if (own && !G.prevMine) Sound.chime();
    G.prevMine = own;
    document.title = own ? '\u{1F3B2} Your turn - Capital Clash' : 'Capital Clash';

    // Trading and ending the turn belong to the player whose turn it is, after the move.
    const trading = mine && phase === 'trade';
    document.querySelectorAll('.bank-btn').forEach(b => { b.disabled = !trading; b.classList.toggle('locked', !trading); });
    const eb = $('endBtn'); eb.classList.toggle('hidden', !trading); eb.disabled = !!G.endPending;
    $('bankHint').textContent = trading ? 'Buy or sell, then press End turn' : (phase === 'trade' ? cur.name + ' is at the bank' : 'Opens after you move');
    const rb = $('resetTrackerBtn'); if (rb) rb.classList.toggle('opacity-50', MP.on && !isHost());

    if (!trading) closeTrade(); else if (!$('tradeModal').classList.contains('hidden')) renderTrade();
    updateFocus(own || (mine && !online), phase);
    showTurnPopup(cur, phase, own || (mine && !online));
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

/* ---------- Focus glow + turn popup ----------
   ONE table says which control glows in which phase. Every new feature that needs the player's attention
   adds its element ids here (and, if it should be taught, a step in js/guide.js). */
const FOCUS = { roll: ['diceScene'], accept: ['acceptBtn'], trade: ['bankCard', 'endBtn'] };
const FOCUS_ALL = ['diceScene', 'acceptBtn', 'bankCard', 'endBtn'];

function updateFocus(mine, phase) {
    const on = mine && !(phase === 'accept' && !G.diceReady) ? (FOCUS[phase] || []) : [];
    FOCUS_ALL.forEach(id => { const e = $(id); if (e) e.classList.toggle('focus-glow', on.includes(id)); });
}

// What every screen shows when a new step of the game starts.
const TURN_TEXT = {
    roll: (name, mine) => mine ? 'Your turn: roll the dice' : name + "'s turn: rolling the dice",
    trade: (name, mine) => mine ? 'Buy or sell shares, then end your turn' : name + ' is at the bank'
};
function showTurnPopup(cur, phase, mine) {
    if (!TURN_TEXT[phase]) return;
    const lm = APP_STATE.lastMove, key = [APP_STATE.currentPlayerIndex, phase, lm ? lm.seq : 0, APP_STATE.lastEffect && APP_STATE.lastEffect.kind === 'reset' ? APP_STATE.lastEffect.seq : 0].join('|');
    if (G.popKey === key) return;
    G.popKey = key;
    const pop = $('turnPopup'), color = PLAYER_COLORS[APP_STATE.currentPlayerIndex % PLAYER_COLORS.length];
    pop.style.setProperty('--pc', color);
    pop.innerHTML = `<span class="tp-avatar">${avatarEmoji(cur.avatar)}</span><span><b>${escapeHtml(cur.name)}${mine && MP.on ? ' (you)' : ''}</b><small>${TURN_TEXT[phase](escapeHtml(cur.name), mine)}</small></span>`;
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
    clearTimeout(G.popTimer); G.popTimer = setTimeout(() => pop.classList.remove('show'), 2600);
}

/* ---------- Bank: buy / sell window ---------- */

const TRADE = { kind: 'buy' };

function bankAction(kind) {
    Sound.unlock();
    const b = document.querySelector('.bank-btn.' + kind);
    if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 160); }
    if (!(isMyTurn() && APP_STATE.turnPhase === 'trade')) { showToast('The bank opens for you after you move'); return; }
    TRADE.kind = kind;
    $('tradeTitle').textContent = kind === 'buy' ? 'Buy shares' : 'Sell shares';
    $('tradeModal').dataset.kind = kind;
    $('tradeQty').value = 1;
    $('tradeModal').classList.remove('hidden');
    renderTrade();
    setTimeout(() => { try { $('tradeQty').focus(); $('tradeQty').select(); } catch (_) {} }, 30);
}

function tradeMax() {
    const cur = curPlayer(), price = marketValue();
    if (!cur) return 0;
    return TRADE.kind === 'buy' ? (price > 0 ? Math.floor(cur.money / price) : 1000) : cur.shares;
}

function tradeStep(d) { $('tradeQty').value = Math.max(0, (parseInt($('tradeQty').value, 10) || 0) + d); renderTrade(); }
function tradeSetMax() { $('tradeQty').value = tradeMax(); renderTrade(); }

function renderTrade() {
    const cur = curPlayer(); if (!cur) return;
    const price = marketValue(), q = parseInt($('tradeQty').value, 10) || 0, total = q * price, buy = TRADE.kind === 'buy';
    $('tradePrice').textContent = fmtNum(price);
    $('tradeMoney').textContent = fmtNum(cur.money); $('tradeShares').textContent = fmtNum(cur.shares);
    $('tradeTotal').textContent = fmtNum(total);
    $('tradeAfterMoney').textContent = fmtNum(cur.money + (buy ? -total : total));
    $('tradeAfterShares').textContent = fmtNum(cur.shares + (buy ? q : -q));
    let err = '';
    if (q < 1) err = 'Enter how many shares';
    else if (buy && total > cur.money) err = 'Not enough money (you can afford ' + tradeMax() + ')';
    else if (!buy && q > cur.shares) err = 'You only have ' + cur.shares + ' shares';
    $('tradeErr').textContent = err;
    $('tradeOk').disabled = !!err;
    $('tradeOk').textContent = (buy ? 'Buy ' : 'Sell ') + (q > 0 ? q + ' share' + (q > 1 ? 's' : '') : '');
}

function closeTrade() { $('tradeModal').classList.add('hidden'); }

function confirmTrade() {
    const q = parseInt($('tradeQty').value, 10) || 0;
    if ($('tradeOk').disabled || q < 1) return;
    closeTrade();
    if (MP.on && !isHost()) { MP.t.send('trade', { from: MP.id, kind: TRADE.kind, qty: q }); return; }
    authTrade(curPlayer().id, TRADE.kind, q);
}

function onEndClick() {
    Sound.unlock();
    if ($('endBtn').disabled) return;
    closeTrade();
    if (MP.on && !isHost()) {
        G.endPending = true; updateTurnUI();
        setTimeout(() => { if (G.endPending) { G.endPending = false; updateTurnUI(); } }, 3000);
        MP.t.send('endturn', { from: MP.id });
        return;
    }
    authEndTurn(curPlayer().id);
}

function toggleMenu() {
    const bar = $('menuBar'); bar.classList.toggle('hidden');
    $('menuBtn').setAttribute('aria-expanded', String(!bar.classList.contains('hidden')));
}
