import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SOUND_LIBRARY } from '../audio/sound-library';
import type { SoundId } from '../domain/types';
import { SOUND_ICONS } from './sound-icons';

interface SoundLibraryProps {
  onAdd: (soundId: SoundId) => void;
}

/** 底部音源栏：点按即添加到圆盘并开始播放 */
export function SoundLibrary({ onAdd }: SoundLibraryProps) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {SOUND_LIBRARY.map((def) => {
          const Icon = SOUND_ICONS[def.id];
          return (
            <Pressable key={def.id} style={styles.item} onPress={() => onAdd(def.id)}>
              <Icon size={24} color="#E8D5B5" />
              <Text style={styles.label}>{def.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A3850',
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 64,
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(42, 56, 80, 0.5)',
  },
  label: {
    fontSize: 12,
    color: '#C9D4E8',
  },
});
