/** 圆盘半径对应的最大听感距离（米） */
export const MAX_DISTANCE_M = 4;

export interface SpacePoint {
  x: number;
  z: number;
}

export interface DiscOffset {
  dx: number;
  dy: number;
}

/**
 * 圆盘内像素偏移（相对圆心）→ 空间坐标。
 * 屏幕上方为前方（-z），右为右（+x），与 Apple 听者默认朝向一致。
 */
export function discOffsetToSpace(offset: DiscOffset, radiusPx: number): SpacePoint {
  const scale = MAX_DISTANCE_M / radiusPx;
  return { x: offset.dx * scale, z: offset.dy * scale };
}

/** 空间坐标 → 圆盘内像素偏移（相对圆心） */
export function spaceToDiscOffset(point: SpacePoint, radiusPx: number): DiscOffset {
  const scale = radiusPx / MAX_DISTANCE_M;
  return { dx: point.x * scale, dy: point.z * scale };
}

/** 将像素偏移限制在半径 radius 的圆内 */
export function clampToDisc(dx: number, dy: number, radius: number): DiscOffset {
  const dist = Math.hypot(dx, dy);
  if (dist <= radius) return { dx, dy };
  const k = radius / dist;
  return { dx: dx * k, dy: dy * k };
}

/** 空间坐标到听者的直线距离（米） */
export function distanceToListener(point: SpacePoint): number {
  return Math.hypot(point.x, point.z);
}
