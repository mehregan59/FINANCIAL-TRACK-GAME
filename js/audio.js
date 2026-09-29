/* Capital Clash: sound effects, synthesized with the Web Audio API (no audio files needed). */

const Sound = (() => {
    let ctx = null;
    let muted = false;
    try { muted = localStorage.getItem('cc_muted') === '1'; } catch (_) {}

    // Browsers only allow audio after a user gesture, so the context is created/resumed lazily.
    function ac() {
        if (!ctx) {
            const C = window.AudioContext || window.webkitAudioContext;
            if (!C) return null;
            try { ctx = new C(); } catch (_) { return null; }
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    }

    function tone(freq, start, dur, type, gain, endFreq) {
        const c = ac(); if (!c || muted) return;
        const t = c.currentTime + start;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + dur + 0.03);
    }

    // A short burst of filtered noise: one "click" of a die hitting the table.
    function click(start, freq, gain) {
        const c = ac(); if (!c || muted) return;
        const t = c.currentTime + start, len = Math.floor(c.sampleRate * 0.035);
        const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
        g.gain.value = gain;
        src.connect(f); f.connect(g); g.connect(c.destination);
        src.start(t);
    }

    return {
        unlock() { ac(); },
        get muted() { return muted; },
        setMuted(v) { muted = !!v; try { localStorage.setItem('cc_muted', muted ? '1' : '0'); } catch (_) {} if (!muted) ac(); },
        // Dice tumbling: clicks that get further apart as the die slows down.
        rattle(ms) {
            let t = 0, gap = 0.035;
            while (t < ms / 1000 - 0.08) {
                click(t, 1400 + Math.random() * 2200, 0.35 + Math.random() * 0.3);
                t += gap; gap *= 1.11 + Math.random() * 0.05;
            }
        },
        thud() { tone(150, 0, 0.16, 'sine', 0.5, 55); click(0, 500, 0.5); },
        step(k) { tone(440 + (k % 8) * 55, 0, 0.09, 'triangle', 0.22); },
        chime() { tone(660, 0, 0.18, 'sine', 0.22); tone(990, 0.12, 0.28, 'sine', 0.2); },
        arrive() { tone(523, 0, 0.12, 'triangle', 0.22); tone(659, 0.09, 0.12, 'triangle', 0.22); tone(784, 0.18, 0.22, 'triangle', 0.22); }
    };
})();

// The first tap anywhere unlocks audio, so sounds from other players' rolls can play later.
window.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
