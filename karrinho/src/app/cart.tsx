import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Linking,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AppFrame } from "@/components/app-frame";
import { CartOverview } from "@/components/cart-overview";
import { ProductCard } from "@/components/product-card";
import { EditProduct } from "@/components/edit-product";
import { Button } from "@/components/button";
import { Pressable } from "@/components/atoms/pressable";
import SegmentedControl from "@/components/organisms/segmented-control";
import { Grid, Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";
import { cartRepository } from "@/storage/cart";
import { useCart } from "@/storage/cart-context";
import type { SavedProduct } from "@/types/product";

type StoreSection = { title: string; domain: string; data: SavedProduct[] };
export default function Cart() {
  const router = useRouter();
  const { colors } = useDesign();
  const { width } = useWindowDimensions();
  const { products, loading, error: storageError } = useCart();
  const [filter, setFilter] = useState<"all" | "review">("all");
  const [editing, setEditing] = useState<SavedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingCount = products.filter(
    (item) => item.status !== "ready",
  ).length;
  const sections = useMemo(() => {
    const stores = new Map<string, StoreSection>();
    for (const product of products) {
      if (filter === "review" && product.status === "ready") continue;
      const section = stores.get(product.store);
      if (section) {
        section.data.push(product);
        if (
          section.title === product.store &&
          product.storeName !== product.store
        )
          section.title = product.storeName;
      } else
        stores.set(product.store, {
          title: product.storeName,
          domain: product.store,
          data: [product],
        });
    }
    return [...stores.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [products, filter]);
  async function action(operation: () => Promise<unknown>) {
    setError(null);
    try {
      await operation();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a ação.",
      );
    }
  }
  return (
    <AppFrame active="cart">
      {(error || storageError) && (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: colors.danger }]}
        >
          {error || storageError}
        </Text>
      )}
      <SectionList
        style={styles.fill}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.headingCopy}>
                <Text
                  accessibilityRole="header"
                  style={[styles.title, { color: colors.ink }]}
                >
                  Seu carrinho
                </Text>
                <Text style={[styles.description, { color: colors.muted }]}>
                  Guardados para você decidir depois.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Adicionar produto"
                onPress={() => router.replace("/")}
                style={[styles.add, { backgroundColor: colors.accentFill }]}
              >
                <View aria-hidden>
                  <Ionicons name="add" size={24} color={colors.onAccent} />
                </View>
              </Pressable>
            </View>
            {products.length > 0 && (
              <View style={styles.summary}>
                <CartOverview compact />
              </View>
            )}
            {products.length > 0 && (
              <View style={styles.filters}>
                <SegmentedControl
                  currentIndex={filter === "all" ? 0 : 1}
                  onChange={(index) =>
                    setFilter(index === 0 ? "all" : "review")
                  }
                  labels={["Todos", "A conferir"]}
                  accessibilityLabel="Filtrar produtos"
                  width={Math.min(width, Grid.maxWidth) - Grid.gutter * 2}
                  segmentedControlBackgroundColor={colors.soft}
                  activeSegmentBackgroundColor={colors.surface}
                  activeSegmentBorderColor={colors.control}
                  dividerColor="transparent"
                  paddingVertical={4}
                  borderRadius={14}
                  disableScaleEffect
                  disableBlur
                  enablePanGesture={false}
                >
                  {[
                    {
                      label: "Todos",
                      count: products.length,
                      selected: filter === "all",
                    },
                    {
                      label: "A conferir",
                      count: pendingCount,
                      selected: filter === "review",
                    },
                  ].map((tab) => (
                    <View key={tab.label} style={styles.filterLabelRow}>
                      <Text
                        style={[
                          styles.filterLabel,
                          { color: tab.selected ? colors.ink : colors.muted },
                        ]}
                      >
                        {tab.label}
                      </Text>
                      <Text
                        style={[
                          styles.filterCount,
                          {
                            color: tab.selected ? colors.accent : colors.muted,
                          },
                        ]}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  ))}
                </SegmentedControl>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                color={colors.accent}
                accessibilityLabel="Carregando carrinho"
              />
            </View>
          ) : (
            <View
              style={[
                styles.empty,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <View
                aria-hidden
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <Ionicons
                  name={
                    filter === "review"
                      ? "checkmark-done-outline"
                      : "bag-handle-outline"
                  }
                  size={30}
                  color={colors.accent}
                />
              </View>
              <Text
                accessibilityRole="header"
                style={[styles.emptyTitle, { color: colors.ink }]}
              >
                {filter === "review"
                  ? "Tudo conferido."
                  : "Um lugar para seus próximos achados"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {filter === "review"
                  ? "Seus produtos já têm os dados confirmados."
                  : "Adicione o link de um produto. Seus itens ficam organizados aqui, por loja."}
              </Text>
              <Button
                label={
                  filter === "review"
                    ? "Ver todos os produtos"
                    : "Adicionar primeiro produto"
                }
                icon={filter === "review" ? undefined : "add"}
                onPress={() =>
                  filter === "review" ? setFilter("all") : router.replace("/")
                }
              />
            </View>
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.storeHeader}>
            <Text
              accessibilityRole="header"
              style={[styles.storeName, { color: colors.ink }]}
            >
              {section.title}
            </Text>
            <Text style={[styles.storeCount, { color: colors.muted }]}>
              {section.data.length}{" "}
              {section.data.length === 1 ? "item" : "itens"}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onEdit={() => setEditing(item)}
            onOpen={() => void action(() => Linking.openURL(item.url))}
            onRemove={() => void action(() => cartRepository.remove(item.id))}
            onRetry={() => void action(() => cartRepository.retry(item.id))}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.itemGap} />}
        SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
      />
      {editing && (
        <EditProduct
          key={editing.id}
          product={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </AppFrame>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 24, flexGrow: 1 },
  error: {
    fontFamily: Type.regular,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 24,
  },
  headingCopy: { flex: 1, gap: 8 },
  title: {
    fontFamily: Type.bold,
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  description: { fontFamily: Type.regular, fontSize: 16, lineHeight: 24 },
  add: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { marginBottom: 24 },
  filters: { marginBottom: 4 },
  filterLabelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: { fontFamily: Type.medium, fontSize: 15, lineHeight: 22 },
  filterCount: { fontFamily: Type.medium, fontSize: 13, lineHeight: 20 },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 22,
    paddingBottom: 14,
  },
  storeName: { fontFamily: Type.medium, fontSize: 18, lineHeight: 25, flex: 1 },
  storeCount: { fontFamily: Type.regular, fontSize: 14, lineHeight: 20 },
  itemGap: { height: 12 },
  sectionGap: { height: 4 },
  empty: { padding: 24, borderRadius: 22, borderWidth: 1, gap: 16 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: Type.medium,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontFamily: Type.regular,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 520,
  },
});
