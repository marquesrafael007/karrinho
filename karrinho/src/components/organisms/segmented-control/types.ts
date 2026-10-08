import { SegmentedControlPresets } from "./presets";

type SegmentedControlPreset = keyof typeof SegmentedControlPresets;

interface ISegmentedControl {
  children: React.ReactNode;
  onChange: (index: number) => void;
  currentIndex: number;
  readonly preset?: SegmentedControlPreset;
  readonly segmentedControlBackgroundColor?: string;
  readonly activeSegmentBackgroundColor?: string;
  readonly activeSegmentBorderColor?: string;
  readonly paddingVertical?: number;
  readonly dividerColor?: string;
  readonly borderRadius?: number;
  readonly disableScaleEffect?: boolean;
  /** Total width of the control. Defaults to the screen width minus 32. */
  readonly width?: number;
  readonly labels?: readonly string[];
  readonly accessibilityLabel?: string;
  readonly disableAnimations?: boolean;
  readonly disableBlur?: boolean;
  readonly enablePanGesture?: boolean;
  readonly haptics?: boolean;
}

export { ISegmentedControl, SegmentedControlPreset };
