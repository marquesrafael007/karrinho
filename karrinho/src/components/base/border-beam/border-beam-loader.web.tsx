import { useEffect, useState } from "react";
import { View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

import type { IBorderBeam } from "./types";

export function BorderBeam(props: IBorderBeam) {
  const [mounted, setMounted] = useState(false);
  const fallback = <View style={props.style}>{props.children}</View>;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return fallback;

  return (
    <WithSkiaWeb<IBorderBeam>
      getComponent={() => import("./index")}
      componentProps={props}
      fallback={fallback}
    />
  );
}

export default BorderBeam;
export type { IBorderBeam } from "./types";
