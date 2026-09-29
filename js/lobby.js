/* Capital Clash: landing page and lobby. */

function inviteLink() { return location.origin + location.pathname + '?room=' + MP.code; }

function copyInviteLink() {
    const url = inviteLink();
    const done = () => { showToast('Invite link copied'); const l = $('copyLinkLabel'); if (l) { l.textContent = 'Copied!'; setTimeout(() => l.textContent = 'Copy invite link', 1500); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
    else window.prompt('Copy this link:', url);
}

function mpInit() {
    const params = new URLSearchParams(location.search);
    const pre = cleanCode(params.get('room'));
    try { $('playerNameInput').value = localStorage.getItem('ftg_name') || ''; } catch (_) {}
    if (pre) $('roomCodeInput').value = pre;
    if (!usingSupabase()) {
        const n = $('transportNote');
        n.textContent = 'Test mode: rooms only work between tabs of this browser, because the online game server is not connected yet.';
        n.classList.remove('hidden');
    }
    $('landing').classList.remove('hidden');
    (pre ? $('playerNameInput') : $('playerNameInput')).focus();
}

function showLandingError(msg) { const e = $('landingError'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }

function setLandingBusy(b) { ['createRoomBtn', 'joinRoomBtn'].forEach(id => { $(id).disabled = b; $(id).classList.toggle('opacity-50', b); }); }

let EXPECTED_SETUP = 4;

function stepExpected(d) {
    EXPECTED_SETUP = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, EXPECTED_SETUP + d));
    $('expectedVal').textContent = EXPECTED_SETUP;
}

function playSolo() { $('landing').classList.add('hidden'); }

function readName() {
    const n = cleanName($('playerNameInput').value);
    if (!n) { showLandingError('Please enter your name first.'); $('playerNameInput').focus(); return ''; }
    try { localStorage.setItem('ftg_name', n); } catch (_) {}
    return n;
}

async function createRoom() { const n = readName(); if (n) await enterRoom(newRoomCode(), n, true, EXPECTED_SETUP); }

async function joinRoom() {
    const n = readName(); if (!n) return;
    const code = cleanCode($('roomCodeInput').value);
    if (code.length !== 5) { showLandingError('Room codes have 5 characters.'); return; }
    await enterRoom(code, n, false);
}

async function enterRoom(code, name, creator, expected) {
    showLandingError(''); setLandingBusy(true);
    Object.assign(MP, { on: true, code, name, id: getClientId(), hostId: creator ? getClientId() : '', phase: 'lobby', seq: 0,
        members: [], arrival: [], creatorJoin: creator, gotState: false, lastRollSeq: 0, rollPending: false, admitted: false,
        expected: creator ? expected : 0 });
    const admitWait = new Promise(res => { MP.admitResolve = res; setTimeout(res, 2500); });
    MP.t = makeTransport(code);
    MP.t.onMessage(onMpMessage);
    MP.t.onPresence(onMpPresence);
    try { await MP.t.join(myMeta()); }
    catch (err) { abortJoin(err.message || 'Could not join the room.'); return; }
    await admitWait;
    if (!MP.on) return;
    // One-time capacity check at the moment we join (never re-run, so existing players are not kicked out).
    const cap = MP.expected || MAX_PLAYERS;
    if (!creator && MP.members.filter(m => m.id !== MP.id).length >= cap) { abortJoin('This room is full (' + cap + ' players).'); return; }
    try { history.replaceState(null, '', location.pathname + '?room=' + code); } catch (_) {}
    $('landing').classList.add('hidden');
    showLobby();
    if (!creator) {
        MP.joinTimer = setTimeout(() => {
            if (MP.on && !MP.hostId && MP.phase === 'lobby') abortJoin('Room ' + code + ' was not found. Check the code, or ask the host to open the room first.');
        }, 6000);
    }
}

function abortJoin(msg) {
    resetMP(); setLandingBusy(false);
    $('lobby').classList.add('hidden'); $('landing').classList.remove('hidden');
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
    showLandingError(msg);
}

function leaveRoom() { resetMP(); location.href = location.pathname; }

function showLobby() { $('lobby').classList.remove('hidden'); renderLobby(); }

function renderLobby() {
    if (!MP.on) return;
    $('lobbyCode').textContent = MP.code;
    const N = MP.expected || MAX_PLAYERS;
    const list = $('lobbyList'); list.innerHTML = '';
    const ordered = orderedMembers();
    for (let i = 0; i < Math.max(N, ordered.length); i++) {
        const m = ordered[i], row = document.createElement('div');
        const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
        if (m) {
            row.className = 'flex items-center justify-between p-2 rounded-xl border bg-slate-900/50 border-slate-800';
            row.innerHTML = `<div class="flex items-center space-x-2"><span class="w-3 h-3 rounded-full" style="background-color:${color}"></span>
                <span class="font-bold text-slate-200 text-xs">${escapeHtml(m.name)}${m.id === MP.id ? ' <span class="text-emerald-400">(you)</span>' : ''}</span></div>
                <span class="text-[10px] font-bold text-amber-300">${m.id === MP.hostId ? 'HOST' : ''}</span>`;
        } else {
            row.className = 'flex items-center p-2 rounded-xl border border-dashed border-slate-700 text-slate-500';
            row.innerHTML = `<span class="w-3 h-3 rounded-full border border-slate-600 mr-2"></span><span class="text-xs">Waiting for player ${i + 1}...</span>`;
        }
        list.appendChild(row);
    }
    const n = ordered.length, full = n >= N && n >= MIN_PLAYERS;
    $('lobbyCount').textContent = `${n} of ${N} joined`;
    const btn = $('startGameBtn');
    btn.classList.toggle('hidden', !isHost());
    btn.disabled = !full;
    const early = $('startEarlyBtn');
    const canEarly = isHost() && n >= MIN_PLAYERS && n < N;
    early.classList.toggle('hidden', !canEarly);
    early.textContent = `Start now with ${n} players instead`;
    $('lobbyHint').textContent = isHost()
        ? (full ? 'Everyone is here. Start when you are ready.' : `Waiting for ${Math.max(N - n, 0)} more player${N - n === 1 ? '' : 's'}. Share the room code or invite link.`)
        : 'Waiting for the host to start the game...';
}

/* ---------- Presence, host tracking ---------- */

function enterGameView() {
    $('lobby').classList.add('hidden'); $('landing').classList.add('hidden');
    $('roomPill').classList.remove('hidden'); $('roomPillCode').textContent = MP.code;
    $('playerCountBlock').classList.add('hidden');
    if (!APP_STATE.players.some(p => p.id === MP.id)) showToast('This game already started: you are watching as a spectator');
    else showToast('Game on! ' + APP_STATE.players.length + ' investors at the start line');
}

function hostStartGame() {
    if (!isHost() || MP.phase !== 'lobby') return;
    const present = MP.arrival.filter(id => MP.members.some(m => m.id === id));
    const order = [MP.id, ...present.filter(id => id !== MP.id)].slice(0, MP.expected || MAX_PLAYERS);
    if (order.length < MIN_PLAYERS) { showToast(`You need at least ${MIN_PLAYERS} players to start`); return; }
    const used = {};
    APP_STATE.players = order.map((id, i) => {
        let name = memberName(id) || `Investor ${i + 1}`;
        used[name] = (used[name] || 0) + 1;
        if (used[name] > 1) name = `${name} ${used[name]}`;
        return { id, name, position: 1 };
    });
    APP_STATE.activePlayersCount = order.length;
    APP_STATE.currentPlayerIndex = 0; APP_STATE.lastRoll = null;
    APP_STATE.marketTracker = [0, 0, 0]; APP_STATE.ringRotations = [0, 0, 0];
    MP.phase = 'playing';
    broadcastState();
    updateMarketTrackerUI(); renderPlayersList(); drawBoard(); updateTurnUI();
    enterGameView(); applyRoleUI(); watchCurrentPlayer();
}

/* ---------- UI state ---------- */

