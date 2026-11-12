import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MAX_DISTANCE_M } from '../domain/position';
import type { PlacedSource } from '../domain/types';
import { soundNameOf } from '../audio/sound-library';
import { SOUND_ICONS } from './sound-icons';

const NODE_SIZE = 52;
const NODE_RADIUS = NODE_SIZE / 2;
const NODE_COLOR = '#E8D5B5';
const PAUSED_COLOR = '#5A6B85';

interface SourceNodeProps {
  source: PlacedSource;
  /** 圆盘像素半径，用于空间坐标换算 */
  discRadius: number;
  isSelected: boolean;
  isPaused: boolean;
  onSelect: (instanceId: string) => void;
  onMove?: (instanceId: string, x: number, z: number) => void;
  onMoveEnd: (instanceId: string, x: number, z: number) => void;
}

/**
 * 盘上声源节点：可拖动，拖动结束后把像素位置换算回空间坐标提交。
 * 拖动过程中节点位置由 shared value 驱动（UI 线程），不经 JS 重渲染。
 */
export function SourceNode({
  source,
  discRadius,
  isSelected,
  isPaused,
  onSelect,
  onMove,
  onMoveEnd,
}: SourceNodeProps) {
  const metersToPx = discRadius / MAX_DISTANCE_M;
  const offsetX = useSharedValue(source.x * metersToPx);
  const offsetY = useSharedValue(source.z * metersToPx);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastSentX = useSharedValue(source.x * metersToPx);
  const lastSentY = useSharedValue(source.z * metersToPx);

  // 圆盘尺寸在首次 layout 后才知道，此时按最新半径重放空间坐标
  useEffect(() => {
    offsetX.value = source.x * metersToPx;
    offsetY.value = source.z * metersToPx;
    lastSentX.value = source.x * metersToPx;
    lastSentY.value = source.z * metersToPx;
  }, [discRadius, metersToPx, source.x, source.z, offsetX, offsetY, lastSentX, lastSentY]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      lastSentX.value = offsetX.value;
      lastSentY.value = offsetY.value;
    })
    .onUpdate((event) => {
      // clamp 到圆盘内（与 domain/position.ts 的 clampToDisc 相同逻辑，worklet 内联）
      const dx = startX.value + event.translationX;
      const dy = startY.value + event.translationY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = discRadius - NODE_RADIUS;
      let targetX = dx;
      let targetY = dy;
      if (dist <= maxDist) {
        offsetX.value = dx;
        offsetY.value = dy;
      } else {
        const k = maxDist / dist;
        targetX = dx * k;
        targetY = dy * k;
        offsetX.value = targetX;
        offsetY.value = targetY;
      }

      if (onMove) {
        const moveDistSq =
          (targetX - lastSentX.value) * (targetX - lastSentX.value) +
          (targetY - lastSentY.value) * (targetY - lastSentY.value);
        if (moveDistSq >= 1) {
          lastSentX.value = targetX;
          lastSentY.value = targetY;
          const pxToMeters = MAX_DISTANCE_M / discRadius;
          runOnJS(onMove)(source.instanceId, targetX * pxToMeters, targetY * pxToMeters);
        }
      }
    })
    .onEnd(() => {
      const pxToMeters = MAX_DISTANCE_M / discRadius;
      const finalX = offsetX.value * pxToMeters;
      const finalZ = offsetY.value * pxToMeters;
      if (onMove) {
        runOnJS(onMove)(source.instanceId, finalX, finalZ);
      }
      runOnJS(onMoveEnd)(source.instanceId, finalX, finalZ);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)(source.instanceId);
  });

  const gesture = Gesture.Exclusive(tap, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  const Icon = SOUND_ICONS[source.soundId];
  const iconColor = isPaused ? PAUSED_COLOR : NODE_COLOR;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.node,
          {
            left: discRadius - NODE_RADIUS,
            top: discRadius - NODE_RADIUS,
            borderColor: isSelected ? '#FFFFFF' : 'transparent',
            opacity: isPaused ? 0.55 : 1,
          },
          animatedStyle,
        ]}
      >
        <Icon size={24} color={iconColor} weight={isSelected ? 'bold' : 'regular'} />
        <Text style={[styles.label, { color: iconColor }]}>{soundNameOf(source.soundId)}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_RADIUS,
    backgroundColor: 'rgba(232, 213, 181, 0.14)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NODE_COLOR,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    position: 'absolute',
    bottom: -18,
    fontSize: 11,
    color: NODE_COLOR,
  },
});
