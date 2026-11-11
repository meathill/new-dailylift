/**
 * 程序生成 6 个单声道无缝循环 WAV 音源（demo 用占位素材）。
 * 运行：node scripts/generate-sounds.ts
 * 产物：apps/mobile/assets/audio/*.wav
 *
 * 无缝循环原理：生成 T + X 时长信号，输出头部 X 区域做交叉淡化
 * （信号开头渐入、结尾渐出），循环点在样本 0 处自然衔接。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SAMPLE_RATE = 44100;
const DURATION = 8;
const CROSSFADE = 0.5;
const PEAK = 0.75;

/** 音源描述：id 用于文件名与 app 内 soundId，name 为界面中文名 */
export const SOUND_DEFS = [
  { id: 'rain', name: '雨声' },
  { id: 'stream', name: '溪流' },
  { id: 'campfire', name: '篝火' },
  { id: 'windchime', name: '风铃' },
  { id: 'wind', name: '风声' },
  { id: 'birds', name: '鸟鸣' },
] as const;

export type SoundId = (typeof SOUND_DEFS)[number]['id'];

type SoundGenerator = (sampleCount: number, sampleRate: number) => Float32Array;

/** 均匀白噪声，[-1, 1) */
function whiteNoise(sampleCount: number): Float32Array {
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = Math.random() * 2 - 1;
  }
  return out;
}

/** Paul Kellet 粉红噪声滤波器 */
function pinkNoise(sampleCount: number): Float32Array {
  const white = whiteNoise(sampleCount);
  const out = new Float32Array(sampleCount);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < sampleCount; i++) {
    const w = white[i];
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/** 一阶低通：系数 alpha 越接近 1 截止频率越低 */
function lowpass(signal: Float32Array, alpha: number): Float32Array {
  const out = new Float32Array(signal.length);
  let y = 0;
  for (let i = 0; i < signal.length; i++) {
    y += alpha * (signal[i] - y);
    out[i] = y;
  }
  return out;
}

/** 一阶高通 */
function highpass(signal: Float32Array, alpha: number): Float32Array {
  const out = new Float32Array(signal.length);
  let yPrev = 0;
  let xPrev = 0;
  for (let i = 0; i < signal.length; i++) {
    yPrev = alpha * (yPrev + signal[i] - xPrev);
    out[i] = yPrev;
    xPrev = signal[i];
  }
  return out;
}

/** 带通：低通后高通 */
function bandpass(signal: Float32Array, lowAlpha: number, highAlpha: number): Float32Array {
  return highpass(lowpass(signal, lowAlpha), highAlpha);
}

/** 用多个缓慢正弦 LFO 合成 [lo, hi] 区间的平滑调制值 */
function smoothLfo(t: number, lo: number, hi: number): number {
  const mid = (lo + hi) / 2;
  const amp = (hi - lo) / 2;
  return (
    mid +
    amp * (0.5 * Math.sin(t * 0.7 + 1.3) + 0.3 * Math.sin(t * 1.9 + 4.2) + 0.2 * Math.sin(t * 3.7))
  );
}

/** 雨声：粉红噪声底 + 随机雨滴高频脉冲 */
function generateRain(sampleCount: number, sampleRate: number): Float32Array {
  const base = lowpass(pinkNoise(sampleCount), 0.35);
  const out = new Float32Array(sampleCount);
  // 每个采样点以极低概率触发雨滴：短促高通 tick，指数衰减
  let dropDecay = 0;
  let dropSign = 1;
  for (let i = 0; i < sampleCount; i++) {
    if (Math.random() < 0.0006) {
      dropDecay = 1;
      dropSign = Math.random() < 0.5 ? 1 : -1;
    }
    dropDecay *= 0.9985;
    const drop = dropSign * dropDecay * dropDecay * (Math.random() * 2 - 1);
    out[i] = base[i] * 0.9 + drop * 0.5;
  }
  return bandpass(out, 0.6, 0.04);
}

/** 溪流：带通白噪声，中心频率随时间缓慢摆动 */
function generateStream(sampleCount: number, sampleRate: number): Float32Array {
  const white = whiteNoise(sampleCount);
  const out = new Float32Array(sampleCount);
  // 时变一阶低通 + 固定高通，得到流动的水声质感
  let y = 0;
  for (let i = 0; i < sampleCount; i++) {
    const alpha = smoothLfo(i / sampleRate, 0.08, 0.35);
    y += alpha * (white[i] - y);
    out[i] = y;
  }
  return highpass(out, 0.15);
}

/** 篝火：低频隆隆 + 随机噼啪脉冲簇 */
function generateCampfire(sampleCount: number, sampleRate: number): Float32Array {
  const rumble = lowpass(pinkNoise(sampleCount), 0.12);
  const out = new Float32Array(sampleCount);
  let crackleEnv = 0;
  let crackleSign = 1;
  for (let i = 0; i < sampleCount; i++) {
    // 低概率触发噼啪：带少量回弹的双脉冲包络
    if (Math.random() < 0.0004) {
      crackleEnv = 1;
      crackleSign = Math.random() < 0.5 ? 1 : -1;
    }
    const bounce = crackleEnv > 0.4 && crackleEnv < 0.5 ? 0.6 : 0;
    crackleEnv *= 0.9988;
    const crackle = crackleSign * (crackleEnv + bounce) * (Math.random() * 2 - 1);
    out[i] = rumble[i] * 1.2 + crackle * 0.8;
  }
  return out;
}

/** 风铃：五声音阶正弦簇（基频 + 泛音），随机触发，指数衰减 */
function generateWindchime(sampleCount: number, sampleRate: number): Float32Array {
  // A 大调五声音阶高音区
  const scale = [880, 987.77, 1108.73, 1318.51, 1479.98, 1760, 1975.53];
  const out = new Float32Array(sampleCount);
  const voices: { freq: number; env: number; decay: number; pan: number }[] = [];
  for (let i = 0; i < sampleCount; i++) {
    if (Math.random() < 0.0012 && voices.length < 12) {
      const freq = scale[Math.floor(Math.random() * scale.length)];
      voices.push({
        freq,
        env: 1,
        // 高频衰减更快，模拟金属管
        decay: Math.exp(Math.log(0.0001) / (freq * 4)),
        pan: Math.random() * 2 - 1,
      });
    }
    let sample = 0;
    for (const v of voices) {
      v.env *= v.decay;
      const phase = ((i * v.freq) / sampleRate) % 1;
      // 基频 + 二次泛音，轻微失谐制造钟管质感
      const detune = Math.sin(2 * Math.PI * phase * 2.003) * 0.3;
      sample += (Math.sin(2 * Math.PI * phase) + detune) * v.env * (0.5 + 0.5 * Math.abs(v.pan));
    }
    for (let vi = voices.length - 1; vi >= 0; vi--) {
      if (voices[vi].env < 0.0005) voices.splice(vi, 1);
    }
    out[i] = sample * 0.4;
  }
  return lowpass(out, 0.7);
}

/** 风声：低通粉噪，幅度随多个缓慢 LFO 起伏 */
function generateWind(sampleCount: number, sampleRate: number): Float32Array {
  const pink = lowpass(pinkNoise(sampleCount), 0.08);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const gust = smoothLfo(t, 0.3, 1.4);
    out[i] = pink[i] * gust;
  }
  return out;
}

/** 鸟鸣：稀疏随机啁啾（正弦扫频短音）+ 轻微环境底噪 */
function generateBirds(sampleCount: number, sampleRate: number): Float32Array {
  const ambient = lowpass(pinkNoise(sampleCount), 0.04);
  const out = new Float32Array(sampleCount);
  let chirpActive = 0;
  let chirpFreq = 0;
  let chirpRate = 0;
  let chirpEnv = 0;
  let cooldown = 0;
  for (let i = 0; i < sampleCount; i++) {
    if (cooldown > 0) cooldown--;
    else if (Math.random() < 0.00015) {
      chirpActive = Math.floor(sampleRate * (0.08 + Math.random() * 0.15));
      chirpFreq = 1800 + Math.random() * 1800;
      // 每次啁啾随机扫频速率与方向
      chirpRate = (600 + Math.random() * 900) * (Math.random() < 0.5 ? 1 : -1);
      chirpEnv = 1;
      cooldown = Math.floor(sampleRate * (0.4 + Math.random() * 1.2));
    }
    let chirp = 0;
    if (chirpActive > 0) {
      chirpActive--;
      const progress = 1 - chirpActive / (sampleRate * 0.25);
      const freq = chirpFreq + chirpRate * progress;
      const phase = ((i * freq) / sampleRate) % 1;
      // 包络：快起慢落
      chirpEnv = Math.min(1, chirpEnv * 1.15) * 0.998;
      chirp = Math.sin(2 * Math.PI * phase) * chirpEnv * Math.sin(Math.PI * Math.min(1, progress * 3));
    }
    out[i] = chirp * 0.7 + ambient[i] * 0.15;
  }
  return out;
}

const GENERATORS: Record<SoundId, SoundGenerator> = {
  rain: generateRain,
  stream: generateStream,
  campfire: generateCampfire,
  windchime: generateWindchime,
  wind: generateWind,
  birds: generateBirds,
};

/** 循环交叉淡化：见文件头注释 */
function applyLoopCrossfade(signal: Float32Array, crossfadeSamples: number): Float32Array {
  const out = new Float32Array(signal.length - crossfadeSamples);
  for (let i = 0; i < crossfadeSamples; i++) {
    const w = i / crossfadeSamples;
    out[i] = signal[i] * w + signal[out.length + i] * (1 - w);
  }
  out.set(signal.subarray(crossfadeSamples, out.length), crossfadeSamples);
  return out;
}

/** 峰值归一化到 target */
function normalize(signal: Float32Array, target: number): void {
  let peak = 0;
  for (const s of signal) peak = Math.max(peak, Math.abs(s));
  if (peak === 0) return;
  const gain = target / peak;
  for (let i = 0; i < signal.length; i++) signal[i] *= gain;
}

/** 写 16-bit 单声道 PCM WAV */
function writeWav(path: string, samples: Float32Array, sampleRate: number): void {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  writeFileSync(path, buffer);
}

function main(): void {
  const outDir = join(import.meta.dirname, '..', 'apps', 'mobile', 'assets', 'audio');
  mkdirSync(outDir, { recursive: true });
  const totalSamples = SAMPLE_RATE * DURATION;
  const crossfadeSamples = SAMPLE_RATE * CROSSFADE;

  for (const def of SOUND_DEFS) {
    const generator = GENERATORS[def.id];
    const raw = generator(totalSamples + crossfadeSamples, SAMPLE_RATE);
    normalize(raw, PEAK);
    const looped = applyLoopCrossfade(raw, crossfadeSamples);
    const path = join(outDir, `${def.id}.wav`);
    writeWav(path, looped, SAMPLE_RATE);
    console.log(`生成 ${def.id}.wav（${def.name}）：${(looped.length / SAMPLE_RATE).toFixed(1)}s`);
  }
}

main();
