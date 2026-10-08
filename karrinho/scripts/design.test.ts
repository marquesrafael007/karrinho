import assert from "node:assert/strict";
import test from "node:test";
import { Palette } from "../src/constants/theme";

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [mode, colors] of Object.entries(Palette)) {
  test(`${mode} theme: text meets WCAG AA and input boundaries meet 3:1`, () => {
    for (const foreground of [
      colors.ink,
      colors.muted,
      colors.accent,
      colors.danger,
    ]) {
      for (const background of [
        colors.background,
        colors.surface,
        colors.soft,
      ]) {
        assert(
          contrast(foreground, background) >= 4.5,
          `${mode}: ${foreground} on ${background}`,
        );
      }
    }
    assert(contrast(colors.onAccent, colors.accentFill) >= 4.5);
    assert(contrast(colors.accent, colors.accentSoft) >= 4.5);
    assert(contrast(colors.warning, colors.warningSoft) >= 4.5);
    assert(contrast(colors.control, colors.surface) >= 3);
  });
}
