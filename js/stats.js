/* Capital Clash: end-game analytics and learning outcomes.
   The authority records small numbers while the game runs (stored on each player as p.st and in APP_STATE.history,
   both part of the shared state), and the results screen turns them into a match recap:
   net-worth chart, ranking history, pivotal moments, investor style, positives and negatives. */

const Stats = (() => {
    const MAX_HIST = 400, MAX_MOMENTS = 40;
    const blank = () => ({ buys: 0, sells: 0, bought: 0, sold: 0, buyCost: 0, sellGain: 0, lowBuys: 0, highSells: 0, panicSells: 0,
        cardsGood: 0, cardsBad: 0, penalties: 0, bestTile: 0, worstTile: 0, peak: 0, low: 0, moments: [] });
    const st = p => (p.st = p.st || blank());
    const total = p => p.money + p.shares * marketValue();
    const avg = () => APP_STATE.history.length ? APP_STATE.history.reduce((a, h) => a + h.m, 0) / APP_STATE.history.length : marketValue();
    const turnNo = () => (APP_STATE.history || []).length + 1;
    const moment = (p, text, size) => { const s = st(p); s.moments.push({ n: turnNo(), text: String(text).slice(0, 120), size: Math.round(size) }); if (s.moments.length > MAX_MOMENTS) s.moments.shift(); };

    function reset() {
        APP_STATE.history = [];
        APP_STATE.players.forEach(p => { p.st = blank(); p.st.peak = p.st.low = total(p); });
        snapshot('');
    }
    function snapshot(by) {
        APP_STATE.history = APP_STATE.history || [];
        APP_STATE.history.push({ by, m: marketValue(), t: APP_STATE.players.map(p => Math.round(total(p))), r: rankedIds() });
        if (APP_STATE.history.length > MAX_HIST) APP_STATE.history.splice(1, 1);
        APP_STATE.players.forEach(p => { const s = st(p), v = total(p); s.peak = Math.max(s.peak || v, v); s.low = Math.min(s.low || v, v); });
    }
    function turn(p) { snapshot(p.id); }
    function tile(p, text, d) {
        const s = st(p); s.bestTile = Math.max(s.bestTile, d); s.worstTile = Math.min(s.worstTile, d);
        if (Math.abs(d) >= 15) moment(p, (d > 0 ? 'Landed on ' : 'Hit ') + text.replace(/ \([^)]*\)$/, '') + ': market ' + (d > 0 ? '+' : '') + d, Math.abs(d) * 10);
    }
    function trade(p, kind, qty, price) {
        const s = st(p), a = avg();
        if (kind === 'buy') { s.buys++; s.bought += qty; s.buyCost += qty * price; if (price < a * 0.95) s.lowBuys++; }
        else {
            s.sells++; s.sold += qty; s.sellGain += qty * price;
            if (price > a * 1.05) s.highSells++;
            if (price < a * 0.9 && APP_STATE.forecast && APP_STATE.forecast.phase === 'bear') s.panicSells++;
        }
        if (qty * price >= 2000) moment(p, (kind === 'buy' ? 'Bought ' : 'Sold ') + qty + ' shares at ' + money(price), qty * price / 10);
    }
    function card(p, id, o, choice) {
        const s = st(p), c = cardById(id); if (!c) return;
        if (!o.ok) { s.penalties++; s.cardsBad++; moment(p, '\u201C' + c.name + '\u201D could not be paid: skipped a turn', 300); return; }
        if (o.dm > 0 && !o.ds) s.cardsGood++; else if (o.dm < 0 && !o.ds) s.cardsBad++;
        if (o.ds) trade(p, o.ds > 0 ? 'buy' : 'sell', Math.abs(o.ds), marketValue());
        if (Math.abs(o.dm) >= 1000) moment(p, 'Event Card \u201C' + c.name + '\u201D: ' + (o.dm > 0 ? '+' : '-') + money(Math.abs(o.dm)), Math.abs(o.dm) / 5);
    }

    /* ---------- sync cleaning ---------- */
    const n = (v, lo, hi) => clampInt(v, lo, hi, 0);
    function clean(s) {
        const o = blank();
        Object.keys(o).forEach(k => { if (k !== 'moments') o[k] = n(s[k], -1e12, 1e12); });
        o.moments = (Array.isArray(s.moments) ? s.moments : []).slice(-MAX_MOMENTS).map(m => ({ n: n(m && m.n, 0, 1e6), text: String((m && m.text) || '').slice(0, 120), size: n(m && m.size, 0, 1e9) }));
        return o;
    }
    function cleanHistory(h) {
        if (!Array.isArray(h)) return [];
        return h.slice(-MAX_HIST).map(x => ({ by: String((x && x.by) || ''), m: n(x && x.m, 0, 100000), t: (Array.isArray(x && x.t) ? x.t : []).slice(0, MAX_PLAYERS).map(v => n(v, -1e12, 1e12)), r: (Array.isArray(x && x.r) ? x.r : []).slice(0, MAX_PLAYERS).map(String) }));
    }

    /* ---------- results screen ---------- */
    const COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#a78bfa', '#f87171', '#2dd4bf', '#e879f9', '#a3e635'];

    function chart(hist) {
        const W = 520, H = 170, P = 26, players = APP_STATE.players;
        if (hist.length < 2) return '<p class="os-empty">Play a few turns to see the chart.</p>';
        const all = hist.flatMap(h => h.t), lo = Math.min(...all), hi = Math.max(...all, lo + 1);
        const x = i => P + (W - 2 * P) * i / (hist.length - 1), y = v => H - P + 6 - (H - 2 * P) * (v - lo) / (hi - lo);
        const lines = players.map((p, k) => `<polyline fill="none" stroke="${COLORS[k % COLORS.length]}" stroke-width="2.5" stroke-linejoin="round" points="${hist.map((h, i) => x(i).toFixed(1) + ',' + y(h.t[k] || 0).toFixed(1)).join(' ')}"/>`).join('');
        const legend = players.map((p, k) => `<span><i style="background:${COLORS[k % COLORS.length]}"></i>${escapeHtml(p.name)}</span>`).join('');
        return `<svg viewBox="0 0 ${W} ${H}" class="os-chart" role="img" aria-label="Net worth over the game">
            <text x="${P}" y="14" class="os-ax">${money(hi)}</text><text x="${P}" y="${H - 4}" class="os-ax">${money(lo)}</text>
            <line x1="${P}" y1="${H - P + 6}" x2="${W - P}" y2="${H - P + 6}" class="os-axis"/>${lines}</svg><div class="os-legend">${legend}</div>`;
    }

    function rankHistory(hist) {
        const name = id => playerName(id);
        let leader = '', changes = [];
        hist.forEach((h, i) => { const l = h.r[0]; if (l && l !== leader) { changes.push({ i, id: l }); leader = l; } });
        const led = new Map(); hist.forEach(h => { if (h.r[0]) led.set(h.r[0], (led.get(h.r[0]) || 0) + 1); });
        const most = [...led.keys()].sort((a, b) => led.get(b) - led.get(a))[0];
        return `<p><b>${changes.length > 1 ? changes.length - 1 + ' lead change' + (changes.length > 2 ? 's' : '') : 'No lead changes'}</b>${most ? ' \u00B7 ' + escapeHtml(name(most)) + ' led for ' + Math.round(100 * led.get(most) / hist.length) + '% of the game' : ''}.</p>
            <ol class="os-leads">${changes.slice(-6).map(c => `<li>Turn ${c.i}: ${escapeHtml(name(c.id))} takes the lead</li>`).join('')}</ol>`;
    }

    function style(s) {
        const trades = s.buys + s.sells;
        if (trades === 0) return ['\u{1F9D8} Patient Holder', 'You never traded and let the market do the work.'];
        if (s.lowBuys + s.highSells >= Math.max(2, trades / 2)) return ['\u{1F9E0} Value Investor', 'You bought below the average price and sold above it.'];
        if (trades >= 8) return ['\u26A1 Active Trader', 'You traded often (' + trades + ' trades) to chase every move.'];
        if (s.panicSells) return ['\u{1F630} Nervous Seller', 'You sold when the market was falling.'];
        return ['\u2696\uFE0F Balanced Investor', 'A steady mix of buying, selling and holding.'];
    }

    function lessons(p, s, finalPrice) {
        const good = [], bad = [], avgBuy = s.bought ? s.buyCost / s.bought : 0, avgSell = s.sold ? s.sellGain / s.sold : 0;
        if (s.lowBuys) good.push('Bought low ' + s.lowBuys + ' time' + (s.lowBuys > 1 ? 's' : '') + ' (below the average market price).');
        if (s.highSells) good.push('Sold high ' + s.highSells + ' time' + (s.highSells > 1 ? 's' : '') + ' (above the average market price).');
        if (avgBuy && avgBuy < finalPrice) good.push('Your average buy price ' + money(Math.round(avgBuy)) + ' is below the final price ' + money(finalPrice) + '.');
        if (s.cardsGood) good.push('Collected ' + s.cardsGood + ' rewarding Event Card' + (s.cardsGood > 1 ? 's' : '') + '.');
        if (s.penalties === 0 && (s.cardsBad || s.cardsGood)) good.push('Always had enough cash and shares to meet every Event Card.');
        if (avgBuy && avgBuy > finalPrice) bad.push('Your average buy price ' + money(Math.round(avgBuy)) + ' is above the final price ' + money(finalPrice) + ': bought too high.');
        if (avgSell && avgSell < finalPrice * 0.9) bad.push('Sold at ' + money(Math.round(avgSell)) + ' on average; the market ended higher.');
        if (s.panicSells) bad.push('Panic-sold ' + s.panicSells + ' time' + (s.panicSells > 1 ? 's' : '') + ' in a falling (Bear) market.');
        if (s.penalties) bad.push('Could not fulfil ' + s.penalties + ' Event Card' + (s.penalties > 1 ? 's' : '') + ' and lost turns: keep a cash and share buffer.');
        const t = total(p); if (t > 0 && p.money / t > 0.7 && finalPrice > APP_STATE.settings.market) bad.push('Kept ' + Math.round(100 * p.money / t) + '% in cash while the market rose: idle cash misses growth.');
        if (s.peak && t < s.peak * 0.8) bad.push('Dropped from a peak of ' + money(Math.round(s.peak)) + ': consider locking in gains.');
        if (!good.length) good.push('You finished the game and learned how the market swings.');
        if (!bad.length) bad.push('No big mistakes: well played!');
        return { good, bad };
    }

    function recapHtml(r) {
        const hist = APP_STATE.history || [], price = marketValue();
        const order = r.ranking.map(x => APP_STATE.players.find(p => p.id === x.id)).filter(Boolean);
        const moments = APP_STATE.players.flatMap(p => (st(p).moments || []).map(m => ({ ...m, who: p.name }))).sort((a, b) => b.size - a.size).slice(0, 5).sort((a, b) => a.n - b.n);
        const first = hist[0] ? hist[0].m : APP_STATE.settings.market;
        const mine = (typeof MP !== "undefined" && MP.on) ? order.filter(p => p.id === MP.id) : order;
        const cards = (mine.length ? mine : order).map(p => {
            const s = st(p), [sty, why] = style(s), l = lessons(p, s, price);
            return `<details class="os-player"><summary>${avatarEmoji(p.avatar)} <b>${escapeHtml(p.name)}</b> <span class="os-style">${sty}</span></summary>
                <p class="os-why">${why} Trades: ${s.buys} buys, ${s.sells} sells \u00B7 Peak ${money(Math.round(s.peak || 0))}.</p>
                <div class="os-two"><div class="os-good"><h5>\u2714 Positives</h5><ul>${l.good.map(x => '<li>' + escapeHtml(x) + '</li>').join('')}</ul></div>
                <div class="os-bad"><h5>\u2716 Negatives</h5><ul>${l.bad.map(x => '<li>' + escapeHtml(x) + '</li>').join('')}</ul></div></div></details>`;
        }).join('');
        return `<div class="os-block"><h4>\u{1F4C8} Net worth over the game</h4>${chart(hist)}</div>
            <div class="os-block"><h4>\u{1F3C1} Ranking history</h4>${rankHistory(hist)}</div>
            <div class="os-block"><h4>\u{1F4CC} Match recap</h4><p>Market Tracker: ${money(first)} \u2192 ${money(price)} (${price >= first ? '+' : ''}${Math.round(100 * (price - first) / Math.max(1, first))}%) over ${Math.max(0, hist.length - 1)} turns.</p>
                <ul class="os-moments">${moments.map(m => `<li><b>Turn ${m.n}, ${escapeHtml(m.who)}:</b> ${escapeHtml(m.text)}</li>`).join('') || '<li>A calm game with no big swings.</li>'}</ul></div>
            <div class="os-block"><h4>\u{1F393} Learning outcomes</h4>${cards}</div>`;
    }

    return { reset, turn, tile, trade, card, clean, cleanHistory, recapHtml };
})();
