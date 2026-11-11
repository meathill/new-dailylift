import { Asset } from 'expo-asset';
import type { SoundDef, SoundId } from '../domain/types';
import birdsWav from '../../assets/audio/birds.wav';
import campfireWav from '../../assets/audio/campfire.wav';
import rainWav from '../../assets/audio/rain.wav';
import streamWav from '../../assets/audio/stream.wav';
import windWav from '../../assets/audio/wind.wav';
import windchimeWav from '../../assets/audio/windchime.wav';

interface LibraryEntry extends SoundDef {
  assetModule: number;
}

const LIBRARY: LibraryEntry[] = [
  { id: 'rain', name: '雨声', assetModule: rainWav },
  { id: 'stream', name: '溪流', assetModule: streamWav },
  { id: 'campfire', name: '篝火', assetModule: campfireWav },
  { id: 'windchime', name: '风铃', assetModule: windchimeWav },
  { id: 'wind', name: '风声', assetModule: windWav },
  { id: 'birds', name: '鸟鸣', assetModule: birdsWav },
];

/** 内置音源定义列表（界面音源栏使用） */
export const SOUND_LIBRARY: SoundDef[] = LIBRARY.map(({ id, name }) => ({ id, name }));

/** 音源显示名 */
export function soundNameOf(id: SoundId): string {
  return LIBRARY.find((item) => item.id === id)?.name ?? id;
}

/** 解析音源的本地文件 URI，供原生模块读取 */
export async function resolveSoundUri(id: SoundId): Promise<string> {
  const entry = LIBRARY.find((item) => item.id === id);
  if (!entry) throw new Error(`未知音源: ${id}`);
  const asset = Asset.fromModule(entry.assetModule);
  if (asset.localUri) return asset.localUri;
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error(`音源资源不可用: ${id}`);
  return asset.localUri;
}
