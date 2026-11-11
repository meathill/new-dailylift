import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SoundScheme } from './types';

const STORAGE_KEY = 'dailylift.schemes';

/** 读取全部已保存方案 */
export async function listSavedSchemes(): Promise<SoundScheme[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as SoundScheme[]) : [];
  } catch {
    return [];
  }
}

/** 按方案名 upsert 保存 */
export async function saveScheme(scheme: SoundScheme): Promise<void> {
  const schemes = await listSavedSchemes();
  const existingIndex = schemes.findIndex((item) => item.name === scheme.name);
  if (existingIndex >= 0) {
    schemes[existingIndex] = scheme;
  } else {
    schemes.push(scheme);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
}
