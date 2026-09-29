/* Capital Clash: rooms, presence, host handover and state sync. */

const MP = {
    on: false, code: '', id: '', name: '', hostId: '', phase: 'idle', expected: 0, // phase: idle | lobby | playing
    seq: 0, members: [], arrival: [], t: null, creatorJoin: false, gotState: false,
    lastRollSeq: 0, rollPending: false, hostTimer: null, skipTimer: null, joinTimer: null,
    diceTimer: null, trackerTimer: null, lastTrackerSend: 0, toastTimer: null
};

const isHost = () => MP.on && MP.hostId === MP.id;

function myMeta() { return { id: MP.id, name: MP.name, creator: MP.creatorJoin && MP.hostId === MP.id, expected: MP.expected }; }

function resetMP() {
    try { MP.t && MP.t.leave(); } catch (_) {}
    ['hostTimer', 'skipTimer', 'joinTimer', 'trackerTimer'].forEach(k => { clearTimeout(MP[k]); MP[k] = null; });
    Object.assign(MP, { on: false, t: null, phase: 'idle', hostId: '', members: [], arrival: [] });
}

const memberName = id => { const m = MP.members.find(x => x.id === id); return m ? m.name : ''; };

/* ---------- Landing page ---------- */

function orderedMembers() {
    const rank = id => { const i = MP.arrival.indexOf(id); return i < 0 ? 999 : i; };
    return [...MP.members].sort((a, b) => (a.id === MP.hostId ? -1 : b.id === MP.hostId ? 1 : rank(a.id) - rank(b.id)));
}

function onMpPresence(list) {
    if (!MP.on) return;
    const prev = new Set(MP.members.map(m => m.id));
    MP.members = list.filter(m => m && m.id).map(m => ({ id: String(m.id), name: cleanName(m.name) || 'Investor', creator: !!m.creator, expected: clampExpected(m.expected) }));
    if (!MP.expected) { const k = MP.members.find(m => m.expected); if (k) MP.expected = k.expected; }
    MP.members.forEach(m => { if (!MP.arrival.includes(m.id)) MP.arrival.push(m.id); });

    if (!MP.hostId) { const c = MP.members.find(m => m.creator); if (c) { MP.hostId = c.id; clearTimeout(MP.joinTimer); } }

    // First presence update that includes us = we are admitted; unblocks the one-time capacity check in enterRoom().
    if (!MP.admitted && MP.members.some(m => m.id === MP.id)) { MP.admitted = true; if (MP.admitResolve) MP.admitResolve(); }
    // New arrival while a game is running: host re-sends the full state.
    if (isHost() && MP.phase === 'playing' && MP.members.some(m => !prev.has(m.id) && m.id !== MP.id)) setTimeout(broadcastState, 250);

    watchHost();
    watchCurrentPlayer();
    if (MP.phase === 'playing') { renderPlayersList(); updateTurnUI(); } else renderLobby();
}

// If the host vanishes for 4s, the lowest-id remaining player takes over using their own copy of the state.
function watchHost() {
    const hostPresent = !MP.hostId || MP.members.some(m => m.id === MP.hostId);
    if (hostPresent) { clearTimeout(MP.hostTimer); MP.hostTimer = null; return; }
    if (MP.hostTimer) return; // countdown already running: presence updates must not restart it
    MP.hostTimer = setTimeout(() => {
        MP.hostTimer = null;
        if (!MP.on || MP.members.some(m => m.id === MP.hostId)) return;
        const candidate = MP.members.map(m => m.id).sort()[0];
        if (candidate !== MP.id) return;
        MP.hostId = MP.id; MP.creatorJoin = false;
        try { MP.t.updateMeta(myMeta()); } catch (_) {}
        showToast('The host left. You are now the host.');
        broadcastState(); applyRoleUI();
        if (MP.phase === 'playing') { renderPlayersList(); updateTurnUI(); watchCurrentPlayer(); } else renderLobby();
    }, 4000);
}

// Host skips a disconnected player's turn after 8s so the game never stalls.
function watchCurrentPlayer() {
    const cur = APP_STATE.players[APP_STATE.currentPlayerIndex];
    const needsSkip = isHost() && MP.phase === 'playing' && cur && cur.id !== MP.id && !MP.members.some(m => m.id === cur.id);
    if (!needsSkip) { clearTimeout(MP.skipTimer); MP.skipTimer = null; MP.skipFor = null; return; }
    if (MP.skipTimer && MP.skipFor === cur.id) return; // already counting down for this player
    clearTimeout(MP.skipTimer); MP.skipFor = cur.id;
    MP.skipTimer = setTimeout(() => {
        MP.skipTimer = null; MP.skipFor = null;
        const c2 = APP_STATE.players[APP_STATE.currentPlayerIndex];
        if (!isHost() || !c2 || c2.id !== cur.id || MP.members.some(m => m.id === c2.id)) return;
        APP_STATE.currentPlayerIndex = nextPlayerIndex(APP_STATE.currentPlayerIndex);
        broadcastState(); renderPlayersList(); updateTurnUI(); watchCurrentPlayer();
        showToast(c2.name + ' is offline: turn skipped');
    }, 8000);
}

function nextPlayerIndex(cur) {
    const ps = APP_STATE.players, n = ps.length;
    for (let k = 1; k <= n; k++) {
        const i = (cur + k) % n, p = ps[i];
        if (p.id === MP.id || MP.members.some(m => m.id === p.id)) return i;
    }
    return cur;
}

/* ---------- State sync ---------- */

function snapshot() {
    return {
        seq: MP.seq, hostId: MP.hostId, phase: MP.phase, expected: MP.expected, boardMode: APP_STATE.boardMode,
        marketTracker: [...APP_STATE.marketTracker], ringRotations: [...APP_STATE.ringRotations],
        eventPool: [...APP_STATE.eventPool], tiles: APP_STATE.tiles.map(t => t.text),
        players: APP_STATE.players.map(p => ({ id: p.id, name: p.name, position: p.position })),
        currentPlayerIndex: APP_STATE.currentPlayerIndex, roll: APP_STATE.lastRoll || null
    };
}

function broadcastState() { if (!MP.on || !MP.t) return; MP.seq++; MP.t.send('state', { from: MP.id, state: snapshot() }); }

function broadcastIfHost() { if (MP.on && isHost() && MP.phase === 'playing') broadcastState(); }

function applyState(s) {
    MP.gotState = true; clearTimeout(MP.joinTimer);
    MP.hostId = String(s.hostId || MP.hostId);
    if (clampExpected(s.expected)) MP.expected = clampExpected(s.expected);
    const was = MP.phase; MP.phase = s.phase === 'playing' ? 'playing' : 'lobby';
    if (MP.phase === 'playing') {
        APP_STATE.boardMode = s.boardMode === 'double' ? 'double' : 'single';
        APP_STATE.marketTracker = [0, 1, 2].map(i => digit(s.marketTracker && s.marketTracker[i]));
        APP_STATE.ringRotations = [0, 1, 2].map(i => Number(s.ringRotations && s.ringRotations[i]) || 0);
        APP_STATE.eventPool = (s.eventPool || []).slice(0, 60).map(t => String(t).slice(0, 80));
        if (!APP_STATE.eventPool.length) APP_STATE.eventPool = ['Reserve Vault'];
        APP_STATE.tiles = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, text: String((s.tiles || [])[i] || '').slice(0, 80) }));
        APP_STATE.players = (s.players || []).slice(0, MAX_PLAYERS).map(p => ({ id: String(p.id), name: cleanName(p.name) || 'Investor', position: Math.max(1, Math.min(100, parseInt(p.position, 10) || 1)) }));
        APP_STATE.activePlayersCount = APP_STATE.players.length;
        APP_STATE.currentPlayerIndex = Math.max(0, Math.min(APP_STATE.players.length - 1, parseInt(s.currentPlayerIndex, 10) || 0));
        paintModeButtons(APP_STATE.boardMode);
        MP.rollPending = false;
        updateMarketTrackerUI(); renderEventsEditor(); renderPlayersList(); drawBoard(); updateTurnUI();
        presentRoll(s.roll);
        if (was !== 'playing') enterGameView();
    } else if (!$('lobby').classList.contains('hidden')) renderLobby();
    applyRoleUI();
}

function onMpMessage(e, d) {
    if (!MP.on || !d) return;
    if (e === 'state') {
        const s = d.state;
        if (s && s.hostId === d.from && s.seq > MP.seq) { MP.seq = s.seq; applyState(s); }
    } else if (e === 'roll') {
        if (isHost() && MP.phase === 'playing') hostRoll(String(d.from));
    } else if (e === 'tracker') {
        if (MP.phase !== 'playing' || !trackerSenderAllowed(String(d.from)) || !Array.isArray(d.m) || !Array.isArray(d.r)) return;
        APP_STATE.marketTracker = [0, 1, 2].map(i => digit(d.m[i]));
        APP_STATE.ringRotations = [0, 1, 2].map(i => Number(d.r[i]) || 0);
        updateMarketTrackerUI(); drawBoard();
    }
}

/* ---------- Game actions ---------- */

function trackerSenderAllowed(from) {
    const cur = APP_STATE.players[APP_STATE.currentPlayerIndex];
    return from === MP.hostId || (!!cur && cur.id === from);
}

function canControlTracker() {
    if (!MP.on) return true;
    if (MP.phase !== 'playing') return false;
    return trackerSenderAllowed(MP.id);
}

function applyRoleUI() {
    const restrict = MP.on && !isHost();
    document.querySelectorAll('.host-only').forEach(el => el.classList.toggle('hidden', restrict));
    if (restrict && !$('editorTab').classList.contains('hidden')) switchTab('board');
    if (MP.on && MP.phase === 'playing') updateTurnUI();
}

window.addEventListener('pagehide', () => { try { MP.t && MP.t.leave(); } catch (_) {} });

/* ---------- Lobby ---------- */

