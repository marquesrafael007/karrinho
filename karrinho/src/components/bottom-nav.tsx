import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AnimatedChip } from "@/components/molecules/animated-chip";

type BottomNavProps = {
  active: "home" | "cart";
};

export function BottomNav({ active }: BottomNavProps) {
  const router = useRouter();

  return (
    <View style={styles.footer}>
      <AnimatedChip
        value={active}
        onValueChange={(value) => {
          router.replace(value === "cart" ? "/cart" : "/");
        }}
        style={styles.container}
      >
        <AnimatedChip.Item value="home" activeColor="#2876d5">
          <AnimatedChip.Icon>
            <Text style={styles.icon}>🏠</Text>
          </AnimatedChip.Icon>
          <AnimatedChip.Label>Home</AnimatedChip.Label>
        </AnimatedChip.Item>
        <AnimatedChip.Item value="cart" activeColor="#2876d5">
          <AnimatedChip.Icon>
            <Text style={styles.icon}>🛒</Text>
          </AnimatedChip.Icon>
          <AnimatedChip.Label>Carrinho</AnimatedChip.Label>
        </AnimatedChip.Item>
      </AnimatedChip>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  container: {
    width: "auto",
    padding: 8,
    backgroundColor: "#0b2f51",
    borderRadius: 100,
  },
  icon: {
    fontSize: 18,
  },
});
