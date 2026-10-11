/* Capital Clash: translations.
   All screen text is written in English in the HTML and scripts. This layer swaps it for the chosen language
   (English or German) while the game runs, including text the game writes later (turn messages, toasts, cards).
   Dictionaries live in js/i18n-<lang>.js as { "English text": "translated text" }.
   Keys may hold placeholders {0}, {1}: numbers and names in the live text fill them in.
   ==> To add a language: create js/i18n-xx.js with a dictionary, register it in DICTS and add it to LANGS. */
const I18N = (() => {
    const LANGS = [{ id: 'en', label: 'English' }, { id: 'de', label: 'Deutsch' }];
    const DICTS = { de: typeof I18N_DE !== 'undefined' ? I18N_DE : {} };
    // Reverse lookups (German -> English) clean up live text that changed after it was translated.
    const reverse = d => { const r = {}, tmp = document.createElement('div'); for (const k in d) { tmp.innerHTML = d[k]; const v = tmp.textContent.replace(/\s+/g, ' ').trim(); if (v && v.toLowerCase() !== k.toLowerCase() && r[v] == null) r[v] = k; } return r; };
    const KEY = 'cc_lang';
    const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CODE']);
    const INLINE = new Set(['SPAN', 'B', 'I', 'SMALL', 'A', 'BR', 'EM', 'STRONG', 'U', 'SUP', 'SUB', 'KBD']);
    const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    let lang = 'en', patterns = null, cache = new Map(), done = [], obs = null;
    try { const v = localStorage.getItem(KEY); if (DICTS[v]) lang = v; } catch (_) {}

    const norm = s => String(s).replace(/\s+/g, ' ').trim();
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const plain = h => { if (!/[<&]/.test(h)) return h; const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
    const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function buildPatterns(d) {
        patterns = [];
        for (const k in d) {
            if (!/\{\d+\}/.test(k)) continue;
            const parts = k.split(/\{(\d+)\}/), order = [];
            let re = '^';
            parts.forEach((p, i) => { if (i % 2) { re += '(.+?)'; order.push(p); } else re += reEsc(p); });
            if (re.length > 6) patterns.push({ re: new RegExp(re + '$'), val: d[k], order });
        }
        patterns.sort((a, b) => b.re.source.length - a.re.source.length); // most specific first
    }
    // Exact text, or the same text with its numbers as {0}, {1}...
    function basic(d, k) {
        if (d[k] != null) return { v: d[k], frags: {} };
        const nums = []; const kn = k.replace(/\d[\d,.]*\d|\d/g, m => '{' + (nums.push(m) - 1) + '}');
        if (nums.length && d[kn] != null) return { v: d[kn], frags: Object.fromEntries(nums.map((n, i) => [i, n])) };
        return null;
    }
    // Returns { v: translated, frags: { id: raw fragment } } or null.
    function find(text) {
        const d = DICTS[lang]; if (!d) return null;
        const k = norm(text); if (!k || !/[A-Za-z]{2}/.test(k)) return null;
        if (cache.has(k)) return cache.get(k);
        let r = basic(d, k);
        if (!r) {
            if (!patterns) buildPatterns(d);
            for (const p of patterns) {
                const m = k.match(p.re);
                if (m) { const frags = {}; p.order.forEach((id, i) => { const f = m[i + 1], b = f.length < k.length ? find(f) : basic(d, f); frags[id] = b ? plain(fill(b, false)) : f; }); r = { v: p.val, frags }; break; }
            }
        }
        if (cache.size > 4000) cache.clear();
        cache.set(k, r);
        return r;
    }
    const fill = (r, html) => r.v.replace(/\{(\d+)\}/g, (_, i) => (r.frags[i] == null ? '' : html ? esc(r.frags[i]) : r.frags[i]));
    function t(s) { if (lang === 'en') return s; const r = find(s); return r ? plain(fill(r, false)) : s; }

    const record = (node, kind, orig, set, attr) => { done.push({ node, kind, orig, set, attr }); if (done.length > 6000) done = done.filter(x => x.node.isConnected); };
    const isUnit = el => {
        let direct = false;
        for (const c of el.childNodes) {
            if (c.nodeType === 3) { if (c.nodeValue.trim()) direct = true; }
            else if (c.nodeType === 1) { if (!INLINE.has(c.tagName.toUpperCase()) || !isInlineDeep(c)) return false; }
        }
        return direct;
    };
    const isInlineDeep = el => [...el.children].every(c => INLINE.has(c.tagName.toUpperCase()) && isInlineDeep(c));

    function doText(n) {
        const r = find(n.nodeValue); if (!r) return;
        const lead = n.nodeValue.match(/^\s*/)[0], tail = n.nodeValue.match(/\s*$/)[0];
        const orig = n.nodeValue, v = lead + plain(fill(r, false)) + tail;
        if (v !== orig) { n.nodeValue = v; record(n, 't', orig, v); }
    }
    function doAttrs(el) {
        for (const a of ATTRS) {
            const v = el.getAttribute && el.getAttribute(a); if (!v) continue;
            const r = find(v); if (!r) continue;
            const nv = plain(fill(r, false)); if (nv !== v) { el.setAttribute(a, nv); record(el, 'a', v, nv, a); }
        }
    }
    function visit(el) {
        if (el.nodeType === 3) { doText(el); return; }
        if (el.nodeType !== 1) return;
        const tag = el.tagName.toUpperCase();
        if (el.hasAttribute('data-noi18n')) return;
        doAttrs(el); // inputs keep their value but their placeholder/title are translated
        if (SKIP.has(tag)) return;
        if (tag === 'SELECT') return; // options handled one by one below
        if (isUnit(el)) {
            const r = find(el.textContent);
            if (r) {
                const svg = el instanceof SVGElement;
                const orig = svg ? el.textContent : el.innerHTML;
                let v = svg ? plain(fill(r, false)) : fill(r, true);
                if (!svg && !/<i[\s>]/.test(v)) { const ic = [...el.children].filter(c => c.tagName === 'I').map(c => c.outerHTML).join(''); if (ic) v = ic + ' ' + v; } // keep button icons
                if (v !== orig) { if (svg) el.textContent = v; else el.innerHTML = v; record(el, svg ? 's' : 'h', orig, svg ? v : el.textContent); }
                return;
            }
        }
        for (const c of [...el.childNodes]) visit(c);
        if (tag === 'OPTGROUP') return;
    }
    function apply(root) {
        if (lang === 'en' || lang === 'rev' || !root) return;
        pause(() => visit(root));
        document.querySelectorAll('option').forEach(o => { if (!o.__i18n) { const r = find(o.textContent); if (r) { const orig = o.textContent; o.textContent = plain(fill(r, false)); o.__i18n = 1; record(o, 's', orig, o.textContent); } } });
    }
    function restore() {
        pause(() => {
            for (let i = done.length - 1; i >= 0; i--) {
                const x = done[i]; if (!x.node.isConnected) continue;
                if (x.kind === 't') { if (x.node.nodeValue === x.set) x.node.nodeValue = x.orig; }
                else if (x.kind === 'a') { if (x.node.getAttribute(x.attr) === x.set) x.node.setAttribute(x.attr, x.orig); }
                else if (x.kind === 's') { if (x.node.textContent === x.set) { x.node.textContent = x.orig; x.node.__i18n = 0; } }
                else if (x.node.textContent === x.set) x.node.innerHTML = x.orig;
            }
            done = [];
        });
    }
    function pause(fn) { if (obs) obs.disconnect(); try { fn(); } finally { if (obs) { obs.takeRecords(); watch(); } } }
    function watch() { obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }
    function onMutations(list) {
        if (lang === 'en' || lang === 'rev') return;
        const roots = new Set();
        for (const m of list) {
            if (m.type === 'childList') { m.addedNodes.forEach(n => roots.add(n.nodeType === 3 ? n.parentElement || n : n)); if (m.target.nodeType === 1 && isUnit(m.target)) roots.add(m.target); }
            else if (m.type === 'characterData') roots.add(m.target.parentElement || m.target);
            else roots.add(m.target);
        }
        pause(() => roots.forEach(n => { if (n && n.isConnected !== false) { let u = n.nodeType === 1 ? n : null; while (u && u.parentElement && isUnit(u.parentElement)) u = u.parentElement; visit(u || n); } }));
    }
    function set(l, save) {
        if (!DICTS[l] && l !== 'en') l = 'en';
        if (l === lang) return;
        const from = lang;
        restore();
        if (from !== 'en') { DICTS['rev'] = DICTS['rev_' + from] || (DICTS['rev_' + from] = reverse(DICTS[from])); lang = 'rev'; cache = new Map(); patterns = null; pause(() => visit(document.body)); done = []; }
        lang = l; cache = new Map(); patterns = null;
        document.documentElement.lang = l;
        if (save !== false) { try { localStorage.setItem(KEY, l); } catch (_) {} }
        document.querySelectorAll('.lang-pick').forEach(s => { s.value = l; });
        apply(document.body);
        termLanding();
    }
    const termLanding = () => { const L = document.getElementById('landing'); if (L && window.highlightTerms) pause(() => window.highlightTerms(L)); };
    function init() {
        document.documentElement.lang = lang;
        document.querySelectorAll('.lang-pick').forEach(s => {
            if (!s.options.length) LANGS.forEach(L => s.add(new Option(L.label, L.id)));
            s.value = lang; s.setAttribute('data-noi18n', ''); s.onchange = () => set(s.value);
        });
        // Main game words on the start page: capital first letter and red (same as the guides).
        termLanding();
        obs = new MutationObserver(onMutations); watch();
        apply(document.body); termLanding();
        // The guide window and the game share this setting, so a change in one updates the other.
        window.addEventListener('storage', e => { if (e.key === KEY) set(e.newValue || 'en', false); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    return { t, set, apply, get lang() { return lang; }, LANGS };
})();
