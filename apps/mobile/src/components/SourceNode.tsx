import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TrashIcon } from 'phosphor-react-native';
import { MAX_DISTANCE_M } from '../domain/position';
import type { PlacedSource } from '../domain/types';
import { soundNameOf } from '../audio/sound-library';
import { SOUND_ICONS } from './sound-icons';

const NODE_SIZE = 52;
const NODE_RADIUS = NODE_SIZE / 2;
const NODE_COLOR = '#E8D5B5';
const PAUSED_COLOR = '#5A6B85';
const REMOVE_COLOR = '#EB5757';

interface SourceNodeProps {
  source: PlacedSource;
  /** 圆盘像素半径，用于空间坐标换算 */
  discRadius: number;
  isSelected: boolean;
  isPaused: boolean;
  onSelect: (instanceId: string) => void;
  onMove?: (instanceId: string, x: number, z: number) => void;
  onMoveEnd: (instanceId: string, x: number, z: number) => void;
  onRemove: (instanceId: string) => void;
}

/**
 * 盘上声源节点：可拖动。
 * - 拖动在圆盘内：实时更新声像空间坐标；
 * - 拖出圆盘外：变红显示垃圾桶，松手直接删除。
 */
export function SourceNode({
  source,
  discRadius,
  isSelected,
  isPaused,
  onSelect,
  onMove,
  onMoveEnd,
  onRemove,
}: SourceNodeProps) {
  const [isOutsideState, setIsOutsideState] = useState(false);

  const metersToPx = discRadius / MAX_DISTANCE_M;
  const offsetX = useSharedValue(source.x * metersToPx);
  const offsetY = useSharedValue(source.z * metersToPx);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastSentX = useSharedValue(source.x * metersToPx);
  const lastSentY = useSharedValue(source.z * metersToPx);
  const isOutside = useSharedValue(false);

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
      isOutside.value = false;
      runOnJS(setIsOutsideState)(false);
    })
    .onUpdate((event) => {
      const dx = startX.value + event.translationX;
      const dy = startY.value + event.translationY;
      const dist = Math.hypot(dx, dy);

      // 允许拖出圆盘（外延 60px），不硬性锁死在圆盘内
      const maxDrag = discRadius + 60;
      let targetX = dx;
      let targetY = dy;
      if (dist > maxDrag) {
        const k = maxDrag / dist;
        targetX = dx * k;
        targetY = dy * k;
      }
      offsetX.value = targetX;
      offsetY.value = targetY;

      // 判断是否已经拖出圆盘外
      const out = dist > discRadius;
      if (out !== isOutside.value) {
        isOutside.value = out;
        runOnJS(setIsOutsideState)(out);
      }

      // 在圆盘内且有位移时，实时更新空间声音位置
      if (!out && onMove) {
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
      const dist = Math.hypot(offsetX.value, offsetY.value);
      if (dist > discRadius) {
        // 拖出圆盘外松手：删除该声源！
        runOnJS(onRemove)(source.instanceId);
      } else {
        // 留在圆盘内：安全贴边
        const maxDist = discRadius - NODE_RADIUS;
        let finalX = offsetX.value;
        let finalY = offsetY.value;
        if (dist > maxDist) {
          const k = maxDist / dist;
          finalX *= k;
          finalY *= k;
          offsetX.value = withSpring(finalX);
          offsetY.value = withSpring(finalY);
        }
        const pxToMeters = MAX_DISTANCE_M / discRadius;
        if (onMove) {
          runOnJS(onMove)(source.instanceId, finalX * pxToMeters, finalY * pxToMeters);
        }
        runOnJS(onMoveEnd)(source.instanceId, finalX * pxToMeters, finalY * pxToMeters);
      }
    })
    .onFinalize(() => {
      isOutside.value = false;
      runOnJS(setIsOutsideState)(false);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)(source.instanceId);
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const animatedStyle = useAnimatedStyle(() => {
    const out = isOutside.value;
    return {
      transform: [
        { translateX: offsetX.value },
        { translateY: offsetY.value },
        { scale: out ? withTiming(0.88, { duration: 100 }) : withTiming(1, { duration: 100 }) },
      ],
      backgroundColor: out
        ? 'rgba(235, 87, 87, 0.28)'
        : isSelected
          ? 'rgba(232, 213, 181, 0.24)'
          : 'rgba(232, 213, 181, 0.14)',
      borderColor: out ? REMOVE_COLOR : isSelected ? '#FFFFFF' : 'transparent',
      opacity: out ? 0.7 : isPaused ? 0.55 : 1,
    };
  });

  const Icon = SOUND_ICONS[source.soundId];
  const iconColor = isOutsideState ? REMOVE_COLOR : isPaused ? PAUSED_COLOR : NODE_COLOR;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.node,
          {
            left: discRadius - NODE_RADIUS,
            top: discRadius - NODE_RADIUS,
          },
          animatedStyle,
        ]}
      >
        {isOutsideState ? (
          <TrashIcon size={24} color={REMOVE_COLOR} weight="bold" />
        ) : (
          <Icon size={24} color={iconColor} weight={isSelected ? 'bold' : 'regular'} />
        )}
        <Text style={[styles.label, { color: iconColor }]}>
          {isOutsideState ? '松手删除' : soundNameOf(source.soundId)}
        </Text>
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
    fontWeight: '500',
    textAlign: 'center',
    minWidth: 64,
  },
});
