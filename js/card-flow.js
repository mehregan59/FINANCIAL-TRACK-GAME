/* Capital Clash: Event Card turn steps and screen (deck, flip, Accept Event).
   Turn phases added by the cards: 'card' (landed on an Event Card Tile: tap the Event Card Deck) and
   'cardShow' (the card is face up: Accept Event). After that the turn goes on to The Bank ('trade') as usual.
   The authority (host, or this browser when solo) changes the state; every screen plays the same flip. */

/* ---------- Authority ---------- */

function resetCards() {
    Object.assign(APP_STATE, { cardDeck: freshDeck(), lastCard: null, holdBy: '', lastSkip: null });
    APP_STATE.players.forEach(p => { delete p.skipNext; });
}

function authDraw(fromId) {
    const cur = curPlayer();
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'card') return;
    if (!Array.isArray(APP_STATE.cardDeck) || !APP_STATE.cardDeck.length) APP_STATE.cardDeck = freshDeck(); // all 10 drawn: reshuffle
    const id = APP_STATE.cardDeck.shift();
    APP_STATE.lastCard = { by: cur.id, id, done: false, ok: true, choice: '', text: '', seq: nextEvt() };
    APP_STATE.turnPhase = 'cardShow';
    publish();
}

function authResolveCard(fromId, choice) {
    const cur = curPlayer(), c = APP_STATE.lastCard;
    if (!cur || cur.id !== fromId || APP_STATE.turnPhase !== 'cardShow' || !c || c.by !== cur.id || c.done) return;
    choice = CHOICES.includes(choice) ? choice : '';
    const price = marketValue(), o = cardOutcome(c.id, cur, price, choice);
    if (o.needChoice) return;
    const text = cardOutcomeText(c.id, cur, price, choice, money);
    if (o.ok) {
        cur.money += o.dm; cur.shares += o.ds;
        if (o.hold) APP_STATE.holdBy = cur.id;
        if (o.ds) APP_STATE.lastTrade = { by: cur.id, kind: o.ds > 0 ? 'buy' : 'sell', qty: Math.abs(o.ds), price, seq: nextEvt(), card: true };
    } else cur.skipNext = true;
    if (typeof Stats !== 'undefined') Stats.card(cur, c.id, o, choice);
    Object.assign(c, { done: true, ok: o.ok, choice, text, dm: o.dm, ds: o.ds, seq: nextEvt() });
    APP_STATE.turnPhase = 'trade';
    publish();
}

/* ---------- What the local player does ---------- */

function onDeckClick() {
    Sound.unlock();
    if (!(isMyTurn() && APP_STATE.turnPhase === 'card')) {
        if (APP_STATE.turnPhase !== 'card') showToast('Land on an Event Card Tile to draw from the Event Card Deck');
        return;
    }
    if (MP.on && !isHost()) { MP.t.send('draw', { from: MP.id }); return; }
    authDraw(curPlayer().id);
}

function onCardAccept(choice) {
    Sound.unlock();
    if (!(isMyTurn() && APP_STATE.turnPhase === 'cardShow')) return;
    if (MP.on && !isHost()) { MP.t.send('cardok', { from: MP.id, choice: choice || '' }); return; }
    authResolveCard(curPlayer().id, choice || '');
}

/* ---------- Screen ---------- */

const CARD_KIND = { gain: { label: 'Reward', dot: '\u{1F7E2}' }, loss: { label: 'Obligation', dot: '\u{1F534}' }, action: { label: 'Market action', dot: '\u{1F535}' } };
const CARD_ICON = { 1: '\u{1F4B0}', 2: '\u{1F9FE}', 3: '\u{1F381}', 4: '\u{1F4C5}', 5: '\u{1F393}', 6: '\u{1F6A8}', 7: '\u{1F512}', 8: '\u{1F4C9}', 9: '\u{1F4C8}', 10: '\u{1F914}' };

// Money amounts in a card rule are shown with the room's currency symbol.
const ruleWithCurrency = r => r.replace(/\{c\}/g, curSym());

function renderDeck() {
    const slot = $('cardSlot'); if (!slot) return;
    const ph = APP_STATE.turnPhase, cur = curPlayer(), mine = isMyTurn() && ph === 'card';
    const left = Array.isArray(APP_STATE.cardDeck) ? APP_STATE.cardDeck.length : EVENT_CARDS.length;
    slot.classList.toggle('deck-ready', ph === 'card');
    slot.classList.toggle('deck-mine', mine);
    $('deckBtn').disabled = !mine;
    $('deckLeft').textContent = (left || EVENT_CARDS.length) + ' cards left (10 in the deck)';
    $('deckHint').textContent = ph === 'card'
        ? (mine ? 'Tap the Event Card Deck to draw the top card!' : (cur ? cur.name : 'A player') + ' is drawing an Event Card...')
        : 'Land on an Event Card Tile (gold) to draw a card';
}

function cardFaceHtml(c, forMe) {
    const card = cardById(c.id); if (!card) return '';
    const p = APP_STATE.players.find(x => x.id === c.by), price = marketValue(), k = CARD_KIND[card.kind];
    let body = '';
    if (!c.done) {
        if (card.id === 10) {
            const opts = [['cash', 'Receive ' + money(2500)], ['buy', 'Buy 5 shares (' + money(5 * price) + ')'], ['sell', 'Sell 5 shares (' + money(5 * price) + ')']];
            body = `<p class="ec-you">${forMe ? 'Your choice:' : escapeHtml(p ? p.name : '') + ' is choosing...'}</p><div class="ec-choices">` + opts.map(([id, label]) => {
                const o = cardOutcome(10, p, price, id);
                return `<button type="button" class="ec-choice" ${forMe ? '' : 'disabled'} onclick="onCardAccept('${id}')"><b>${label}</b><small>${o.ok ? 'Possible' : 'Not possible: you would skip your next turn'}</small></button>`;
            }).join('') + '</div>';
        } else {
            const o = cardOutcome(card.id, p, price, '');
            body = `<p class="ec-you ${o.ok ? '' : 'bad'}"><b>${forMe ? 'For you' : 'For ' + escapeHtml(p ? p.name : '')}:</b> ${escapeHtml(cardOutcomeText(card.id, p, price, '', money))}</p>`
                + (forMe ? `<button type="button" id="cardOk" class="ec-accept" onclick="onCardAccept('')">${o.ok ? 'Accept Event' : 'Accept Event (skip next turn)'}</button>` : `<p class="ec-wait">Waiting for ${escapeHtml(p ? p.name : '')} to press Accept Event...</p>`);
        }
    } else {
        body = `<p class="ec-you ${c.ok ? 'ok' : 'bad'}"><b>${c.ok ? 'Done' : 'Penalty'}:</b> ${escapeHtml(c.text)}</p><button type="button" class="ec-accept alt" onclick="closeCard()">Continue</button>`;
    }
    return `<div class="ec-kind ${card.kind}">${k.dot} ${k.label}</div>
        <div class="ec-icon">${CARD_ICON[card.id] || '\u{1F0CF}'}</div>
        <div class="ec-num">Card ${card.id} of ${EVENT_CARDS.length}</div>
        <h3 class="ec-name">${escapeHtml(card.name)}</h3>
        <p class="ec-rule">${escapeHtml(ruleWithCurrency(card.rule))}</p>${body}`;
}

// Opens the card in the middle of the screen. flip = play the turn-over animation from the deck.
function showCard(c, flip) {
    const m = $('cardModal'); if (!m || !c) return;
    const forMe = isMyTurn() && c.by === (curPlayer() || {}).id;
    $('cardFront').className = 'ec-face ec-front ' + (cardById(c.id) || {}).kind;
    $('cardFront').innerHTML = cardFaceHtml(c, forMe);
    m.classList.remove('hidden');
    const inner = $('cardInner');
    if (flip) {
        inner.classList.remove('flipped'); inner.classList.add('from-deck');
        void inner.offsetWidth;
        setTimeout(() => { inner.classList.remove('from-deck'); inner.classList.add('flipped'); Sound.chime(); }, 450);
    } else inner.classList.add('flipped');
    clearTimeout(G.cardTimer);
    if (c.done) G.cardTimer = setTimeout(closeCard, forMe ? 6000 : 4000);
}
function closeCard() { clearTimeout(G.cardTimer); const m = $('cardModal'); if (m) m.classList.add('hidden'); }

// Called from syncEffects: play each new card event once on every screen.
function syncCard(fresh) {
    const c = APP_STATE.lastCard, sk = APP_STATE.lastSkip;
    if (fresh) {
        G.seenCard = c ? c.seq : 0; G.seenSkip = sk ? sk.seq : 0;
        if (c && !c.done && APP_STATE.turnPhase === 'cardShow') showCard(c, false); else closeCard();
        return;
    }
    if (c && c.seq > (G.seenCard || 0)) {
        G.seenCard = c.seq;
        if (!c.done) showCard(c, true);
        else {
            showCard(c, false);
            FX.card(c);
            const parts = [];
            if (c.dm) parts.push((c.dm > 0 ? '+' : '-') + money(Math.abs(c.dm)) + ' cash');
            if (c.ds) parts.push((c.ds > 0 ? '+' : '') + c.ds + ' shares');
            const res = !c.ok ? 'cannot fulfil it: skips the next turn' : c.id === 7 ? 'cannot buy or sell this turn' : parts.join(', ') || 'no change';
            showToast(playerName(c.by) + ' drew \u201C' + (cardById(c.id) || {}).name + '\u201D: ' + res, true);
        }
    }
    if (sk && sk.seq > (G.seenSkip || 0)) {
        G.seenSkip = sk.seq;
        showToast(sk.ids.map(playerName).join(' & ') + ' must skip this turn (Event Card penalty)', true);
    }
    if (APP_STATE.turnPhase !== 'cardShow' && !(c && c.done && !$('cardModal').classList.contains('hidden'))) closeCard();
}

/* ---------- Sync helpers (used by multiplayer.js) ---------- */

function cleanCard(c) {
    if (!c || typeof c !== 'object') return null;
    const seq = parseInt(c.seq, 10), id = parseInt(c.id, 10);
    if (!(seq > 0) || !cardById(id)) return null;
    return { by: String(c.by), id, done: !!c.done, ok: c.ok !== false, choice: CHOICES.includes(c.choice) ? c.choice : '', text: String(c.text || '').slice(0, 200), dm: clampInt(c.dm, -1e9, 1e9, 0), ds: clampInt(c.ds, -1e6, 1e6, 0), seq };
}
function cleanDeck(d) {
    if (!Array.isArray(d)) return freshDeck();
    const ids = d.map(x => parseInt(x, 10)).filter(x => cardById(x));
    return ids.filter((x, i) => ids.indexOf(x) === i).slice(0, EVENT_CARDS.length);
}
