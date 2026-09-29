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
        sectorPath.setAttribute("stroke", "#020617");
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
        path.setAttribute("stroke", "#020617");
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
    const ringConfigs = [
        { id: 0, name: "Units", rOut: 100, rIn: 45, color: "#10b981" },
        { id: 1, name: "Tens", rOut: 160, rIn: 105, color: "#06b6d4" },
        { id: 2, name: "Hundreds", rOut: 220, rIn: 165, color: "#f59e0b" }
    ];

    let defs = group.querySelector("defs");
    if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        group.appendChild(defs);
    }

    ringConfigs.forEach((cfg) => {
        const rMid = (cfg.rOut + cfg.rIn) / 2;
        const windowY = cy - rMid;

        // SVG Mask for cover shield
        const maskId = `ringCoverMask_${cfg.id}`;
        let mask = defs.querySelector(`#${maskId}`);
        if (!mask) {
            mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
            mask.setAttribute("id", maskId);
            mask.setAttribute("maskUnits", "userSpaceOnUse");
            mask.setAttribute("maskContentUnits", "userSpaceOnUse");
            
            const whiteRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            whiteRect.setAttribute("x", "0");
            whiteRect.setAttribute("y", "0");
            whiteRect.setAttribute("width", "1000");
            whiteRect.setAttribute("height", "1000");
            whiteRect.setAttribute("fill", "#ffffff");
            mask.appendChild(whiteRect);

            const blackHole = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            blackHole.setAttribute("x", cx - 18);
            blackHole.setAttribute("y", windowY - 18);
            blackHole.setAttribute("width", "36");
            blackHole.setAttribute("height", "36");
            blackHole.setAttribute("rx", "8");
            blackHole.setAttribute("fill", "#000000");
            mask.appendChild(blackHole);

            defs.appendChild(mask);
        }

        // Rotatable Dial Group
        const ringGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                        ringGroup.setAttribute("id", `ringGroup_${cfg.id}`);
        
        const rotDeg = APP_STATE.ringRotations[cfg.id];
        ringGroup.setAttribute("transform", `rotate(${rotDeg}, ${cx}, ${cy})`);

        const ringBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ringBg.setAttribute("cx", cx);
        ringBg.setAttribute("cy", cy);
        ringBg.setAttribute("r", rMid);
        ringBg.setAttribute("stroke", "#090d16");
        ringBg.setAttribute("stroke-width", cfg.rOut - cfg.rIn);
        ringBg.setAttribute("fill", "none");
        ringGroup.appendChild(ringBg);

        // Numbers 0 to 9 with Counter-Rotation to keep upright
        for (let d = 0; d < 10; d++) {
            const ang = (d * 36) * Math.PI / 180 - Math.PI / 2;
            const nx = cx + rMid * Math.cos(ang);
            const ny = cy + rMid * Math.sin(ang);

            const numTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            numTxt.setAttribute("x", nx);
            numTxt.setAttribute("y", ny);
            numTxt.setAttribute("fill", cfg.color);
            numTxt.setAttribute("font-size", "22");
            numTxt.setAttribute("font-weight", "900");
            numTxt.setAttribute("text-anchor", "middle");
            numTxt.setAttribute("dominant-baseline", "central");
            numTxt.setAttribute("transform", `rotate(${-rotDeg}, ${nx}, ${ny})`);
            numTxt.textContent = d;
            ringGroup.appendChild(numTxt);
        }

        group.appendChild(ringGroup);

        // Opaque Cover Plate Ring
        const coverRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        coverRing.setAttribute("cx", cx);
        coverRing.setAttribute("cy", cy);
        coverRing.setAttribute("r", rMid);
        coverRing.setAttribute("stroke", "#090d16");
        coverRing.setAttribute("stroke-width", cfg.rOut - cfg.rIn);
        coverRing.setAttribute("fill", "none");
        coverRing.setAttribute("mask", `url(#${maskId})`);
                        group.appendChild(coverRing);

        // Trim Lines
        const outerBorder = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        outerBorder.setAttribute("cx", cx); outerBorder.setAttribute("cy", cy);
        outerBorder.setAttribute("r", cfg.rOut); outerBorder.setAttribute("stroke", "#1e293b");
        outerBorder.setAttribute("stroke-width", "1.5"); outerBorder.setAttribute("fill", "none");
        group.appendChild(outerBorder);

        const innerBorder = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        innerBorder.setAttribute("cx", cx); innerBorder.setAttribute("cy", cy);
        innerBorder.setAttribute("r", cfg.rIn); innerBorder.setAttribute("stroke", "#1e293b");
        innerBorder.setAttribute("stroke-width", "1.5"); innerBorder.setAttribute("fill", "none");
        group.appendChild(innerBorder);

        // 12 o'clock Aperture Window
        const aperture = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        aperture.setAttribute("x", cx - 18);
        aperture.setAttribute("y", windowY - 18);
        aperture.setAttribute("width", "36");
        aperture.setAttribute("height", "36");
        aperture.setAttribute("rx", "8");
        aperture.setAttribute("fill", "none");
        aperture.setAttribute("stroke", cfg.color);
        aperture.setAttribute("stroke-width", "3");
        aperture.setAttribute("filter", "drop-shadow(0 0 6px " + cfg.color + ")");
                        group.appendChild(aperture);

    });

    // Center Hub Badge
    const hubBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    hubBg.setAttribute("cx", cx); hubBg.setAttribute("cy", cy); hubBg.setAttribute("r", "42");
    hubBg.setAttribute("fill", "#020617"); hubBg.setAttribute("stroke", "#eab308");
    hubBg.setAttribute("stroke-width", "3");
    group.appendChild(hubBg);

    const hubLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    hubLabel.setAttribute("x", cx); hubLabel.setAttribute("y", cy - 20);
    hubLabel.setAttribute("fill", "#cbd5e1"); hubLabel.setAttribute("font-size", "10");
    hubLabel.setAttribute("font-weight", "800"); hubLabel.setAttribute("text-anchor", "middle");
    hubLabel.textContent = "MARKET";
    group.appendChild(hubLabel);
    const hubLabel2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    hubLabel2.setAttribute("x", cx); hubLabel2.setAttribute("y", cy - 8);
    hubLabel2.setAttribute("fill", "#cbd5e1"); hubLabel2.setAttribute("font-size", "10");
    hubLabel2.setAttribute("font-weight", "800"); hubLabel2.setAttribute("text-anchor", "middle");
    hubLabel2.textContent = "TRACKER";
    group.appendChild(hubLabel2);

    const trackerValStr = `${APP_STATE.marketTracker[2]}${APP_STATE.marketTracker[1]}${APP_STATE.marketTracker[0]}`;
    const hubVal = document.createElementNS("http://www.w3.org/2000/svg", "text");
    hubVal.setAttribute("x", cx); hubVal.setAttribute("y", cy + 16);
    hubVal.setAttribute("fill", "#facc15"); hubVal.setAttribute("font-size", "20");
    hubVal.setAttribute("font-weight", "900"); hubLabel.setAttribute("text-anchor", "middle");
    hubVal.setAttribute("text-anchor", "middle");
    hubVal.textContent = trackerValStr;
    group.appendChild(hubVal);
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs) {
    const e = document.createElementNS(SVG_NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
}

// Pawns stand OUTSIDE the board, on the perimeter, next to the space they are on.
// A pawn's spot: radius/side offsets make players on the same space fan out (3 side by side, more rings outward).
const PAWN_R0 = 518;
function pawnSlots() {
    const seen = {}, slots = [];
    APP_STATE.players.forEach((p, i) => { const k = seen[p.position] = (seen[p.position] || 0) + 1; slots[i] = k - 1; });
    return slots;
}
function pawnXY(idx, pos, slot) {
    const angle = (pos - 0.5) * (2 * Math.PI / 100) - Math.PI / 2;
    const side = ((slot % 3) - 1) * 12;              // along the perimeter: -12, 0, +12
    const r = PAWN_R0 + Math.floor(slot / 3) * 22;   // further out when more than 3 share a space
    const tx = -Math.sin(angle), ty = Math.cos(angle);
    return { x: 500 + r * Math.cos(angle) + tx * side, y: 500 + r * Math.sin(angle) + ty * side };
}

function fillPawnLayer(layer) {
    const cur = APP_STATE.currentPlayerIndex, slots = pawnSlots();
    // The player whose turn it is is drawn last, so they sit on top.
    const order = APP_STATE.players.map((_, i) => i).sort((a, b) => (a === cur) - (b === cur));
    order.forEach(idx => {
        const p = APP_STATE.players[idx];
        const anim = APP_STATE.anim && APP_STATE.anim.id === p.id ? APP_STATE.anim : null;
        const { x, y } = pawnXY(idx, anim ? anim.pos : p.position, slots[idx]);
        const lift = anim ? anim.lift : 0;
        const yy = y - lift * 12;
        const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
        const isTurn = idx === cur;

        const g = svgEl('g', { class: 'pawn-element' });
        g.appendChild(svgEl('ellipse', { cx: x, cy: y + 11, rx: 9 - lift * 3, ry: 3.2 - lift, fill: 'rgba(0,0,0,0.45)' }));
        if (isTurn) g.appendChild(svgEl('circle', { class: 'pawn-glow', cx: x, cy: yy, r: 15, fill: 'none', stroke: color, 'stroke-width': 3 }));
        g.appendChild(svgEl('circle', { cx: x, cy: yy, r: isTurn ? 12 : 11, fill: color, stroke: '#ffffff', 'stroke-width': 2 }));
        const face = svgEl('text', { x, y: yy + 0.5, 'font-size': 13, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        face.textContent = avatarEmoji(p.avatar);
        g.appendChild(face);
        if (anim && anim.count > 0) { // the number being counted as the avatar hops forward
            g.appendChild(svgEl('rect', { x: x - 11, y: yy - 36, width: 22, height: 18, rx: 9, fill: '#facc15', stroke: '#1e293b', 'stroke-width': 1.5 }));
            const n = svgEl('text', { x, y: yy - 27, 'font-size': 12, 'font-weight': 900, fill: '#1e293b', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
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

function adjustRing(ringIdx, step) {
    if (!canControlTracker()) return;
    APP_STATE.marketTracker[ringIdx] = (APP_STATE.marketTracker[ringIdx] + step + 10) % 10;
    APP_STATE.ringRotations[ringIdx] = -APP_STATE.marketTracker[ringIdx] * 36;
    updateMarketTrackerUI();
    drawBoard();
    syncTracker();
}

function resetMarketTracker() {
    if (!canControlTracker()) return;
    APP_STATE.marketTracker = [0, 0, 0];
    APP_STATE.ringRotations = [0, 0, 0];
    updateMarketTrackerUI();
    drawBoard();
    syncTracker();
}

function setDirectMarketTrackerValue(val) {
    if (!canControlTracker()) return;
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 999) num = 999;

    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;

    APP_STATE.marketTracker = [u, t, h];
    APP_STATE.ringRotations = [-u * 36, -t * 36, -h * 36];

    updateMarketTrackerUI();
    drawBoard();
    syncTracker();
}

function updateMarketTrackerUI() {
    document.getElementById('digitUnits').textContent = APP_STATE.marketTracker[0];
    document.getElementById('digitTens').textContent = APP_STATE.marketTracker[1];
    document.getElementById('digitHundreds').textContent = APP_STATE.marketTracker[2];
    
    const fullVal = `${APP_STATE.marketTracker[2]}${APP_STATE.marketTracker[1]}${APP_STATE.marketTracker[0]}`;
    document.getElementById('trackerValueBadge').textContent = fullVal;

    if (typeof renderWallet === 'function') renderWallet();
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

