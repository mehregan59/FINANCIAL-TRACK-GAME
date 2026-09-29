/* Capital Clash: the 3D dice in the top-left corner. */

const Dice = (() => {
    // Which of the 9 grid cells hold a pip for each face value (cells numbered 1-9, row by row).
    const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
    // Cube rotation (x, y in degrees) that brings a face to the front. Opposite faces add up to 7.
    const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
    const ROLL_MS = 1200;
    let ax = 0, ay = 0, value = 1, rolling = false, timer = null;

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

    function apply(ms) {
        const cube = $('diceCube');
        cube.style.transition = ms ? `transform ${ms}ms cubic-bezier(.16,.72,.24,1)` : 'none';
        cube.style.transform = `rotateX(${ax}deg) rotateY(${ay}deg)`;
    }

    return {
        init: build,
        get rolling() { return rolling; },
        get value() { return value; },
        // Show a face immediately, without animation.
        show(n) {
            clearTimeout(timer); rolling = false;
            const scene = $('diceScene'); if (scene) scene.classList.remove('dice-hop');
            value = n; [ax, ay] = FACE_ROT[n]; apply(0);
        },
        // Tumble and land on face n, then call onDone.
        roll(n, onDone) {
            clearTimeout(timer);
            value = n; rolling = true;
            const [rx, ry] = FACE_ROT[n];
            ax = nextAngle(ax, rx, 2 + Math.floor(Math.random() * 2));
            ay = nextAngle(ay, ry, 2 + Math.floor(Math.random() * 2));
            const scene = $('diceScene');
            scene.classList.remove('dice-hop'); void scene.offsetWidth; scene.classList.add('dice-hop');
            apply(ROLL_MS);
            Sound.rattle(ROLL_MS - 100);
            timer = setTimeout(() => {
                rolling = false; scene.classList.remove('dice-hop');
                Sound.thud();
                if (onDone) onDone();
            }, ROLL_MS + 50);
        }
    };
})();
