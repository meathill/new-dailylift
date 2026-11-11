import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurMask, Canvas, Circle, RadialGradient } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { PlacedSource } from '../domain/types';
import { SourceNode } from './SourceNode';

interface DiscProps {
  sources: PlacedSource[];
  pausedIds: string[];
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
  onMoveEnd: (instanceId: string, x: number, z: number) => void;
}

/** 距离圈：内圈近、外圈远 */
const RING_RATIOS = [1 / 3, 2 / 3];

/**
 * 声音空间俯视图：中心为听者，屏幕上方为前方。
 * 盘面由 Skia 绘制，声源节点为可拖动的 RN 组件。
 */
export function Disc({ sources, pausedIds, selectedId, onSelect, onMoveEnd }: DiscProps) {
  const [size, setSize] = useState(0);
  const radius = size / 2;

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const listenerRadius = useDerivedValue(() => 9 + pulse.value * 3);
  const listenerOpacity = useDerivedValue(() => 0.9 - pulse.value * 0.35);
  const haloRadius = useDerivedValue(() => 16 + pulse.value * 8);
  const haloOpacity = useDerivedValue(() => 0.35 - pulse.value * 0.2);

  return (
    <View style={styles.flex} onLayout={handleLayout}>
      <View style={[styles.disc, { width: size, height: size }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Circle cx={radius} cy={radius} r={radius}>
            <RadialGradient
              c={{ x: radius, y: radius }}
              r={radius}
              colors={['#1E2A3F', '#10161F']}
              positions={[0, 1]}
            />
          </Circle>
          {radius > 0 &&
            RING_RATIOS.map((ratio) => (
              <Circle
                key={ratio}
                cx={radius}
                cy={radius}
                r={radius * ratio}
                style="stroke"
                strokeWidth={1}
                color="#2A3850"
              />
            ))}
          {radius > 0 && (
            <Circle cx={radius} cy={radius} r={haloRadius} color="#F5E8D0" opacity={haloOpacity}>
              <BlurMask blur={12} style="solid" />
            </Circle>
          )}
          {radius > 0 && (
            <Circle
              cx={radius}
              cy={radius}
              r={listenerRadius}
              color="#F5E8D0"
              opacity={listenerOpacity}
            />
          )}
        </Canvas>
        {radius > 0 &&
          sources.map((source) => (
            <SourceNode
              key={source.instanceId}
              source={source}
              discRadius={radius}
              isSelected={selectedId === source.instanceId}
              isPaused={pausedIds.includes(source.instanceId)}
              onSelect={onSelect}
              onMoveEnd={onMoveEnd}
            />
          ))}
      </View>
    </View>
  );

  function handleLayout(event: { nativeEvent: { layout: { width: number; height: number } } }) {
    const { width, height } = event.nativeEvent.layout;
    setSize(Math.floor(Math.min(width, height)));
  }
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {},
});
