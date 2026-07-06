// Процедурные звуки через WebAudio — без файлов
const Sfx = (() => {
  let ac = null;

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // Шумовой хлопок (выстрелы, удары)
  function burst(dur, vol, filterFreq) {
    if (!ensure()) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ac.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start();
  }

  // Тональный сигнал (подбор, лечение и т.д.)
  function tone(freq, dur, vol, type, slideTo) {
    if (!ensure()) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  }

  return {
    unlock() { ensure(); },
    shot(key) {
      const p = {
        pistol:  [0.12, 0.25, 1400],
        smg:     [0.08, 0.18, 1600],
        rifle:   [0.13, 0.28, 1100],
        shotgun: [0.22, 0.35, 700],
        sniper:  [0.30, 0.40, 500],
      }[key] || [0.1, 0.2, 1200];
      burst(p[0], p[1], p[2]);
    },
    empty()  { tone(1200, 0.05, 0.15, 'square'); },
    reload() { tone(500, 0.08, 0.15, 'square', 300); },
    hit()    { tone(220, 0.07, 0.20, 'square', 160); },
    hurt()   { tone(140, 0.15, 0.25, 'sawtooth', 90); },
    pickup() { tone(620, 0.09, 0.20, 'sine', 950); },
    heal()   { tone(500, 0.25, 0.18, 'sine', 800); },
    kill()   { tone(880, 0.30, 0.22, 'sine', 220); },
    punch()  { burst(0.06, 0.18, 500); },
  };
})();
