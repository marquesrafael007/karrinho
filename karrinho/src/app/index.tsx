import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/button";
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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

          <View style={styles.formContainer}>
            {product && (
              <View style={styles.confirmationCard}>
                <View style={styles.confirmationHeader}>
                  <Text style={styles.savedLabel}>SALVO NO CARRINHO</Text>
                  <Text style={styles.redirectLabel}>abrindo em 15s</Text>
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
                      <Text style={styles.storeName}>{product.storeName}</Text>
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

            <View style={styles.form}>
              <Text style={styles.formLabel}>Insira o link do produto</Text>
              <Text style={styles.formHint}>
                Cole uma URL para identificar loja, imagem e preço.
              </Text>
            </View>

            <InputURL
              value={productUrl}
              onChangeText={setProductUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://loja.com/produto"
              onSubmitEditing={handleAddProduct}
            />

            <Button
              label={loading ? "Buscando produto..." : "Adicionar"}
              onPress={handleAddProduct}
              disabled={loading}
            />
          </View>
        </View>

        <BottomNav active="home" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111010",
  },
  container: {
    flexGrow: 1,
    paddingTop: 40,
    paddingHorizontal: 16,
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
  formContainer: {
    width: "100%",
    gap: 12,
    padding: 16,
    backgroundColor: "#181717",
    borderWidth: 1,
    borderColor: "#282727",
    borderRadius: 16,
  },
  form: {
    gap: 4,
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  formLabel: {
    color: "#f4f4f0",
    fontSize: 16,
    fontWeight: "600",
  },
  formHint: {
    marginTop: 3,
    color: "#8d9296",
    fontSize: 13,
    lineHeight: 18,
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
