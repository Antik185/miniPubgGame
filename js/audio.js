// Процедурные звуки через WebAudio — без файлов
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

export const Sfx = {
  unlock() { ensure(); },
  shot()   { burst(0.11, 0.22, 1300); tone(900, 0.06, 0.1, 'square', 300); },
  hit()    { tone(500, 0.08, 0.2, 'square', 250); },
  destroy(){ burst(0.25, 0.3, 600); tone(300, 0.3, 0.2, 'sawtooth', 80); },
  jump()   { tone(350, 0.15, 0.12, 'sine', 550); },
  dance()  { tone(520, 0.12, 0.15, 'sine', 780); tone(660, 0.12, 0.15, 'sine', 990); },
  pickup() { tone(600, 0.1, 0.15, 'sine', 900); tone(900, 0.12, 0.12, 'sine', 1200); },
  hurt()   { burst(0.12, 0.2, 500); tone(200, 0.15, 0.15, 'sawtooth', 100); },
  kill()   { tone(880, 0.1, 0.15, 'square', 660); tone(1100, 0.15, 0.12, 'square', 880); },
  win()    { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.2, 'sine'), i * 160)); },
  lose()   { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => tone(f, 0.35, 0.18, 'sawtooth'), i * 200)); },
};
