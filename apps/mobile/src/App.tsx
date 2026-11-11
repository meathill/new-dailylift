import { Alert, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  loadAndPlaySource,
  pauseSource,
  resumeSource,
  stopAllSources,
  stopAndUnloadSource,
  updateSourcePosition,
  updateSourceVolume,
} from './audio/audio-controller';
import { Disc } from './components/Disc';
import { SchemeBar } from './components/SchemeBar';
import { SoundLibrary } from './components/SoundLibrary';
import { SourcePanel } from './components/SourcePanel';
import { createInstanceId } from './domain/id';
import { saveScheme } from './domain/storage';
import type { SoundId, SoundScheme } from './domain/types';
import { useSchemeStore } from './store/useSchemeStore';
import { importSchemeFromClipboard, shareScheme } from './sharing';

export default function App() {
  const sources = useSchemeStore((state) => state.sources);
  const pausedIds = useSchemeStore((state) => state.pausedIds);
  const selectedId = useSchemeStore((state) => state.selectedId);
  const schemeName = useSchemeStore((state) => state.schemeName);
  const store = useSchemeStore;

  const selectedSource = sources.find((item) => item.instanceId === selectedId) ?? null;

  /** 点按音源栏：随机摆到中圈某处并立即播放 */
  function handleAdd(soundId: SoundId) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 1.6 + Math.random() * 0.8;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const instanceId = createInstanceId();
    store.getState().addSource(soundId, x, z, instanceId);
    loadAndPlaySource(instanceId, soundId, x, z, 0.8).catch((error) => {
      store.getState().removeSource(instanceId);
      notifyError(error);
    });
  }

  function handleMoveEnd(instanceId: string, x: number, z: number) {
    store.getState().moveSource(instanceId, x, z);
    updateSourcePosition(instanceId, x, z).catch(notifyError);
  }

  function handleVolumeChange(instanceId: string, volume: number) {
    store.getState().setSourceVolume(instanceId, volume);
    updateSourceVolume(instanceId, volume).catch(notifyError);
  }

  function handleTogglePause(instanceId: string) {
    const isPaused = store.getState().pausedIds.includes(instanceId);
    store.getState().togglePaused(instanceId);
    const resume = isPaused ? resumeSource : pauseSource;
    resume(instanceId).catch(notifyError);
  }

  function handleRemove(instanceId: string) {
    store.getState().removeSource(instanceId);
    stopAndUnloadSource(instanceId).catch(notifyError);
  }

  function handleSave() {
    const scheme: SoundScheme = { version: 1, name: schemeName, sources };
    saveScheme(scheme)
      .then(() => Alert.alert('已保存', `方案「${schemeName}」已存到本机`))
      .catch(notifyError);
  }

  async function handleShare() {
    const scheme: SoundScheme = { version: 1, name: schemeName, sources };
    try {
      await shareScheme(scheme);
    } catch (error) {
      notifyError(error);
    }
  }

  /** 剪贴板导入：先停掉并卸载当前声源，再逐个加载方案内容 */
  async function handleImport() {
    const scheme = await importSchemeFromClipboard();
    if (!scheme) {
      Alert.alert('导入失败', '剪贴板里没有找到有效的声音方案');
      return;
    }
    try {
      await stopAllSources();
      await Promise.allSettled(sources.map((item) => stopAndUnloadSource(item.instanceId)));
      store.getState().replaceSources(scheme.sources);
      store.getState().setSchemeName(scheme.name);
      await Promise.allSettled(
        scheme.sources.map((item) =>
          loadAndPlaySource(item.instanceId, item.soundId, item.x, item.z, item.volume)
        )
      );
      Alert.alert('导入成功', `方案「${scheme.name}」已加载`);
    } catch (error) {
      notifyError(error);
    }
  }

  async function handleClear() {
    store.getState().clear();
    try {
      await stopAllSources();
      await Promise.allSettled(sources.map((item) => stopAndUnloadSource(item.instanceId)));
    } catch (error) {
      notifyError(error);
    }
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <Text style={styles.title}>声境</Text>
            <Text style={styles.subtitle}>把声音拖到你身边 · 中心是你</Text>
          </View>
          <Disc
            sources={sources}
            pausedIds={pausedIds}
            selectedId={selectedId}
            onSelect={(instanceId) => store.getState().select(instanceId)}
            onMoveEnd={handleMoveEnd}
          />
          {selectedSource && (
            <SourcePanel
              source={selectedSource}
              isPaused={pausedIds.includes(selectedSource.instanceId)}
              onVolumeChange={(volume) => handleVolumeChange(selectedSource.instanceId, volume)}
              onTogglePause={() => handleTogglePause(selectedSource.instanceId)}
              onRemove={() => handleRemove(selectedSource.instanceId)}
            />
          )}
          <SchemeBar
            schemeName={schemeName}
            onNameChange={(name) => store.getState().setSchemeName(name)}
            onSave={handleSave}
            onShare={handleShare}
            onImport={handleImport}
            onClear={handleClear}
          />
          <SoundLibrary onAdd={handleAdd} />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function notifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  Alert.alert('出错了', message);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0E1420',
  },
  safe: {
    flex: 1,
    backgroundColor: '#0E1420',
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F5E8D0',
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#5A6B85',
  },
});
