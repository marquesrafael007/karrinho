import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BottomNav } from "@/components/bottom-nav";
import { getCartProducts, removeCartProduct } from "@/storage/cart";
import type { SavedProduct } from "@/types/product";
import { formatPrice } from "@/utils/format-price";

type StoreSection = {
  title: string;
  faviconUrl: string | null;
  data: SavedProduct[];
};

export default function Cart() {
  const router = useRouter();
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      setProducts(await getCartProducts());
    } catch {
      Alert.alert("Erro", "Não foi possível carregar o carrinho.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts]),
  );

  const sections = useMemo<StoreSection[]>(() => {
    const stores = new Map<string, StoreSection>();

    products.forEach((product) => {
      const key = product.store;
      const section = stores.get(key);

      if (section) {
        section.data.push(product);
      } else {
        stores.set(key, {
          title: product.storeName,
          faviconUrl: product.faviconUrl,
          data: [product],
        });
      }
    });

    return Array.from(stores.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [products]);

  async function handleRemove(product: SavedProduct) {
    await removeCartProduct(product.id);
    setProducts((current) =>
      current.filter((item) => item.id !== product.id),
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#65e6bf" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          products.length === 0 && styles.emptyContent,
        ]}
        ListHeaderComponent={
          products.length > 0 ? (
            <View style={styles.header}>
              <Text style={styles.eyebrow}>PRODUTOS SALVOS</Text>
              <Text style={styles.title}>Carrinho</Text>
              <Text style={styles.summary}>
                {products.length} {products.length === 1 ? "item" : "itens"} em{" "}
                {sections.length} {sections.length === 1 ? "loja" : "lojas"}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptySymbol}>🛒</Text>
            <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
            <Text style={styles.emptyDescription}>
              Adicione links de produtos para reunir suas escolhas em um só lugar.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/")}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryActionLabel}>Adicionar produto</Text>
            </Pressable>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.storeHeader}>
            {section.faviconUrl && (
              <Image
                source={{ uri: section.faviconUrl }}
                style={styles.storeFavicon}
              />
            )}
            <Text style={styles.storeName}>{section.title}</Text>
            <View style={styles.storeCount}>
              <Text style={styles.storeCountText}>{section.data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.productImage}
              />
            ) : (
              <View style={[styles.productImage, styles.imageFallback]}>
                <Text style={styles.imageFallbackText}>sem imagem</Text>
              </View>
            )}

            <View style={styles.productCopy}>
              <Text style={styles.productTitle} numberOfLines={3}>
                {item.title ?? "Produto sem nome"}
              </Text>
              <Text style={styles.productPrice}>
                {formatPrice(item.price, item.currency)}
              </Text>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(item.url)}
                  style={({ pressed }) => [
                    styles.openAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.openActionLabel}>Abrir produto</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${item.title ?? "produto"}`}
                  onPress={() => void handleRemove(item)}
                  style={({ pressed }) => [
                    styles.removeAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.removeActionLabel}>Remover</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        ListFooterComponent={<BottomNav active="cart" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111010",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111010",
  },
  content: {
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  header: {
    marginBottom: 28,
  },
  eyebrow: {
    color: "#65e6bf",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 3,
    color: "#f5f5f2",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.2,
  },
  summary: {
    marginTop: 6,
    color: "#85898c",
    fontSize: 14,
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  storeFavicon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  storeName: {
    flex: 1,
    color: "#f0f0ec",
    fontSize: 16,
    fontWeight: "700",
  },
  storeCount: {
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#252525",
  },
  storeCountText: {
    color: "#aeb2b4",
    fontSize: 11,
    fontWeight: "700",
  },
  productCard: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 16,
    backgroundColor: "#181717",
  },
  productImage: {
    width: 96,
    height: 120,
    borderRadius: 11,
    backgroundColor: "#242424",
  },
  imageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageFallbackText: {
    color: "#6d7174",
    fontSize: 10,
  },
  productCopy: {
    flex: 1,
    minHeight: 120,
  },
  productTitle: {
    color: "#eeeeeb",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  productPrice: {
    marginTop: 6,
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: "auto",
    paddingTop: 12,
  },
  openAction: {
    minHeight: 32,
    justifyContent: "center",
  },
  openActionLabel: {
    color: "#65e6bf",
    fontSize: 12,
    fontWeight: "700",
  },
  removeAction: {
    minHeight: 32,
    justifyContent: "center",
  },
  removeActionLabel: {
    color: "#8e9295",
    fontSize: 12,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.55,
  },
  sectionGap: {
    height: 18,
  },
  emptyState: {
    flex: 1,
    maxWidth: 360,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptySymbol: {
    marginBottom: 18,
    fontSize: 38,
  },
  emptyTitle: {
    color: "#f4f4f0",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: 10,
    color: "#888d90",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryAction: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#2876d5",
  },
  primaryActionLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
