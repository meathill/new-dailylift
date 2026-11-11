import { requireNativeModule, type NativeModule } from 'expo';

/**
 * SpatialAudio 原生模块接口（本模块的原生端见 ios/SpatialAudioModule.swift）。
 * 坐标单位为米：听者在原点，前方 -z，右 +x。
 * 距离衰减由原生层处理，volume 仅作声源基础音量。
 */
export interface SpatialAudioNativeModule extends NativeModule {
  prepare(): Promise<void>;
  loadSource(id: string, uri: string, loop: boolean): Promise<void>;
  playSource(id: string): Promise<void>;
  stopSource(id: string): Promise<void>;
  setSourcePosition(id: string, x: number, y: number, z: number): Promise<void>;
  setSourceVolume(id: string, volume: number): Promise<void>;
  unloadSource(id: string): Promise<void>;
  stopAll(): Promise<void>;
}

export default requireNativeModule<SpatialAudioNativeModule>('SpatialAudio');
