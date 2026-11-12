import { describe, expect, it } from 'vitest';
import {
  MAX_DISTANCE_M,
  clampToDisc,
  discOffsetToSpace,
  distanceToListener,
  isPointInsideDisc,
  spaceToDiscOffset,
  windowPointToSpace,
} from './position';

describe('discOffsetToSpace', () => {
  it('圆盘半径像素映射到最大距离', () => {
    expect(discOffsetToSpace({ dx: 100, dy: 0 }, 100)).toEqual({ x: MAX_DISTANCE_M, z: 0 });
    expect(discOffsetToSpace({ dx: 0, dy: -50 }, 100)).toEqual({ x: 0, z: -MAX_DISTANCE_M / 2 });
  });

  it('屏幕上方为前方（-z）', () => {
    const { z } = discOffsetToSpace({ dx: 0, dy: -100 }, 100);
    expect(z).toBeLessThan(0);
  });

  it('屏幕右方为 +x', () => {
    const { x } = discOffsetToSpace({ dx: 100, dy: 0 }, 100);
    expect(x).toBeGreaterThan(0);
  });
});

describe('spaceToDiscOffset', () => {
  it('与 discOffsetToSpace 互为逆变换', () => {
    const offset = { dx: 37.5, dy: -62.1 };
    const space = discOffsetToSpace(offset, 120);
    const restored = spaceToDiscOffset(space, 120);
    expect(restored.dx).toBeCloseTo(offset.dx, 6);
    expect(restored.dy).toBeCloseTo(offset.dy, 6);
  });
});

describe('clampToDisc', () => {
  it('圆内点不改变', () => {
    expect(clampToDisc(30, 40, 100)).toEqual({ dx: 30, dy: 40 });
  });

  it('圆外点收缩到圆周上', () => {
    const clamped = clampToDisc(300, 400, 100);
    expect(Math.hypot(clamped.dx, clamped.dy)).toBeCloseTo(100, 6);
    // 方向保持不变
    expect(clamped.dx / clamped.dy).toBeCloseTo(300 / 400, 6);
  });

  it('圆周上的点恰好保留', () => {
    expect(clampToDisc(100, 0, 100)).toEqual({ dx: 100, dy: 0 });
  });

  it('原点不产生 NaN', () => {
    expect(clampToDisc(0, 0, 100)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('distanceToListener', () => {
  it('计算到原点的距离', () => {
    expect(distanceToListener({ x: 3, z: 4 })).toBe(5);
    expect(distanceToListener({ x: 0, z: 0 })).toBe(0);
  });
});

describe('isPointInsideDisc', () => {
  const bounds = { centerX: 200, centerY: 300, radius: 100 };

  it('圆心与圆内点返回 true', () => {
    expect(isPointInsideDisc(200, 300, bounds)).toBe(true);
    expect(isPointInsideDisc(250, 300, bounds)).toBe(true);
    expect(isPointInsideDisc(200, 210, bounds)).toBe(true);
  });

  it('边界点受 tolerance 影响', () => {
    expect(isPointInsideDisc(200, 400, bounds, 1.0)).toBe(true);
    expect(isPointInsideDisc(200, 405, bounds, 1.0)).toBe(false);
    expect(isPointInsideDisc(200, 405, bounds, 1.1)).toBe(true);
  });

  it('远离圆盘的点返回 false', () => {
    expect(isPointInsideDisc(0, 0, bounds)).toBe(false);
    expect(isPointInsideDisc(500, 500, bounds)).toBe(false);
  });
});

describe('windowPointToSpace', () => {
  const bounds = { centerX: 200, centerY: 300, radius: 100 };

  it('圆心转换为空间原点 (0, 0)', () => {
    const point = windowPointToSpace(200, 300, bounds);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.z).toBeCloseTo(0, 6);
  });

  it('屏幕上方转换为负 z（前方）', () => {
    const point = windowPointToSpace(200, 200, bounds);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.z).toBeCloseTo(-MAX_DISTANCE_M, 6);
  });

  it('屏幕右方转换为正 x（右方）', () => {
    const point = windowPointToSpace(300, 300, bounds);
    expect(point.x).toBeCloseTo(MAX_DISTANCE_M, 6);
    expect(point.z).toBeCloseTo(0, 6);
  });

  it('包含安全边距 nodeRadius 时向内收缩', () => {
    const point = windowPointToSpace(400, 300, bounds, 20);
    // 半径 100，nodeRadius 20，因此限制在 80px，对应 80/100 * MAX_DISTANCE_M
    expect(point.x).toBeCloseTo(MAX_DISTANCE_M * 0.8, 6);
    expect(point.z).toBeCloseTo(0, 6);
  });
});
