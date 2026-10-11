/* Capital Clash: in-game chat (live rooms only).
   - A pop-up window (not a fixed panel) with emoji; players can close it any time.
   - "Notify" reminds the player whose turn it is: their screen plays a sound and shows a message.
   - If the same player's turn lasts longer than IDLE_MS, every other player can vote to remove them.
     When all other players in the room voted, the host removes that player from the game. */
const Chat = (() => {
    const EMO = ['😀', '😂', '👍', '👏', '🎉', '😮', '😢', '😡', '🤔', '🚀', '📈', '📉', '💰', '🔥', '🙏', '⏰'];
    const IDLE_MS = 3 * 60 * 1000, NUDGE_GAP_MS = 15000, MAX_MSGS = 120;
    let open = false, unread = 0, msgs = [], turnKey = '', turnAt = Date.now(), votes = new Map(), lastNudge = 0, seated = false;
    const el = id => document.getElementById(id);
    const active = () => typeof MP !== 'undefined' && MP.on && MP.phase === 'playing';
    const cur = () => APP_STATE.players[APP_STATE.currentPlayerIndex] || null;
    const needed = target => MP.members.filter(m => m.id !== target).length;
    const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    function init() {
        const row = el('chatEmojis'); if (!row) return;
        row.innerHTML = EMO.map(e => `<button type="button" aria-label="Emoji ${e}">${e}</button>`).join('');
        row.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; const i = el('chatInput'); i.value = (i.value + b.textContent).slice(0, 200); i.focus(); });
        setInterval(tick, 1000);
    }
    function toggle(force) {
        open = force === undefined ? !open : !!force;
        el('chatPop').classList.toggle('hidden', !open);
        if (open) { unread = 0; badge(); renderTurn(); setTimeout(() => el('chatInput').focus(), 30); el('chatList').scrollTop = 1e9; }
    }
    function badge() { const b = el('chatBadge'); b.textContent = unread > 9 ? '9+' : String(unread); b.classList.toggle('hidden', !unread); }

    function tick() {
        const on = active();
        el('chatFab').classList.toggle('hidden', !on);
        if (!on) { if (open) toggle(false); seated = false; return; }
        const c = cur();
        const k = APP_STATE.currentPlayerIndex + '|' + (c ? c.id : '') + '|' + (APP_STATE.history || []).length;
        if (k !== turnKey) { turnKey = k; turnAt = Date.now(); votes.clear(); }
        const inGame = APP_STATE.players.some(p => p.id === MP.id);
        if (seated && !inGame) { seated = false; showToast('You were removed from the game because your turn took too long', true); setTimeout(() => leaveRoom(), 3000); return; }
        seated = inGame;
        if (open) renderTurn();
    }

    function renderTurn() {
        const box = el('chatTurn'), c = cur();
        if (!box || !c) { if (box) box.innerHTML = ''; return; }
        if (c.id === MP.id) { box.innerHTML = '<span class="chat-note">It is your turn</span>'; return; }
        const wait = Date.now() - lastNudge < NUDGE_GAP_MS;
        let html = `<button type="button" class="chat-btn nudge" onclick="Chat.nudge()" ${wait ? 'disabled' : ''}><i class="fa-solid fa-bell"></i> <span>Notify ${escapeHtml(c.name)}</span></button>`;
        if (!c.bot) {
            const left = IDLE_MS - (Date.now() - turnAt), v = votes.get(c.id), mine = !!(v && v.has(MP.id)), n = v ? v.size : 0;
            html += left > 0
                ? `<button type="button" class="chat-btn kick" disabled title="Opens when one turn takes longer than 3 minutes"><i class="fa-solid fa-user-xmark"></i> <span>Remove player in ${fmt(left)}</span></button>`
                : `<button type="button" class="chat-btn kick on" onclick="Chat.vote()" ${mine ? 'disabled' : ''}><i class="fa-solid fa-user-xmark"></i> <span>Vote to remove ${escapeHtml(c.name)} (${n}/${needed(c.id)})</span></button>`;
        }
        box.innerHTML = html;
    }

    function add(m) {
        msgs.push(m); if (msgs.length > MAX_MSGS) msgs.shift();
        const li = document.createElement('div');
        li.className = 'chat-msg' + (m.sys ? ' sys' : m.from === MP.id ? ' me' : '');
        li.innerHTML = m.sys ? `<span>${escapeHtml(m.text)}</span>` : `<b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.text)}</span>`;
        const list = el('chatList'); list.appendChild(li); while (list.children.length > MAX_MSGS) list.firstChild.remove();
        list.scrollTop = 1e9;
        if (!open && !m.sys && m.from !== MP.id) { unread++; badge(); try { Sound.tick && Sound.tick(); } catch (_) {} }
    }
    const sys = text => add({ sys: true, text });

    function send(ev) {
        if (ev) ev.preventDefault();
        if (!active()) return;
        const i = el('chatInput'), text = i.value.trim().slice(0, 200); if (!text) return;
        const m = { from: MP.id, name: MP.name, text };
        MP.t.send('chat', m); add(m); i.value = '';
    }
    function nudge() {
        const c = cur(); if (!active() || !c || c.id === MP.id) return;
        if (Date.now() - lastNudge < NUDGE_GAP_MS) return;
        lastNudge = Date.now();
        MP.t.send('nudge', { from: MP.id, name: MP.name, to: c.id });
        sys('You reminded ' + c.name + ' to play'); renderTurn();
    }
    function vote() {
        const c = cur(); if (!active() || !c || c.id === MP.id || c.bot) return;
        if (Date.now() - turnAt < IDLE_MS) return;
        MP.t.send('kickvote', { from: MP.id, target: c.id }); addVote(c.id, MP.id);
    }
    function addVote(target, from) {
        const c = cur(); if (!c || c.id !== target || Date.now() - turnAt < IDLE_MS - 5000) return;
        if (!votes.has(target)) votes.set(target, new Set());
        const v = votes.get(target); if (v.has(from)) return; v.add(from);
        sys((memberName(from) || 'A player') + ' voted to remove ' + c.name + ' (' + v.size + '/' + needed(target) + ')');
        renderTurn();
        if (isHost() && v.size >= needed(target)) { const name = c.name; if (authRemovePlayer(target)) { sys(name + ' was removed from the game'); MP.t.send('chat', { from: MP.id, name: 'Capital Clash', text: name + ' was removed from the game' }); } }
    }
    // Called by onMpMessage for chat events; returns true when handled.
    function handle(e, d) {
        if (e === 'chat') { add({ from: String(d.from || ''), name: cleanName(d.name) || 'Investor', text: String(d.text || '').slice(0, 200) }); return true; }
        if (e === 'nudge') {
            if (String(d.to) === MP.id) {
                const who = cleanName(d.name) || 'A player';
                try { Sound.unlock && Sound.unlock(); Sound.chime(); setTimeout(() => Sound.chime(), 450); setTimeout(() => Sound.chime(), 900); } catch (_) {}
                showToast('🔔 ' + who + ' reminds you: it is your turn!', true); sys(who + ' reminded you to play');
            }
            return true;
        }
        if (e === 'kickvote') { if (active()) addVote(String(d.target), String(d.from)); return true; }
        return false;
    }
    document.addEventListener('DOMContentLoaded', init);
    return { toggle, send, nudge, vote, handle };
})();
