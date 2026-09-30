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

async function playSolo() { await Guide.ask(); $('landing').classList.add('hidden'); startSoloGame(); Guide.start(); }

function readName() {
    const n = cleanName($('playerNameInput').value);
    if (!n) { showLandingError('Please enter your name first.'); $('playerNameInput').focus(); return ''; }
    try { localStorage.setItem('ftg_name', n); } catch (_) {}
    return n;
}

// Landing page "Game settings": starting Market value, money and shares per player.
function readSettingsForm() {
    const s = cleanSettings({ market: $('setMarket').value, money: $('setMoney').value, shares: $('setShares').value, mode: $('setMode').value });
    $('setMarket').value = s.market; $('setMoney').value = s.money; $('setShares').value = s.shares;
    return s;
}
function resetSettingsForm() { $('setMarket').value = 500; $('setMoney').value = 5000; $('setShares').value = 5; $('setPreset').value = 'classic'; $('setSoloPlayers').value = 4; $('setMode').value = 'long'; }

// Event set chosen under Settings ('classic' keeps the board as it is).
const chosenPreset = () => { const p = $('setPreset') ? $('setPreset').value : 'classic'; return p === 'wallstreet' || p === 'crypto' ? p : 'classic'; };
function applyChosenPreset(p) { if (p && p !== 'classic') loadFinancialPreset(p); }
let SETUP_PRESET = 'classic';

// Back to the start page (leaves the room / resets the one-screen game).
function goHome() {
    const msg = MP.on ? 'Leave this game and go back to the start page? You can rejoin with the room code.' : 'Go back to the start page? The one-screen game will be reset.';
    if (window.confirm(msg)) leaveRoom();
}

async function createRoom() { const n = readName(); if (n) { await Guide.ask(); APP_STATE.settings = readSettingsForm(); SETUP_PRESET = chosenPreset(); await enterRoom(newRoomCode(), n, true, EXPECTED_SETUP); } }

async function joinRoom() {
    const n = readName(); if (!n) return;
    const code = cleanCode($('roomCodeInput').value);
    if (code.length !== 5) { showLandingError('Room codes have 5 characters.'); return; }
    await Guide.ask();
    await enterRoom(code, n, false);
}

async function enterRoom(code, name, creator, expected) {
    showLandingError(''); setLandingBusy(true);
    Object.assign(MP, { on: true, code, name, id: getClientId(), hostId: creator ? getClientId() : '', phase: 'lobby', seq: 0,
        members: [], arrival: [], creatorJoin: creator, gotState: false, admitted: false, avatar: '',
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
    if (MP.resumeState) { applyResume(); return; }
    if (MP.phase !== 'playing') showLobby(); // a running game may already have arrived while we waited
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
            row.innerHTML = `<div class="flex items-center space-x-2"><span class="avatar-chip" style="--pc:${color}">${m.avatar ? avatarEmoji(m.avatar) : ''}</span>
                <span class="font-bold text-slate-200 text-xs">${escapeHtml(m.name)}${m.id === MP.id ? ' <span class="text-emerald-400">(you)</span>' : ''}</span></div>
                <span class="text-[10px] font-bold text-amber-300">${m.id === MP.hostId ? 'HOST' : ''}</span>`;
        } else {
            row.className = 'flex items-center p-2 rounded-xl border border-dashed border-slate-700 text-slate-500';
            row.innerHTML = `<span class="avatar-chip" style="--pc:#334155"></span><span class="text-xs ml-2">Waiting for player ${i + 1}...</span>`;
        }
        list.appendChild(row);
    }
    const bots = TEST_BOTS && isHost() ? (MP.bots | 0) : 0; // TEST BOTS
    for (let b = 1; b <= bots; b++) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-2 rounded-xl border bg-amber-500/10 border-amber-500/30';
        row.innerHTML = `<div class="flex items-center space-x-2"><span class="avatar-chip">\u{1F916}</span><span class="font-bold text-slate-200 text-xs">Test Bot ${b}</span></div><span class="text-[10px] font-bold text-amber-300">TEST</span>`;
        list.appendChild(row);
    }
    const bb = $('botsBtn');
    if (bb) { bb.classList.toggle('hidden', !(TEST_BOTS && isHost())); bb.textContent = MP.bots ? 'Remove the 2 test players' : '+ Add 2 test players (temporary)'; }
    renderModeGrid();
    renderAvatarGrid();
    const n = ordered.length, full = (n >= N && n >= MIN_PLAYERS) || (bots > 0 && n + bots >= MIN_PLAYERS);
    $('lobbyCount').textContent = `${n} of ${N} joined`;
    const btn = $('startGameBtn');
    btn.classList.toggle('hidden', !isHost());
    btn.disabled = !full;
    const early = $('startEarlyBtn');
    const canEarly = isHost() && n >= MIN_PLAYERS && n < N && !bots;
    early.classList.toggle('hidden', !canEarly);
    early.textContent = `Start now with ${n} players instead`;
    $('lobbyHint').textContent = isHost()
        ? (full ? (bots ? 'Test players are ready. Start when you are ready.' : 'Everyone is here. Start when you are ready.') : `Waiting for ${Math.max(N - n, 0)} more player${N - n === 1 ? '' : 's'}. Share the room code or invite link.`)
        : 'Waiting for the host to start the game...';
}

// Game length: the host chooses (Short / Standard / Long / Beginner); the others see it when the game starts.
function renderModeGrid() {
    const grid = $('modeGrid'); if (!grid) return;
    const cur = APP_STATE.settings.mode, host = isHost();
    grid.innerHTML = '';
    MODE_IDS.forEach(id => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mode-btn' + (id === cur ? ' on' : ''); b.disabled = !host;
        b.innerHTML = `<b>${MODES[id].label}</b><small>${MODES[id].tag}${id === 'beginner' ? ' gentle' : ''}</small>`;
        b.onclick = () => { APP_STATE.settings = { ...APP_STATE.settings, mode: id }; renderModeGrid(); };
        grid.appendChild(b);
    });
    $('modeHint').textContent = (host ? MODES[cur].hint : 'Game length chosen by the host: ' + MODES[cur].hint) + '. ' + MODE_NOTE;
}

// Avatar picker: taken avatars are greyed out and show who has them.
function renderAvatarGrid() {
    const grid = $('avatarGrid'); if (!grid) return;
    grid.innerHTML = '';
    AVATARS.forEach(a => {
        const owner = MP.members.find(m => m.avatar === a.id && m.id !== MP.id);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'avatar-btn' + (MP.avatar === a.id ? ' mine' : '');
        b.textContent = a.emoji;
        b.disabled = !!owner;
        b.title = owner ? `${a.label} (taken by ${owner.name})` : a.label;
        b.setAttribute('aria-label', b.title);
        b.dataset.avatar = a.id;
        b.onclick = () => chooseAvatar(a.id);
        grid.appendChild(b);
    });
}

function chooseAvatar(id) {
    if (MP.phase !== 'lobby' || id === MP.avatar) return;
    if (MP.members.some(m => m.id !== MP.id && m.avatar === id)) { showToast('That avatar is already taken'); return; }
    setMyAvatar(id, false);
    renderLobby();
}

/* ---------- Presence, host tracking ---------- */

function enterGameView() {
    Guide.start();
    $('lobby').classList.add('hidden'); $('landing').classList.add('hidden');
    $('roomPill').classList.remove('hidden'); $('roomPillCode').textContent = MP.code;
    if (!APP_STATE.players.some(p => p.id === MP.id)) showToast('This game already started: you are watching as a spectator');
    else showToast('Game on! ' + APP_STATE.players.length + ' investors at the start line');
}

function hostStartGame() {
    if (!isHost() || MP.phase !== 'lobby') return;
    const present = MP.arrival.filter(id => MP.members.some(m => m.id === id));
    const order = [MP.id, ...present.filter(id => id !== MP.id)].slice(0, MP.expected || MAX_PLAYERS);
    const bots = TEST_BOTS ? Math.min(MP.bots | 0, MAX_PLAYERS - order.length) : 0; // TEST BOTS
    if (order.length + bots < MIN_PLAYERS) { showToast(`You need at least ${MIN_PLAYERS} players to start`); return; }
    // Keep the avatars people picked; hand out a free one to anyone without (or with a duplicate).
    const avatars = order.concat(Array(bots).fill('')).map(id => (MP.members.find(m => m.id === id) || {}).avatar || '');
    avatars.forEach((a, i) => { if (a && avatars.indexOf(a) !== i) avatars[i] = ''; });
    avatars.forEach((a, i) => { if (!a) avatars[i] = AVATARS.find(x => !avatars.includes(x.id)).id; });
    const used = {};
    APP_STATE.players = order.map((id, i) => {
        let name = memberName(id) || `Investor ${i + 1}`;
        used[name] = (used[name] || 0) + 1;
        if (used[name] > 1) name = `${name} ${used[name]}`;
        return { id, name, position: 1, avatar: avatars[i], ...newWallet() };
    });
    for (let b = 1; b <= bots; b++) { // TEST BOTS
        APP_STATE.players.push({ id: 'bot-' + b, name: 'Test Bot ' + b, position: 1, avatar: avatars[order.length + b - 1], bot: true, ...newWallet() });
    }
    APP_STATE.activePlayersCount = APP_STATE.players.length;
    APP_STATE.currentPlayerIndex = 0; // the host (player 1) starts, then one after the other
    Object.assign(APP_STATE, { turnPhase: 'roll', pending: null, lastRoll: null, lastMove: null, lastEffect: null, lastTrade: null, evtSeq: 0 });
    setTrackerNumber(APP_STATE.settings.market);
    applyChosenPreset(SETUP_PRESET);
    APP_STATE.rank = []; APP_STATE.finalBy = ''; APP_STATE.finalSeq = 0; APP_STATE.gameOver = null;
    buildBalancedTiles(); startPhase();
    MP.phase = 'playing';
    broadcastState();
    enterGameView();
    syncEffects(true);
    updateMarketTrackerUI(); drawBoard();
    applyRoleUI(); watchCurrentPlayer();
}

/* ---------- UI state ---------- */


// TEST BOTS: toggle two computer players (host only).
function toggleBots() { if (!isHost()) return; MP.bots = MP.bots ? 0 : 2; renderLobby(); }

// TEST BOTS: bots never act on their own; the host presses the dice and Accept for them (see isMyTurn in game.js).
