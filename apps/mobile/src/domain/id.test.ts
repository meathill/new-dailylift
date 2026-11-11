import { describe, expect, it } from 'vitest';
import { createInstanceId } from './id';

describe('createInstanceId', () => {
  it('批量生成不重复', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createInstanceId()));
    expect(ids.size).toBe(1000);
  });

  it('格式为 s_ 前缀的安全字符', () => {
    expect(createInstanceId()).toMatch(/^s_[0-9a-z]+_[0-9a-z]+$/);
  });
});
