import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDesign } from "@/design/theme-provider";

export function StoreIcon({ uri }: { uri: string | null }) {
  const { colors } = useDesign();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View
      aria-hidden
      style={{
        width: 16,
        height: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: 16, height: 16 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="storefront-outline" size={15} color={colors.muted} />
      )}
    </View>
  );
}
