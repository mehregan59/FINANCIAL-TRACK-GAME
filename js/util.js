/* Capital Clash: small shared helpers. */

const $ = id => document.getElementById(id);

/* ---------- Transports (same API, two backends) ---------- */

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showToast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(MP.toastTimer); MP.toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);

const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

function newRoomCode() {
    const b = new Uint8Array(5); crypto.getRandomValues(b);
    return [...b].map(x => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

function rollD6() { const b = new Uint32Array(1); let x; do { crypto.getRandomValues(b); x = b[0]; } while (x >= 4294967292); return (x % 6) + 1; }

function getClientId() {
    let id = null;
    try { id = sessionStorage.getItem('ftg_id'); } catch (_) {}
    if (!id) { id = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); try { sessionStorage.setItem('ftg_id', id); } catch (_) {} }
    return id;
}

const clampExpected = v => { const n = parseInt(v, 10); return n >= MIN_PLAYERS && n <= MAX_PLAYERS ? n : 0; };

const digit = v => Math.max(0, Math.min(9, parseInt(v, 10) || 0));

