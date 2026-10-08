import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "@/components/atoms/pressable";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";

type ButtonProps = Omit<ComponentProps<typeof Pressable>, "children"> & {
  label: string;
  variant?: "primary" | "secondary";
  icon?: ComponentProps<typeof Ionicons>["name"];
};
export function Button({
  label,
  variant = "primary",
  icon,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useDesign();
  const primary = variant === "primary";
  const foreground = primary ? colors.onAccent : colors.ink;
  return (
    <Pressable
      accessibilityLabel={label}
      {...props}
      style={[
        styles.button,
        { backgroundColor: primary ? colors.accentFill : colors.soft },
        style,
      ]}
    >
      {icon && (
        <View aria-hidden>
          <Ionicons name={icon} size={20} color={foreground} />
        </View>
      )}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontFamily: Type.medium,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    flexShrink: 1,
  },
});
