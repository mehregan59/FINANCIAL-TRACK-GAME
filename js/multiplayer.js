/* Capital Clash: rooms, presence, host handover and state sync. */

const MP = {
    on: false, code: '', id: '', name: '', hostId: '', phase: 'idle', expected: 0, // phase: idle | lobby | playing
    avatar: '', seq: 0, members: [], arrival: [], t: null, creatorJoin: false, gotState: false,
    hostTimer: null, skipTimer: null, joinTimer: null, trackerTimer: null, lastTrackerSend: 0, toastTimer: null
};

const isHost = () => MP.on && MP.hostId === MP.id;

function myMeta() { return { id: MP.id, name: MP.name, creator: MP.creatorJoin && MP.hostId === MP.id, expected: MP.expected, avatar: MP.avatar }; }

function resetMP() {
    try { MP.t && MP.t.leave(); } catch (_) {}
    ['hostTimer', 'skipTimer', 'joinTimer', 'trackerTimer'].forEach(k => { clearTimeout(MP[k]); MP[k] = null; });
    Object.assign(MP, { on: false, t: null, phase: 'idle', hostId: '', avatar: '', members: [], arrival: [] });
}

const memberName = id => { const m = MP.members.find(x => x.id === id); return m ? m.name : ''; };

function orderedMembers() {
    const rank = id => { const i = MP.arrival.indexOf(id); return i < 0 ? 999 : i; };
    return [...MP.members].sort((a, b) => (a.id === MP.hostId ? -1 : b.id === MP.hostId ? 1 : rank(a.id) - rank(b.id)));
}

/* ---------- Avatars (unique within a room) ---------- */

function setMyAvatar(id, announce) {
    MP.avatar = id;
    const me = MP.members.find(m => m.id === MP.id);
    if (me) me.avatar = id; // optimistic: show it before the server echoes it back
    try { MP.t.updateMeta(myMeta()); } catch (_) {}
    if (announce) showToast('Someone picked your avatar first, so you got a new one');
}

// Everyone runs the same rule: if two people hold the same avatar, the one with the lower id keeps it.
function resolveAvatarConflicts() {
    if (MP.phase !== 'lobby' || !MP.admitted) return;
    if (!MP.members.some(m => m.id === MP.id)) return;
    const others = MP.members.filter(m => m.id !== MP.id);
    const clash = !!MP.avatar && others.some(o => o.avatar === MP.avatar && o.id < MP.id);
    if (MP.avatar && !clash) return;
    const used = new Set(others.map(o => o.avatar).filter(Boolean));
    const free = AVATARS.find(a => !used.has(a.id));
    if (free) setMyAvatar(free.id, clash);
}

/* ---------- Presence and host tracking ---------- */

function onMpPresence(list) {
    if (!MP.on) return;
    const prev = new Set(MP.members.map(m => m.id));
    MP.members = list.filter(m => m && m.id).map(m => ({
        id: String(m.id), name: cleanName(m.name) || 'Investor', creator: !!m.creator,
        expected: clampExpected(m.expected), avatar: isAvatarId(m.avatar) ? m.avatar : ''
    }));
    if (!MP.expected) { const k = MP.members.find(m => m.expected); if (k) MP.expected = k.expected; }
    MP.members.forEach(m => { if (!MP.arrival.includes(m.id)) MP.arrival.push(m.id); });

    if (!MP.hostId) { const c = MP.members.find(m => m.creator); if (c) { MP.hostId = c.id; clearTimeout(MP.joinTimer); } }

    // First presence update that includes us = we are admitted; unblocks the one-time capacity check in enterRoom().
    if (!MP.admitted && MP.members.some(m => m.id === MP.id)) { MP.admitted = true; if (MP.admitResolve) MP.admitResolve(); }
    // New arrival while a game is running: host re-sends the full state.
    if (isHost() && MP.phase === 'playing' && MP.members.some(m => !prev.has(m.id) && m.id !== MP.id)) setTimeout(broadcastState, 250);

    resolveAvatarConflicts();
    watchHost();
    watchCurrentPlayer();
    if (MP.phase === 'playing') updateTurnUI(); else renderLobby();
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
        if (MP.phase === 'playing') { resumeAfterTakeover(); updateTurnUI(); watchCurrentPlayer(); } else renderLobby();
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
        authSkipTurn(); watchCurrentPlayer();
        showToast(c2.name + ' is offline: turn skipped');
    }, 8000);
}

function nextPlayerIndex(cur) {
    const ps = APP_STATE.players, n = ps.length;
    if (!MP.on) return (cur + 1) % n; // one-screen game: everyone is always present
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
        players: APP_STATE.players.map(p => ({ id: p.id, name: p.name, position: p.position, avatar: p.avatar })),
        currentPlayerIndex: APP_STATE.currentPlayerIndex,
        turnPhase: APP_STATE.turnPhase, pending: APP_STATE.pending, evtSeq: APP_STATE.evtSeq,
        lastRoll: APP_STATE.lastRoll, lastMove: APP_STATE.lastMove
    };
}

function broadcastState() { if (!MP.on || !MP.t) return; MP.seq++; MP.t.send('state', { from: MP.id, state: snapshot() }); }

function broadcastIfHost() { if (MP.on && isHost() && MP.phase === 'playing') broadcastState(); }

const int = (v, lo, hi) => { const n = parseInt(v, 10); return n >= lo && n <= hi ? n : null; };
function cleanRoll(r) {
    if (!r || typeof r !== 'object') return null;
    const n = int(r.n, 1, 6), seq = int(r.seq, 1, 1e9);
    return n && seq ? { n, by: String(r.by), seq } : null;
}
function cleanMove(m) {
    if (!m || typeof m !== 'object') return null;
    const from = int(m.from, 1, 100), to = int(m.to, 1, 100), seq = int(m.seq, 1, 1e9);
    return from && to && seq ? { by: String(m.by), from, to, seq } : null;
}

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
        APP_STATE.players = (s.players || []).slice(0, MAX_PLAYERS).map((p, i) => ({
            id: String(p.id), name: cleanName(p.name) || 'Investor', position: int(p.position, 1, 100) || 1,
            avatar: isAvatarId(p.avatar) ? p.avatar : AVATARS[i % AVATARS.length].id
        }));
        APP_STATE.activePlayersCount = APP_STATE.players.length;
        APP_STATE.currentPlayerIndex = Math.max(0, Math.min(APP_STATE.players.length - 1, parseInt(s.currentPlayerIndex, 10) || 0));
        APP_STATE.turnPhase = ['roll', 'accept', 'moving'].includes(s.turnPhase) ? s.turnPhase : 'roll';
        APP_STATE.pending = int(s.pending, 1, 6);
        APP_STATE.evtSeq = int(s.evtSeq, 0, 1e9) || 0;
        APP_STATE.lastRoll = cleanRoll(s.lastRoll);
        APP_STATE.lastMove = cleanMove(s.lastMove);
        paintModeButtons(APP_STATE.boardMode);
        const first = was !== 'playing';
        if (first) enterGameView();
        syncEffects(first);           // starts the dice / hop animation before the board is redrawn
        updateMarketTrackerUI(); renderEventsEditor(); drawBoard();
    } else if (!$('lobby').classList.contains('hidden')) renderLobby();
    applyRoleUI();
}

function onMpMessage(e, d) {
    if (!MP.on || !d) return;
    if (e === 'state') {
        const s = d.state;
        if (s && s.hostId === d.from && s.seq > MP.seq) { MP.seq = s.seq; applyState(s); }
    } else if (e === 'roll') {
        if (isHost() && MP.phase === 'playing') authRoll(String(d.from));
    } else if (e === 'accept') {
        if (isHost() && MP.phase === 'playing') authAccept(String(d.from));
    } else if (e === 'tracker') {
        if (MP.phase !== 'playing' || !trackerSenderAllowed(String(d.from)) || !Array.isArray(d.m) || !Array.isArray(d.r)) return;
        APP_STATE.marketTracker = [0, 1, 2].map(i => digit(d.m[i]));
        APP_STATE.ringRotations = [0, 1, 2].map(i => Number(d.r[i]) || 0);
        updateMarketTrackerUI(); drawBoard();
    }
}

/* ---------- Permissions ---------- */

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
