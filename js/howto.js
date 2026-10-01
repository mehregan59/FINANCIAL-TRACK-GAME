/* Capital Clash: "How to play" window with two versions: a short Summary and the Full guide (details).
   The full guide is how-to-play.html, the same designed document as the published player guide, shown in a frame. */
const Howto = (() => {
    let tab = 'summary', loaded = false, step = 2;
    const SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];   // text size steps (index 2 = 100%)
    const $ = id => document.getElementById(id);
    function show(which) {
        tab = which === 'details' ? 'details' : 'summary';
        $('howSummary').classList.toggle('hidden', tab !== 'summary');
        $('howDetails').classList.toggle('hidden', tab !== 'details');
        $('howTabSummary').classList.toggle('on', tab === 'summary');
        $('howTabDetails').classList.toggle('on', tab === 'details');
        $('howTabSummary').setAttribute('aria-selected', tab === 'summary');
        $('howTabDetails').setAttribute('aria-selected', tab === 'details');
        if (tab === 'details' && !loaded) { $('howFrame').addEventListener('load', applyScale); $('howFrame').src = 'how-to-play.html'; loaded = true; }
        try { localStorage.setItem('cc_howto_tab', tab); } catch (_) {}
    }
    // Text size: the Summary and the guide inside the frame (same site, so its document can be reached) are zoomed together.
    function applyScale() {
        const z = SCALES[step];
        $('howSummary').style.zoom = z;
        $('howSizeVal').textContent = Math.round(z * 100) + '%';
        try { const d = $('howFrame').contentDocument; if (d && d.documentElement) d.documentElement.style.zoom = z; } catch (_) {}
        try { localStorage.setItem('cc_howto_size', String(step)); } catch (_) {}
    }
    function size(dir) { step = Math.max(0, Math.min(SCALES.length - 1, step + dir)); applyScale(); }
    try { const n = parseInt(localStorage.getItem('cc_howto_size'), 10); if (n >= 0 && n < SCALES.length) step = n; } catch (_) {}
    function open(which) {
        if (!which) { try { which = localStorage.getItem('cc_howto_tab') || 'summary'; } catch (_) { which = 'summary'; } }
        $('howModal').classList.remove('hidden');
        document.body.classList.add('how-open');
        show(which); applyScale();
        const c = $('howClose'); if (c) c.focus();
    }
    function close() { $('howModal').classList.add('hidden'); document.body.classList.remove('how-open'); }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('howModal') && !$('howModal').classList.contains('hidden')) close(); });
    return { open, close, show, size };
})();
