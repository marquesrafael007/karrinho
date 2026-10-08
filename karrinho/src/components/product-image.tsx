import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";

export function ProductImage({
  uri,
  style,
}: {
  uri: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useDesign();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View
      aria-hidden
      style={[styles.box, { backgroundColor: colors.soft }, style]}
    >
      {uri && !failed ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          style={styles.image}
        />
      ) : (
        <>
          <Ionicons name="image-outline" size={27} color={colors.muted} />
          <Text style={[styles.label, { color: colors.muted }]}>Sem foto</Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    width: 108,
    height: 124,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  image: { width: "90%", height: "90%" },
  label: { fontFamily: Type.regular, fontSize: 12, lineHeight: 16 },
});
