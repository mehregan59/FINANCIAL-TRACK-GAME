/* Capital Clash: "City path" board theme.
   A winding road of 100 paving blocks (10 rows, the road waves gently), a little town on the right.
   The Bank and the Market are buildings you click: the Bank opens Sell / Buy, the Market says "coming soon".
   Everything is drawn as vector art, in the same <g id="boardGroup"> the magnifier lens re-uses. */

const CITY = { W: 1000, H: 760, cols: 10, rows: 10, cw: 78, rh: 72, x0: 61, y0: 56, tw: 70, th: 54, A: 9, P: 390, hist: [] };
const isCity = () => APP_STATE.settings && APP_STATE.settings.theme === 'city';

// Centre and tilt of tile i (0..99). The rows wave like a river; every row waves the same way, so rows never touch.
function cityTile(i) {
    i = Math.max(0, Math.min(99, i));
    const row = Math.floor(i / CITY.cols), c = i % CITY.cols, col = row % 2 ? CITY.cols - 1 - c : c;
    const x = CITY.x0 + col * CITY.cw, w = (x - CITY.x0) / CITY.P * 2 * Math.PI;
    const y = CITY.y0 + row * CITY.rh + CITY.A * Math.sin(w);
    const rot = Math.atan(CITY.A * 2 * Math.PI / CITY.P * Math.cos(w)) * 180 / Math.PI;
    return { x, y, rot };
}
// Point for a (possibly fractional) position 1..100: the pawn slides from tile to tile.
function cityPoint(pos) {
    const f = Math.max(1, Math.min(100, pos)), a = cityTile(Math.floor(f) - 1), b = cityTile(Math.min(99, Math.floor(f))), t = f - Math.floor(f);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/* ---------- Page layout for the theme ---------- */
function applyTheme() {
    const city = isCity();
    document.body.dataset.theme = city ? 'city' : 'classic';
    const svg = document.getElementById('boardSvg');
    if (svg) svg.setAttribute('viewBox', city ? `0 0 ${CITY.W} ${CITY.H}` : '-55 -55 1110 1110');
    const panel = document.getElementById('trackerPanel'), left = document.getElementById('leftRail'), right = document.querySelector('.right-rail');
    if (panel && left && right) {
        if (city && panel.parentNode !== left) left.insertBefore(panel, left.firstChild);
        if (!city && panel.parentNode !== right) right.appendChild(panel);
    }
    if (panel && !document.getElementById('cityChart')) {
        const c = document.createElement('div'); c.id = 'cityChart'; c.className = 'city-chart';
        const head = panel.firstElementChild; if (head) head.after(c); else panel.appendChild(c);
    }
    if (!city) closeBankPop();
}

/* ---------- Market chart (left panel) ---------- */
function cityOnMarket() {
    const v = marketValue(), h = CITY.hist;
    if (!h.length || h[h.length - 1] !== v) { h.push(v); if (h.length > 40) h.shift(); }
    renderCityChart();
}
function renderCityChart() {
    const box = document.getElementById('cityChart'); if (!box || !isCity()) return;
    const h = CITY.hist.length > 1 ? CITY.hist : [marketValue(), marketValue()];
    const lo = Math.min(...h, 450), hi = Math.max(...h, 550), W = 260, H = 54;
    const pts = h.map((v, i) => `${(i / (h.length - 1) * (W - 8) + 4).toFixed(1)},${(H - 6 - (v - lo) / (hi - lo) * (H - 12)).toFixed(1)}`).join(' ');
    const up = h[h.length - 1] >= h[0];
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${H - 6 - (500 - lo) / (hi - lo) * (H - 12)}" y2="${H - 6 - (500 - lo) / (hi - lo) * (H - 12)}" stroke="#ffffff" stroke-opacity=".25" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="${up ? '#3ddc97' : '#ff6b6b'}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/* ---------- Drawing ---------- */
const E = (n, a, t) => { const e = svgEl(n, a || {}); if (t !== undefined) e.textContent = t; return e; };
const nameLines = n => {
    const w = n.split(' ');
    if (n.length <= 11 || w.length === 1) return [n];
    let best = 1, diff = 1e9;
    for (let k = 1; k < w.length; k++) { const d = Math.abs(w.slice(0, k).join(' ').length - w.slice(k).join(' ').length); if (d < diff) { diff = d; best = k; } }
    return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
};

function tree(g, x, y, s) {
    g.appendChild(E('ellipse', { cx: x, cy: y + 14 * s, rx: 12 * s, ry: 4 * s, fill: 'rgba(0,0,0,.14)' }));
    g.appendChild(E('rect', { x: x - 2.5 * s, y: y + 2 * s, width: 5 * s, height: 12 * s, fill: '#7a5230', rx: 2 }));
    g.appendChild(E('circle', { cx: x, cy: y - 6 * s, r: 12 * s, fill: '#3f9a4a' }));
    g.appendChild(E('circle', { cx: x - 7 * s, cy: y - 1 * s, r: 9 * s, fill: '#4aae55' }));
    g.appendChild(E('circle', { cx: x + 7 * s, cy: y - 2 * s, r: 9 * s, fill: '#52b95d' }));
    g.appendChild(E('circle', { cx: x - 3 * s, cy: y - 10 * s, r: 5 * s, fill: '#79d085', opacity: .7 }));
}
function house(g, x, y, roof) {
    g.appendChild(E('ellipse', { cx: x + 22, cy: y + 38, rx: 28, ry: 5, fill: 'rgba(0,0,0,.14)' }));
    g.appendChild(E('rect', { x, y: y + 12, width: 44, height: 26, fill: '#f6e7c8', stroke: '#c9b27a', 'stroke-width': 1.5 }));
    g.appendChild(E('polygon', { points: `${x - 5},${y + 14} ${x + 22},${y - 6} ${x + 49},${y + 14}`, fill: roof, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1.5 }));
    g.appendChild(E('rect', { x: x + 6, y: y + 20, width: 10, height: 10, fill: '#8cc7f0', stroke: '#b89a5a' }));
    g.appendChild(E('rect', { x: x + 28, y: y + 22, width: 9, height: 16, fill: '#8a5a2b', rx: 2 }));
}

function drawBank(g, x, y) {
    const b = E('g', { class: 'bld', 'data-bld': 'bank', tabindex: 0, role: 'button', 'aria-label': 'Bank: buy or sell shares', transform: `translate(${x},${y})` });
    b.appendChild(E('title', {}, 'Bank: click to buy or sell shares'));
    const art = E('g', { class: 'bld-art' });
    art.appendChild(E('ellipse', { cx: 75, cy: 132, rx: 74, ry: 8, fill: 'rgba(0,0,0,.18)' }));
    art.appendChild(E('rect', { x: 6, y: 120, width: 138, height: 8, rx: 2, fill: '#cdbf9f' }));
    art.appendChild(E('rect', { x: 12, y: 113, width: 126, height: 8, rx: 2, fill: '#ddd0b1' }));
    art.appendChild(E('rect', { x: 14, y: 62, width: 122, height: 52, fill: '#fffaf0', stroke: '#b9a678', 'stroke-width': 2 }));
    for (let i = 0; i < 5; i++) art.appendChild(E('rect', { x: 20 + i * 24.5, y: 64, width: 9, height: 48, fill: '#efe3c6', stroke: '#c9b27a' }));
    art.appendChild(E('path', { d: 'M62 114 V92 a13 13 0 0 1 26 0 V114 Z', fill: '#1f4fa8', stroke: '#173d86', 'stroke-width': 2 }));
    art.appendChild(E('rect', { x: 8, y: 48, width: 134, height: 16, rx: 3, fill: '#f0b72a', stroke: '#b8830a', 'stroke-width': 2 }));
    art.appendChild(E('text', { x: 75, y: 60.5, 'font-size': 12.5, 'font-weight': 900, 'letter-spacing': 3, fill: '#3b2a00', 'text-anchor': 'middle', 'font-family': 'Georgia, serif' }, 'BANK'));
    art.appendChild(E('polygon', { points: '2,50 75,6 148,50', fill: '#2f6fd6', stroke: '#173d86', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    art.appendChild(E('circle', { cx: 75, cy: 32, r: 9, fill: '#f0b72a', stroke: '#b8830a', 'stroke-width': 2 }));
    art.appendChild(E('text', { x: 75, y: 36.5, 'font-size': 12, 'font-weight': 900, fill: '#7a4d00', 'text-anchor': 'middle' }, '$'));
    b.appendChild(art);
    b.appendChild(E('rect', { x: 20, y: 140, width: 110, height: 22, rx: 11, fill: '#12336f', stroke: '#facc15', 'stroke-width': 2 }));
    b.appendChild(E('text', { x: 75, y: 155.5, 'font-size': 12, 'font-weight': 800, fill: '#fff', 'text-anchor': 'middle' }, 'Buy / Sell shares'));
    g.appendChild(b);
}
function drawMarketShop(g, x, y) {
    const b = E('g', { class: 'bld', 'data-bld': 'market', tabindex: 0, role: 'button', 'aria-label': 'Market: event cards, coming soon', transform: `translate(${x},${y})` });
    b.appendChild(E('title', {}, 'Market: event cards are coming soon'));
    const art = E('g', { class: 'bld-art' });
    art.appendChild(E('ellipse', { cx: 75, cy: 132, rx: 74, ry: 8, fill: 'rgba(0,0,0,.18)' }));
    art.appendChild(E('rect', { x: 12, y: 56, width: 126, height: 72, fill: '#f6e7c8', stroke: '#c9b27a', 'stroke-width': 2 }));
    art.appendChild(E('rect', { x: 22, y: 84, width: 34, height: 28, fill: '#8cc7f0', stroke: '#b89a5a', 'stroke-width': 2 }));
    art.appendChild(E('rect', { x: 94, y: 84, width: 34, height: 28, fill: '#8cc7f0', stroke: '#b89a5a', 'stroke-width': 2 }));
    art.appendChild(E('rect', { x: 63, y: 88, width: 24, height: 40, fill: '#8a5a2b', rx: 3 }));
    // fruit crates
    [['#e53935', 30], ['#fb8c00', 42], ['#7cb342', 102], ['#e53935', 114]].forEach(([c, cx]) => art.appendChild(E('circle', { cx, cy: 120, r: 5.5, fill: c, stroke: 'rgba(0,0,0,.25)' })));
    // striped awning
    for (let i = 0; i < 9; i++) art.appendChild(E('path', { d: `M${6 + i * 15.3} 58 h15.3 v12 a7.65 7.65 0 0 1 -15.3 0 Z`, fill: i % 2 ? '#fff' : '#2e9e5b', stroke: 'rgba(0,0,0,.18)' }));
    art.appendChild(E('rect', { x: 6, y: 40, width: 138, height: 20, rx: 4, fill: '#12336f', stroke: '#facc15', 'stroke-width': 2 }));
    art.appendChild(E('text', { x: 75, y: 55, 'font-size': 13, 'font-weight': 900, 'letter-spacing': 3, fill: '#fff', 'text-anchor': 'middle', 'font-family': 'Georgia, serif' }, 'MARKET'));
    art.appendChild(E('polygon', { points: '12,42 75,10 138,42', fill: '#c0572b', stroke: '#8a3a18', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    art.appendChild(E('text', { x: 75, y: 34, 'font-size': 15, 'font-weight': 900, fill: '#ffe680', 'text-anchor': 'middle' }, String(marketValue())));
    b.appendChild(art);
    b.appendChild(E('rect', { x: 20, y: 140, width: 110, height: 22, rx: 11, fill: '#12336f', stroke: '#facc15', 'stroke-width': 2 }));
    b.appendChild(E('text', { x: 75, y: 155.5, 'font-size': 12, 'font-weight': 800, fill: '#fff', 'text-anchor': 'middle' }, 'Event cards (soon)'));
    g.appendChild(b);
}

function drawCityBoard(group) {
    const W = CITY.W, H = CITY.H;
    const defs = E('defs');
    defs.innerHTML = `<linearGradient id="cgGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9a9"/><stop offset="1" stop-color="#b3da86"/></linearGradient>
        <linearGradient id="cgRiver" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6fbdf0"/><stop offset="1" stop-color="#8fd0f7"/></linearGradient>`;
    group.appendChild(defs);
    group.appendChild(E('rect', { x: 0, y: 0, width: W, height: H, rx: 26, fill: 'url(#cgGrass)', stroke: '#8fbf63', 'stroke-width': 4 }));

    // grass tufts, only in the margins so they never sit under the tiles
    const tufts = E('g', { fill: '#9ccc6f', opacity: .7 });
    [[14, 120], [12, 330], [16, 560], [10, 700], [300, 740], [520, 744], [700, 742], [150, 12], [420, 10], [650, 12], [880, 20], [905, 420], [960, 410]].forEach(([x, y]) => tufts.appendChild(E('path', { d: `M${x} ${y} l3 -9 l3 9 l3 -8 l3 8 z` })));
    group.appendChild(tufts);

    // river between the road and the town
    const rp = []; for (let y = -10; y <= H + 10; y += 20) rp.push([812 + 5 * Math.sin(y / 60), y]);
    const rd = 'M' + rp.map(p => p.join(',')).join(' L');
    group.appendChild(E('path', { d: rd, fill: 'none', stroke: '#5aaee6', 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    group.appendChild(E('path', { d: rd, fill: 'none', stroke: 'url(#cgRiver)', 'stroke-width': 20, 'stroke-linejoin': 'round' }));
    group.appendChild(E('path', { d: rd, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-opacity': .5, 'stroke-dasharray': '10 22' }));

    // the road: one winding band under all tiles
    const pts = []; for (let i = 0; i < 100; i++) { const t = cityTile(i); pts.push(t.x + ',' + t.y); }
    const road = 'M' + pts.join(' L');
    group.appendChild(E('path', { d: road, fill: 'none', stroke: '#b99a5b', 'stroke-width': 66, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    group.appendChild(E('path', { d: road, fill: 'none', stroke: '#ead9ab', 'stroke-width': 60, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

    // the 100 tiles
    for (let i = 0; i < 100; i++) {
        const t = cityTile(i), tile = APP_STATE.tiles[i];
        const m = tile.text.match(/^(.*) \(([^)]*)\)$/), name = m ? m[1] : tile.text, eff = m ? m[2] : '';
        const col = eff.startsWith('+') ? '#0b7a3b' : eff.startsWith('-') ? '#c62828' : '#6b5b2e';
        const g = E('g', { transform: `translate(${t.x},${t.y}) rotate(${t.rot.toFixed(2)})` });
        g.appendChild(E('rect', { x: -CITY.tw / 2, y: -CITY.th / 2, width: CITY.tw, height: CITY.th, rx: 10, fill: i === 0 ? '#e3f6d3' : i === 99 ? '#ffe9a3' : '#fff7de', stroke: '#c9ad6a', 'stroke-width': 2 }));
        g.appendChild(E('rect', { x: -CITY.tw / 2, y: -CITY.th / 2 + 6, width: 5, height: CITY.th - 12, rx: 2.5, fill: col, opacity: .85 }));
        g.appendChild(E('text', { x: -28, y: -14, 'font-size': 12.5, 'font-weight': 900, fill: '#9a6b00' }, (i === 0 ? '\u{1F6A9}' : i === 99 ? '\u{1F3C6}' : '') + (i + 1)));
        g.appendChild(E('text', { x: 32, y: -13, 'font-size': 16.5, 'font-weight': 900, fill: col, 'text-anchor': 'end' }, eff));
        const L = nameLines(name);
        L.forEach((l, k) => g.appendChild(E('text', { x: 2, y: (L.length === 1 ? 11 : 3 + k * 12.5), 'font-size': l.length > 11 ? 10 : 11.5, 'font-weight': 800, fill: '#3b2f13', 'text-anchor': 'middle' }, l)));
        group.appendChild(g);
    }

    // the town on the right
    const town = E('g');
    tree(town, 852, 470, 1); tree(town, 960, 450, 1.1); tree(town, 880, 560, 1.15); tree(town, 975, 585, .95);
    tree(town, 846, 690, 1); tree(town, 975, 700, 1.05);
    house(town, 848, 610, '#c0572b'); house(town, 920, 640, '#2f6fd6');
    // fountain
    town.appendChild(E('ellipse', { cx: 915, cy: 520, rx: 30, ry: 14, fill: '#cfc7b0', stroke: '#a89f86', 'stroke-width': 2 }));
    town.appendChild(E('ellipse', { cx: 915, cy: 518, rx: 24, ry: 10, fill: '#8fd0f7' }));
    town.appendChild(E('rect', { x: 912, y: 498, width: 6, height: 20, fill: '#cfc7b0' }));
    town.appendChild(E('path', { d: 'M915 498 q-10 -10 -14 4 M915 498 q10 -10 14 4', fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    // lamp posts
    [[836, 250], [836, 430]].forEach(([x, y]) => { town.appendChild(E('rect', { x: x - 1.5, y, width: 3, height: 24, fill: '#3a3a3a' })); town.appendChild(E('circle', { cx: x, cy: y - 2, r: 5, fill: '#ffe680', stroke: '#b89a2b' })); });
    group.appendChild(town);
    drawBank(group, 838, 36);
    drawMarketShop(group, 838, 252);
}

/* ---------- Pawns on the tiles ---------- */
function fillCityPawns(layer) {
    const cur = APP_STATE.currentPlayerIndex, still = {};
    APP_STATE.players.forEach((p, i) => { if (!(APP_STATE.anim && APP_STATE.anim.id === p.id)) (still[p.position] = still[p.position] || []).push(i); });
    const items = [];
    for (const pos in still) {
        const list = still[pos], n = list.length, cols = Math.min(n, 4);
        list.forEach((idx, k) => {
            const t = cityTile(+pos - 1), dx = (k % 4 - (cols - 1) / 2) * 25, dy = -32 - Math.floor(k / 4) * 22;
            items.push({ idx, x: t.x + dx, y: t.y + dy, lift: 0, count: 0 });
        });
    }
    const a = APP_STATE.anim;
    if (a) {
        const idx = APP_STATE.players.findIndex(p => p.id === a.id);
        if (idx >= 0) { const pt = cityPoint(a.pos); items.push({ idx, x: pt.x, y: pt.y - 32, lift: a.lift, count: a.count }); }
    }
    items.sort((p, q) => (p.idx === cur) - (q.idx === cur));
    items.forEach(({ idx, x, y, lift, count }) => {
        const p = APP_STATE.players[idx], color = PLAYER_COLORS[idx % PLAYER_COLORS.length], turn = idx === cur, yy = y - lift * 12;
        const g = E('g', { class: 'pawn-element' });
        g.appendChild(E('ellipse', { cx: x, cy: y + 12, rx: 10 - lift * 3, ry: 3, fill: 'rgba(0,0,0,.35)' }));
        if (turn) g.appendChild(E('circle', { class: 'pawn-glow', cx: x, cy: yy, r: 16, fill: 'none', stroke: color, 'stroke-width': 3.5 }));
        g.appendChild(E('circle', { class: 'pawn-body', cx: x, cy: yy, r: turn ? 13 : 12, fill: '#0f172a', stroke: color, 'stroke-width': 4 }));
        g.appendChild(E('text', { x, y: yy + 1, 'font-size': 15, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, avatarEmoji(p.avatar)));
        if (count > 0) {
            g.appendChild(E('rect', { x: x - 13, y: yy - 38, width: 26, height: 20, rx: 10, fill: '#facc15', stroke: '#1e293b', 'stroke-width': 2 }));
            g.appendChild(E('text', { x, y: yy - 28, 'font-size': 14, 'font-weight': 900, fill: '#1e293b', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, count));
        }
        layer.appendChild(g);
    });
}

/* ---------- Buildings: click handling and the Bank pop-up ---------- */
function openBankPop() {
    const pop = document.getElementById('bankPop'); if (!pop) return;
    document.getElementById('bpPrice').textContent = marketValue();
    const h = document.getElementById('bankHint'), bh = document.getElementById('bpHint');
    if (h && bh) bh.textContent = h.textContent;
    pop.classList.remove('hidden');
}
function closeBankPop() { const pop = document.getElementById('bankPop'); if (pop) pop.classList.add('hidden'); }
function bankPopChoose(kind) { closeBankPop(); bankAction(kind); }
function cityBuilding(id) {
    Sound.unlock();
    if (id === 'bank') openBankPop();
    else if (id === 'market') bigPopup('\u{1F3EA}', 'MARKET', 'Market event cards are coming soon. For now the Market value is changed by the tiles.', 'neutral');
}
function initCityEvents() {
    const svg = document.getElementById('boardSvg'); if (!svg) return;
    svg.addEventListener('click', ev => {
        if (!isCity() || (typeof Lens !== 'undefined' && Lens.isOn())) return;
        const b = ev.target.closest && ev.target.closest('[data-bld]'); if (b) cityBuilding(b.dataset.bld);
    });
    svg.addEventListener('keydown', ev => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        const b = ev.target.closest && ev.target.closest('[data-bld]'); if (b) { ev.preventDefault(); cityBuilding(b.dataset.bld); }
    });
}
document.addEventListener('DOMContentLoaded', initCityEvents);
