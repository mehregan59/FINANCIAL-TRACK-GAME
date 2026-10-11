/* Capital Clash: animations that every screen plays from the shared state.
   - FX.market(effect): the landed Tile sends its value to the Market Tracker, the price counts up or down.
   - FX.trade(trade): shares and cash fly between The Bank and the player's wallet. */

const FX = (() => {
    const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
    let countTimer = null;

    // Count the price shown on the board, the Market Tracker panel and The Bank from 'from' to 'to'.
    function countPrice(from, to) {
        clearInterval(countTimer);
        const t0 = performance.now(), ms = 900;
        const paint = v => {
            const c = document.getElementById('centerValue'); if (c) c.textContent = v;
            const b = document.getElementById('trackerValueBadge'); if (b) b.textContent = v;
            const bp = document.getElementById('bankPrice'); if (bp) bp.textContent = money(v);
        };
        countTimer = setInterval(() => {
            const f = Math.min(1, (performance.now() - t0) / ms), e = 1 - Math.pow(1 - f, 3);
            paint(Math.round(from + (to - from) * e));
            if (f >= 1) { clearInterval(countTimer); countTimer = null; }
        }, 30);
    }

    function flash(id, up) {
        const el = document.getElementById(id); if (!el) return;
        el.classList.remove('fx-up', 'fx-down'); void el.getBoundingClientRect();
        el.classList.add(up ? 'fx-up' : 'fx-down');
        setTimeout(() => el.classList.remove('fx-up', 'fx-down'), 1400);
    }

    // A glowing streak from the landed Tile to the centre of the Space Board, then a "+19" bubble over the Market Tracker.
    function tileStreak(tileNo, delta) {
        const svg = document.getElementById('boardGroup'); if (!svg || !tileNo) return;
        const a = (tileNo - 0.5) * (2 * Math.PI / 100) - Math.PI / 2, r = 340;
        const x = 500 + r * Math.cos(a), y = 500 + r * Math.sin(a);
        const up = delta > 0, col = up ? '#34d399' : delta < 0 ? '#f87171' : '#cbd5e1';
        const g = svgEl('g', { class: 'fx-layer', 'pointer-events': 'none' });
        const line = svgEl('line', { x1: x, y1: y, x2: 500, y2: 500, stroke: col, 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.9 });
        const len = Math.hypot(500 - x, 500 - y);
        line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
        g.appendChild(line);
        const bub = svgEl('text', { x: 500, y: 330, 'text-anchor': 'middle', 'font-size': 64, 'font-weight': 900, fill: col, stroke: '#0b1f4d', 'stroke-width': 6, 'paint-order': 'stroke', opacity: 0 });
        bub.textContent = delta > 0 ? '+' + delta : delta < 0 ? String(delta) : '0';
        g.appendChild(bub);
        svg.appendChild(g);
        line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 450, easing: 'ease-in', fill: 'forwards' });
        bub.animate([{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.3 }, { opacity: 1, offset: 0.75 }, { opacity: 0, transform: 'translateY(-30px)' }],
            { duration: 1800, delay: 350, fill: 'forwards' });
        line.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 500, delay: 700, fill: 'forwards' });
        setTimeout(() => g.remove(), 2400);
    }

    // Screen point of a Tile on the stretched Space Board.
    function tileEl(tileNo) {
        const g = document.getElementById('boardGroup'); if (!g || !tileNo) return null;
        const a = (tileNo - 0.5) * (2 * Math.PI / 100) - Math.PI / 2, r = 340;
        const c = svgEl('circle', { cx: 500 + r * Math.cos(a) * BOARD_SX, cy: 500 + r * Math.sin(a), r: 4, fill: 'none' });
        g.appendChild(c); setTimeout(() => c.remove(), 3000); return c;
    }
    function centerEl() { return document.getElementById('centerValue') || document.getElementById('boardSvg'); }

    // Share value up: coins go from the centre of the Space Board to every shareholder.
    // Share value down: coins leave every shareholder and go to the centre.
    function portfolioPulse(d) {
        if (!d) return;
        const center = centerEl();
        APP_STATE.players.forEach((p, i) => {
            const row = document.querySelector(`#walletRows [data-idx="${i}"]`); if (!row) return;
            const amt = d * (p.shares || 0); if (!amt) return;
            const tag = document.createElement('span');
            tag.className = 'fx-delta ' + (amt > 0 ? 'up' : 'down');
            tag.textContent = (amt > 0 ? '+' : '\u2212') + money(Math.abs(amt));
            row.appendChild(tag);
            tag.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)', offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 2000, fill: 'forwards' }).onfinish = () => tag.remove();
            row.classList.add(amt > 0 ? 'fx-up' : 'fx-down'); setTimeout(() => row.classList.remove('fx-up', 'fx-down'), 1400);
            if (center) amt > 0 ? fly(center, row, curSym(), 'coin', 3) : fly(row, center, curSym(), 'coin', 3);
        });
    }

    function market(ef) {
        if (!ef || !(ef.kind === 'tile' || ef.kind === 'phase') || ef.before === ef.after && ef.kind === 'phase') return;
        if (reduce()) return;
        const m = APP_STATE.lastMove;
        const onTile = ef.kind === 'tile' && m && m.by === ef.by;
        if (onTile) {
            tileStreak(m.to, ef.delta);
            // Plus Tile: coins fly from the Tile into the centre. Minus Tile: coins leave the centre back to the Tile.
            const t = tileEl(m.to), c = centerEl();
            if (ef.delta > 0) fly(t, c, curSym(), 'coin', 4); else if (ef.delta < 0) fly(c, t, curSym(), 'coin', 4);
        }
        setTimeout(() => {
            if (ef.before !== ef.after) countPrice(ef.before, ef.after);
            const up = ef.after >= ef.before;
            ['trackerValueBadge', 'bankPrice', 'trackerPanel'].forEach(id => flash(id, up));
            portfolioPulse(ef.after - ef.before);
        }, ef.kind === 'tile' ? 1100 : 0);
    }

    // Fly n tokens from one element to another (fixed-position overlay, so it works across the whole screen).
    function fly(fromEl, toEl, label, cls, n) {
        if (!fromEl || !toEl) return;
        const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
        const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
        for (let i = 0; i < n; i++) {
            const t = document.createElement('div');
            t.className = 'fx-token ' + cls; t.textContent = label;
            document.body.appendChild(t);
            const jx = (Math.random() - 0.5) * 40, jy = (Math.random() - 0.5) * 30, lift = -80 - Math.random() * 60;
            const anim = t.animate([
                { transform: `translate(${ax + jx}px, ${ay + jy}px) scale(.6)`, opacity: 0 },
                { transform: `translate(${(ax + bx) / 2}px, ${(ay + by) / 2 + lift}px) scale(1.15)`, opacity: 1, offset: 0.5 },
                { transform: `translate(${bx}px, ${by}px) scale(.7)`, opacity: 0.2 }
            ], { duration: 1000, delay: i * 90, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' });
            anim.onfinish = () => t.remove();
        }
    }

    function trade(tr) {
        if (!tr || tr.card || reduce()) return; // Card cash is animated once by card(), including forced trades.
        const idx = APP_STATE.players.findIndex(p => p.id === tr.by);
        const bank = document.getElementById('bankCard'), row = document.querySelector(`#walletRows [data-idx="${idx}"]`);
        const n = Math.max(1, Math.min(8, tr.qty));
        const shares = tr.qty + ' share' + (tr.qty > 1 ? 's' : ''), cash = money(tr.qty * tr.price);
        // Only money moves, one way: buying pays The Bank, selling pays the player.
        if (tr.kind === 'buy') fly(row, bank, curSym(), 'coin', Math.max(3, Math.min(8, n)));
        else fly(bank, row, curSym(), 'coin', Math.max(3, Math.min(8, n)));
        // A label in the middle of the path says what moved.
        if (bank && row) {
            const a = bank.getBoundingClientRect(), b = row.getBoundingClientRect();
            const tag = document.createElement('div');
            tag.className = 'fx-tag ' + tr.kind;
            tag.innerHTML = tr.kind === 'buy' ? `The Bank \u2192 ${escapeHtml(playerName(tr.by))}: <b>${shares}</b> &middot; ${cash} paid` : `${escapeHtml(playerName(tr.by))} \u2192 The Bank: <b>${shares}</b> &middot; ${cash} received`;
            document.body.appendChild(tag);
            tag.style.left = ((a.left + a.width / 2 + b.left + b.width / 2) / 2) + 'px';
            tag.style.top = (Math.min(a.top, b.top) + 40) + 'px';
            tag.animate([{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2200, fill: 'forwards' }).onfinish = () => tag.remove();
        }
        setTimeout(() => { const r = document.querySelector(`#walletRows [data-idx="${idx}"]`); if (r) { r.classList.add('fx-wallet'); setTimeout(() => r.classList.remove('fx-wallet'), 900); } }, 900);
    }

    // The resolved card's cash delta is authoritative on every screen.
    function card(c) {
        if (!c || !c.done || !c.ok || !c.dm || reduce()) return;
        const idx = APP_STATE.players.findIndex(p => p.id === c.by);
        if (idx < 0) return;
        const bank = document.getElementById('bankCard');
        const row = document.querySelector(`#walletRows [data-idx="${idx}"]`);
        if (!bank || !row) return;
        const reward = c.dm > 0;
        fly(reward ? bank : row, reward ? row : bank, curSym(), 'coin', 6);
        flash('bankCard', !reward);
        row.classList.add(reward ? 'fx-up' : 'fx-down');
        setTimeout(() => row.classList.remove('fx-up', 'fx-down'), 1400);
        const tag = document.createElement('span');
        tag.className = 'fx-delta ' + (reward ? 'up' : 'down');
        tag.textContent = (reward ? '+' : '\u2212') + money(Math.abs(c.dm));
        row.appendChild(tag);
        tag.animate([
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)', offset: .2 },
            { opacity: 1, offset: .8 },
            { opacity: 0, transform: 'translateY(-10px)' }
        ], { duration: 2200, fill: 'forwards' }).onfinish = () => tag.remove();
    }

    return { market, trade, card };
})();
