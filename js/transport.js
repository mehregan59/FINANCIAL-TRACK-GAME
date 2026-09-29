/* Capital Clash: realtime transports (Supabase for production, BroadcastChannel for same-browser tests). */

const usingSupabase = () => !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && window.supabase);

// Test/dev backend: works only between tabs of the SAME browser. Used when Supabase is not configured.
function LocalTransport(code) {
    const bc = new BroadcastChannel('ftg-' + code);
    const peers = new Map();
    let msgH = () => {}, presH = () => {}, meta = null, timer = null;
    const beat = () => { if (meta) bc.postMessage({ k: 'pres', meta }); };
    const emit = () => {
        const now = Date.now();
        for (const [id, p] of peers) if (now - p.seen > 3500) peers.delete(id);
        presH([meta, ...[...peers.values()].map(p => p.meta)].filter(Boolean));
    };
    bc.onmessage = ev => {
        const m = ev.data;
        if (m.k === 'pres') { const known = peers.has(m.meta.id); peers.set(m.meta.id, { meta: m.meta, seen: Date.now() }); if (!known) beat(); emit(); }
        else if (m.k === 'bye') { peers.delete(m.id); emit(); }
        else if (m.k === 'msg') msgH(m.e, m.d);
    };
    return {
        async join(m) { meta = m; beat(); timer = setInterval(() => { beat(); emit(); }, 1000); await new Promise(r => setTimeout(r, 700)); emit(); },
        updateMeta(m) { meta = m; beat(); emit(); },
        send(e, d) { bc.postMessage({ k: 'msg', e, d }); },
        onMessage(f) { msgH = f; }, onPresence(f) { presH = f; },
        leave() { if (meta) bc.postMessage({ k: 'bye', id: meta.id }); clearInterval(timer); bc.close(); }
    };
}

// Production backend: Supabase Realtime.
function SupabaseTransport(code) {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { realtime: { params: { eventsPerSecond: 20 } } });
    let ch, msgH = () => {}, presH = () => {}, meta = null;
    const readPresence = () => presH(Object.values(ch.presenceState()).map(a => a[a.length - 1]));
    return {
        join(m) {
            meta = m;
            ch = client.channel('ftg-room-' + code, { config: { broadcast: { self: false }, presence: { key: m.id } } });
            ch.on('broadcast', { event: 'msg' }, ({ payload }) => msgH(payload.e, payload.d));
            ch.on('presence', { event: 'sync' }, readPresence);
            return new Promise((resolve, reject) => {
                let settled = false;
                const to = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Could not reach the game server (timeout).')); } }, 10000);
                ch.subscribe(async status => {
                    if (status === 'SUBSCRIBED') {
                        await ch.track(meta); // also re-announces us after an automatic reconnect
                        if (!settled) { settled = true; clearTimeout(to); resolve(); } else showToast('Reconnected');
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        if (!settled) { settled = true; clearTimeout(to); reject(new Error('Could not connect to the game server.')); }
                        else showToast('Connection lost, reconnecting...');
                    }
                });
            });
        },
        updateMeta(m) { meta = m; ch.track(m); },
        send(e, d) { ch.send({ type: 'broadcast', event: 'msg', payload: { e, d } }); },
        onMessage(f) { msgH = f; }, onPresence(f) { presH = f; },
        leave() { try { ch.untrack(); } catch (_) {} try { client.removeChannel(ch); } catch (_) {} }
    };
}

const makeTransport = code => usingSupabase() ? SupabaseTransport(code) : LocalTransport(code);

/* ---------- Small helpers ---------- */

