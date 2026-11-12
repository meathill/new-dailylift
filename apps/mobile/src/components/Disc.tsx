import { type ComponentRef, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BlurMask, Canvas, Circle, RadialGradient } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { DiscBounds } from '../domain/position';
import type { PlacedSource } from '../domain/types';
import { SourceNode } from './SourceNode';

interface DiscProps {
  sources: PlacedSource[];
  pausedIds: string[];
  selectedId: string | null;
  isDropTargetHovered?: boolean;
  onSelect: (instanceId: string) => void;
  onMove?: (instanceId: string, x: number, z: number) => void;
  onMoveEnd: (instanceId: string, x: number, z: number) => void;
  onRemove: (instanceId: string) => void;
  onLayoutBounds?: (bounds: DiscBounds) => void;
  onToggleMasterPlay?: () => void;
}

/** 距离圈：内圈近、外圈远 */
const RING_RATIOS = [1 / 3, 2 / 3];

/**
 * 声音空间俯视图：中心为听者，屏幕上方为前方。
 * 盘面由 Skia 绘制，尺寸基于屏幕宽度恒定锁定，绝不随操作条显隐发生跳变。
 */
export function Disc({
  sources,
  pausedIds,
  selectedId,
  isDropTargetHovered = false,
  onSelect,
  onMove,
  onMoveEnd,
  onRemove,
  onLayoutBounds,
  onToggleMasterPlay,
}: DiscProps) {
  const { width: windowWidth } = useWindowDimensions();
  // 保持尺寸绝对恒定：由屏幕宽度计算（两侧留出充盈边距），绝不受下方 SourcePanel 显隐的高度压缩影响
  const size = Math.floor(Math.min(windowWidth - 64, 320));
  const radius = size / 2;
  const discRef = useRef<ComponentRef<typeof View>>(null);

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

  function measureBounds() {
    discRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && onLayoutBounds) {
        onLayoutBounds({
          centerX: x + width / 2,
          centerY: y + height / 2,
          radius: width / 2,
        });
      }
    });
  }

  function handleLayout() {
    requestAnimationFrame(measureBounds);
  }

  return (
    <View style={styles.flex} onLayout={handleLayout}>
      <View
        ref={discRef}
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          {/* 主背景渐变圆盘 */}
          <Circle cx={radius} cy={radius} r={radius}>
            <RadialGradient
              c={{ x: radius, y: radius }}
              r={radius}
              colors={['#1E2A3F', '#10161F']}
              positions={[0, 1]}
            />
          </Circle>

          {/* 边界常驻轮廓细线 */}
          <Circle
            cx={radius}
            cy={radius}
            r={radius - 1}
            style="stroke"
            strokeWidth={1}
            color="#2A3850"
          />

          {/* 拖入悬停时的吸附高亮光圈（严格同心，不溢出屏幕） */}
          {isDropTargetHovered && (
            <>
              <Circle
                cx={radius}
                cy={radius}
                r={radius - 2}
                style="stroke"
                strokeWidth={4}
                color="#E8D5B5"
                opacity={0.3}
              >
                <BlurMask blur={8} style="solid" />
              </Circle>
              <Circle
                cx={radius}
                cy={radius}
                r={radius - 1}
                style="stroke"
                strokeWidth={1.5}
                color="#F5E8D0"
                opacity={0.9}
              />
            </>
          )}

          {/* 距离参考同心圆环 */}
          {RING_RATIOS.map((ratio) => (
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

          {/* 中心听者光晕与中心点 */}
          <Circle cx={radius} cy={radius} r={haloRadius} color="#F5E8D0" opacity={haloOpacity}>
            <BlurMask blur={12} style="solid" />
          </Circle>
          <Circle
            cx={radius}
            cy={radius}
            r={listenerRadius}
            color="#F5E8D0"
            opacity={listenerOpacity}
          />
        </Canvas>

        {/* 中心听者可点击热区（点击同样可切换全局播控） */}
        {onToggleMasterPlay && (
          <Pressable
            style={[styles.centerTouch, { left: radius - 24, top: radius - 24, borderRadius: 24 }]}
            onPress={onToggleMasterPlay}
            accessibilityLabel="全局播放或暂停"
          />
        )}

        {/* 盘上各音源节点 */}
        {sources.map((source) => (
          <SourceNode
            key={source.instanceId}
            source={source}
            discRadius={radius}
            isSelected={selectedId === source.instanceId}
            isPaused={pausedIds.includes(source.instanceId)}
            onSelect={onSelect}
            onMove={onMove}
            onMoveEnd={onMoveEnd}
            onRemove={onRemove}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  disc: {
    position: 'relative',
    overflow: 'visible',
  },
  centerTouch: {
    position: 'absolute',
    width: 48,
    height: 48,
    zIndex: 10,
  },
});
