import { create } from 'zustand';
import type { PlacedSource, SoundId } from '../domain/types';
import { createInstanceId } from '../domain/id';

interface SchemeState {
  /** 盘上的声源（含空间坐标），按添加顺序排列 */
  sources: PlacedSource[];
  /** 暂停播放的声源实例 id */
  pausedIds: string[];
  selectedId: string | null;
  schemeName: string;
  addSource: (soundId: SoundId, x: number, z: number, instanceId: string) => void;
  moveSource: (instanceId: string, x: number, z: number) => void;
  setSourceVolume: (instanceId: string, volume: number) => void;
  removeSource: (instanceId: string) => void;
  togglePaused: (instanceId: string) => void;
  select: (instanceId: string | null) => void;
  setSchemeName: (name: string) => void;
  /** 导入方案：整体替换声源并取消暂停 */
  replaceSources: (sources: PlacedSource[]) => void;
  clear: () => void;
}

export const useSchemeStore = create<SchemeState>((set) => ({
  sources: [],
  pausedIds: [],
  selectedId: null,
  schemeName: '我的声音方案',

  addSource: (soundId, x, z, instanceId) =>
    set((state) => ({
      sources: [...state.sources, { instanceId, soundId, x, z, volume: 0.8 }],
    })),

  moveSource: (instanceId, x, z) =>
    set((state) => ({
      sources: state.sources.map((item) =>
        item.instanceId === instanceId ? { ...item, x, z } : item
      ),
    })),

  setSourceVolume: (instanceId, volume) =>
    set((state) => ({
      sources: state.sources.map((item) =>
        item.instanceId === instanceId ? { ...item, volume } : item
      ),
    })),

  removeSource: (instanceId) =>
    set((state) => ({
      sources: state.sources.filter((item) => item.instanceId !== instanceId),
      pausedIds: state.pausedIds.filter((id) => id !== instanceId),
      selectedId: state.selectedId === instanceId ? null : state.selectedId,
    })),

  togglePaused: (instanceId) =>
    set((state) => ({
      pausedIds: state.pausedIds.includes(instanceId)
        ? state.pausedIds.filter((id) => id !== instanceId)
        : [...state.pausedIds, instanceId],
    })),

  select: (instanceId) => set({ selectedId: instanceId }),

  setSchemeName: (name) => set({ schemeName: name }),

  replaceSources: (sources) => set({ sources, pausedIds: [], selectedId: null }),

  clear: () => set({ sources: [], pausedIds: [], selectedId: null }),
}));
