import { useState } from "react";
import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";

export function InputURL({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const { colors } = useDesign();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      {...rest}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        {
          color: colors.ink,
          backgroundColor: colors.surface,
          borderColor: focused ? colors.accent : colors.control,
        },
        style,
      ]}
    />
  );
}
const styles = StyleSheet.create({
  input: {
    fontFamily: Type.regular,
    fontSize: 16,
    minHeight: 56,
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
  },
});
