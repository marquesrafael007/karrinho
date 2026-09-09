import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

import type { IEnergyOrb } from "./types";

export function EnergyOrb(props: IEnergyOrb) {
  const { width = 200, height = 200 } = props;
  const [mounted, setMounted] = useState(false);
  const fallback = (
    <View style={[styles.fallback, { width, height }]}>
      <ActivityIndicator color="#208AEF" />
    </View>
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return fallback;

  return (
    <WithSkiaWeb<IEnergyOrb>
      getComponent={() => import("./index")}
      componentProps={props}
      fallback={fallback}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default EnergyOrb;
