/* Capital Clash: the 3D dice in the top-left corner. */

/* Multi-sided dice (10-sided for Standard, 20-sided for Short/Beginner), drawn on a canvas.
   The number is decided first; the die tumbles and lands with that face towards the player. Faces are numbered
   1..N, so the spare faces (10 on the d10, 19 and 20 on the d20) carry their own different numbers that are never rolled. */
const Poly = (() => {
    const P = (1 + Math.sqrt(5)) / 2;
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // quaternions [x, y, z, w]
    const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    const qaxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
    const qrot = (q, v) => { const u = [q[0], q[1], q[2]], t = cross(u, v).map(x => 2 * x), c = cross(u, t); return [v[0] + q[3] * t[0] + c[0], v[1] + q[3] * t[1] + c[1], v[2] + q[3] * t[2] + c[2]]; };
    const qslerp = (a, b, t) => {
        let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(x => -x); d = -d; }
        if (d > 0.9995) { const r = a.map((x, i) => x + (b[i] - x) * t), l = Math.hypot(...r); return r.map(x => x / l); }
        const th = Math.acos(d), s = Math.sin(th), k1 = Math.sin((1 - t) * th) / s, k2 = Math.sin(t * th) / s;
        return a.map((x, i) => x * k1 + b[i] * k2);
    };

    function d10() {
        const V = [[0, 1, 0], [0, -1, 0]];
        for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5; V.push([.85 * Math.sin(a), .22, .85 * Math.cos(a)]); }
        for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5 + Math.PI / 5; V.push([.85 * Math.sin(a), -.22, .85 * Math.cos(a)]); }
        const F = [];
        for (let k = 0; k < 5; k++) { F.push([0, 2 + k, 7 + k, 2 + (k + 1) % 5]); F.push([1, 7 + k, 2 + (k + 1) % 5, 7 + (k + 1) % 5]); }
        return { V, F };
    }
    function d20() {
        const V = [[0, 1, P], [0, -1, P], [0, 1, -P], [0, -1, -P], [1, P, 0], [-1, P, 0], [1, -P, 0], [-1, -P, 0], [P, 0, 1], [P, 0, -1], [-P, 0, 1], [-P, 0, -1]].map(norm);
        const dist = (a, b) => Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1], V[a][2] - V[b][2]), e = dist(0, 1), F = [];
        for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++)
            if (Math.abs(dist(i, j) - e) < .01 && Math.abs(dist(j, k) - e) < .01 && Math.abs(dist(i, k) - e) < .01) F.push([i, j, k]);
        return { V, F };
    }
    const cache = {};
    // Shape for a die with `sides` numbers: 10-sided up to 10 numbers, else 20-sided.
    function shape(sides) {
        const key = sides <= 10 ? 10 : 20;
        if (!cache[key]) {
            const s = key === 10 ? d10() : d20();
            s.faces = s.F.map(f => {
                const c = [0, 1, 2].map(d => f.reduce((a, k) => a + s.V[k][d], 0) / f.length);
                return { idx: f, c, n: norm(c) };
            });
            cache[key] = s;
        }
        return cache[key];
    }
    // Orientation that brings face i to the front with its first corner pointing up (so the number reads upright).
    function orient(sh, i) {
        const f = sh.faces[i], z = [0, 0, 1], ax = cross(f.n, z), s = Math.hypot(...ax), c = dot(f.n, z);
        const q1 = s < 1e-6 ? (c > 0 ? [0, 0, 0, 1] : [1, 0, 0, 0]) : qaxis(ax.map(x => x / s), Math.atan2(s, c));
        const v = qrot(q1, sh.V[f.idx[0]].map((x, k) => x - f.c[k]));
        return qmul(qaxis(z, Math.PI / 2 - Math.atan2(v[1], v[0])), q1);
    }
    function draw(cv, sh, q, upFace) {
        const g = cv.getContext('2d'), W = cv.width, S = W * 0.43, C = W / 2;
        g.clearRect(0, 0, W, W);
        const R = sh.V.map(v => qrot(q, v));
        const vis = [];
        sh.faces.forEach((f, i) => { const n = qrot(q, f.n); if (n[2] > 0.02) vis.push({ f, i, nz: n[2], c: qrot(q, f.c) }); });
        vis.sort((a, b) => a.c[2] - b.c[2]);
        vis.forEach(({ f, i, nz, c }) => {
            const up = i === upFace;
            g.beginPath();
            f.idx.forEach((k, j) => { const x = C + R[k][0] * S, y = C - R[k][1] * S; j ? g.lineTo(x, y) : g.moveTo(x, y); });
            g.closePath();
            g.fillStyle = up ? '#fff1f1' : `hsl(215, 32%, ${72 + nz * 22}%)`; g.fill();
            g.lineJoin = 'round'; g.lineWidth = W * 0.012; g.strokeStyle = '#64748b'; g.stroke();
            const lab = String(i + 1), size = (up ? 0.17 : 0.11 + 0.06 * nz) * W * (lab.length > 1 ? 0.85 : 1);
            g.font = `800 ${size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillStyle = up ? '#d10f0f' : '#334155';
            g.fillText(lab, C + c[0] * S, C - c[1] * S + size * 0.04);
        });
    }
    return { shape, orient, draw, qmul, qaxis, qslerp };
})();

const Dice = (() => {
    // Which of the 9 grid cells hold a pip for each face value (cells numbered 1-9, row by row).
    const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
    // Cube rotation (x, y in degrees) that brings a face to the front. Opposite faces add up to 7.
    const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
    const ROLL_MS = 1200;
    let ax = 0, ay = 0, value = 1, rolling = false, timer = null, sides = 6, raf = 0, pq = [0, 0, 0, 1];

    const mod = (a, m) => ((a % m) + m) % m;
    // Next angle that is congruent to target (mod 360) and a few full spins ahead of the current one.
    const nextAngle = (cur, target, spins) => Math.floor(cur / 360) * 360 + 360 * spins + mod(target, 360);

    function build() {
        const cube = $('diceCube');
        if (!cube || cube.children.length) return;
        for (let v = 1; v <= 6; v++) {
            const face = document.createElement('div');
            face.className = 'dice-face';
            face.dataset.face = v;
            PIPS[v].forEach(cell => {
                const pip = document.createElement('span');
                pip.className = 'dice-pip' + (v === 1 ? ' dice-pip-one' : '');
                pip.style.gridRow = Math.ceil(cell / 3);
                pip.style.gridColumn = ((cell - 1) % 3) + 1;
                face.appendChild(pip);
            });
            cube.appendChild(face);
        }
        Dice.show(1);
    }

    // The face that lies on top (facing the player) gets red pips, all other faces black.
    function markUp(n) {
        document.querySelectorAll('#diceCube .dice-face').forEach(f => f.classList.toggle('up', Number(f.dataset.face) === n));
    }

    function apply(ms) {
        const cube = $('diceCube');
        cube.style.transition = ms ? `transform ${ms}ms cubic-bezier(.16,.72,.24,1)` : 'none';
        cube.style.transform = `rotateX(${ax}deg) rotateY(${ay}deg)`;
    }


    const isPoly = () => sides > 6;
    function rollPoly(n, onDone) {
        cancelAnimationFrame(raf);
        value = n; rolling = true; bigNumber(0);
        const sh = Poly.shape(sides), f = faceOf(n), q0 = pq, qT = Poly.orient(sh, f);
        const axis = (() => { const v = [Math.random() - .5, Math.random() - .5, Math.random() - .5], l = Math.hypot(...v) || 1; return v.map(x => x / l); })();
        const spins = 2 + Math.random() * 1.5, t0 = performance.now();
        const scene = $('diceScene');
        scene.classList.remove('dice-hop'); void scene.offsetWidth; scene.classList.add('dice-hop');
        Sound.rattle(ROLL_MS - 100);
        const step = now => {
            const t = Math.min(1, (now - t0) / ROLL_MS), e = 1 - Math.pow(1 - t, 3);
            pq = Poly.qmul(Poly.qaxis(axis, (1 - e) * spins * 2 * Math.PI), Poly.qslerp(q0, qT, e));
            drawPoly(pq, t < 1 ? -1 : f);
            if (t < 1) { raf = requestAnimationFrame(step); return; }
            rolling = false; scene.classList.remove('dice-hop'); pq = qT; bigNumber(n); Sound.thud();
            if (onDone) onDone();
        };
        raf = requestAnimationFrame(step);
    }
    const faceOf = n => Math.min(Math.max(n, 1), sides) - 1;
    function drawPoly(q, upFace) { const cv = $('diceCanvas'); if (cv) Poly.draw(cv, Poly.shape(sides), q, upFace); }
    function bigNumber(n) { const b = $('diceBig'); if (!b) return; b.textContent = n ? String(n) : ''; b.classList.toggle('on', !!n); }
    function applyMode() {
        const poly = isPoly(), cube = $('diceCube'), cv = $('diceCanvas'), tilt = cube && cube.parentElement;
        if (tilt) tilt.style.display = poly ? 'none' : '';
        if (cv) cv.style.display = poly ? 'block' : 'none';
        if (!poly) bigNumber(0);
    }

    return {
        init: build,
        get sides() { return sides; },
        // Switch between the cube (1-6) and the 10/20-sided die.
        setSides(n) {
            n = n > 6 ? n : 6;
            if (n === sides) return;
            sides = n; applyMode(); this.show(Math.min(value, sides));
        },
        get rolling() { return rolling; },
        get value() { return value; },
        // Show a face immediately, without animation.
        show(n) {
            clearTimeout(timer); rolling = false;
            const scene = $('diceScene'); if (scene) scene.classList.remove('dice-hop');
            if (isPoly()) {
                cancelAnimationFrame(raf); value = n; pq = Poly.orient(Poly.shape(sides), faceOf(n)); drawPoly(pq, faceOf(n)); bigNumber(n); return;
            }
            value = n; [ax, ay] = FACE_ROT[n]; apply(0); markUp(n);
        },
        // Tumble and land on face n, then call onDone.
        roll(n, onDone) {
            clearTimeout(timer);
            if (isPoly()) return rollPoly(n, onDone);
            value = n; rolling = true; markUp(0);
            const [rx, ry] = FACE_ROT[n];
            ax = nextAngle(ax, rx, 2 + Math.floor(Math.random() * 2));
            ay = nextAngle(ay, ry, 2 + Math.floor(Math.random() * 2));
            const scene = $('diceScene');
            scene.classList.remove('dice-hop'); void scene.offsetWidth; scene.classList.add('dice-hop');
            apply(ROLL_MS);
            Sound.rattle(ROLL_MS - 100);
            timer = setTimeout(() => {
                rolling = false; scene.classList.remove('dice-hop'); markUp(n);
                Sound.thud();
                if (onDone) onDone();
            }, ROLL_MS + 50);
        }
    };
})();
