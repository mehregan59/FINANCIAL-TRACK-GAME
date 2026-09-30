/* Capital Clash: SVG board, Market Tracker dials and pawns. */

function drawBoard() {
    const svg = document.getElementById('boardSvg');
    if (!svg) return;
    svg.innerHTML = '';

    const cx = 500, cy = 500;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    if (APP_STATE.boardMode === 'single') {
        drawSinglePerimeterRing(group, cx, cy);
    } else {
        drawDoublePerimeterRing(group, cx, cy);
    }

    drawMarketTrackerRings(group, cx, cy);
    drawPlayerPawns(group, cx, cy);

    svg.appendChild(group);
}

function drawSinglePerimeterRing(group, cx, cy) {
    const totalSectors = 100;
    const R_out = 485;
    const R_in = 230;
    const stepAngle = (2 * Math.PI) / totalSectors;
    const palette = ['#0284c7', '#059669', '#d97706', '#7c3aed', '#dc2626'];

    for (let i = 0; i < totalSectors; i++) {
        const tile = APP_STATE.tiles[i];
        const A1 = i * stepAngle - Math.PI / 2;
        const A2 = (i + 1) * stepAngle - Math.PI / 2;

        const x1_out = cx + R_out * Math.cos(A1);
        const y1_out = cy + R_out * Math.sin(A1);
        const x2_out = cx + R_out * Math.cos(A2);
        const y2_out = cy + R_out * Math.sin(A2);

        const x2_in = cx + R_in * Math.cos(A2);
        const y2_in = cy + R_in * Math.sin(A2);
        const x1_in = cx + R_in * Math.cos(A1);
        const y1_in = cy + R_in * Math.sin(A1);

        const pathData = `M ${x1_out} ${y1_out} A ${R_out} ${R_out} 0 0 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${R_in} ${R_in} 0 0 0 ${x1_in} ${y1_in} Z`;

        const sectorPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        sectorPath.setAttribute("d", pathData);
        sectorPath.setAttribute("fill", palette[i % palette.length]);
        sectorPath.setAttribute("stroke", "#0d2a63");
        sectorPath.setAttribute("stroke-width", "1.5");
        group.appendChild(sectorPath);

        const midA = (A1 + A2) / 2;
        const textStartX = cx + (R_out - 12) * Math.cos(midA);
        const textStartY = cy + (R_out - 12) * Math.sin(midA);
        let textAngle = (midA * 180 / Math.PI) + 180;

        const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        textGroup.setAttribute("transform", `translate(${textStartX}, ${textStartY}) rotate(${textAngle})`);

        const textElem = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textElem.setAttribute("x", "0");
        textElem.setAttribute("y", "0");
        textElem.setAttribute("fill", "#ffffff");
        textElem.setAttribute("font-size", "12.5");
        textElem.setAttribute("font-weight", "800");
        textElem.setAttribute("dominant-baseline", "central");
        textElem.setAttribute("class", "text-stroke");

        const numSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        numSpan.textContent = tile.number + " ";
        numSpan.setAttribute("fill", "#facc15");
        numSpan.setAttribute("font-weight", "900");
        numSpan.setAttribute("font-size", "14");

        const textSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        textSpan.textContent = tile.text;
        textSpan.setAttribute("fill", "#ffffff");

        textElem.appendChild(numSpan);
        textElem.appendChild(textSpan);
        textGroup.appendChild(textElem);
        group.appendChild(textGroup);
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
    const disc = svgEl("circle", { cx, cy, r: 230, fill: "#1b4796", stroke: "#8fbcff", "stroke-width": 2 });
    group.appendChild(disc);
    group.appendChild(svgEl("circle", { cx, cy, r: 205, fill: "#12336f", stroke: "#eab308", "stroke-width": 5 }));
    const v = APP_STATE.marketTracker[2] * 100 + APP_STATE.marketTracker[1] * 10 + APP_STATE.marketTracker[0];
    const t1 = svgEl("text", { x: cx, y: cy - 78, fill: "#cfe0ff", "font-size": 30, "font-weight": 800, "text-anchor": "middle", "letter-spacing": 3 });
    t1.textContent = "MARKET TRACKER";
    const t2 = svgEl("text", { x: cx, y: cy - 40, fill: "#cfe0ff", "font-size": 30, "font-weight": 800, "text-anchor": "middle", "letter-spacing": 3 });
    t2.textContent = "VALUE";
    const val = svgEl("text", { id: "centerValue", x: cx, y: cy + 82, fill: "#facc15", "font-size": 150, "font-weight": 900, "text-anchor": "middle" });
    val.textContent = v;
    group.appendChild(t1); group.appendChild(t2); group.appendChild(val);
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
const pawnAngle = pos => (pos - 0.5) * (2 * Math.PI / 100) - Math.PI / 2;

// Spots of all players (index = player index). Uses stored positions, so a hopping pawn keeps its spot.
function pawnSpots() {
    const spots = [], placed = [];
    const need = 2 * PAWN_R + PAWN_GAP, side = need, rowStep = need * 0.87;
    const evenRow = [0, -1, 1, -2, 2, -3, 3, -4, 4], oddRow = [-0.5, 0.5, -1.5, 1.5, -2.5, 2.5, -3.5, 3.5];
    APP_STATE.players.forEach((p, i) => {
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
        g.appendChild(svgEl('line', { x1: 500 + 487 * Math.cos(ang), y1: 500 + 487 * Math.sin(ang), x2: x, y2: y, stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85 }));
        g.appendChild(svgEl('circle', { cx: 500 + 487 * Math.cos(ang), cy: 500 + 487 * Math.sin(ang), r: 4, fill: color, stroke: '#fff', 'stroke-width': 1.5 }));
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
    const bp = document.getElementById('bankPrice'); if (bp) bp.textContent = parseInt(fullVal, 10);

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

