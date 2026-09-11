import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BottomNav } from "@/components/bottom-nav";
import { BorderBeam } from "@/components/base/border-beam/border-beam-loader";
import { InputURL } from "@/components/input";
import { EnergyOrb } from "@/components/organisms/energy-orb/energy-orb-loader";
import { saveCartProduct } from "@/storage/cart";
import type { ScrapedProduct } from "@/types/product";
import { apiUrl } from "@/utils/api-url";
import { formatPrice } from "@/utils/format-price";

const CART_REDIRECT_DELAY = 15_000;

function isScrapedProduct(value: unknown): value is ScrapedProduct {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "store" in value &&
    typeof value.store === "string" &&
    "storeName" in value &&
    typeof value.storeName === "string"
  );
}

function getErrorMessage(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return null;
}

export default function Home() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ScrapedProduct | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function handleAddProduct() {
    if (!productUrl.trim()) {
      Alert.alert("URL obrigatória", "Insira o link de um produto.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(apiUrl("/scrape"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: productUrl.trim() }),
      });

      const responseText = await response.text();
      let result: unknown;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          responseText || "O servidor retornou uma resposta inválida.",
        );
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result) ?? "Não foi possível salvar o produto.",
        );
      }

      if (!isScrapedProduct(result)) {
        throw new Error("O servidor retornou um produto inválido.");
      }

      await saveCartProduct(result);
      setProduct(result);
      setProductUrl("");

      if (redirectTimer.current) clearTimeout(redirectTimer.current);
      redirectTimer.current = setTimeout(() => {
        setProduct(null);
        router.push("/cart");
      }, CART_REDIRECT_DELAY);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o produto.";

      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.select({ ios: "padding", android: "height" })}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Karrinho</Text>
      </View>
      <View style={styles.content}>
          <View style={styles.energyOrbContainer}>
            <EnergyOrb
              intensity={0.9}
              colors={["#cfd0f4ff", "#3a00e8ff", "#002ee8ff"]}
            />
          </View>

          <View style={styles.headlineLabelContainer}>
            <Text style={styles.headlineLabel}>Adicione produtos ao seu carrinho</Text>
          </View>

          {loading ? (
            <BorderBeam
              style={styles.beamContainer}
              borderRadius={36}
              borderWidth={1}
              colors={["#2563eb", "#67e8f9", "#2563eb"]}
              ambient={0.04}
              duration={2.8}
              intensity={0.9}
              glow={9}
            >
              <View style={[styles.formContainer]}>
                <View style={styles.inputRow}>
                  <InputURL
                    value={productUrl}
                    onChangeText={setProductUrl}
                    editable={!loading}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Cole o link do produto"
                    placeholderTextColor="#827d78"
                    returnKeyType="go"
                    onSubmitEditing={handleAddProduct}
                    style={styles.urlInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Adicionar produto"
                    disabled={loading}
                    onPress={() => void handleAddProduct()}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.addButtonPressed,
                      loading && styles.addButtonDisabled,
                    ]}
                  >
                    <Ionicons name="arrow-up" size={21} color="#211b18" />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.loadingLabel}>Adicionando...</Text>
            </BorderBeam>
          ) : (
            <View style={styles.beamContainer}>
              <View style={styles.formContainer}>
                {product && (
                  <View style={styles.confirmationCard}>
                    <View style={styles.confirmationHeader}>
                      <Text style={styles.savedLabel}>Salvo no carrinho</Text>
                    </View>

                    <View style={styles.previewRow}>
                      {product.imageUrl && (
                        <Image
                          source={{ uri: product.imageUrl }}
                          style={styles.previewImage}
                        />
                      )}
                      <View style={styles.previewCopy}>
                        <View style={styles.storeRow}>
                          {product.faviconUrl && (
                            <Image
                              source={{ uri: product.faviconUrl }}
                              style={styles.storeFavicon}
                            />
                          )}
                          <Text style={styles.storeName}>
                            {product.storeName}
                          </Text>
                        </View>
                        <Text style={styles.productTitle} numberOfLines={2}>
                          {product.title ?? "Produto sem nome"}
                        </Text>
                        <Text style={styles.productPrice}>
                          {formatPrice(product.price, product.currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                
                <View style={styles.inputRow}>
                  <InputURL
                    value={productUrl}
                    onChangeText={setProductUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Cole o link do produto"
                    placeholderTextColor="#827d78"
                    returnKeyType="go"
                    onSubmitEditing={handleAddProduct}
                    style={styles.urlInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Adicionar produto"
                    onPress={() => void handleAddProduct()}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.addButtonPressed,
                    ]}
                  >
                    <Ionicons name="arrow-up" size={21} color="#211b18" />
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      <BottomNav active="home" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111010",
    paddingBottom: 16,
    paddingTop: 36,
    paddingHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingTop: 40,
    paddingBottom: 12,
  },
  header: {
    minHeight: 64,
  },
  eyebrow: {
    color: "#6f7c87",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    color: "#f5f5f2",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  energyOrbContainer: {
    minHeight: 190,
    alignItems: "center",
    justifyContent: "flex-end",
    pointerEvents: "none",
  },
  beamContainer: {
    width: "100%",
    borderRadius: 12,
  },
  formContainer: {
    width: "100%",
    gap: 13,
    padding: 12,
    backgroundColor: "#1d1b1a",
    borderWidth: 1,
    borderColor: "#393532",
    borderRadius: 36,
  },
  headlineLabelContainer:{
    padding: 12,
  },
  headlineLabel: {
    color: "#f5f5f2",
    fontSize: 18,
    fontWeight: "400",
    letterSpacing: -0.8,
  },
  inputRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  urlInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 8,
    color: "#eeeae5",
    fontSize: 16,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#e8e3dc",
  },
  addButtonPressed: {
    opacity: 0.72,
  },
  addButtonDisabled: {
    opacity: 0.62,
  },
  loadingLabel: {
    marginTop: 9,
    paddingLeft: 8,
    paddingBottom: 2,
    color: "#b8aea7",
    fontSize: 12,
    fontWeight: "500",
  },
  confirmationCard: {
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#303030",
  },
  confirmationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedLabel: {
    color: "#65e6bf",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  redirectLabel: {
    color: "#73777b",
    fontSize: 11,
  },
  previewRow: {
    flexDirection: "row",
    gap: 12,
  },
  previewImage: {
    width: 76,
    height: 92,
    borderRadius: 10,
    backgroundColor: "#252525",
  },
  previewCopy: {
    flex: 1,
    justifyContent: "center",
    gap: 5,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  storeFavicon: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  storeName: {
    color: "#9ba1a6",
    fontSize: 12,
    fontWeight: "600",
  },
  productTitle: {
    color: "#f2f2ef",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  productPrice: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
});
