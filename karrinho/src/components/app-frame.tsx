import type { PropsWithChildren } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Grid, Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";
import { Pressable } from "@/components/atoms/pressable";

export function AppFrame({
  children,
}: PropsWithChildren<{ active: "home" | "cart" }>) {
  const { colors, isDark, toggleTheme } = useDesign();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.frame}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View
              aria-hidden
              style={[styles.mark, { backgroundColor: colors.accentSoft }]}
            >
              <Ionicons
                name="bag-handle-outline"
                size={21}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.wordmark, { color: colors.ink }]}>
              karrinho
            </Text>
          </View>
          <Pressable
            accessibilityLabel={isDark ? "Usar tema claro" : "Usar tema escuro"}
            onPress={toggleTheme}
            style={[
              styles.themeButton,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <View aria-hidden>
              <Ionicons
                name={isDark ? "sunny-outline" : "moon-outline"}
                size={20}
                color={colors.muted}
              />
            </View>
          </Pressable>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Grid.maxWidth,
    alignSelf: "center",
    paddingHorizontal: Grid.gutter,
  },
  header: {
    minHeight: 76,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { fontFamily: Type.bold, fontSize: 22, letterSpacing: -0.7 },
  themeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  content: { flex: 1 },
});
