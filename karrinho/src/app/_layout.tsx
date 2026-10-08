import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import { Palette } from "@/constants/theme";
import { CartProvider } from "@/storage/cart-context";
import { DesignProvider, useDesign } from "@/design/theme-provider";
import "@/global.css";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PressableProvider } from "@/components/atoms/pressable";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BottomNav } from "@/components/bottom-nav";
import { Ionicons } from "@expo/vector-icons";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppNavigation() {
  const { colors, isDark } = useDesign();
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationBar style={isDark ? "light" : "dark"} />
      <PressableProvider
        disableAnimations={reducedMotion}
        defaultPressAnimation={{ scale: 0.98, duration: 120, useSpring: false }}
      >
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "none",
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </View>
        {(pathname === "/" || pathname === "/cart") && (
          <BottomNav active={pathname === "/cart" ? "cart" : "home"} />
        )}
      </PressableProvider>
    </GestureHandlerRootView>
  );
}

export default function Layout() {
  const system = useColorScheme();
  const initialColors = system === "dark" ? Palette.dark : Palette.light;
  const [fontsLoaded, fontError] = useFonts({
    // Register icons before rendering both the static HTML and the client tree.
    ...Ionicons.font,
    Archivo_400Regular: require("@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf"),
    Archivo_500Medium: require("@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf"),
    Archivo_700Bold: require("@expo-google-fonts/archivo/700Bold/Archivo_700Bold.ttf"),
  });
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: initialColors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          color={initialColors.accent}
          accessibilityLabel="Abrindo Karrinho"
        />
      </View>
    );
  return (
    <DesignProvider>
      <CartProvider>
        <AppNavigation />
      </CartProvider>
    </DesignProvider>
  );
}
