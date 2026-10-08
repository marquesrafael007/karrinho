import { StyleSheet, Text, View } from "react-native";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";

export function SectionLabel({
  number,
  label,
  trailing,
}: {
  number: string;
  label: string;
  trailing?: string;
}) {
  const { colors } = useDesign();
  return (
    <View style={styles.row}>
      <Text style={[styles.number, { color: colors.accent }]}>{number}</Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      {trailing && (
        <Text style={[styles.trailing, { color: colors.muted }]}>
          {trailing}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  number: { fontFamily: Type.mono, fontSize: 11 },
  label: { fontFamily: Type.mono, fontSize: 11, letterSpacing: 1.1, flex: 1 },
  trailing: { fontFamily: Type.mono, fontSize: 11 },
});
