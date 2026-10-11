/* Capital Clash: SVG board, Market Tracker dials and pawns. */

// Inner radius of the single ring (smaller hole = longer bars).
const SINGLE_R_IN = 125;

function drawBoard() {
    const svg = document.getElementById('boardSvg');
    if (!svg) return;
    svg.innerHTML = '';

    const cx = 500, cy = 500;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute('id', 'boardGroup');
    fitBoardViewport(svg);
    // Fit the oval to the remaining centre area without resizing either rail.
    const wheel = svgEl('g', { transform: `translate(500 0) scale(${BOARD_SX} 1) translate(-500 0)` });

    if (APP_STATE.boardMode === 'single') {
        drawSinglePerimeterRing(wheel, cx, cy);
    } else {
        drawDoublePerimeterRing(wheel, cx, cy);
    }

    drawMarketTrackerRings(wheel, cx, cy);
    // Start Tile 0 shows only while someone still waits on it (new game); hidden once everyone has left.
    if (!APP_STATE.players.length || APP_STATE.players.some(p => p.position <= 0)) drawStartBench(group);
    drawPlayerPawns(wheel, cx, cy);
    group.appendChild(wheel);

    svg.appendChild(group);
    const u = document.getElementById('lensUse'); if (u) { u.setAttribute('href', '#'); u.setAttribute('href', '#boardGroup'); }
}

function drawSinglePerimeterRing(group, cx, cy) {
    // 100 bars with a clear gap between them (GAP board units, cut evenly at both radii), text in its own lane:
    // number (yellow, bigger) | name | effect (bold, at the end).
    const totalSectors = 100;
    const R_out = 485;
    const R_in = SINGLE_R_IN;
    const GAP = 5;
    const stepAngle = (2 * Math.PI) / totalSectors;
    const palette = ['#0284c7', '#059669', '#d97706', '#7c3aed', '#dc2626'];
    const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

    for (let i = 0; i < totalSectors; i++) {
        const tile = APP_STATE.tiles[i];
        const A1 = i * stepAngle - Math.PI / 2;
        const A2 = (i + 1) * stepAngle - Math.PI / 2;
        const o1 = pt(R_out, A1 + GAP / 2 / R_out), o2 = pt(R_out, A2 - GAP / 2 / R_out);
        const i2 = pt(R_in, A2 - GAP / 2 / R_in), i1 = pt(R_in, A1 + GAP / 2 / R_in);

        const card = isCardTile(tile);
        const mt = tile.text.match(/^(.*) \(([^)]*)\)$/);
        const effTxt = mt ? mt[2] : '';
        const neg = /^[-\u2212]/.test(effTxt);
        const fillCol = card ? '#f5b800' : neg ? '#dc2626' : '#16a34a';
        const sectorPath = svgEl('path', {
            d: `M ${o1[0]} ${o1[1]} A ${R_out} ${R_out} 0 0 1 ${o2[0]} ${o2[1]} L ${i2[0]} ${i2[1]} A ${R_in} ${R_in} 0 0 0 ${i1[0]} ${i1[1]} Z`,
            fill: fillCol, ...(card ? { stroke: '#fff7cc', 'stroke-width': 2.5 } : {})
        });
        group.appendChild(sectorPath);

        const midA = (A1 + A2) / 2;
        // Tile number in a fixed circle near the outer edge, so every number sits in the same place.
        const [bx, by] = pt(R_out - 19, midA);
        group.appendChild(svgEl('circle', { cx: bx, cy: by, r: 13, fill: '#ffffff', stroke: card ? '#7a5a00' : '#0b1f4d', 'stroke-width': 1.5 }));
        const nb = svgEl('text', { x: bx, y: by, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': tile.number >= 100 ? 10 : 13, 'font-weight': 700, fill: '#0b1f4d' });
        nb.textContent = tile.number; group.appendChild(nb);

        const [textStartX, textStartY] = pt(R_out - 38, midA);
        const textAngle = (midA * 180 / Math.PI) + 180;
        const textGroup = svgEl('g', { transform: `translate(${textStartX}, ${textStartY}) rotate(${textAngle})` });
        const name = card ? 'Event Card' : mt ? mt[1] : tile.text, effect = card ? 'Draw' : effTxt;
        // The name gets the lane between the number badge and the effect ring.
        const EFF_R = 302;   // fixed ring for every effect value
        const lane = (R_out - 38) - (EFF_R + 24);
        const fs = Math.min(15, Math.max(9, lane / (name.length * 0.58)));
        const txtCol = card ? '#000000' : '#ffffff';
        const textElem = svgEl('text', { x: 0, y: 0, fill: txtCol, 'font-size': fs.toFixed(1), 'font-weight': 500, 'dominant-baseline': 'central' });
        textElem.textContent = name;
        if (name.length * fs * 0.58 > lane) { textElem.setAttribute('textLength', lane); textElem.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
        textGroup.appendChild(textElem);
        group.appendChild(textGroup);
        // Effect (+5, -9, Draw) always sits on the same inner ring, so all values line up.
        if (effect) {
            const [ex, ey] = pt(EFF_R, midA);
            const eg = svgEl('g', { transform: `translate(${ex}, ${ey}) rotate(${textAngle})` });
            const et = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: txtCol, 'font-size': 17, 'font-weight': 800, stroke: card ? 'none' : 'rgba(0,0,0,.35)', 'stroke-width': 0.6, 'paint-order': 'stroke' });
            et.textContent = effect;
            eg.appendChild(et); group.appendChild(eg);
        }
    }
}

function drawDoublePerimeterRing(group, cx, cy) {
    const R1_out = 485, R1_in = 360;
    const R2_out = 355, R2_in = 230;
    const palette = ['#0284c7', '#059669', '#d97706', '#7c3aed', '#dc2626'];

    for (let i = 0; i < 100; i++) {
        const isOuter = i < 50;
        const ringIndex = isOuter ? i : i - 50;
        const total = 50;
        const step = (2 * Math.PI) / total;
        const R_out = isOuter ? R1_out : R2_out;
        const R_in = isOuter ? R1_in : R2_in;

        const A1 = ringIndex * step - Math.PI / 2;
        const A2 = (ringIndex + 1) * step - Math.PI / 2;

        const pathData = `M ${cx + R_out * Math.cos(A1)} ${cy + R_out * Math.sin(A1)} ` +
                         `A ${R_out} ${R_out} 0 0 1 ${cx + R_out * Math.cos(A2)} ${cy + R_out * Math.sin(A2)} ` +
                         `L ${cx + R_in * Math.cos(A2)} ${cy + R_in * Math.sin(A2)} ` +
                         `A ${R_in} ${R_in} 0 0 0 ${cx + R_in * Math.cos(A1)} ${cy + R_in * Math.sin(A1)} Z`;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("fill", palette[i % palette.length]);
        path.setAttribute("stroke", "#0d2a63");
        path.setAttribute("stroke-width", "1.5");
        group.appendChild(path);

        const midA = (A1 + A2) / 2;
        const startX = cx + (R_out - 10) * Math.cos(midA);
        const startY = cy + (R_out - 10) * Math.sin(midA);
        const textAngle = (midA * 180 / Math.PI) + 180;

        const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        textGroup.setAttribute("transform", `translate(${startX}, ${startY}) rotate(${textAngle})`);

        const textElem = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textElem.setAttribute("dominant-baseline", "central");
        textElem.setAttribute("class", "text-stroke");

        const numSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        numSpan.textContent = (i + 1) + " ";
        numSpan.setAttribute("fill", "#facc15");
        numSpan.setAttribute("font-weight", "900");
        numSpan.setAttribute("font-size", "15");

        const labelSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        labelSpan.textContent = APP_STATE.tiles[i].text;
        labelSpan.setAttribute("fill", "#ffffff");
        labelSpan.setAttribute("font-size", "13");

        textElem.appendChild(numSpan);
        textElem.appendChild(labelSpan);
        textGroup.appendChild(textElem);
        group.appendChild(textGroup);
    }
}

function drawMarketTrackerRings(group, cx, cy) {
    // Centre of the board: just the current market value (no dials).
    const single = APP_STATE.boardMode === 'single', rDisc = single ? SINGLE_R_IN : 230, rInner = rDisc - 25;
    const disc = svgEl("circle", { cx, cy, r: rDisc, fill: "#1b4796", stroke: "#8fbcff", "stroke-width": 2 });
    group.appendChild(disc);
    group.appendChild(svgEl("circle", { cx, cy, r: rInner, fill: "#12336f", stroke: "#eab308", "stroke-width": 5 }));
    const v = APP_STATE.marketTracker[2] * 100 + APP_STATE.marketTracker[1] * 10 + APP_STATE.marketTracker[0];
    const t1 = svgEl("text", { x: cx, y: cy - (single ? 50 : 70), fill: "#cfe0ff", "font-size": single ? 17 : 30, "font-weight": 800, "text-anchor": "middle", "letter-spacing": 3 });
    t1.textContent = "MARKET TRACKER";
    const t2 = svgEl("text", { x: cx, y: cy - (single ? 28 : 36), fill: "#cfe0ff", "font-size": single ? 17 : 30, "font-weight": 800, "text-anchor": "middle", "letter-spacing": 3 });
    t2.textContent = "VALUE";
    const val = svgEl("text", { id: "centerValue", x: cx, y: cy, "dominant-baseline": "central", fill: "#facc15", "font-size": single ? 82 : 150, "font-weight": 900, "text-anchor": "middle" });
    val.textContent = v;
    group.appendChild(val);
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs) {
    const e = document.createElementNS(SVG_NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
}

// Pawns stand OUTSIDE the board, on the perimeter, next to the space they are on.
// They are big enough to read and never touch: each pawn takes the free spot closest to its space
// (first straight out from the space, then further out / to the sides), and a thin line links it to its tile.
const PAWN_R = 27;            // pawn radius
const PAWN_R0 = 487 + 30;     // first row, just outside the outer edge of the tiles (485)
const PAWN_GAP = 4;           // free space kept between two pawns
// Tile 0: the Start Bench in the top-left corner, before Tile 1. Pawns wait here until their first roll,
// so a first roll of 5 lands exactly on Tile 5.
let BOARD_SX = 1.16;
let boardResizeObserver;
function fitBoardViewport(svg) {
    const container = svg.parentElement;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    BOARD_SX = Math.min(1.25, Math.max(1.16, width / height * 1120 / 970));
    // Keep a gentle oval instead of flattening the board to fill wide screens.
    const viewWidth = 970 * BOARD_SX;
    svg.setAttribute('viewBox', `${500 - viewWidth / 2} -70 ${viewWidth} 1120`);
    if (!boardResizeObserver && typeof ResizeObserver !== 'undefined') {
        boardResizeObserver = new ResizeObserver(() => drawBoard());
        boardResizeObserver.observe(container);
    }
}
const BENCH = { x: 1000, y: -62, w: 100, h: 100 };
// Waiting spots beside the bench (screen coords), converted into the stretched wheel's coords.
const BENCH_SPOTS = [[945, -38], [887, -38], [829, -38], [771, -38], [713, -38], [1080, 90], [1022, 90], [964, 90], [1080, 148], [1022, 148]];
const benchSpot = k => { const [x, y] = BENCH_SPOTS[k % BENCH_SPOTS.length]; return { x: 500 + (x - 500) / BOARD_SX, y }; };
function drawStartBench(group) {
    const g = svgEl('g', { id: 'startBench' });
    g.appendChild(svgEl('rect', { x: BENCH.x, y: BENCH.y, width: BENCH.w, height: BENCH.h, rx: 8, class: 'start-tile' }));
    const number = svgEl('text', { x: BENCH.x + BENCH.w / 2, y: BENCH.y + 56, 'text-anchor': 'middle', 'font-size': 48, 'font-weight': 900, class: 'start-tile-number' });
    number.textContent = '0';
    g.appendChild(number);
    const t = svgEl('text', { x: BENCH.x + BENCH.w / 2, y: BENCH.y + 84, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 900, class: 'start-tile-label' });
    t.textContent = 'START';
    g.appendChild(t);
    // dashed arrow from the bench towards Tile 1 (just right of 12 o'clock)
    g.appendChild(svgEl('path', { d: 'M 1000 -70 Q 760 -95 560 -2', fill: 'none', stroke: '#ffd54a', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 9' }));
    g.appendChild(svgEl('path', { d: 'M 548 6 l 8 -18 l 12 14 z', fill: '#ffd54a' }));
    group.appendChild(g);
}
const pawnAngle = pos => (pos - 0.5) * (2 * Math.PI / 100) - Math.PI / 2;

// Spots of all players (index = player index). Uses stored positions, so a hopping pawn keeps its spot.
function pawnSpots() {
    const spots = [], placed = [];
    const need = 2 * PAWN_R + PAWN_GAP, side = need, rowStep = need * 0.87;
    const evenRow = [0, -1, 1, -2, 2, -3, 3, -4, 4], oddRow = [-0.5, 0.5, -1.5, 1.5, -2.5, 2.5, -3.5, 3.5];
    let bench = 0;
    APP_STATE.players.forEach((p, i) => {
        if (p.position <= 0) { spots[i] = benchSpot(bench++); spots[i].bench = true; return; }
        const ang = pawnAngle(p.position), tx = -Math.sin(ang), ty = Math.cos(ang);
        let best = null;
        for (let row = 0; row < 4 && !best; row++) {
            for (const sd of (row % 2 ? oddRow : evenRow)) {
                const r = PAWN_R0 + row * rowStep, o = sd * side;
                const x = 500 + r * Math.cos(ang) + tx * o, y = 500 + r * Math.sin(ang) + ty * o;
                if (placed.every(q => Math.hypot(q.x - x, q.y - y) >= need - 0.05)) { best = { x, y }; break; }
            }
        }
        if (!best) best = { x: 500 + (PAWN_R0 + 4 * rowStep) * Math.cos(ang), y: 500 + (PAWN_R0 + 4 * rowStep) * Math.sin(ang) };
        spots[i] = best; placed.push(best);
    });
    return spots;
}

function fillPawnLayer(layer) {
    const cur = APP_STATE.currentPlayerIndex, spots = pawnSpots();
    // The player whose turn it is is drawn last, so they sit on top.
    const order = APP_STATE.players.map((_, i) => i).sort((a, b) => (a === cur) - (b === cur));
    order.forEach(idx => {
        const p = APP_STATE.players[idx];
        const anim = APP_STATE.anim && APP_STATE.anim.id === p.id ? APP_STATE.anim : null;
        let { x, y } = spots[idx];
        if (anim) { // while hopping, the pawn travels along the perimeter from space to space
            const ang = pawnAngle(anim.pos), r = PAWN_R0;
            x = 500 + r * Math.cos(ang); y = 500 + r * Math.sin(ang);
        }
        const lift = anim ? anim.lift : 0;
        const yy = y - lift * 14;
        const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
        const isTurn = idx === cur;
        const ang = pawnAngle(anim ? anim.pos : p.position);

        const g = svgEl('g', { class: 'pawn-element' });
        // link to the tile the pawn is standing at
        if (anim || !spots[idx].bench) {
            g.appendChild(svgEl('line', { x1: 500 + 487 * Math.cos(ang), y1: 500 + 487 * Math.sin(ang), x2: x, y2: y, stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85 }));
            g.appendChild(svgEl('circle', { cx: 500 + 487 * Math.cos(ang), cy: 500 + 487 * Math.sin(ang), r: 4, fill: color, stroke: '#fff', 'stroke-width': 1.5 }));
        }
        g.appendChild(svgEl('ellipse', { cx: x, cy: y + PAWN_R - 2, rx: PAWN_R * 0.8 - lift * 4, ry: 4 - lift, fill: 'rgba(0,0,0,0.45)' }));
        if (isTurn) g.appendChild(svgEl('circle', { class: 'pawn-glow', cx: x, cy: yy, r: PAWN_R + 3, fill: 'none', stroke: color, 'stroke-width': 4 }));
        g.appendChild(svgEl('circle', { class: 'pawn-body', cx: x, cy: yy, r: PAWN_R, fill: '#0f172a', stroke: color, 'stroke-width': 6 }));
        const face = svgEl('text', { x, y: yy + 1, 'font-size': 33, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        face.textContent = avatarEmoji(p.avatar);
        g.appendChild(face);
        if (anim && anim.count > 0) { // the number being counted as the avatar hops forward
            g.appendChild(svgEl('rect', { x: x - 15, y: yy - 58, width: 30, height: 24, rx: 12, fill: '#facc15', stroke: '#1e293b', 'stroke-width': 2 }));
            const n = svgEl('text', { x, y: yy - 46, 'font-size': 16, 'font-weight': 900, fill: '#1e293b', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
            n.textContent = anim.count;
            g.appendChild(n);
        }
        layer.appendChild(g);
    });
}

function drawPlayerPawns(group) {
    const layer = svgEl('g', { id: 'pawnLayer' });
    fillPawnLayer(layer);
    group.appendChild(layer);
}

// Redraw only the pawns (cheap), used every animation frame instead of redrawing the whole board.
function renderPawnLayer() {
    const layer = document.getElementById('pawnLayer');
    if (!layer) return;
    layer.innerHTML = '';
    fillPawnLayer(layer);
}

// The Market Tracker is locked for players: tile effects and the host's Reset (requestReset in game.js) are the only ways it changes.
function resetMarketTracker() { requestReset(); }

function updateMarketTrackerUI() {
    
    const fullVal = `${APP_STATE.marketTracker[2]}${APP_STATE.marketTracker[1]}${APP_STATE.marketTracker[0]}`;
    document.getElementById('trackerValueBadge').textContent = fullVal;
    const bp = document.getElementById('bankPrice'); if (bp) bp.textContent = money(parseInt(fullVal, 10));
    const bs = document.getElementById('bankSym'); if (bs) bs.textContent = curSym();
    // Previous share price right under the current one, so everyone sees where the market moved.
    const now = parseInt(fullVal, 10), pv = APP_STATE.prevMarket, d = pv == null ? 0 : now - pv;
    const prevHtml = pv == null ? '<span>Previous: <b>-</b></span><em class="flat">no move yet</em>'
        : `<span>Previous: <b>${money(pv)}</b></span><em class="${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '\u25B2 +' + d : d < 0 ? '\u25BC ' + d : '= 0'}</em>`;
    ['bankPrev', 'trackerPrev'].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = prevHtml; });

    if (typeof renderWallet === 'function') renderWallet();
    if (typeof renderTrade === 'function' && !document.getElementById('tradeModal').classList.contains('hidden')) renderTrade();
    const quickInput = document.getElementById('quickNumberInput');
    if (quickInput && document.activeElement !== quickInput) {
        quickInput.value = parseInt(fullVal, 10);
    }
}

function setBoardMode(mode) {
    if (MP.on && !isHost()) return;
    APP_STATE.boardMode = mode;
    document.getElementById('btnSingleRing').className = mode === 'single' ? "px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-bold transition" : "px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition";
    document.getElementById('btnDoubleRing').className = mode === 'double' ? "px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-bold transition" : "px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition";
    drawBoard();
    broadcastIfHost();
}

function paintModeButtons(mode) {
    $('btnSingleRing').className = mode === 'single' ? 'px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-bold transition' : 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition';
    $('btnDoubleRing').className = mode === 'double' ? 'px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-bold transition' : 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition';
}

function syncTracker() {
    if (!MP.on || MP.phase !== 'playing') return;
    const send = () => { MP.lastTrackerSend = Date.now(); MP.t.send('tracker', { from: MP.id, m: [...APP_STATE.marketTracker], r: [...APP_STATE.ringRotations] }); };
    clearTimeout(MP.trackerTimer);
    if (Date.now() - MP.lastTrackerSend >= 60) send(); else MP.trackerTimer = setTimeout(send, 60);
}

