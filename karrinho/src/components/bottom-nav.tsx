import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedChip } from "@/components/molecules/animated-chip";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";

export function BottomNav({ active }: { active: "home" | "cart" }) {
  const router = useRouter();
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: insets.left + 20,
        paddingRight: insets.right + 20,
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <AnimatedChip.Group
        value={active}
        onValueChange={(value) =>
          router.replace(value === "cart" ? "/cart" : "/")
        }
        accessibilityLabel="Navegação principal"
        haptics={false}
        springConfig={{ damping: 22, stiffness: 220, overshootClamping: true }}
      >
        {(
          [
            {
              key: "home",
              label: "Início",
              icon: "home-outline",
              selectedIcon: "home",
            },
            {
              key: "cart",
              label: "Carrinho",
              icon: "bag-handle-outline",
              selectedIcon: "bag-handle",
            },
          ] as const
        ).map((item) => (
          <AnimatedChip.Item
            key={item.key}
            value={item.key}
            accessibilityLabel={item.label}
            activeColor={colors.accentFill}
            inactiveColor={colors.soft}
          >
            <AnimatedChip.Icon>
              {({ selected }) => (
                <Ionicons
                  name={selected ? item.selectedIcon : item.icon}
                  size={22}
                  color={selected ? colors.onAccent : colors.muted}
                />
              )}
            </AnimatedChip.Icon>
            <AnimatedChip.Label
              color={colors.onAccent}
              style={{
                fontFamily: Type.medium,
                fontSize: 16,
                fontWeight: "500",
              }}
            >
              {item.label}
            </AnimatedChip.Label>
          </AnimatedChip.Item>
        ))}
      </AnimatedChip.Group>
    </View>
  );
}
