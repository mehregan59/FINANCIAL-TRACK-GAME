/* Capital Clash: shared helpers for the guides.
   - highlightTerms(root): writes every main game word with a capital first letter, bold and red.
   - ScreenTour.mount(el): an animated, step-by-step tour of a game screenshot (Back / Next). */
(function () {
    const TERM_EN = /\b(space\s+board|space\s+bar|player\s+portfolios?|player\s+wallets?|player\s+avatars?|event\s+card\s+deck|event\s+cards?|market\s+tracker|the\s+bank|bank|pawns?|avatars?|dice|die|tiles?)\b/gi;
    // German game words (the dictionary translates the game names too).
    const TERM_DE = /(?<![A-Za-zäöüß])(Spielbrett(?:s|es)?|Spielerportfolios?|Spielfigur(?:en)?|Ereigniskartenstapels?|Ereigniskarten?|Marktanzeige|Bank|Würfels?|Feld(?:er|ern|es)?)(?![a-zäöüß])/g;
    let TERM_RE = TERM_EN;
    const SKIP = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'CODE']);
    function canon(m) {
        if (TERM_RE === TERM_DE) return m;
        const w = m.replace(/\s+/g, ' ').toLowerCase();
        if (w === 'space bar') return 'Space Board';
        if (w.startsWith('player wallet')) return 'Player Portfolio' + (w.endsWith('s') ? 's' : '');
        if (w === 'pawn') return 'Player Avatar';
        if (w === 'pawns') return 'Player Avatars';
        return w.replace(/\b\w/g, c => c.toUpperCase());
    }
    function highlightTerms(root) {
        if (!root) return;
        TERM_RE = (document.documentElement.lang || '').startsWith('de') ? TERM_DE : TERM_EN;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                for (let p = n.parentElement; p && p !== root.parentElement; p = p.parentElement) {
                    if (SKIP.has(p.tagName.toUpperCase()) || p.classList.contains('comp') || p.classList.contains('term') || p.hasAttribute('data-noterms')) return NodeFilter.FILTER_REJECT;
                }
                TERM_RE.lastIndex = 0;
                return TERM_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(n => {
            const frag = document.createDocumentFragment(), s = n.nodeValue; let last = 0;
            s.replace(TERM_RE, (m, _g, i) => {
                if (i > last) frag.appendChild(document.createTextNode(s.slice(last, i)));
                const sp = document.createElement('span'); sp.className = 'comp'; sp.textContent = canon(m);
                frag.appendChild(sp); last = i + m.length; return m;
            });
            if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
            n.parentNode.replaceChild(frag, n);
        });
    }
    // Same for an HTML string (used by the in-game tour popups).
    function highlightHtml(html) { const d = document.createElement('div'); d.innerHTML = html; highlightTerms(d); return d.innerHTML; }

    // Rectangles in % of the 1440 x 900 screenshot.
    const STEPS = [
        { r: [0, 0, 100, 11.2], t: 'Top bar', d: 'Whose turn it is, the Forecast, the Magnifier, the Font choice, How to play, Tour and Home page.' },
        { r: [0.7, 12.3, 21.5, 86.6], t: 'Player Portfolio', d: 'Every player: their Tile, shares, cash and total value (cash + shares × share price). The glowing row is the player whose turn it is. Scroll when there are many players.' },
        { r: [23.3, 12.8, 51.7, 85.7], t: 'Space Board', d: '100 Tiles. Green Tiles (+) raise the share price, red Tiles (−) lower it, gold Tiles draw an Event Card. The number in the middle is the share price.' },
        { r: [65, 17, 9, 9], t: 'Start Tile 0', d: 'Every Player Avatar waits here at the start. A roll of 5 moves you to Tile 5. Start disappears once everyone has left it.' },
        { r: [76.1, 12.3, 23.2, 15.9], t: 'Dice', d: 'Tap the Dice on your turn, then press Accept. Your Player Avatar hops that many Tiles.' },
        { r: [76.1, 29.1, 23.2, 25.8], t: 'The Bank', d: 'Shows the share price and the previous price. After you move, press Buy or Sell: a window opens, choose how many (or Max) and confirm. Coins fly to The Bank when you buy and to you when you sell.' },
        { r: [76.1, 55.8, 23.2, 12.9], t: 'Event Card Deck', d: 'Land on a gold Tile and the deck glows. Tap it, read the card, press Accept Event. Green cards give a bonus, red cards cost per share, blue cards force a hold, sale or purchase. After an Event Card, The Bank stays closed until your next turn.' }
    ];
    const CSS = `.st-wrap{margin:14px 0}.st-stage{position:relative;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.st-stage img{display:block;width:100%;height:auto;transition:filter .4s}
.st-shade{position:absolute;inset:0;pointer-events:none}
.st-box{position:absolute;border:4px solid #dc2626;border-radius:14px;box-shadow:0 0 0 9999px rgba(6,16,46,.55);transition:all .6s cubic-bezier(.3,1.2,.5,1);animation:stPulse 1.4s ease-in-out infinite}
@keyframes stPulse{50%{border-color:#ffd54a}}
.st-num{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;display:grid;place-items:center;background:#dc2626;color:#fff;font:800 15px/1 inherit;border:3px solid #fff;transition:all .6s cubic-bezier(.3,1.2,.5,1)}
.st-cap{margin-top:12px;padding:14px 16px;border-radius:14px;background:#fff8e1;border:3px solid #f6d365;color:#10306b;animation:stIn .45s ease-out}
.st-cap h4{margin:0 0 6px;font-size:1.15rem}.st-cap p{margin:0;line-height:1.45}
@keyframes stIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.st-nav{display:flex;align-items:center;gap:8px;margin-top:10px}.st-nav button{border:0;border-radius:999px;padding:9px 18px;font:700 14px/1 inherit;cursor:pointer;background:#ffd54a;color:#3b2a00}
.st-nav button:disabled{opacity:.4;cursor:default}.st-dots{display:flex;gap:6px;margin:0 auto}.st-dots i{width:10px;height:10px;border-radius:50%;background:#cbd5e1;cursor:pointer}.st-dots i.on{background:#dc2626}
.comp{font-weight:800;color:#dc2626}`;
    function mount(el) {
        if (!el || el.dataset.ready) return; el.dataset.ready = '1';
        if (!document.getElementById('stCss')) { const s = document.createElement('style'); s.id = 'stCss'; s.textContent = CSS; document.head.appendChild(s); }
        el.classList.add('st-wrap');
        el.innerHTML = `<div class="st-stage"><img src="${el.dataset.img || '/img/guide-screen.jpg'}" alt="Capital Clash game screen"><div class="st-box"></div><div class="st-num"></div></div>
            <div class="st-cap"></div><div class="st-nav"><button type="button" class="st-prev">Back</button><span class="st-dots">${STEPS.map((_, i) => `<i data-i="${i}"></i>`).join('')}</span><button type="button" class="st-next">Next</button></div>`;
        let i = 0;
        const box = el.querySelector('.st-box'), num = el.querySelector('.st-num'), cap = el.querySelector('.st-cap');
        function show() {
            const s = STEPS[i], [x, y, w, h] = s.r;
            Object.assign(box.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
            Object.assign(num.style, { left: x + 1.5 + '%', top: y + 2.5 + '%' }); num.textContent = i + 1;
            cap.innerHTML = `<h4>${i + 1}. ${s.t}</h4><p>${s.d}</p>`;
            highlightTerms(cap); cap.style.animation = 'none'; void cap.offsetWidth; cap.style.animation = '';
            el.querySelector('.st-prev').disabled = i === 0;
            el.querySelector('.st-next').textContent = i === STEPS.length - 1 ? 'Start again' : 'Next';
            el.querySelectorAll('.st-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
        }
        el.querySelector('.st-prev').onclick = () => { if (i > 0) { i--; show(); } };
        el.querySelector('.st-next').onclick = () => { i = (i + 1) % STEPS.length; show(); };
        el.querySelectorAll('.st-dots i').forEach(d => d.onclick = () => { i = +d.dataset.i; show(); });
        show();
    }
    window.highlightTerms = highlightTerms; window.highlightHtml = highlightHtml;
    window.ScreenTour = { mount, STEPS };
})();
