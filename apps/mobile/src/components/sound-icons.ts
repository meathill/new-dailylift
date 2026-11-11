import {
  BellIcon,
  BirdIcon,
  CampfireIcon,
  CloudRainIcon,
  DropIcon,
  WindIcon,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import type { SoundId } from '../domain/types';

type SoundIcon = ComponentType<{ size: number; color: string; weight?: 'regular' | 'bold' }>;

/** 各音源的展示图标 */
export const SOUND_ICONS: Record<SoundId, SoundIcon> = {
  rain: CloudRainIcon,
  stream: DropIcon,
  campfire: CampfireIcon,
  windchime: BellIcon,
  wind: WindIcon,
  birds: BirdIcon,
};
