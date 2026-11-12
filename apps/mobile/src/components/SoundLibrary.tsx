import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SOUND_LIBRARY } from '../audio/sound-library';
import type { SoundId } from '../domain/types';
import { SOUND_ICONS } from './sound-icons';

interface SoundLibraryProps {
  onDragStart: (soundId: SoundId, absoluteX: number, absoluteY: number) => void;
  onDragUpdate: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: (soundId: SoundId, absoluteX: number, absoluteY: number) => void;
  onDragCancel: () => void;
  onTapHint?: () => void;
}

interface ItemProps {
  id: SoundId;
  name: string;
  onDragStart: (soundId: SoundId, absoluteX: number, absoluteY: number) => void;
  onDragUpdate: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: (soundId: SoundId, absoluteX: number, absoluteY: number) => void;
  onDragCancel: () => void;
  onTapHint?: () => void;
}

function SoundLibraryItem({
  id,
  name,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onDragCancel,
  onTapHint,
}: ItemProps) {
  const Icon = SOUND_ICONS[id];

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onStart((event) => {
      runOnJS(onDragStart)(id, event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(onDragUpdate)(event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(onDragEnd)(id, event.absoluteX, event.absoluteY);
    })
    .onFinalize(() => {
      runOnJS(onDragCancel)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    if (onTapHint) {
      runOnJS(onTapHint)();
    }
  });

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.item}>
        <Icon size={24} color="#E8D5B5" />
        <Text style={styles.label}>{name}</Text>
      </View>
    </GestureDetector>
  );
}

/** 底部音源栏：向上拖动音源至圆盘中放置并开始播放 */
export function SoundLibrary({
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onDragCancel,
  onTapHint,
}: SoundLibraryProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>向上拖动音源放入上方圆盘</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {SOUND_LIBRARY.map((def) => (
          <SoundLibraryItem
            key={def.id}
            id={def.id}
            name={def.name}
            onDragStart={onDragStart}
            onDragUpdate={onDragUpdate}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
            onTapHint={onTapHint}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A3850',
    paddingBottom: 4,
  },
  hintBar: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  hintText: {
    fontSize: 11,
    color: '#5A6B85',
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
