import { SOUND_IDS, type PlacedSource, type SoundScheme } from './types';

/**
 * 校验未知数据是否为合法的声音方案（用于分享导入）。
 * 结构不符、soundId 不在白名单、数值越界一律拒绝。
 */
export function isSoundScheme(value: unknown): value is SoundScheme {
  if (typeof value !== 'object' || value === null) return false;
  const scheme = value as Record<string, unknown>;
  if (scheme.version !== 1) return false;
  if (typeof scheme.name !== 'string' || scheme.name.length === 0 || scheme.name.length > 50) {
    return false;
  }
  if (!Array.isArray(scheme.sources)) return false;
  return scheme.sources.every((item) => isPlacedSource(item));
}

function isPlacedSource(value: unknown): value is PlacedSource {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Record<string, unknown>;
  if (typeof source.instanceId !== 'string' || source.instanceId.length === 0) return false;
  if (typeof source.soundId !== 'string') return false;
  if (!(SOUND_IDS as readonly string[]).includes(source.soundId)) return false;
  if (!isFiniteNumber(source.x) || !isFiniteNumber(source.z)) return false;
  // 坐标超出圆盘范围（±最大距离）拒绝
  if (Math.abs(Number(source.x)) > 4 || Math.abs(Number(source.z)) > 4) return false;
  return isFiniteNumber(source.volume) && Number(source.volume) >= 0 && Number(source.volume) <= 1;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 序列化为分享用 JSON 文本 */
export function serializeScheme(scheme: SoundScheme): string {
  return JSON.stringify(scheme);
}

/** 从 JSON 文本解析方案，非法输入返回 null */
export function parseScheme(json: string): SoundScheme | null {
  try {
    const value: unknown = JSON.parse(json);
    return isSoundScheme(value) ? value : null;
  } catch {
    return null;
  }
}
