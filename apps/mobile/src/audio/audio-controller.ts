import native from './spatial-audio';
import { resolveSoundUri } from './sound-library';
import type { SoundId } from '../domain/types';

let prepared = false;

/** 启动音频引擎（幂等），首次播放或恢复场景前调用 */
export async function ensureEngineReady(): Promise<void> {
  if (prepared) return;
  await native.prepare();
  prepared = true;
}

/** 加载内置音源到指定位置并立即循环播放 */
export async function loadAndPlaySource(
  instanceId: string,
  soundId: SoundId,
  x: number,
  z: number,
  volume: number
): Promise<void> {
  await ensureEngineReady();
  const uri = await resolveSoundUri(soundId);
  await native.loadSource(instanceId, uri, true);
  await native.setSourcePosition(instanceId, x, 0, z);
  await native.setSourceVolume(instanceId, volume);
  await native.playSource(instanceId);
}

/** 拖动中实时更新位置（高频调用，仅设置原生属性） */
export async function updateSourcePosition(
  instanceId: string,
  x: number,
  z: number
): Promise<void> {
  await native.setSourcePosition(instanceId, x, 0, z);
}

export async function updateSourceVolume(instanceId: string, volume: number): Promise<void> {
  await native.setSourceVolume(instanceId, volume);
}

export async function pauseSource(instanceId: string): Promise<void> {
  await native.stopSource(instanceId);
}

export async function resumeSource(instanceId: string): Promise<void> {
  await native.playSource(instanceId);
}

export async function stopAndUnloadSource(instanceId: string): Promise<void> {
  await native.unloadSource(instanceId);
}

export async function stopAllSources(): Promise<void> {
  await native.stopAll();
}
