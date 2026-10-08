import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useAnimatedProps,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { SegmentedControlPresets } from "./presets";
import type { ISegmentedControl } from "./types";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { BlurView, type BlurViewProps } from "expo-blur";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import { scheduleOnRN } from "react-native-worklets";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const DEFAULT_WIDTH = Dimensions.get("screen").width - 32;

const SegmentedControl: React.FC<ISegmentedControl> &
  React.FunctionComponent<ISegmentedControl> = ({
  children,
  onChange,
  currentIndex,
  preset = "ios",
  segmentedControlBackgroundColor,
  activeSegmentBackgroundColor,
  activeSegmentBorderColor = "transparent",
  paddingVertical = 12,
  dividerColor,
  borderRadius = 8,
  disableScaleEffect = false,
  width = DEFAULT_WIDTH,
  labels,
  accessibilityLabel,
  disableAnimations = false,
  disableBlur = false,
  enablePanGesture = true,
  haptics = false,
}: ISegmentedControl):
  (React.ReactNode & React.JSX.Element & React.ReactElement) | null => {
  const theme = SegmentedControlPresets[preset];
  const reducedMotion = useReducedMotion();
  const animationsDisabled = reducedMotion || disableAnimations;
  const tabRefs = useRef<
    Array<React.ElementRef<typeof TouchableOpacity> | null>
  >([]);
  const haptic = useCallback(
    (style: ImpactFeedbackStyle) => {
      if (haptics && Platform.OS !== "web")
        void impactAsync(style).catch(() => undefined);
    },
    [haptics],
  );
  const finalSegmentedControlBackgroundColor =
    segmentedControlBackgroundColor ?? theme.segmentedControlBackgroundColor;
  const finalActiveSegmentBackgroundColor =
    activeSegmentBackgroundColor ?? theme.activeSegmentBackgroundColor;
  const finalDividerColor = dividerColor ?? theme.dividerColor;

  const childrenArray = React.Children.toArray(children);
  const tabsCount = childrenArray.length;

  const translateValue = (width - 4) / tabsCount;

  const tabTranslate = useSharedValue<number>(currentIndex * translateValue);
  const blurAmount = useSharedValue<number>(0);
  const isDragging = useSharedValue<boolean>(false);
  const dragStartIndex = useSharedValue<number>(currentIndex);

  const activeScale = useSharedValue(1);

  const triggerBlur = useCallback(() => {
    if (animationsDisabled || disableBlur) {
      blurAmount.value = 0;
      return;
    }
    blurAmount.value = withSequence<number>(
      withTiming<number>(10, {
        duration: 400,
        easing: Easing.inOut(Easing.ease),
      }),
      withTiming<number>(0, {
        duration: 400,
        easing: Easing.inOut(Easing.ease),
      }),
    );
  }, [animationsDisabled, disableBlur]);

  const triggerTapScale = useCallback(() => {
    if (disableScaleEffect || animationsDisabled) return;
    activeScale.value = withSequence<number>(
      withTiming<number>(1.3, { duration: 350 }),
      withSpring<number>(1, { stiffness: 10, damping: 5, mass: 0.8 }),
    );
  }, [disableScaleEffect, animationsDisabled]);
  const memoizedTabPressCallback = useCallback(
    (index: number) => {
      onChange(index);
      if (!isDragging.value) {
        triggerBlur();
        triggerTapScale();
        haptic(ImpactFeedbackStyle.Light);
      }
    },
    [onChange, triggerBlur, triggerTapScale, haptic],
  );

  useEffect(() => {
    activeScale.value = 1;
    tabTranslate.value = animationsDisabled
      ? currentIndex * translateValue
      : withSpring<number>(currentIndex * translateValue, {
          stiffness: 80,
          damping: 90,
          mass: 1,
        });
  }, [currentIndex, translateValue, animationsDisabled]);

  const animatedTabStyle = useAnimatedStyle<
    Partial<Pick<ViewStyle, "transform">>
  >(() => {
    return {
      transform: [
        { translateX: tabTranslate.value },
        { scale: activeScale.value },
      ],
    };
  });

  const animatedBlurViewProps = useAnimatedProps<
    Required<Pick<BlurViewProps, "intensity">>
  >(() => {
    return {
      intensity: blurAmount.value,
    };
  });

  const panGesture = Gesture.Pan()
    .enabled(enablePanGesture && !animationsDisabled)
    .minDistance(10)

    .onStart(() => {
      isDragging.value = true;
      dragStartIndex.value = currentIndex;
      if (disableScaleEffect) return;
      activeScale.value = withSpring<number>(1.2, {
        stiffness: 300,
        damping: 15,
      });
      scheduleOnRN(haptic, ImpactFeedbackStyle.Medium);
    })
    .onUpdate((event) => {
      const tabWidth = (width - 4) / tabsCount;
      const rawIndex = Math.floor(event.x / tabWidth);
      const newIndex = Math.max(0, Math.min(tabsCount - 1, rawIndex));

      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < tabsCount) {
        scheduleOnRN(onChange, newIndex);
        scheduleOnRN(haptic, ImpactFeedbackStyle.Rigid);
      }
    })
    .onEnd(() => {
      isDragging.value = false;
      activeScale.value = withSpring<number>(1, {
        stiffness: 200,
        damping: 20,
      });
      if (currentIndex !== dragStartIndex.value) {
        scheduleOnRN(triggerBlur);
        scheduleOnRN(haptic, ImpactFeedbackStyle.Medium);
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
      activeScale.value = withSpring(1, { stiffness: 200, damping: 20 });
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.segmentedControlWrapper,
          {
            width,
            backgroundColor: finalSegmentedControlBackgroundColor,
            paddingVertical: paddingVertical,
            borderRadius,
          },
        ]}
      >
        <Animated.View
          style={[
            {
              ...StyleSheet.absoluteFill,
              position: "absolute",
              width: (width - 4) / tabsCount,
              top: 0,
              marginVertical: 2,
              marginHorizontal: 2,
              backgroundColor: finalActiveSegmentBackgroundColor,
              borderWidth: 1,
              borderColor: activeSegmentBorderColor,
              borderRadius,
              pointerEvents: "none",
            },
            animatedTabStyle,
          ]}
        />

        {childrenArray.map<React.ReactNode>((child, index) => {
          const showDivider = index < tabsCount - 1;

          return (
            <React.Fragment key={index}>
              <TouchableOpacity
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                accessibilityRole="tab"
                accessibilityLabel={labels?.[index]}
                accessibilityState={{ selected: currentIndex === index }}
                aria-selected={currentIndex === index}
                {...(Platform.OS === "web"
                  ? {
                      onKeyDownCapture: (event: {
                        key: string;
                        preventDefault(): void;
                      }) => {
                        const next =
                          event.key === "ArrowRight"
                            ? (index + 1) % tabsCount
                            : event.key === "ArrowLeft"
                              ? (index - 1 + tabsCount) % tabsCount
                              : event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? tabsCount - 1
                                  : null;
                        if (next !== null) {
                          event.preventDefault();
                          memoizedTabPressCallback(next);
                          tabRefs.current[next]?.focus();
                        }
                      },
                    }
                  : {})}
                style={[styles.textWrapper]}
                onPress={() => memoizedTabPressCallback(index)}
                activeOpacity={0.7}
              >
                {child}
              </TouchableOpacity>

              {showDivider && (
                <AnimatedDivider
                  currentIndex={currentIndex}
                  dividerIndex={index}
                  color={finalDividerColor}
                  disableAnimations={animationsDisabled}
                />
              )}
            </React.Fragment>
          );
        })}

        {!disableBlur && !animationsDisabled && (
          <AnimatedBlurView
            style={[
              {
                overflow: "hidden",
                pointerEvents: "none",
                borderRadius,
                ...StyleSheet.absoluteFill,
              },
            ]}
            animatedProps={animatedBlurViewProps}
            tint="default"
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const AnimatedDivider: React.FC<{
  currentIndex: number;
  dividerIndex: number;
  color: string;
  disableAnimations: boolean;
}> = ({ currentIndex, dividerIndex, color, disableAnimations }) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    const shouldFadeOut =
      dividerIndex === currentIndex || dividerIndex === currentIndex - 1;

    opacity.value = disableAnimations
      ? shouldFadeOut
        ? 0
        : 1
      : withTiming(shouldFadeOut ? 0 : 1, {
          duration: 200,
        });
  }, [currentIndex, dividerIndex, disableAnimations]);

  const animatedDividerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[styles.divider, { backgroundColor: color }, animatedDividerStyle]}
    />
  );
};

const styles = StyleSheet.create({
  segmentedControlWrapper: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 0,
  },
  textWrapper: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  divider: {
    width: 1,
    height: "60%",
    alignSelf: "center",
  },
});

export default memo(SegmentedControl);
