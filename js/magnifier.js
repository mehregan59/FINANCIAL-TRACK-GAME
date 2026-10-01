/* Capital Clash: board magnifier.
   - "Magnifier" button (per player, only on your own screen): a round lens follows your finger / mouse over the board and shows
     that spot about 3.5x bigger, turned so the tile text reads left to right.
   - Auto zoom: while an avatar hops, the lens follows it and stays a few seconds on the tile it lands on (on every screen).
   The lens is a second <svg> that <use>s the live board group, so pawns and text are always current. */
const Lens = (() => {
    const VW = 295, VH = 155;         // board units shown in the lens: the whole tile ring width (about 255) plus the avatars outside it
    const VX = -40;                   // after turning, the tile sits on the left edge and its text runs to the right
    let on = false, hideT = null, auto = false;
    const $ = id => document.getElementById(id);
    const el = () => $('lens');

    function size() { const w = Math.min(500, Math.round(window.innerWidth * 0.92)); return { w, h: Math.round(w * VH / VW) }; }

    // Put the lens on a board point (x, y in board units). rot = true turns the board so the tile text reads horizontally.
    function aim(x, y) {
        const l = el(), u = $('lensUse'), v = $('lensSvg');
        if (!l || !u || !v) return;
        const bg = v.firstElementChild; if (bg) bg.setAttribute('fill', typeof isCity === 'function' && isCity() ? '#cfe9a9' : '#0b1f4d');
        if (typeof isCity === 'function' && isCity()) { // city path: no turning, show a wide patch of road
            u.setAttribute('transform', '');
            const w = 300, h = Math.round(w * VH / VW);
            v.setAttribute('viewBox', (x - w / 2) + ' ' + (y - h / 2) + ' ' + w + ' ' + h);
            return;
        }
        const dx = x - 500, dy = y - 500, r = Math.hypot(dx, dy);
        let phi = 0;
        if (r > 150) phi = 180 - Math.atan2(dy, dx) * 180 / Math.PI; // tile on the left, text then runs to the right
        u.setAttribute('transform', 'rotate(' + phi.toFixed(2) + ' 500 500)');
        const a = phi * Math.PI / 180, rx = 500 + dx * Math.cos(a) - dy * Math.sin(a), ry = 500 + dx * Math.sin(a) + dy * Math.cos(a);
        if (phi) v.setAttribute('viewBox', VX + ' ' + (ry - VH / 2) + ' ' + VW + ' ' + VH);       // rotated: tile ring on the left
        else v.setAttribute('viewBox', (rx - VW / 2) + ' ' + (ry - VH / 2) + ' ' + VW + ' ' + VH); // centre of the board
    }

    function show(left, top) {
        const l = el(), s = size();
        if (!l) return;
        l.style.width = s.w + 'px'; l.style.height = s.h + 'px';
        l.style.left = Math.max(6, Math.min(window.innerWidth - s.w - 6, left)) + 'px';
        l.style.top = Math.max(6, Math.min(window.innerHeight - s.h - 6, top)) + 'px';
        l.classList.add('on');
    }
    function hide() { const l = el(); if (l) l.classList.remove('on'); }

    function boardPoint(ev) {
        const svg = $('boardSvg'), ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
        return p.matrixTransform(ctm.inverse());
    }
    function onPointer(ev) {
        if (!on || auto) return;
        const bp = boardPoint(ev); if (!bp) return;
        aim(bp.x, bp.y);
        const s = size(), touch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
        // Finger: lens above the finger. Mouse: lens beside the cursor, flipped when it would leave the screen.
        let left = touch ? ev.clientX - s.w / 2 : ev.clientX + 28, top = touch ? ev.clientY - s.h - 30 : ev.clientY - s.h / 2;
        if (touch && top < 6) top = ev.clientY + 40;
        if (!touch && left + s.w > window.innerWidth - 6) left = ev.clientX - s.w - 28;
        show(left, top);
    }

    function toggle(force) {
        on = force === undefined ? !on : !!force;
        const b = $('btnLens'); if (b) { b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); }
        const sec = $('boardSvg'); if (sec) sec.style.cursor = on ? 'zoom-in' : '';
        if (!on && !auto) hide();
        if (on && !auto) { // nothing under the pointer yet: start on the current player's space
            const p = APP_STATE.players[APP_STATE.currentPlayerIndex];
            if (p) follow(p.position, 0);
        }
    }

    // Follow a (possibly fractional) space number. hold = ms to keep the lens after the last call.
    function follow(pos, hold) {
        const city = typeof isCity === 'function' && isCity();
        const ang = (pos - 0.5) * (2 * Math.PI / 100) - Math.PI / 2, r = 445;
        if (city) { const pt = cityPoint(pos); aim(pt.x, pt.y - 8); } else aim(500 + r * Math.cos(ang), 500 + r * Math.sin(ang));
        // Auto position: over the half of the board away from the avatar, so the avatar stays visible.
        const box = document.querySelector('.board-container'), rc = box ? box.getBoundingClientRect() : { left: 10, top: 10, width: 600, height: 600 }, s = size();
        const pawnTop = city ? cityPoint(pos).y < CITY.H / 2 : Math.sin(ang) < 0;
        show(rc.left + (rc.width - s.w) / 2, pawnTop ? rc.top + rc.height - s.h - 12 : rc.top + 12);
        clearTimeout(hideT);
        if (hold) hideT = setTimeout(() => { auto = false; if (!on) hide(); else toggle(true); }, hold);
    }
    // Called by the hop animation.
    function autoFollow(pos) { auto = true; follow(pos, 0); }
    function autoDone(pos) { auto = true; follow(pos, 3500); }

    function init() {
        const svg = $('boardSvg');
        if (!svg) return;
        ['pointerdown', 'pointermove'].forEach(t => svg.addEventListener(t, onPointer));
        svg.addEventListener('pointerleave', ev => { if (on && !auto && ev.pointerType === 'mouse') hide(); });
        // The button lives inside the forecast strip, which is redrawn often, so listen on the document.
        document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('#btnLens')) toggle(); });
    }
    return { init, toggle, autoFollow, autoDone, hide, isOn: () => on };
})();
