import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sampleRate = 44100;
const outDir = join(process.cwd(), "public", "sfx");

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function envelope(t, duration, attack = 0.01, release = 0.12) {
  const fadeIn = Math.min(1, t / attack);
  const fadeOut = Math.min(1, (duration - t) / release);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

function sweep(t, duration, from, to) {
  return from + (to - from) * (t / duration);
}

function seededNoise(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff * 2 - 1;
  };
}

function render(duration, fn) {
  const count = Math.floor(sampleRate * duration);
  const samples = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    samples[i] = clamp(fn(t, duration));
  }

  return samples;
}

function writeWav(name, samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(clamp(samples[i]) * 32767), 44 + i * 2);
  }

  writeFileSync(join(outDir, name), buffer);
}

function sine(freq, t) {
  return Math.sin(2 * Math.PI * freq * t);
}

function square(freq, t) {
  return sine(freq, t) >= 0 ? 1 : -1;
}

mkdirSync(outDir, { recursive: true });

const sounds = {
  "argon-slash.wav": () => {
    const noise = seededNoise(11);
    return render(0.32, (t, d) => {
      const env = envelope(t, d, 0.004, 0.18);
      const blade = sine(sweep(t, d, 640, 180), t) * 0.48;
      const edge = noise() * Math.max(0, 1 - t / 0.16) * 0.24;
      return (blade + edge) * env;
    });
  },
  "argon-heavy-hit.wav": () => {
    const noise = seededNoise(23);
    return render(0.5, (t, d) => {
      const env = envelope(t, d, 0.002, 0.22);
      const thump = sine(sweep(t, d, 92, 52), t) * 0.7;
      const body = square(146, t) * 0.14;
      const grit = noise() * Math.max(0, 1 - t / 0.08) * 0.28;
      return (thump + body + grit) * env;
    });
  },
  "fina-stab.wav": () => {
    const noise = seededNoise(37);
    return render(0.22, (t, d) => {
      const env = envelope(t, d, 0.002, 0.08);
      const point = sine(sweep(t, d, 1160, 540), t) * 0.42;
      const snap = noise() * Math.max(0, 1 - t / 0.04) * 0.35;
      return (point + snap) * env;
    });
  },
  "fina-backstab.wav": () => {
    const noise = seededNoise(41);
    return render(0.42, (t, d) => {
      const env = envelope(t, d, 0.004, 0.16);
      const whisper = noise() * Math.max(0, 1 - t / 0.18) * 0.22;
      const sting = sine(sweep(t, d, 880, 260), t) * 0.34;
      const low = t > 0.08 ? sine(96, t) * Math.max(0, 1 - (t - 0.08) / 0.18) * 0.38 : 0;
      return (whisper + sting + low) * env;
    });
  },
  "mina-arcane-bolt.wav": () => {
    const notes = [523.25, 783.99, 1046.5];
    return render(0.55, (t, d) => {
      const env = envelope(t, d, 0.015, 0.22);
      const arpeggio = notes.reduce((sum, freq, index) => {
        const start = index * 0.08;
        if (t < start) return sum;
        return sum + sine(freq, t - start) * Math.max(0, 1 - (t - start) / 0.28);
      }, 0);
      return arpeggio * 0.24 * env;
    });
  },
  "mina-arcane-bind.wav": () => {
    const noise = seededNoise(59);
    return render(0.68, (t, d) => {
      const env = envelope(t, d, 0.02, 0.28);
      const hum = sine(174.61, t) * 0.34;
      const shimmer = (sine(659.25, t) + sine(987.77, t)) * 0.12;
      const dust = noise() * 0.05 * Math.max(0, 1 - t / d);
      return (hum + shimmer + dust) * env;
    });
  },
};

for (const [name, createSamples] of Object.entries(sounds)) {
  writeWav(name, createSamples());
}

console.log(`Generated ${Object.keys(sounds).length} WAV files in ${outDir}`);
