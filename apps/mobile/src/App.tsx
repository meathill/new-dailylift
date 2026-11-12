import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';
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
import { DragGhost } from './components/DragGhost';
import { SchemeBar } from './components/SchemeBar';
import { SoundLibrary } from './components/SoundLibrary';
import { SourcePanel } from './components/SourcePanel';
import { createInstanceId } from './domain/id';
import { type DiscBounds, isPointInsideDisc, windowPointToSpace } from './domain/position';
import { saveScheme } from './domain/storage';
import type { SoundId, SoundScheme } from './domain/types';
import { useSchemeStore } from './store/useSchemeStore';
import { importSchemeFromClipboard, shareScheme } from './sharing';

const NODE_RADIUS = 26;

export default function App() {
  const sources = useSchemeStore((state) => state.sources);
  const pausedIds = useSchemeStore((state) => state.pausedIds);
  const selectedId = useSchemeStore((state) => state.selectedId);
  const schemeName = useSchemeStore((state) => state.schemeName);
  const store = useSchemeStore;

  const [discBounds, setDiscBounds] = useState<DiscBounds | null>(null);
  const [activeDragSound, setActiveDragSound] = useState<SoundId | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragActive = useSharedValue(0);

  const selectedSource = sources.find((item) => item.instanceId === selectedId) ?? null;

  /** 在圆盘指定空间位置放置并立即循环播放 */
  function handleAddAt(soundId: SoundId, x: number, z: number) {
    const instanceId = createInstanceId();
    store.getState().addSource(soundId, x, z, instanceId);
    store.getState().select(instanceId);
    loadAndPlaySource(instanceId, soundId, x, z, 0.8).catch((error) => {
      store.getState().removeSource(instanceId);
      notifyError(error);
    });
  }

  function handleDragStart(soundId: SoundId, x: number, y: number) {
    setActiveDragSound(soundId);
    dragX.value = x;
    dragY.value = y;
    dragActive.value = withTiming(1, { duration: 100 });
  }

  function handleDragUpdate(x: number, y: number) {
    dragX.value = x;
    dragY.value = y;
    if (discBounds) {
      const hovered = isPointInsideDisc(x, y, discBounds, 1.05);
      setIsHovered((prev) => (prev !== hovered ? hovered : prev));
    }
  }

  function handleDragEnd(soundId: SoundId, x: number, y: number) {
    dragActive.value = withTiming(0, { duration: 120 });
    setIsHovered(false);
    if (discBounds && isPointInsideDisc(x, y, discBounds, 1.05)) {
      const space = windowPointToSpace(x, y, discBounds, NODE_RADIUS);
      handleAddAt(soundId, space.x, space.z);
    }
    setActiveDragSound(null);
  }

  function handleDragCancel() {
    dragActive.value = withTiming(0, { duration: 120 });
    setIsHovered(false);
    setActiveDragSound(null);
  }

  function handleTapHint() {
    Alert.alert('提示', '请按住音源向上拖动到圆盘中放置');
  }

  /** 拖动中实时更新声音空间位置（不触发 React 重新渲染） */
  function handleMove(instanceId: string, x: number, z: number) {
    updateSourcePosition(instanceId, x, z).catch(notifyError);
  }

  /** 拖动结束：同步到 store 做数据持久化 */
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
            isDropTargetHovered={isHovered}
            onSelect={(instanceId) => store.getState().select(instanceId)}
            onMove={handleMove}
            onMoveEnd={handleMoveEnd}
            onLayoutBounds={setDiscBounds}
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
          <SoundLibrary
            onDragStart={handleDragStart}
            onDragUpdate={handleDragUpdate}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            onTapHint={handleTapHint}
          />
          <DragGhost
            soundId={activeDragSound}
            dragX={dragX}
            dragY={dragY}
            isActive={dragActive}
            isInsideDisc={isHovered}
          />
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
