/* Capital Clash: the optional guide (coach marks).

   When a player starts or joins a room they are asked once whether they want the quick guide.
   If yes, each step highlights a part of the screen with an arrow and a short popup.
   Steps a player has already seen are remembered in this browser and are not shown again,
   so a step only appears again when it is NEW.  ==> To teach a new feature: add ONE entry to GUIDE_STEPS
   (a new id) and, if it needs the player's attention during a turn, its element ids to FOCUS in game.js. */

const C = n => '<span class="comp">' + n + '</span>';
const T = n => '<span class="term">' + n + '</span>';
const GUIDE_STEPS = [
    { id: 'dice', sel: '#diceScene', title: 'Roll the Dice', text: 'On your turn, tap the ' + C('Dice') + '. When it stops, press Accept to move your Player Avatar. The number rolled is the number of Tiles you move (Long: a die with value 1–6; Standard: 1–9; Short and Beginner: 1–18).' },
    { id: 'wallet', sel: '#playersCard', title: 'Player Portfolio', text: C('Player Portfolio') + ' show every investor’s Tile, shares, cash and total. Total = Cash + (Shares × share price). The glowing row is the player whose turn it is.' },
    { id: 'board', sel: '#boardSvg', title: 'Space Board', text: 'The ' + C('Space Board') + ' has 100 ' + T('Tiles') + '. Your ' + T('Player Avatar') + ' stands next to its ' + T('Tile') + '. A plus ' + T('Tile') + ' (+1, +2, +3 and so on) raises the share price in the centre, a minus ' + T('Tile') + ' lowers it. Gold ' + T('Tiles') + ' draw a card from the ' + C('Event Card Deck') + '.' },
    { id: 'magnifier', sel: '#btnLens', title: 'Magnifier', text: 'Press Magnifier, then move your finger or mouse over the ' + C('Space Board') + ' to read any Tile bigger. It also zooms by itself while a Player Avatar moves.' },
    { id: 'bank2', sel: '#bankCard', title: 'The Bank: Share price', text: 'After you move, ' + C('The Bank') + ' opens (it glows). It shows the current <b>Share price</b> and the <b>Previous price</b>, so you see if the market went up or down. Press Enter The Bank, pick Buy or Sell, choose how many shares, then press the button to finalise. End turn waits 5s (a safety wait), then it glows.' },
    { id: 'cards', sel: '#cardSlot', title: 'Event Card Deck', text: 'Land on a gold ' + T('Tile') + ' and the ' + C('Event Card Deck') + ' glows. Tap it, read the card and press Accept Event. Green cards give a bonus, red cards cost per share, blue cards force a hold, sale or purchase. If you cannot meet a card you skip your next turn.' },
    { id: 'status', sel: '#statusCard', title: 'Whose turn', text: 'This box shows whose Turn it is and what to do now, plus the market Forecast (Bull, Bear or Neutral).' },
    { id: 'fontlang', sel: '.font-box', title: 'Font and Language', text: 'Under the game name you pick your own Font and Language (English or Deutsch). Only your screen changes.' },
    { id: 'chat', sel: '#chatFab', title: 'Game chat', text: 'In a live room, open the chat with this button. Send messages and emoji, press Notify to remind the player whose Turn it is, and vote to remove a player whose Turn takes longer than 3 minutes.' },
    { id: 'tour', sel: '#tourBtn', title: 'Tour Guide', text: 'Open Tour Guide to see this tour again, read How to play, or report a bug. Use Back to read a previous step.' }
];

const Guide = (() => {
    const KEY = 'cc_guide_seen';
    let want = false, queue = [], idx = 0;

    const seen = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
    const remember = id => { try { const v = seen(); if (!v.includes(id)) { v.push(id); localStorage.setItem(KEY, JSON.stringify(v)); } } catch (_) {} };
    const unseen = () => { const s = seen(); return s.includes('*') ? [] : GUIDE_STEPS.filter(x => !s.includes(x.id)); };

    function layer() { return $('guideLayer'); }

    function place() {
        const step = queue[idx]; if (!step) return;
        const el = document.querySelector(step.sel);
        if (!el || !el.getClientRects().length) { next(); return; }
        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
        const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
        const spot = $('guideSpot'), pop = $('guidePop'), arrow = $('guideArrow');
        Object.assign(spot.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
        $('guideTitle').textContent = step.title; $('guideText').innerHTML = highlightHtml(step.text); $('guideTitle').innerHTML = highlightHtml(step.title);
        $('guidePrev').disabled = idx === 0;
        $('guideCount').textContent = (idx + 1) + ' / ' + queue.length;
        $('guideNext').textContent = idx === queue.length - 1 ? 'Got it' : 'Next';
        pop.style.visibility = 'hidden'; pop.style.left = '0px'; pop.style.top = '0px';
        const pw = Math.min(320, vw - 24), ph = pop.offsetHeight;
        pop.style.width = pw + 'px';
        const cx = r.left + r.width / 2;
        let left, top, dir;
        const roomRight = vw - r.right, roomLeft = r.left;
        if (roomRight >= pw + 60 && r.width < vw * 0.6) { left = r.right + 46; top = r.top + Math.min(r.height / 2, 90) - 20; dir = 'left'; }
        else if (roomLeft >= pw + 60 && r.width < vw * 0.6) { left = r.left - pw - 46; top = r.top + Math.min(r.height / 2, 90) - 20; dir = 'right'; }
        else if (r.top > ph + 60) { left = cx - pw / 2; top = r.top - ph - 46; dir = 'down'; }
        else { left = cx - pw / 2; top = Math.min(vh - ph - 12, r.bottom + 46); dir = 'up'; }
        left = Math.max(12, Math.min(vw - pw - 12, left)); top = Math.max(12, Math.min(vh - ph - 12, top));
        pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility = 'visible';
        // Arrow sits between the popup and the highlighted area, pointing at it.
        arrow.className = 'guide-arrow ' + dir;
        arrow.textContent = { left: '◀', right: '▶', down: '▼', up: '▲' }[dir];
        const ax = dir === 'left' ? r.right + 8 : dir === 'right' ? r.left - 38 : Math.max(12, Math.min(vw - 40, cx - 15));
        const ay = dir === 'down' ? r.top - 38 : dir === 'up' ? r.bottom + 6 : Math.max(12, Math.min(vh - 40, top + 4));
        arrow.style.left = ax + 'px'; arrow.style.top = ay + 'px';
    }

    function next() {
        const step = queue[idx]; if (step) remember(step.id);
        idx++;
        if (idx >= queue.length) { stop(); return; }
        place();
    }

    function prev() { if (idx > 0) { idx--; place(); } }

    function stop() { queue = []; idx = 0; layer().classList.add('hidden'); window.removeEventListener('resize', place); }

    return {
        // Ask at the start of a room. Resolves when the player has chosen (or at once if there is nothing new to show).
        ask() {
            if (!unseen().length) { want = false; return Promise.resolve(false); }
            return new Promise(res => {
                const m = $('guidePrompt'); m.classList.remove('hidden');
                const done = v => { m.classList.add('hidden'); want = v; res(v); };
                $('guideYes').onclick = () => done(true);
                $('guideNo').onclick = () => done(false);
            });
        },
        // Called when the game screen opens.
        start(force) {
            if (force) { try { localStorage.removeItem(KEY); } catch (_) {} want = true; }
            if (APP_STATE.settings && APP_STATE.settings.mode === 'beginner') want = true; // Beginner mode: the guide is on
            if (!want) return;
            want = false;
            queue = unseen(); idx = 0;
            if (!queue.length) return;
            setTimeout(() => { if (!queue.length) return; layer().classList.remove('hidden'); window.addEventListener('resize', place); place(); }, 900);
        },
        next, prev, skip() { queue.forEach(s => remember(s.id)); stop(); },
        replay() { stop(); Guide.start(true); },
        get active() { return queue.length > 0; }
    };
})();
