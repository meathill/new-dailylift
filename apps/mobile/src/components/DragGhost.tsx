import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { SoundId } from '../domain/types';
import { soundNameOf } from '../audio/sound-library';
import { SOUND_ICONS } from './sound-icons';

const GHOST_SIZE = 56;
const GHOST_RADIUS = GHOST_SIZE / 2;

interface DragGhostProps {
  soundId: SoundId | null;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isActive: SharedValue<number>;
  isInsideDisc: boolean;
}

/**
 * 从音源库拖向圆盘时的全屏跟随半透明光球。
 * 纯 UI 线程动画驱动，绝不阻塞 JS 线程。
 */
export function DragGhost({ soundId, dragX, dragY, isActive, isInsideDisc }: DragGhostProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = isInsideDisc ? withSpring(1.15) : withSpring(1.0);
    return {
      opacity: isActive.value,
      transform: [
        { translateX: dragX.value - GHOST_RADIUS },
        { translateY: dragY.value - GHOST_RADIUS - 20 },
        { scale },
      ],
    };
  });

  if (!soundId) return null;

  const Icon = SOUND_ICONS[soundId];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.ghost, animatedStyle]}>
        <Icon size={26} color="#F5E8D0" weight="bold" />
        <Text style={styles.label}>{soundNameOf(soundId)}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    borderRadius: GHOST_RADIUS,
    backgroundColor: 'rgba(232, 213, 181, 0.28)',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E8D5B5',
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    position: 'absolute',
    bottom: -18,
    fontSize: 11,
    fontWeight: '600',
    color: '#F5E8D0',
  },
});
