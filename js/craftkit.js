/* Capital Clash: printable 4-sheet craft kit. */

// Craft Kit Functions
function openCraftKitModal() {
    document.getElementById('craftKitModal').classList.remove('hidden');
    renderAllCraftSheets();
}

function closeCraftKitModal() {
    document.getElementById('craftKitModal').classList.add('hidden');
}

function showCraftSheet(sheetNum) {
    for (let i = 1; i <= 4; i++) {
        const sheet = document.getElementById(`sheet${i}View`);
        const tab = document.getElementById(`craftTab${i}`);
        if (sheet) sheet.classList.toggle('hidden', i !== sheetNum);
        if (tab) {
            tab.className = i === sheetNum 
                ? "px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold" 
                : "px-4 py-2 rounded-lg text-slate-400 hover:text-slate-100 font-bold";
        }
    }
}

function renderAllCraftSheets() {
    renderSheet1_MainBoard();
    renderSheet2_NumberDials();
    renderSheet3_CoverShields();
}

function renderSheet1_MainBoard() {
    const svg = document.getElementById('sheet1Svg');
    if (!svg) return;
    svg.innerHTML = '';
    const cx = 500, cy = 500;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    if (APP_STATE.boardMode === 'single') {
        drawSinglePerimeterRing(group, cx, cy);
    } else {
        drawDoublePerimeterRing(group, cx, cy);
    }

    const centerMount = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    centerMount.setAttribute("cx", cx); centerMount.setAttribute("cy", cy);
    centerMount.setAttribute("r", "230"); centerMount.setAttribute("fill", "#090d16");
    centerMount.setAttribute("stroke", "#eab308"); centerMount.setAttribute("stroke-width", "3");
    centerMount.setAttribute("stroke-dasharray", "8,8");
    group.appendChild(centerMount);

    const pinCrossH = document.createElementNS("http://www.w3.org/2000/svg", "line");
    pinCrossH.setAttribute("x1", cx - 20); pinCrossH.setAttribute("y1", cy);
    pinCrossH.setAttribute("x2", cx + 20); pinCrossH.setAttribute("y2", cy);
    pinCrossH.setAttribute("stroke", "#facc15"); pinCrossH.setAttribute("stroke-width", "3");
    group.appendChild(pinCrossH);

    const pinCrossV = document.createElementNS("http://www.w3.org/2000/svg", "line");
    pinCrossV.setAttribute("x1", cx); pinCrossV.setAttribute("y1", cy - 20);
    pinCrossV.setAttribute("x2", cx); pinCrossV.setAttribute("y2", cy + 20);
    pinCrossV.setAttribute("stroke", "#facc15"); pinCrossV.setAttribute("stroke-width", "3");
    group.appendChild(pinCrossV);

    const centerTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerTxt.setAttribute("x", cx); centerTxt.setAttribute("y", cy + 40);
    centerTxt.setAttribute("fill", "#facc15"); centerTxt.setAttribute("font-size", "14");
    centerTxt.setAttribute("font-weight", "900"); centerTxt.setAttribute("text-anchor", "middle");
    centerTxt.textContent = "SHEET 1 BASE: MOUNT ROTATING DIALS HERE";
    group.appendChild(centerTxt);

    svg.appendChild(group);
}

function renderSheet2_NumberDials() {
    const svg = document.getElementById('sheet2Svg');
    if (!svg) return;
    svg.innerHTML = '';
    const cx = 500, cy = 500;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const ringConfigs = [
        { id: 0, name: "Units Ring", rOut: 100, rIn: 45, color: "#10b981" },
        { id: 1, name: "Tens Ring", rOut: 160, rIn: 105, color: "#06b6d4" },
        { id: 2, name: "Hundreds Ring", rOut: 220, rIn: 165, color: "#f59e0b" }
    ];

    ringConfigs.forEach(cfg => {
        const rMid = (cfg.rOut + cfg.rIn) / 2;
        
        const outC = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        outC.setAttribute("cx", cx); outC.setAttribute("cy", cy); outC.setAttribute("r", cfg.rOut);
        outC.setAttribute("stroke", cfg.color); outC.setAttribute("stroke-width", "2");
        outC.setAttribute("stroke-dasharray", "6,4"); outC.setAttribute("fill", "none");
        group.appendChild(outC);

        const inC = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        inC.setAttribute("cx", cx); inC.setAttribute("cy", cy); inC.setAttribute("r", cfg.rIn);
        inC.setAttribute("stroke", cfg.color); inC.setAttribute("stroke-width", "2");
        inC.setAttribute("stroke-dasharray", "6,4"); inC.setAttribute("fill", "none");
        group.appendChild(inC);

        for (let d = 0; d < 10; d++) {
            const ang = (d * 36) * Math.PI / 180 - Math.PI / 2;
            const nx = cx + rMid * Math.cos(ang);
            const ny = cy + rMid * Math.sin(ang);

            const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txt.setAttribute("x", nx); txt.setAttribute("y", ny);
            txt.setAttribute("fill", "#0f172a"); txt.setAttribute("font-size", "22");
            txt.setAttribute("font-weight", "900"); txt.setAttribute("text-anchor", "middle");
            txt.setAttribute("dominant-baseline", "central");
            txt.textContent = d;
            group.appendChild(txt);
        }
    });

    const pinV = document.createElementNS("http://www.w3.org/2000/svg", "line");
    pinV.setAttribute("x1", cx); pinV.setAttribute("y1", cy - 25);
    pinV.setAttribute("x2", cx); pinV.setAttribute("y2", cy + 25);
    pinV.setAttribute("stroke", "#0f172a"); pinV.setAttribute("stroke-width", "2");
    group.appendChild(pinV);

    const pinH = document.createElementNS("http://www.w3.org/2000/svg", "line");
    pinH.setAttribute("x1", cx - 25); pinH.setAttribute("y1", cy);
    pinH.setAttribute("x2", cx + 25); pinH.setAttribute("y2", cy);
    pinH.setAttribute("stroke", "#0f172a"); pinH.setAttribute("stroke-width", "2");
    group.appendChild(pinH);

    svg.appendChild(group);
}

function renderSheet3_CoverShields() {
    const svg = document.getElementById('sheet3Svg');
    if (!svg) return;
    svg.innerHTML = '';
    const cx = 500, cy = 500;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const ringConfigs = [
        { id: 0, name: "Units Cover", rOut: 100, rIn: 45, color: "#10b981" },
        { id: 1, name: "Tens Cover", rOut: 160, rIn: 105, color: "#06b6d4" },
        { id: 2, name: "Hundreds Cover", rOut: 220, rIn: 165, color: "#f59e0b" }
    ];

    ringConfigs.forEach(cfg => {
        const rMid = (cfg.rOut + cfg.rIn) / 2;
        const windowY = cy - rMid;

        const cBody = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        cBody.setAttribute("cx", cx); cBody.setAttribute("cy", cy); cBody.setAttribute("r", rMid);
        cBody.setAttribute("stroke", "#0f172a"); cBody.setAttribute("stroke-width", cfg.rOut - cfg.rIn);
        cBody.setAttribute("fill", "none");
        group.appendChild(cBody);

        const cutWin = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        cutWin.setAttribute("x", cx - 18); cutWin.setAttribute("y", windowY - 18);
        cutWin.setAttribute("width", "36"); cutWin.setAttribute("height", "36");
        cutWin.setAttribute("rx", "6");
        cutWin.setAttribute("fill", "#ffffff"); cutWin.setAttribute("stroke", "#ef4444");
        cutWin.setAttribute("stroke-width", "3"); cutWin.setAttribute("stroke-dasharray", "4,4");
        group.appendChild(cutWin);

        const cutTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        cutTxt.setAttribute("x", cx); cutTxt.setAttribute("y", windowY);
        cutTxt.setAttribute("fill", "#ef4444"); cutTxt.setAttribute("font-size", "9");
        cutTxt.setAttribute("font-weight", "900"); cutTxt.setAttribute("text-anchor", "middle");
        cutTxt.setAttribute("dominant-baseline", "central");
        cutTxt.textContent = "CUT OUT";
        group.appendChild(cutTxt);
    });

    svg.appendChild(group);
}

function renderPawnCutouts() {
    const box = document.getElementById('pawnCutouts');
    if (!box) return;
    box.innerHTML = Array.from({ length: 10 }, (_, k) => `<div class="border-2 border-dashed border-slate-400 p-2 rounded-lg bg-white">
        <div class="w-6 h-6 mx-auto rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[10px] mb-1">P${k + 1}</div>
        <span class="text-[9px] text-slate-600 block">Fold Base</span>
    </div>`).join('');
}
