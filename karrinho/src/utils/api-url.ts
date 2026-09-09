import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PORT = 3001;

function metroHostname(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  try {
    return new URL(`http://${hostUri}`).hostname;
  } catch {
    return hostUri.split(":")[0] || null;
  }
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

  if (configuredUrl) return `${configuredUrl}${normalizedPath}`;
  if (Platform.OS === "web") return normalizedPath;

  const developmentHost = metroHostname();
  if (developmentHost) {
    return `http://${developmentHost}:${API_PORT}${normalizedPath}`;
  }

  const emulatorHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  return `http://${emulatorHost}:${API_PORT}${normalizedPath}`;
}
