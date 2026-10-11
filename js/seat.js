/* Capital Clash: secure seat reclaim for live rooms.
   Every seated player holds a secret Seat key (kept in this browser, so a new tab of the same browser finds it).
   The shared game state only stores a hash of the key. To take a seat back on a new tab or another device,
   the player sends the key; the host checks it against the hash, moves the seat to the new connection and
   stores the hash of a fresh key, so a key that was ever sent can never be used again. */
const Seat = (() => {
    const LS = code => 'cc_seat_' + code, PEND = code => 'cc_seat_next_' + code;
    const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let asked = '', lastClaim = 0, forced = '', sentKey = '';
    // One browser can hold several seats (test tabs), so keys are kept as a list per room.
    const keys = code => { try { return JSON.parse(localStorage.getItem(LS(code)) || '[]').filter(k => typeof k === 'string'); } catch (_) { return []; } };
    const saveKeys = (code, l) => put(LS(code), l.length ? JSON.stringify([...new Set(l)].slice(-6)) : '');
    const get = k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
    const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} };
    const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const pretty = k => k ? k.slice(0, 5) + '-' + k.slice(5) : '';
    function fresh() { const a = new Uint32Array(10); crypto.getRandomValues(a); return Array.from(a, x => ABC[x % ABC.length]).join(''); }
    async function hash(k) {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cc-seat:' + clean(k)));
        return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('').slice(0, 40);
    }
    const mySeat = () => APP_STATE.players.find(p => p.id === MP.id && !p.bot);
    const isHash = h => typeof h === 'string' && /^[0-9a-f]{40}$/.test(h);

    // Run after every shared state: register a key for my new seat, or ask for my old seat back.
    async function check() {
        if (!MP.on || MP.phase !== 'playing') return;
        const code = MP.code, seat = mySeat();
        const pend = get(PEND(code));
        if (seat) {
            if (pend && seat.kh && seat.kh === await hash(pend)) { saveKeys(code, keys(code).filter(k => k !== sentKey).concat(pend)); put(PEND(code), ''); showToast('Your seat is back. You have a new Seat key.'); }
            if (!seat.kh && asked !== code + seat.id) {
                asked = code + seat.id;
                const k = fresh(); saveKeys(code, keys(code).concat(k));
                const h = await hash(k);
                if (isHost()) { seat.kh = h; broadcastState(); } else MP.t.send('seatkey', { from: MP.id, h });
            }
            return;
        }
        const list = keys(code);
        if (!list.length || Date.now() - lastClaim < 3000) return;
        lastClaim = Date.now();
        // Try only keys whose seat is offline (a typed key may also take a seat that is still open elsewhere).
        let key = '';
        for (const k of list) { const h = await hash(k); const st = APP_STATE.players.find(p => p.kh === h); if (st && (!isPresent(st) || k === forced)) { key = k; break; } }
        if (!key) return;
        sentKey = key;
        const next = pend || fresh(); put(PEND(code), next);
        const msg = { from: MP.id, key, next: await hash(next), force: key === forced };
        if (isHost()) hostClaim(msg); else MP.t.send('claim', msg);
    }

    async function hostClaim(d) {
        if (!isHost() || MP.phase !== 'playing' || !isHash(d.next)) return;
        const h = await hash(d.key);
        const seat = APP_STATE.players.find(p => !p.bot && p.kh === h);
        if (!seat || APP_STATE.players.some(p => p.id === String(d.from))) return;
        if (isPresent(seat) && !d.force) return;
        const was = seat.id;
        seat.id = String(d.from); seat.kh = d.next;
        if (APP_STATE.holdBy === was) APP_STATE.holdBy = seat.id;
        if (APP_STATE.finalBy === was) APP_STATE.finalBy = seat.id;
        APP_STATE.rank = (APP_STATE.rank || []).map(x => (x === was ? seat.id : x));
        broadcastState(); updateTurnUI(); watchCurrentPlayer();
        showToast(seat.name + ' took their seat back');
        if (seat.id === MP.id) check();
    }

    function handle(e, d) {
        if (e === 'seatkey') {
            if (isHost() && MP.phase === 'playing' && isHash(d.h)) {
                const seat = APP_STATE.players.find(p => p.id === String(d.from) && !p.bot);
                if (seat && !seat.kh) { seat.kh = d.h; broadcastState(); }
            }
            return true;
        }
        if (e === 'claim') { hostClaim(d); return true; }
        return false;
    }

    // Landing page: a key typed for another device is stored for that room before joining.
    function useTyped(code) {
        const k = clean(($('seatKeyInput') || {}).value);
        if (k.length === 10) { saveKeys(code, keys(code).concat(k)); put(PEND(code), ''); forced = k; }
        return k.length === 10;
    }
    const hasKey = code => keys(code).length > 0;

    function showKey() {
        closeTourMenu && closeTourMenu();
        const box = $('seatKeyBox'); if (!box) return;
        mine().then(k => { $('seatKeyText').textContent = k ? pretty(k) : '—'; });
        $('seatKeyRoom').textContent = MP.on ? MP.code : '—';
        box.classList.remove('hidden');
    }
    async function mine() { const s = MP.on && mySeat(); if (!s || !s.kh) return ''; for (const k of keys(MP.code)) if (await hash(k) === s.kh) return k; return ''; }
    async function copyKey() { const k = pretty(await mine()); if (k && navigator.clipboard) navigator.clipboard.writeText(k).then(() => showToast('Seat key copied')); }

    return { check, handle, useTyped, hasKey, showKey, copyKey, hash, clean, _put: put };
})();
