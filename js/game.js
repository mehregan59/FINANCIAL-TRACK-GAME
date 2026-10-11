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
    seenEffect: 0, seenTrade: 0, seenPhase: 0, seenFinal: 0, seenOver: 0, popKey: ''
};

const curPlayer = () => APP_STATE.players[APP_STATE.currentPlayerIndex] || null;
const isGameActive = () => (MP.on ? MP.phase === 'playing' : G.solo);
// Online you act only for yourself; on one screen whoever's turn it is uses the shared dice.
// TEST BOTS: the host presses the dice and Accept for a test bot by hand (bots never play on their own).
const isMyTurn = () => { const c = curPlayer(); return !!c && (MP.on ? (c.id === MP.id || (!!c.bot && isHost())) : true); };
const nextEvt = () => ++APP_STATE.evtSeq;

/* ---------- Setup (solo) ---------- */

function resetTurnState() {
    clearTimeout(G.finishTimer); stopAnim();
    Object.assign(APP_STATE, { turnPhase: 'roll', pending: null, lastRoll: null, lastMove: null, lastEffect: null, lastTrade: null, finalBy: '', finalSeq: 0, gameOver: null, rank: [] });
    G.seenRoll = G.seenMove = G.seenEffect = G.seenTrade = G.seenPhase = G.seenFinal = G.seenOver = APP_STATE.evtSeq; G.popKey = '';
    G.rollPending = G.acceptPending = false; G.diceReady = true;
}

function changePlayerCount(val) {
    APP_STATE.activePlayersCount = parseInt(val);
    APP_STATE.players = [];
    for (let i = 1; i <= APP_STATE.activePlayersCount; i++) {
        APP_STATE.players.push({ id: i, name: `Investor ${i}`, position: 0, avatar: AVATARS[i - 1].id, ...newWallet() });
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
    buildBalancedTiles(); startPhase(); resetCards(); if (typeof Stats !== 'undefined') Stats.reset(); APP_STATE.rank = [];
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
    const n = rollDie(diceSides());
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
    scheduleFinish((to - from) * stepMsFor(to - from) + 500);
}

function scheduleFinish(ms) { clearTimeout(G.finishTimer); G.finishTimer = setTimeout(authFinishMove, ms); }

// The number in a tile's name, e.g. "Crypto Rally (+5)" -> 5, "Bear Market (-2)" -> -2. "(Skip)" and anything else -> 0.
function tileDelta(text) { const m = /\(([+-]\d+)\)/.exec(String(text || '')); return m ? parseInt(m[1], 10) : 0; }

// After the hop has finished on every screen: the tile's number moves the Market Tracker, then the bank opens for this player.
function authFinishMove() {
    if (APP_STATE.turnPhase !== 'moving' || (MP.on && !isHost())) return;
    const cur = curPlayer(), m = APP_STATE.lastMove;
    if (cur && m && m.by === cur.id && m.to > m.from) {
        const tile = APP_STATE.tiles[m.to - 1];
        if (isCardTile(tile)) { APP_STATE.turnPhase = 'card'; publish(); return; }   // Event Card Tile: draw from the deck first
        const base = tileDelta(tile && tile.text), bonus = phaseBonus(base, marketValue()), delta = base + bonus;
        const before = marketValue(), after = Math.max(0, Math.min(999, before + delta));
        APP_STATE.prevMarket = before;
        setTrackerNumber(after);
        APP_STATE.lastEffect = { kind: 'tile', by: cur.id, text: tile ? tile.text : '', delta, bonus, before, after, seq: nextEvt() };
        if (typeof Stats !== 'undefined') Stats.tile(cur, tile ? tile.text : '', after - before);
        updateMarketTrackerUI(); drawBoard();
    }
    APP_STATE.turnPhase = 'trade';
    publish();
}

// The player is done at the bank: the turn passes on, one player after the other.
// Then: ranking by portfolio, market phase countdown, tiles ahead reshuffled, and the end-of-game check.
function skippedPast(from, next, fi) { const n = APP_STATE.players.length, d = i => (i - from + n) % n; return d(fi) > 0 && d(fi) < d(next); }
function authEndTurn(fromId) {
    const cur = curPlayer();
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'trade') return;
    const from = APP_STATE.currentPlayerIndex;
    if (cur.position >= 100 && !APP_STATE.finalBy) { APP_STATE.finalBy = cur.id; APP_STATE.finalSeq = nextEvt(); } // last round starts
    APP_STATE.rank = rankedIds();   // (also set again below, after this turn's market step)
    APP_STATE.holdBy = '';
    if (typeof Stats !== 'undefined') Stats.turn(cur);
    let next = nextPlayerIndex(from), wrapped = next <= from;
    // Event Card penalty: a player marked skipNext loses this turn (once), the turn goes on to the next player.
    const skipped = [];
    for (let guard = 0; guard < APP_STATE.players.length && APP_STATE.players[next] && APP_STATE.players[next].skipNext && next !== from; guard++) {
        APP_STATE.players[next].skipNext = false; skipped.push(APP_STATE.players[next].id);
        const nn = nextPlayerIndex(next); if (nn <= next) wrapped = true; next = nn;
    }
    if (skipped.length) APP_STATE.lastSkip = { ids: skipped, seq: nextEvt() };
    const fi = APP_STATE.finalBy ? APP_STATE.players.findIndex(p => p.id === APP_STATE.finalBy) : -1;
    // Final round: everyone after the finisher plays once more; the game ends when the turn comes back to the finisher.
    if (APP_STATE.finalBy && (next === fi || fi < 0 || (skipped.length && skippedPast(from, next, fi)))) { // the round is complete: everybody had the same number of turns
        APP_STATE.gameOver = makeResults(); APP_STATE.turnPhase = 'over'; APP_STATE.pending = null;
        publish(); return;
    }
    APP_STATE.currentPlayerIndex = next;
    advancePhase();
    APP_STATE.rank = rankedIds();
    updateMarketTrackerUI();
    reshuffleAhead();
    // A player who already stands on the finish has nothing to roll for: straight to the bank.
    APP_STATE.turnPhase = APP_STATE.players[next] && APP_STATE.players[next].position >= 100 ? 'trade' : 'roll';
    drawBoard();
    publish();
    watchCurrentPlayer();
}

// Buy or sell shares at the current Market Tracker value (only the player whose turn it is, only after moving).
// A player who landed on an Event Card Tile this turn has used their turn on the card: no trading.
function usedCardThisTurn(cur) {
    const m = APP_STATE.lastMove;
    return !!(cur && m && m.by === cur.id && cur.position === m.to && isCardTile(APP_STATE.tiles[m.to - 1] || {}));
}
function authTrade(fromId, kind, qty) {
    const cur = curPlayer();
    qty = parseInt(qty, 10);
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'trade' || APP_STATE.holdBy === cur.id || usedCardThisTurn(cur) || !(qty >= 1 && qty <= 100000)) return false;
    const price = marketValue();
    if (kind === 'buy') { if (qty * price > cur.money) return false; cur.money -= qty * price; cur.shares += qty; }
    else if (kind === 'sell') { if (qty > cur.shares) return false; cur.money += qty * price; cur.shares -= qty; }
    else return false;
    APP_STATE.lastTrade = { by: cur.id, kind, qty, price, seq: nextEvt() };
    if (typeof Stats !== 'undefined') Stats.trade(cur, kind, qty, price);
    publish();
    return true;
}

// Start over: Market Tracker back to the starting value, every player back on Tile 0 (Start) with the starting money and shares.
function authReset() {
    if (MP.on && !isHost()) return;
    clearTimeout(G.finishTimer); stopAnim();
    const s = APP_STATE.settings;
    setTrackerNumber(s.market);
    APP_STATE.players.forEach(p => { p.position = 0; p.money = s.money; p.shares = s.shares; });
    Object.assign(APP_STATE, { currentPlayerIndex: 0, turnPhase: 'roll', pending: null, lastRoll: null, lastMove: null, lastTrade: null, finalBy: '', gameOver: null, rank: [], prevMarket: null });
    buildBalancedTiles(); startPhase(); resetCards(); if (typeof Stats !== 'undefined') Stats.reset(); APP_STATE.phaseSeq = nextEvt();
    APP_STATE.lastEffect = { kind: 'reset', by: '', text: '', delta: 0, before: 0, after: s.market, seq: nextEvt() };
    updateMarketTrackerUI(); drawBoard();
    publish();
    watchCurrentPlayer();
}

function requestReset() {
    if (MP.on && !isHost()) { showToast('Only the host can reset the game'); return; }
    if (!window.confirm('Reset the game? The Market Tracker goes back to ' + APP_STATE.settings.market + ' and every player goes back to Tile 0 (Start) with the starting cash and shares.')) return;
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
        G.seenPhase = APP_STATE.phaseSeq; G.seenFinal = APP_STATE.finalSeq; G.seenOver = APP_STATE.gameOver ? APP_STATE.gameOver.seq : 0;
        G.seenEffect = APP_STATE.lastEffect ? APP_STATE.lastEffect.seq : 0; G.seenTrade = APP_STATE.lastTrade ? APP_STATE.lastTrade.seq : 0;
        G.diceReady = true; G.rollPending = G.acceptPending = false;
        Dice.show(APP_STATE.pending || (r ? r.n : 1));
        syncCard(true);
    } else {
        syncCard(false);
        if (r && r.seq > G.seenRoll) { G.seenRoll = r.seq; startDiceRoll(r); }
        if (m && m.seq > G.seenMove) { G.seenMove = m.seq; startPawnMove(m); }
        const ef = APP_STATE.lastEffect, tr = APP_STATE.lastTrade;
        if (ef && ef.seq > G.seenEffect) { G.seenEffect = ef.seq; announceEffect(ef); FX.market(ef); }
        if (tr && tr.seq > G.seenTrade) { G.seenTrade = tr.seq; announceTrade(tr); FX.trade(tr); }
        if (APP_STATE.phaseSeq > G.seenPhase) { G.seenPhase = APP_STATE.phaseSeq; bigPopup(...phasePopup()); }
        if (APP_STATE.finalSeq > G.seenFinal) { G.seenFinal = APP_STATE.finalSeq; bigPopup('\u{1F3C1}', 'FINAL ROUND', playerName(APP_STATE.finalBy) + ' reached the finish. Everyone else gets one last turn.', 'final'); }
        if (APP_STATE.gameOver && APP_STATE.gameOver.seq > G.seenOver) { G.seenOver = APP_STATE.gameOver.seq; showResults(); }
    }
    updateTurnUI();
}

const playerName = id => { const p = APP_STATE.players.find(x => x.id === id); return p ? p.name : 'Someone'; };

// Big pop-up for a new phase or a sudden change of the forecast: [emoji, title, sub, kind].
function phasePopup() {
    const k = APP_STATE.marketPhase, ph = PHASES[k] || PHASES.neutral, n = APP_STATE.phaseNote;
    const note = ' This is a forecast, not a promise: markets can turn suddenly.';
    if (n === 'reverse') return [ph.emoji, 'SUDDEN CHANGE', 'The forecast has reversed: the market now looks set to ' + (k === 'bull' ? 'rise (BULL)' : 'fall (BEAR)') + '.', k];
    if (n === 'calm') return [ph.emoji, 'SUDDEN CHANGE', 'The market has calmed down. The forecast adds no more movement.', k];
    if (n === 'swing') return [ph.emoji, 'SUDDEN CHANGE', 'The calm is over. ' + ph.text + '.', k];
    return [ph.emoji, ph.text, ph.rule + '.' + note, k];
}

function announceEffect(ef) {
    if (ef.kind === 'phase') { showToast('Forecast step (' + ef.text + '): Market Tracker ' + ef.before + ' \u2192 ' + ef.after + ' (' + (ef.delta > 0 ? '+' : '') + ef.delta + ')', true); return; }
    if (ef.kind === 'reset') { showToast('Game reset: Market Tracker ' + ef.after + ', everyone back on Tile 0 (Start)', true); return; }
    const d = ef.delta ? (ef.delta > 0 ? '+' + ef.delta : String(ef.delta)) : 'no change';
    const sg = n => (n > 0 ? '+' : '') + n;
    if (ef.bonus) { const tb = ef.delta - ef.bonus; showToast(playerName(ef.by) + ' landed on ' + ef.text + ': Tile ' + sg(tb) + ' + ' + (ef.bonus > 0 ? 'Bull' : 'Bear') + ' Forecast ' + sg(ef.bonus) + ' = Total ' + sg(ef.delta) + '. Share price ' + ef.before + ' \u2192 ' + ef.after, true); return; }
    showToast(playerName(ef.by) + ' landed on ' + ef.text + ': Share price ' + ef.before + ' \u2192 ' + ef.after + ' (' + d + ')', true);
}

function announceTrade(tr) {
    if (tr.kind === 'buy') Sound.buy(); else Sound.sell();
    showToast(playerName(tr.by) + (tr.kind === 'buy' ? ' bought ' : ' sold ') + tr.qty + ' share' + (tr.qty > 1 ? 's' : '') + ' at ' + money(tr.price) + ' each (' + money(tr.qty * tr.price) + ')', true);
}

function startDiceRoll(r) {
    G.rollPending = false; G.diceReady = false;
    { const t = $('toast'); if (t) t.classList.add('hidden'); }
    Dice.roll(r.n, () => { G.diceReady = true; updateTurnUI(); });
}

function startPawnMove(m) {
    G.acceptPending = false;
    stopAnim();
    if (!APP_STATE.players.some(p => p.id === m.by) || m.to <= m.from) return;
    const steps = m.to - m.from, t0 = performance.now(), SM = stepMsFor(steps);
    let lastK = -1;
    APP_STATE.anim = { id: m.by, pos: m.from, lift: 0, count: 0 };
    // Time-based (not frame-based) so it also completes correctly in background tabs.
    G.animTimer = setInterval(() => {
        const elapsed = performance.now() - t0;
        if (elapsed >= steps * SM) { stopAnim(); Sound.arrive(); updateTurnUI(); Lens.autoDone(m.to); setTimeout(() => showToast(playerName(m.by) + ' landed on Tile ' + m.to + '. Share price is now ' + money(marketValue())), 700); return; }
        const k = Math.floor(elapsed / SM), f = (elapsed - k * SM) / SM;
        const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        const a = APP_STATE.anim;
        a.pos = m.from + k + ease; a.lift = Math.sin(Math.PI * f); a.count = k + 1;
        if (k !== lastK) { lastK = k; Sound.step(k); renderPlayersList(); }
        renderPawnLayer();
        Lens.autoFollow(a.pos);
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

    Dice.setSides(diceSides());
    $('diceBtn').disabled = !(mine && phase === 'roll' && !G.rollPending && !Dice.rolling);

    let msg;
    const steps = APP_STATE.pending || 0, rolledTxt = steps ? String(steps) : '';
    if (phase === 'over') msg = 'Game over';
    else if (phase === 'roll') msg = mine ? (own ? 'Your turn! Tap the dice' : `${cur.name}: tap the dice`) : `${cur.name} is about to roll...`;
    else if (phase === 'accept') msg = !G.diceReady ? 'Rolling...' : (own ? `You rolled ${rolledTxt}!` : `${cur.name} rolled ${rolledTxt}`);
    else if (phase === 'card') msg = mine ? `${cur.name}: Event Card Tile! Tap the Event Card Deck` : `${cur.name} is drawing an Event Card`;
    else if (phase === 'cardShow') msg = mine ? `${cur.name}: read the card, then Accept Event` : `${cur.name} is reading an Event Card`;
    else if (phase === 'trade') msg = own || (mine && !online) ? `${cur.name}: buy/sell, then End turn` : `${cur.name} is at the bank`;
    else msg = `${cur.name} is moving...`;
    $('diceStatus').textContent = msg;

    const ab = $('acceptBtn');
    ab.classList.toggle('hidden', !(mine && phase === 'accept' && G.diceReady));
    ab.disabled = G.acceptPending;
    ab.textContent = `Accept: move ${steps || ''}`;

    $('diceDock').classList.toggle('yourturn', mine && phase !== 'moving');

    const banner = $('turnBanner');
    banner.style.setProperty('--pc', color);
    banner.classList.toggle('mine', own);
    banner.innerHTML = `<span class="banner-avatar">${avatarEmoji(cur.avatar)}</span><span>${phase === 'over' ? 'Game over' : (mine ? escapeHtml(cur.name) + (own ? ' (you)' : '') + ' — Your turn: ' + ({ roll: 'roll the dice', accept: 'accept the move', moving: 'moving…', card: 'draw a card', trade: 'buy, sell or end turn' }[phase] || 'play') : escapeHtml(cur.name) + "'s turn")}</span>`;

    if (own && !G.prevMine) Sound.chime();
    G.prevMine = own;
    document.title = own ? '\u{1F3B2} Your turn - Capital Clash' : 'Capital Clash';

    // Trading and ending the turn belong to the player whose turn it is, after the move.
    const hold = phase === 'trade' && APP_STATE.holdBy === cur.id;
    const trading = mine && phase === 'trade' && !hold;
    const ending = mine && phase === 'trade';
    document.querySelectorAll('.bank-btn').forEach(b => { b.disabled = !trading; b.classList.toggle('locked', !trading); });
    const eb = $('endBtn'); eb.classList.toggle('hidden', !ending);
    const lm = APP_STATE.lastMove, ekey = APP_STATE.currentPlayerIndex + '|' + (lm ? lm.seq : 0);
    if (ending) {
        if (G.endKey !== ekey) { // a new trading step: start the 5 second wait
            G.endKey = ekey; G.endLockUntil = performance.now() + (typeof window.__endLockMs === "number" ? window.__endLockMs : END_LOCK_MS); G.endTradeSeq = APP_STATE.lastTrade ? APP_STATE.lastTrade.seq : 0;
            clearInterval(G.endTick); G.endTick = setInterval(() => { refreshEnd(); if (!endLocked()) clearInterval(G.endTick); }, 250);
        }
    } else { G.endKey = ''; clearInterval(G.endTick); }
    G.focusMine = mine;
    refreshEnd();
    $('bankHint').textContent = hold ? 'Mandatory Hold: no buying or selling until the next turn' : trading ? 'Buy or sell, then press End turn' : (phase === 'trade' ? cur.name + ' is at the bank' : 'Opens after you move');
    const rb = $('resetTrackerBtn'); if (rb) rb.classList.toggle('opacity-50', MP.on && !isHost());

    if (!trading) closeTrade(); else if (!$('tradeModal').classList.contains('hidden')) renderTrade();
    renderPhaseBar(); renderDeck();
    if (!APP_STATE.gameOver) closeResults();
    updateFocus(mine, phase);
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
    $('walletMarket').textContent = money(mv);
    const keepScroll = box.scrollTop;
    box.innerHTML = '';
    rankOrder().forEach((idx, place) => {
        const p = APP_STATE.players[idx];
        const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
        const turn = idx === APP_STATE.currentPlayerIndex && isGameActive();
        const isMe = MP.on && p.id === MP.id;
        const offline = MP.on && MP.phase === 'playing' && !isPresent(p);
        const a = APP_STATE.anim && APP_STATE.anim.id === p.id ? APP_STATE.anim : null;
        const shownPos = a ? Math.max(1, Math.floor(a.pos + 0.5)) : p.position; // counts up while the avatar hops
        const row = document.createElement('div');
        row.className = 'wallet-row player-row' + (turn ? ' turn turn-glow' : '') + (offline ? ' offline' : '');
        row.style.setProperty('--pc', color);
        row.dataset.idx = idx;
        row.innerHTML = `<div class="wallet-top">
                <span class="rank-badge r${place + 1}" title="Rank by portfolio">#${place + 1}</span>
                <span class="avatar-chip" style="--pc:${color}">${avatarEmoji(p.avatar)}</span>
                <span class="wallet-name">${escapeHtml(p.name)}${isMe ? '<small style="color:#86f0b4">(you)</small>' : ''}${p.bot ? '<small style="color:#ffd54a">(test)</small>' : ''}${offline ? '<small style="color:#ff9b9b">(offline)</small>' : ''}</span>
                <span class="wallet-space">${shownPos ? 'Tile ' + shownPos : 'Start'}</span>
            </div>
            <div class="wallet-cells">
                <span class="wallet-cell sh" data-label="Shares">${fmtNum(p.shares)}</span>
                <span class="wallet-cell mo" data-label="Cash">${money(p.money)}</span>
                <span class="wallet-cell to" data-label="Total">${money(p.money + p.shares * mv)}</span>
            </div>`;
        box.appendChild(row);
    });
    box.scrollTop = keepScroll;
    const cur = box.querySelector(`[data-idx="${APP_STATE.currentPlayerIndex}"]`);
    if (cur && isGameActive() && G.lastScrolled !== APP_STATE.currentPlayerIndex) { // bring the active player into view
        G.lastScrolled = APP_STATE.currentPlayerIndex;
        if (cur.offsetTop < box.scrollTop || cur.offsetTop + cur.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = cur.offsetTop - 4;
    }
}

/* ---------- Focus glow + turn popup ----------
   ONE table says which control glows in which phase. Every new feature that needs the player's attention
   adds its element ids here (and, if it should be taught, a step in js/guide.js). */
const FOCUS = { roll: ['diceScene'], accept: ['acceptBtn'], card: ['cardSlot'], trade: ['bankCard', 'endBtn'] };
const FOCUS_ALL = ['diceScene', 'acceptBtn', 'cardSlot', 'bankCard', 'endBtn'];

// After the move the End turn button waits 5 seconds (the Bank glows meanwhile) so nobody ends the turn by mistake before
// using the bank. Buying or selling unlocks it at once. When it unlocks, End turn glows instead of the Bank.
const END_LOCK_MS = 5000;
function endLocked() { return !!G.endKey && APP_STATE.holdBy !== (curPlayer() || {}).id && performance.now() < G.endLockUntil && !(APP_STATE.lastTrade && APP_STATE.lastTrade.seq > G.endTradeSeq); }
function refreshEnd() {
    const eb = $('endBtn'); if (!eb || eb.classList.contains('hidden')) return;
    const lock = endLocked(), left = Math.max(1, Math.ceil((G.endLockUntil - performance.now()) / 1000));
    eb.disabled = !!G.endPending || lock;
    eb.textContent = lock ? 'End turn (' + left + ')' : 'End turn';
    updateFocus(G.focusMine, APP_STATE.turnPhase);
}

function updateFocus(mine, phase) {
    let on = mine && !(phase === 'accept' && !G.diceReady) ? (FOCUS[phase] || []) : [];
    if (phase === 'trade') on = on.filter(id => endLocked() ? id !== 'endBtn' : id !== 'bankCard');
    FOCUS_ALL.forEach(id => { const e = $(id); if (e) e.classList.toggle('focus-glow', on.includes(id)); });
}

// What every screen shows when a new step of the game starts.
function showTurnPopup() {
    $('turnPopup').classList.remove('show');
    clearTimeout(G.popTimer);
}

/* ---------- Bank: buy / sell window ---------- */

const TRADE = { kind: 'buy' };

function bankAction(kind) {
    Sound.unlock();
    const cur = curPlayer();
    if (!cur || !(isMyTurn() && APP_STATE.turnPhase === 'trade')) { showToast('The Bank opens for you after you move'); return; }
    if (APP_STATE.holdBy === cur.id) { showToast('Mandatory Hold: no buying or selling until your next turn'); return; }
    if (usedCardThisTurn(cur)) { showToast('You used an Event Card this turn: The Bank is closed until your next turn'); return; }
    const b = document.querySelector('.bank-btn.enter');
    if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 160); }
    TRADE.kind = kind;
    // Pop-up window on top of The Bank; it closes by itself after the trade.
    const panel = $('tradeModal'), bank = $('bankCard');
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    panel.classList.remove('bank-inline'); panel.classList.add('bank-pop');
    const r = bank.getBoundingClientRect(), card = panel.querySelector('.trade-card');
    const w = Math.min(310, window.innerWidth - 16);
    card.style.width = w + 'px';
    card.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    $('tradeModal').classList.remove('hidden');
    // Sit about 35% higher than The Bank and always fully on screen.
    const h = card.offsetHeight || 380;
    card.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, r.top - window.innerHeight * 0.35 + 20)) + 'px';
    setTradeKind(kind);
    setTimeout(() => { try { $('tradeQty').focus(); $('tradeQty').select(); } catch (_) {} }, 30);
}

function setTradeKind(kind) {
    TRADE.kind = kind === 'sell' ? 'sell' : 'buy';
    $('tradeModal').dataset.kind = TRADE.kind;
    $('tabBuy').classList.toggle('on', TRADE.kind === 'buy'); $('tabSell').classList.toggle('on', TRADE.kind === 'sell');
    $('tabBuy').setAttribute('aria-selected', TRADE.kind === 'buy'); $('tabSell').setAttribute('aria-selected', TRADE.kind === 'sell');
    $('tradeQty').value = 1; renderTrade();
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
    $('tradePrice').textContent = money(price);
    $('tradeMoney').textContent = money(cur.money); $('tradeShares').textContent = fmtNum(cur.shares);
    $('tradeTotal').textContent = money(total);
    $('tradeAfterMoney').textContent = money(cur.money + (buy ? -total : total));
    $('tradeAfterShares').textContent = fmtNum(cur.shares + (buy ? q : -q));
    let err = '';
    if (q < 1) err = 'Enter how many shares';
    else if (buy && total > cur.money) err = 'Not enough cash (you can afford ' + tradeMax() + ')';
    else if (!buy && q > cur.shares) err = 'You only have ' + cur.shares + ' shares';
    $('tradeErr').textContent = err;
    $('tradeOk').disabled = !!err;
    $('tradeOk').textContent = (buy ? 'Buy ' : 'Sell ') + (q > 0 ? q + ' share' + (q > 1 ? 's' : '') : '');
}

function closeTrade() { $('tradeModal').classList.add('hidden'); }

function confirmTrade() {
    const q = parseInt($('tradeQty').value, 10) || 0;
    if ($('tradeOk').disabled || q < 1) return;
    const cur = curPlayer(); if (!cur) return;
    if (MP.on && !isHost()) { closeTrade(); MP.t.send('trade', { from: MP.id, kind: TRADE.kind, qty: q }); return; }
    if (authTrade(cur.id, TRADE.kind, q)) closeTrade();
    else { renderTrade(); $('tradeErr').textContent ||= 'Trade unavailable. Check your turn and available cash or shares.'; }
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

/* ---------- Big popup (market phase, final round), phase bar, results ---------- */

function bigPopup(emoji, title, sub, kind) {
    const el = $('bigPopup');
    el.className = 'big-popup ' + (kind || '');
    el.innerHTML = `<div class="bp-emoji">${emoji}</div><div class="bp-title">${escapeHtml(title)}</div><div class="bp-sub">${escapeHtml(sub || '')}</div>`;
    void el.offsetWidth; el.classList.add('show');
    clearTimeout(G.bigTimer); G.bigTimer = setTimeout(() => el.classList.remove('show'), 5000);
    if (title) showToast(emoji + ' ' + title + (sub ? ': ' + sub : ''), true);
}

// Strip above the board: market phase, game mode, final round.
function renderPhaseBar() {
    const bar = $('phaseBar'); if (!bar) return;
    const ph = PHASES[APP_STATE.marketPhase] || PHASES.neutral, m = modeCfg();
    bar.className = 'phase-bar ' + APP_STATE.marketPhase;
    const sc = $('statusCard'); if (sc) sc.className = 'status-card no-print ' + APP_STATE.marketPhase;
    bar.innerHTML = `<span class="pb-main"><span class="pb-emoji">${ph.emoji}</span><b>${ph.label} forecast</b><small>${ph.rule}</small></span>
        <span class="pb-side">${APP_STATE.finalBy ? '<span class="pb-chip final">\u{1F3C1} Final round</span>' : ''}${APP_STATE.gameOver ? '<button type="button" class="pb-chip btn" onclick="showResults()">Results</button>' : ''}</span>`;
    const tb = $('toolsBox');
    if (tb) tb.innerHTML = `<button id="btnLens" type="button" class="lens-btn${Lens.isOn() ? ' active' : ''}" aria-pressed="${Lens.isOn()}" title="Magnifier: move your finger or mouse over the board to read it bigger"><i class="fa-solid fa-magnifying-glass-plus"></i> Magnifier</button><span class="tools-mode">${m.label} \u00B7 ${m.tag}</span>`;
}

function showResults() {
    const r = APP_STATE.gameOver; if (!r) return;
    const top = r.ranking[0] ? r.ranking[0].total : 0;
    const winners = r.ranking.filter(x => x.total === top);
    $('overTitle').textContent = winners.length > 1 ? 'It is a tie!' : 'We have a winner!';
    $('overSub').textContent = winners.map(w => w.name).join(' & ') + (winners.length > 1 ? ' share' : ' wins') + ' with a portfolio of ' + money(top);
    $('overRows').innerHTML = r.ranking.map((x, i) => `<div class="over-row${x.total === top ? ' win' : ''}"><span class="o-rank">${x.total === top ? '\u{1F3C6}' : '#' + (i + 1)}</span><span class="o-av">${avatarEmoji(x.avatar)}</span><span class="o-name">${escapeHtml(x.name)}</span><span class="o-tot">${money(x.total)}<small>${fmtNum(x.shares)} shares + ${money(x.money)} cash</small></span></div>`).join('');
    $('overAgain').classList.toggle('hidden', MP.on && !isHost());
    if (typeof Stats !== 'undefined') $('overStats').innerHTML = Stats.recapHtml(r) + feedbackHtml();
    else $('overStats').innerHTML = feedbackHtml();
    FB_RATING = 0;
    $('overModal').classList.remove('hidden');
    Sound.chime();
}
function closeResults() { $('overModal').classList.add('hidden'); }
function playAgain() { if (MP.on && !isHost()) { leaveRoom(); return; } closeResults(); authReset(); }

// Host: take a player out of the game (all other players voted because their turn took too long).
function authRemovePlayer(id) {
    if (MP.on && !isHost()) return false;
    const ps = APP_STATE.players, i = ps.findIndex(p => p.id === id);
    if (i < 0) return false;
    if (ps.length <= 2) { if (i === APP_STATE.currentPlayerIndex) authSkipTurn(); showToast('Too few players left to remove one: turn skipped'); return false; }
    clearTimeout(G.finishTimer); stopAnim();
    const ci = APP_STATE.currentPlayerIndex;
    ps.splice(i, 1);
    APP_STATE.activePlayersCount = ps.length;
    if (i === ci) { APP_STATE.turnPhase = 'roll'; APP_STATE.pending = null; APP_STATE.currentPlayerIndex = ci % ps.length; }
    else if (i < ci) APP_STATE.currentPlayerIndex = ci - 1;
    if (APP_STATE.holdBy === id) APP_STATE.holdBy = '';
    drawBoard(); publish(); watchCurrentPlayer();
    return true;
}

function toggleMenu() {
    const bar = $('menuBar'); bar.classList.toggle('hidden');
    $('menuBtn').setAttribute('aria-expanded', String(!bar.classList.contains('hidden')));
}

/* ---------- End-game feedback (saved to the backend through the host page) ---------- */
function feedbackHtml() {
    setTimeout(loadFbQuestions, 0);
    return `<div class="fb-box" id="fbBox"><b>Tell us what you think</b> <small>(only you see your answers)</small>
    <div id="fbQs"><p class="over-sub">Loading questions...</p></div>
    <label for="fbNotes">Anything else you want to tell us?</label><textarea id="fbNotes" rows="3" maxlength="2000"></textarea>
    <div class="trade-actions"><button type="button" class="ok" onclick="fbSend()">Send feedback</button></div><p id="fbMsg" class="over-sub"></p></div>`;
}
let FB_QS = [], FB_RATING = 0;
const FB_URL = 'https://scnnmkroadvzhjspxqtv.supabase.co/rest/v1/', FB_KEY = 'sb_publishable_Jfm4wTvO40J1WL3scYPznQ_o8NmfwA-';
const FB_H = { apikey: FB_KEY, 'Content-Type': 'application/json' };
const FB_DEFAULT = [
    ['game', 'How did the speed of the game feel?', ['Too slow', 'Just right', 'Too fast']],
    ['game', 'Were the Tiles on the Space Board easy to read?', ['Very clear', 'Mostly clear', 'Hard to read']],
    ['game', 'How easy was buying and selling at The Bank?', ['Easy', 'OK', 'Confusing']],
    ['game', 'How did the Event Cards feel?', ['Exciting', 'Balanced', 'Too punishing']],
    ['game', 'Would you play Capital Clash again?', ['Definitely', 'Maybe', 'Probably not']],
    ['learning', 'Did the Bull / Bear forecast help you decide when to trade?', ['Yes, a lot', 'Sometimes', 'I did not use it']],
    ['learning', 'What was your main strategy?', ['Mostly cash', 'A balanced mix', 'Mostly shares']],
    ['learning', 'Did you learn to keep a cash and share buffer for surprises?', ['Yes, always', 'I learned the hard way', 'Not really']],
    ['learning', 'Did you manage to buy low and sell high?', ['Yes, often', 'A few times', 'No, I bought high']],
    ['learning', 'Did the game help you feel how the market moves?', ['Strongly agree', 'Somewhat', 'Not yet']]
].map(([section, question, options], i) => ({ id: 'q' + (i + 1), section, question, options }));
const fbHosted = () => { try { return window.parent !== window; } catch (_) { return true; } };
let FB_GOT = false;
function loadFbQuestions() {
    FB_GOT = false;
    if (!FB_QS.length) { FB_QS = FB_DEFAULT; renderFbQuestions(); }   // show at once, replace with the owner's list when it arrives
    if (fbHosted()) { try { parent.postMessage({ type: 'capital-questions' }, '*'); } catch (_) {} return; }
    fetch(FB_URL + 'feedback_questions?select=id,section,question,options&active=eq.true&order=position&limit=10', { headers: FB_H })
        .then(r => r.ok ? r.json() : []).then(q => { if (Array.isArray(q) && q.length) { FB_QS = q; FB_GOT = true; renderFbQuestions(); } }).catch(() => {});
}
function fbSaveDirect(data) {
    const answers = {}; FB_QS.forEach(q => { if (data.answers[q.id] != null) answers[FB_GOT || !/^q\d+$/.test(q.id) ? q.id : q.question] = data.answers[q.id]; });
    fetch(FB_URL + 'feedback_responses', { method: 'POST', headers: { ...FB_H, Prefer: 'return=minimal' }, body: JSON.stringify({ answers, notes: data.notes || null, player_name: data.playerName || null, game_mode: data.gameMode || null }) })
        .then(r => { const m = $('fbMsg'); if (m) m.textContent = r.ok ? 'Thank you! Your feedback is saved.' : 'Sorry, saving failed. Please try again.'; })
        .catch(() => { const m = $('fbMsg'); if (m) m.textContent = 'Sorry, saving failed. Please try again.'; });
}
function renderFbQuestions() {
    const box = $('fbQs'); if (!box) return;
    const sec = { game: 'The game', learning: 'What you learned' };
    let last = '';
    box.innerHTML = FB_QS.map((q, i) => {
        const head = q.section !== last ? `<div class="fb-sec">${sec[q.section] || escapeHtml(q.section)}</div>` : ''; last = q.section;
        return head + `<div class="fb-q"><b>${i + 1}. ${escapeHtml(q.question)}</b><div class="fb-opts">${(q.options || []).map(o => `<label><input type="radio" name="fbq_${q.id}" value="${escapeHtml(o)}"><span>${escapeHtml(o)}</span></label>`).join('')}</div></div>`;
    }).join('') || '';
}
function fbSend() {
    const me = APP_STATE.players.find(p => p.id === MP.id) || curPlayer();
    const answers = {};
    FB_QS.forEach(q => { const c = document.querySelector(`input[name="fbq_${q.id}"]:checked`); if (c) answers[q.id] = c.value; });
    const data = { answers, notes: $('fbNotes').value.trim(), playerName: me ? String(me.name).slice(0, 40) : '', gameMode: String(APP_STATE.gameMode || '').slice(0, 40) };
    if (!Object.keys(answers).length && !data.notes) { $('fbMsg').textContent = 'Please answer a question or write a note first.'; return; }
    $('fbMsg').textContent = 'Sending...';
    if (!fbHosted()) { fbSaveDirect(data); return; }
    // Built-in questions have no server id: send them by their text so the answers stay readable.
    if (FB_QS === FB_DEFAULT) { const a = {}; FB_QS.forEach(q => { if (answers[q.id]) a[q.question] = answers[q.id]; }); data.answers = a; }
    try { parent.postMessage({ type: 'capital-feedback', data }, '*'); } catch (_) { $('fbMsg').textContent = 'Could not send feedback here.'; }
}
window.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'capital-questions-result') return;
    const q = Array.isArray(e.data.questions) ? e.data.questions.slice(0, 10) : []; if (q.length) { FB_QS = q; FB_GOT = true; renderFbQuestions(); }
});
window.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'capital-feedback-result') return;
    const m = $('fbMsg'); if (m) m.textContent = e.data.ok ? 'Thank you! Your feedback is saved.' : 'Sorry, saving failed. Please try again.';
});

/* ---------- Font selector ---------- */
function setGameFont(f) { document.body.style.setProperty('--game-font', f); try { localStorage.setItem('cc_font', f); } catch (_) {} }
document.addEventListener('DOMContentLoaded', () => { try { const f = localStorage.getItem('cc_font'); if (f) { setGameFont(f); const s = $('fontPick'); if (s) s.value = f; } } catch (_) {} });

/* ---------- Tour Guide drop-down (How to play + Screen tour) ---------- */
function toggleTourMenu(e) { if (e) e.stopPropagation(); const m = $('tourMenu'), open = m.classList.toggle('hidden') === false; $('tourBtn').setAttribute('aria-expanded', String(open)); }
function closeTourMenu() { const m = $('tourMenu'); if (m) m.classList.add('hidden'); const b = $('tourBtn'); if (b) b.setAttribute('aria-expanded', 'false'); }
document.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('.tg-wrap')) closeTourMenu(); });

/* ---------- Report a bug (saved to the backend through the host page) ---------- */
function openBugReport() { closeTourMenu(); $('bugMsg').textContent = ''; $('bugText').value = ''; $('bugModal').classList.remove('hidden'); setTimeout(() => $('bugText').focus(), 30); }
function closeBugReport() { $('bugModal').classList.add('hidden'); }
function sendBugReport() {
    const text = $('bugText').value.trim();
    if (text.length < 5) { $('bugMsg').textContent = 'Please describe the problem (at least 5 letters).'; return; }
    const me = APP_STATE.players.find(p => p.id === MP.id) || curPlayer();
    $('bugMsg').textContent = 'Sending...';
    parent.postMessage({ type: 'capital-bug', data: { description: text.slice(0, 2000), playerName: me ? String(me.name).slice(0, 40) : '', gameMode: String(APP_STATE.gameMode || '').slice(0, 40), browser: navigator.userAgent.slice(0, 300) } }, '*');
}
window.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'capital-bug-result') return;
    $('bugMsg').textContent = e.data.ok ? 'Thank you! The bug report was sent.' : 'Sorry, sending failed. Please try again.';
    if (e.data.ok) setTimeout(closeBugReport, 1400);
});
