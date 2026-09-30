/* Capital Clash: save and resume.

   The host saves the whole game after every step. If everyone disconnects, the host opens the start page,
   types the same room code and presses "Resume saved game"; the others join with the same code and are given
   their old seats back by name. Saves go to the Supabase table game_saves (see supabase/game_saves.sql) and,
   as a backup, to this browser (localStorage). "Start over" is the host's Reset button. */

const Save = (() => {
    const LS = code => 'cc_save_' + code;
    const TTL_MS = 24 * 60 * 60 * 1000; // a save lives for 24 hours after its last change
    let timer = null, lastClean = 0;
    const remoteOn = () => !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && window.supabase);
    const H = () => ({ apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' });

    async function put(code, state) {
        const rec = { state, savedAt: Date.now() };
        try { localStorage.setItem(LS(code), JSON.stringify(rec)); } catch (_) {}
        if (!remoteOn()) return;
        cleanup();
        try {
            await fetch(SUPABASE_URL + '/rest/v1/game_saves?on_conflict=room_code', {
                method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates,return=minimal' },
                body: JSON.stringify({ room_code: code, state, updated_at: new Date().toISOString() })
            });
        } catch (_) { /* offline or table missing: the browser copy still exists */ }
    }

    // Delete saves older than 24 hours (the table policy only allows deleting expired rows). At most once a minute.
    async function cleanup() {
        if (Date.now() - lastClean < 60000) return;
        lastClean = Date.now();
        try { await fetch(SUPABASE_URL + '/rest/v1/game_saves?updated_at=lt.' + encodeURIComponent(new Date(Date.now() - TTL_MS).toISOString()), { method: 'DELETE', headers: { ...H(), Prefer: 'return=minimal' } }); } catch (_) {}
    }

    async function get(code) {
        let best = null;
        if (remoteOn()) {
            try {
                const r = await fetch(SUPABASE_URL + '/rest/v1/game_saves?room_code=eq.' + encodeURIComponent(code) + '&select=state,updated_at', { headers: H() });
                if (r.ok) { const rows = await r.json(); if (rows[0]) best = { state: rows[0].state, savedAt: Date.parse(rows[0].updated_at) || 0 }; }
            } catch (_) {}
        }
        try { const l = JSON.parse(localStorage.getItem(LS(code)) || 'null'); if (l && l.state && (!best || l.savedAt > best.savedAt)) best = l; } catch (_) {}
        if (best && Date.now() - best.savedAt > TTL_MS) { try { localStorage.removeItem(LS(code)); } catch (_) {} best = null; } // expired
        return best ? best.state : null;
    }

    return {
        put, get,
        // Host: save shortly after the latest change (many quick changes become one save).
        queue() {
            if (!MP.on || !isHost() || MP.phase !== 'playing') return;
            clearTimeout(timer);
            timer = setTimeout(() => { if (MP.on && isHost() && MP.phase === 'playing') put(MP.code, snapshot()); }, 700);
        }
    };
})();

// Give an offline seat to the person who joined with the same name (used after a resume or when someone comes back on a new tab).
function claimSeats() {
    if (!MP.on || !isHost() || MP.phase !== 'playing') return false;
    let changed = false;
    MP.members.forEach(m => {
        if (APP_STATE.players.some(p => p.id === m.id)) return;
        const seat = APP_STATE.players.find(p => !p.bot && !isPresent(p) && p.name.toLowerCase() === m.name.toLowerCase());
        if (seat) { seat.id = m.id; changed = true; }
    });
    if (changed) { broadcastState(); updateTurnUI(); watchCurrentPlayer(); }
    return changed;
}

async function resumeRoom() {
    const n = readName(); if (!n) return;
    const code = cleanCode($('roomCodeInput').value);
    if (code.length !== 5) { showLandingError('Type the 5-character room code of the game you want to resume.'); return; }
    showLandingError(''); setLandingBusy(true);
    const s = await Save.get(code);
    setLandingBusy(false);
    if (!s || !Array.isArray(s.players) || s.phase !== 'playing') { showLandingError('No saved game found for room ' + code + '.'); return; }
    if (!s.players.some(p => !p.bot && String(p.name).toLowerCase() === n.toLowerCase())) {
        showLandingError('Use the same name you played with. Players in this game: ' + s.players.filter(p => !p.bot).map(p => p.name).join(', '));
        return;
    }
    await Guide.ask();
    MP.resumeState = s;
    await enterRoom(code, n, true, Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, s.players.length)));
}

// Called by enterRoom for the host of a resumed game, instead of opening the lobby.
function applyResume() {
    const s = MP.resumeState; MP.resumeState = null;
    s.hostId = MP.id; s.phase = 'playing'; s.expected = MP.expected;
    MP.seq = Number(s.seq) || 0;
    MP.graceUntil = Date.now() + 120000; // give the others time to rejoin before their turns are skipped
    applyState(s);
    claimSeats();
    broadcastState();
    resumeAfterTakeover();
    applyRoleUI(); updateTurnUI(); watchCurrentPlayer();
    showToast('Saved game resumed. Others can join with code ' + MP.code);
}
