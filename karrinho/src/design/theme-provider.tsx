import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import { Palette, type DesignColors } from "@/constants/theme";

const DesignContext = createContext<{
  colors: DesignColors;
  isDark: boolean;
  toggleTheme(): void;
}>({ colors: Palette.light, isDark: false, toggleTheme() {} });

export function DesignProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [override, setOverride] = useState<"light" | "dark" | null>(null);
  const mode = override ?? (system === "dark" ? "dark" : "light");
  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
    } else {
      void SystemUI.setBackgroundColorAsync(Palette[mode].background).catch(
        (error) =>
          console.warn("Não foi possível atualizar o fundo nativo", error),
      );
    }
  }, [mode]);
  return (
    <DesignContext.Provider
      value={{
        colors: Palette[mode],
        isDark: mode === "dark",
        toggleTheme: () => setOverride(mode === "dark" ? "light" : "dark"),
      }}
    >
      {children}
    </DesignContext.Provider>
  );
}
export function useDesign() {
  return useContext(DesignContext);
}
