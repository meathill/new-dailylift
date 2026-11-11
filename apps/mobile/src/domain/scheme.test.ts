import { describe, expect, it } from 'vitest';
import { parseScheme, serializeScheme } from './scheme';
import type { SoundScheme } from './types';

const validScheme: SoundScheme = {
  version: 1,
  name: '雨夜篝火',
  sources: [
    { instanceId: 's_1', soundId: 'rain', x: -1.5, z: -2, volume: 0.8 },
    { instanceId: 's_2', soundId: 'campfire', x: 1.2, z: 0.5, volume: 0.5 },
  ],
};

describe('serializeScheme / parseScheme', () => {
  it('序列化后可无损解析', () => {
    const parsed = parseScheme(serializeScheme(validScheme));
    expect(parsed).toEqual(validScheme);
  });

  it('解析后产生独立的对象（不共享引用）', () => {
    const parsed = parseScheme(serializeScheme(validScheme));
    expect(parsed).not.toBe(validScheme);
    expect(parsed?.sources[0]).not.toBe(validScheme.sources[0]);
  });

  it.each([
    ['version 不是 1', JSON.stringify({ ...validScheme, version: 2 })],
    ['name 为空', JSON.stringify({ ...validScheme, name: '' })],
    ['name 超长', JSON.stringify({ ...validScheme, name: 'a'.repeat(51) })],
    [
      'soundId 不在白名单',
      JSON.stringify({
        ...validScheme,
        sources: [{ ...validScheme.sources[0], soundId: 'rocket' }],
      }),
    ],
    [
      'volume 越界',
      JSON.stringify({ ...validScheme, sources: [{ ...validScheme.sources[0], volume: 1.5 }] }),
    ],
    [
      '坐标越界',
      JSON.stringify({ ...validScheme, sources: [{ ...validScheme.sources[0], x: 9 }] }),
    ],
    [
      '非数值坐标',
      JSON.stringify({ ...validScheme, sources: [{ ...validScheme.sources[0], x: 'left' }] }),
    ],
    ['sources 不是数组', JSON.stringify({ ...validScheme, sources: {} })],
    [
      '缺少 instanceId',
      JSON.stringify({ ...validScheme, sources: [{ soundId: 'rain', x: 0, z: 0, volume: 1 }] }),
    ],
    ['整体不是方案结构', JSON.stringify({ hello: 'world' })],
    ['不是 JSON', '这不是 JSON'],
  ])('拒绝：%s', (_label, json) => {
    expect(parseScheme(json)).toBeNull();
  });

  it('接受空 sources 的方案（清空后的方案）', () => {
    const parsed = parseScheme(JSON.stringify({ version: 1, name: '安静', sources: [] }));
    expect(parsed?.sources).toEqual([]);
  });
});
