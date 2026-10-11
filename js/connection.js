/* Capital Clash: live-room connection status and reconnect (keeps the same player id, so the seat is kept). */
const Conn = (() => {
    let state = 'online', tries = 0, timer = null, active = false, busy = false;
    const el = id => document.getElementById(id);
    function show(s) {
        state = s; const p = el('connPill'); if (!p) return;
        p.classList.toggle('hidden', !active); p.dataset.s = s;
        el('connText').textContent = s === 'online' ? 'Online' : s === 'lost' ? 'Reconnecting...' : 'Offline';
        el('connRetry').classList.toggle('hidden', s !== 'offline');
    }
    function onStatus(s) {
        if (!active) return;
        if (s === 'online') {
            const was = state; tries = 0; clearTimeout(timer); show('online');
            if (was !== 'online') { showToast('Reconnected: your place is kept'); requestSync(); }
            return;
        }
        if (state === 'online') show('lost');
        schedule();
    }
    function schedule() {
        clearTimeout(timer);
        if (tries >= 4) { show('offline'); return; } // stop auto-retrying; the player can press Reconnect
        timer = setTimeout(reconnect, Math.min(15000, 2000 * 2 ** tries++));
    }
    function requestSync() {
        if (!MP.on || !MP.t) return;
        MP.seq = -1; // accept the latest shared state, whoever is host now
        MP.t.send('sync', { from: MP.id });
        setTimeout(() => { if (MP.on && isHost()) broadcastState(); }, 1500);
    }
    async function reconnect() {
        if (!active || busy || !MP.on) return;
        busy = true; clearTimeout(timer); show('lost');
        try { MP.t && MP.t.leave(); } catch (_) {}
        const t = makeTransport(MP.code); attach(t);
        t.onMessage(onMpMessage); t.onPresence(onMpPresence); MP.t = t;
        try { await t.join(myMeta()); onStatus('online'); }
        catch (_) { schedule(); }
        finally { busy = false; }
    }
    function attach(t) { if (t.onStatus) t.onStatus(onStatus); }
    function start() { active = true; tries = 0; show('online'); }
    function stop() { active = false; clearTimeout(timer); show('online'); }
    window.addEventListener('offline', () => { if (active) { show('lost'); } });
    window.addEventListener('online', () => { if (active && state !== 'online') { tries = 0; reconnect(); } });
    document.addEventListener('visibilitychange', () => { if (active && !document.hidden && state !== 'online') { tries = 0; reconnect(); } });
    return { attach, start, stop, reconnect, get state() { return state; } };
})();
