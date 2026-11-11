import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { PauseIcon, PlayIcon, XIcon } from 'phosphor-react-native';
import { soundNameOf } from '../audio/sound-library';
import type { PlacedSource } from '../domain/types';
import { SOUND_ICONS } from './sound-icons';

interface SourcePanelProps {
  source: PlacedSource;
  isPaused: boolean;
  onVolumeChange: (volume: number) => void;
  onTogglePause: () => void;
  onRemove: () => void;
}

/** 选中声源后的操作条：音量 / 暂停继续 / 移除 */
export function SourcePanel({
  source,
  isPaused,
  onVolumeChange,
  onTogglePause,
  onRemove,
}: SourcePanelProps) {
  const Icon = SOUND_ICONS[source.soundId];
  return (
    <View style={styles.wrap}>
      <Icon size={20} color="#E8D5B5" />
      <Text style={styles.name}>{soundNameOf(source.soundId)}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={source.volume}
        minimumTrackTintColor="#E8D5B5"
        maximumTrackTintColor="#2A3850"
        thumbTintColor="#E8D5B5"
        onValueChange={onVolumeChange}
      />
      <Pressable style={styles.button} onPress={onTogglePause}>
        {isPaused ? (
          <PlayIcon size={20} color="#E8D5B5" />
        ) : (
          <PauseIcon size={20} color="#E8D5B5" />
        )}
      </Pressable>
      <Pressable style={styles.button} onPress={onRemove}>
        <XIcon size={20} color="#C9D4E8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  name: {
    fontSize: 14,
    color: '#C9D4E8',
    width: 44,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42, 56, 80, 0.6)',
  },
});
