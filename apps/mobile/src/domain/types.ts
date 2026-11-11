/** 内置音源白名单 */
export const SOUND_IDS = ['rain', 'stream', 'campfire', 'windchime', 'wind', 'birds'] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export interface SoundDef {
  id: SoundId;
  /** 界面显示名 */
  name: string;
}

/** 放置到圆盘上的声源实例 */
export interface PlacedSource {
  instanceId: string;
  soundId: SoundId;
  /** 空间横向坐标（米），右为正 */
  x: number;
  /** 空间纵深坐标（米），前方为负（与 Apple 听者坐标系一致） */
  z: number;
  /** 声源基础音量 0~1（距离衰减由原生引擎叠加） */
  volume: number;
}

export interface SoundScheme {
  version: 1;
  name: string;
  sources: PlacedSource[];
}
