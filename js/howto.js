/* Capital Clash: "How to play" window with two versions: a short Summary and the Full guide (details).
   The full guide is how-to-play.html, the same designed document as the published player guide, shown in a frame. */
const Howto = (() => {
    let tab = 'summary', loaded = false;
    const $ = id => document.getElementById(id);
    function show(which) {
        tab = which === 'details' ? 'details' : 'summary';
        $('howSummary').classList.toggle('hidden', tab !== 'summary');
        $('howDetails').classList.toggle('hidden', tab !== 'details');
        $('howTabSummary').classList.toggle('on', tab === 'summary');
        $('howTabDetails').classList.toggle('on', tab === 'details');
        $('howTabSummary').setAttribute('aria-selected', tab === 'summary');
        $('howTabDetails').setAttribute('aria-selected', tab === 'details');
        if (tab === 'details' && !loaded) { $('howFrame').src = 'how-to-play.html'; loaded = true; }
        try { localStorage.setItem('cc_howto_tab', tab); } catch (_) {}
    }
    function open(which) {
        if (!which) { try { which = localStorage.getItem('cc_howto_tab') || 'summary'; } catch (_) { which = 'summary'; } }
        $('howModal').classList.remove('hidden');
        document.body.classList.add('how-open');
        show(which);
        const c = $('howClose'); if (c) c.focus();
    }
    function close() { $('howModal').classList.add('hidden'); document.body.classList.remove('how-open'); }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('howModal') && !$('howModal').classList.contains('hidden')) close(); });
    return { open, close, show };
})();
