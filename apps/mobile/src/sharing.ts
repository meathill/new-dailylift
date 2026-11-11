import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { parseScheme } from './domain/scheme';
import type { SoundScheme } from './domain/types';

/** 分享方案：优先系统分享面板，同时复制到剪贴板兜底 */
export async function shareScheme(scheme: SoundScheme): Promise<void> {
  const json = JSON.stringify(scheme);
  await Clipboard.setStringAsync(json);
  const fileUri = `${cacheDirectory}sound-scheme-${Date.now()}.json`;
  await writeAsStringAsync(fileUri, json);
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: '分享声音方案',
    });
  }
}

/** 从剪贴板导入方案，非法数据返回 null */
export async function importSchemeFromClipboard(): Promise<SoundScheme | null> {
  const text = await Clipboard.getStringAsync();
  if (!text) return null;
  // 兼容剪贴板里混入的前后空白
  return parseScheme(text.trim());
}
