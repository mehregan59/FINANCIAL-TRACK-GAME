/* Capital Clash: turn flow and player panel. */

function changePlayerCount(val) {
    APP_STATE.activePlayersCount = parseInt(val);
    document.getElementById('playerCountVal').textContent = `${val} Players`;
    
    APP_STATE.players = [];
    for (let i = 1; i <= APP_STATE.activePlayersCount; i++) {
        APP_STATE.players.push({
            id: i,
            name: `Investor ${i}`,
            position: 1
        });
    }
    APP_STATE.currentPlayerIndex = 0;
    renderPlayersList();
    drawBoard();
}

function rollDice() {
    if (MP.on) { requestOnlineRoll(); return; }
    const roll = Math.floor(Math.random() * 6) + 1;
    const diceElem = document.getElementById('diceDisplay');
    diceElem.textContent = roll;

    const p = APP_STATE.players[APP_STATE.currentPlayerIndex];
    p.position = Math.min(100, p.position + roll);

    APP_STATE.currentPlayerIndex = (APP_STATE.currentPlayerIndex + 1) % APP_STATE.activePlayersCount;
    document.getElementById('turnPlayerName').textContent = APP_STATE.players[APP_STATE.currentPlayerIndex].name;

    renderPlayersList();
    drawBoard();
}

function renderPlayersList() {
    const container = document.getElementById('playersList');
    if (!container) return;
    container.innerHTML = '';

    APP_STATE.players.forEach((p, idx) => {
        const isMe = MP.on && p.id === MP.id;
        const offline = MP.on && MP.phase === 'playing' && !MP.members.some(m => m.id === p.id);
        const div = document.createElement('div');
        div.className = `flex items-center justify-between p-2 rounded-xl border ${idx === APP_STATE.currentPlayerIndex ? 'bg-slate-800 border-amber-500/50' : 'bg-slate-900/50 border-slate-800'} ${offline ? 'opacity-50' : ''}`;
        div.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="w-3 h-3 rounded-full" style="background-color: ${PLAYER_COLORS[idx % PLAYER_COLORS.length]}"></span>
                <span class="font-bold text-slate-200 text-xs">${escapeHtml(p.name)}${isMe ? ' <span class="text-emerald-400">(you)</span>' : ''}${offline ? ' <span class="text-red-400">(offline)</span>' : ''}</span>
            </div>
            <span class="font-mono text-emerald-400 font-bold text-xs">Space ${p.position} / 100</span>
        `;
        container.appendChild(div);
    });
}

function requestOnlineRoll() {
    if (MP.phase !== 'playing' || MP.rollPending) return;
    const cur = APP_STATE.players[APP_STATE.currentPlayerIndex];
    if (!cur || cur.id !== MP.id) { showToast("It's not your turn"); return; }
    if (isHost()) { hostRoll(MP.id); return; }
    MP.rollPending = true; updateTurnUI();
    setTimeout(() => { if (MP.rollPending) { MP.rollPending = false; updateTurnUI(); } }, 3000);
    MP.t.send('roll', { from: MP.id });
}

function hostRoll(fromId) {
    const idx = APP_STATE.currentPlayerIndex, p = APP_STATE.players[idx];
    if (!p || p.id !== fromId) return;
    const n = rollD6();
    p.position = Math.min(100, p.position + n);
    APP_STATE.lastRoll = { n, by: p.id, seq: MP.seq + 1 };
    APP_STATE.currentPlayerIndex = nextPlayerIndex(idx);
    broadcastState();
    presentRoll(APP_STATE.lastRoll);
    renderPlayersList(); drawBoard(); updateTurnUI(); watchCurrentPlayer();
}

function presentRoll(r) {
    if (!r || !(r.seq > MP.lastRollSeq)) return;
    MP.lastRollSeq = r.seq;
    const el = $('diceDisplay'); let ticks = 0;
    clearInterval(MP.diceTimer);
    MP.diceTimer = setInterval(() => {
        if (++ticks > 8) {
            clearInterval(MP.diceTimer); el.textContent = r.n;
            const who = APP_STATE.players.find(p => p.id === r.by);
            showToast(`${who ? who.name : 'Someone'} rolled a ${r.n}`);
            return;
        }
        el.textContent = 1 + Math.floor(Math.random() * 6);
    }, 60);
}

function updateTurnUI() {
    if (!MP.on) return;
    const cur = APP_STATE.players[APP_STATE.currentPlayerIndex];
    $('turnPlayerName').textContent = cur ? cur.name + (cur.id === MP.id ? ' (you)' : '') : '';
    const mine = !!cur && cur.id === MP.id, btn = $('rollBtn');
    btn.disabled = !mine || MP.rollPending;
    btn.classList.toggle('opacity-40', btn.disabled); btn.classList.toggle('cursor-not-allowed', btn.disabled);
    const can = canControlTracker(), panel = $('trackerPanel');
    panel.classList.toggle('opacity-60', !can); panel.classList.toggle('pointer-events-none', !can);
}

