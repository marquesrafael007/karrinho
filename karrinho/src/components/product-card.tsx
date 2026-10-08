import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Pressable } from "@/components/atoms/pressable";
import { ProductImage } from "@/components/product-image";
import { StoreIcon } from "@/components/store-icon";
import { Button } from "@/components/button";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";
import type { SavedProduct } from "@/types/product";
import { formatPrice } from "@/utils/format-price";
import { productStatus } from "@/utils/product-status";

type Props = {
  product: SavedProduct;
  highlighted?: boolean;
  layout?: "list" | "grid";
  onPress?(): void;
  onOpen?(): void;
  onEdit?(): void;
  onRemove?(): void;
  onRetry?(): void;
};
export function ProductCard({
  product,
  highlighted,
  layout = "list",
  onPress,
  onOpen,
  onEdit,
  onRemove,
  onRetry,
}: Props) {
  const { colors } = useDesign();
  const { width, fontScale } = useWindowDimensions();
  const grid = layout === "grid";
  const largeText = fontScale > 1.3;
  const stacked = grid || largeText;
  const review = product.status === "needs_review";
  const statusColor = review ? colors.warning : colors.muted;
  const content = (
    <>
      {highlighted && (
        <View style={styles.saved}>
          <View aria-hidden>
            <Ionicons name="checkmark-circle" size={17} color={colors.accent} />
          </View>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.savedText,
              grid && { flexShrink: 1 },
              { color: colors.accent },
            ]}
          >
            {grid ? "Salvo" : "Salvo no carrinho"}
          </Text>
        </View>
      )}
      <View
        style={[styles.row, stacked && styles.stacked, grid && { gap: 10 }]}
      >
        <ProductImage
          uri={product.imageUrl}
          style={
            grid
              ? styles.imageGrid
              : stacked
                ? styles.imageStacked
                : width < 350
                  ? styles.imageNarrow
                  : styles.image
          }
        />
        <View style={[styles.copy, stacked && { flex: 0, width: "100%" }]}>
          <View style={styles.store}>
            <StoreIcon uri={product.faviconUrl} />
            <Text
              style={[styles.storeName, { color: colors.muted }]}
              numberOfLines={largeText ? undefined : 1}
            >
              {product.storeName}
            </Text>
          </View>
          <Text
            style={[
              styles.title,
              grid && !largeText && { minHeight: 44 },
              { color: colors.ink },
            ]}
            numberOfLines={largeText ? undefined : grid ? 2 : 3}
          >
            {product.title || "Produto salvo"}
          </Text>
          <Text
            style={[
              product.price ? styles.price : styles.missing,
              grid && product.price ? styles.gridPrice : undefined,
              { color: product.price ? colors.ink : colors.muted },
            ]}
          >
            {product.price
              ? formatPrice(product.price, product.currency)
              : "Preço a conferir"}
          </Text>
          <View style={styles.status}>
            {product.status === "processing" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <View aria-hidden>
                <Ionicons
                  name={
                    review
                      ? "alert-circle-outline"
                      : product.status === "pending"
                        ? "time-outline"
                        : "checkmark-circle-outline"
                  }
                  size={15}
                  color={statusColor}
                />
              </View>
            )}
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.statusText, { color: statusColor }]}
            >
              {productStatus(product)}
            </Text>
          </View>
        </View>
        {onPress && !stacked && (
          <View aria-hidden style={styles.chevron}>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </View>
        )}
      </View>
      {!onPress && (
        <>
          {product.lastError && (
            <View
              style={[styles.notice, { backgroundColor: colors.warningSoft }]}
            >
              <Text style={[styles.noticeText, { color: colors.warning }]}>
                {product.lastError}
              </Text>
            </View>
          )}
          <View style={[styles.actions, { borderTopColor: colors.line }]}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Abrir loja"
              onPress={onOpen}
              style={[styles.open, { backgroundColor: colors.soft }]}
            >
              <Text style={[styles.actionLabel, { color: colors.ink }]}>
                Abrir loja
              </Text>
              <View aria-hidden>
                <Ionicons name="open-outline" size={16} color={colors.muted} />
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel="Editar"
              accessibilityHint={`Editar ${product.title || "produto salvo"}`}
              onPress={onEdit}
              style={styles.edit}
            >
              <Text style={[styles.actionLabel, { color: colors.ink }]}>
                Editar
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Remover ${product.title || "produto"}`}
              onPress={onRemove}
              style={styles.remove}
            >
              <View aria-hidden>
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={colors.danger}
                />
              </View>
            </Pressable>
          </View>
          {review && (
            <Button
              label="Tentar novamente"
              icon="refresh-outline"
              variant="secondary"
              onPress={onRetry}
            />
          )}
        </>
      )}
    </>
  );
  const style = [
    styles.card,
    grid && styles.gridCard,
    {
      backgroundColor: colors.surface,
      borderColor: highlighted ? colors.accent : colors.line,
    },
  ];
  return onPress ? (
    <Pressable
      accessibilityLabel={
        highlighted
          ? "Ver produto salvo no carrinho"
          : `Abrir ${product.title || "produto salvo"} no carrinho`
      }
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View testID={`product-${product.id}`} style={style}>
      {content}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 14 },
  gridCard: { flex: 1, padding: 12, gap: 10 },
  imageGrid: {
    width: "100%",
    height: undefined,
    aspectRatio: 1.2,
    maxHeight: 180,
  },
  gridPrice: { fontSize: 20, lineHeight: 26 },
  row: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  stacked: { flexDirection: "column" },
  image: { width: 108, height: 130 },
  imageNarrow: { width: 84, height: 112 },
  imageStacked: { width: "100%", height: 180 },
  copy: { flex: 1, minWidth: 0, gap: 7 },
  store: { flexDirection: "row", alignItems: "center", gap: 6 },
  storeName: {
    fontFamily: Type.regular,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  title: { fontFamily: Type.medium, fontSize: 16, lineHeight: 22 },
  price: {
    fontFamily: Type.medium,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  missing: { fontFamily: Type.regular, fontSize: 16, lineHeight: 22 },
  status: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  statusText: {
    fontFamily: Type.regular,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  chevron: { alignSelf: "center" },
  saved: { flexDirection: "row", alignItems: "center", gap: 6 },
  savedText: { fontFamily: Type.medium, fontSize: 14, lineHeight: 20 },
  notice: { padding: 12, borderRadius: 12 },
  noticeText: { fontFamily: Type.regular, fontSize: 16, lineHeight: 23 },
  actions: {
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  open: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  edit: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: "center",
  },
  actionLabel: { fontFamily: Type.medium, fontSize: 14, lineHeight: 20 },
  remove: {
    minHeight: 48,
    width: 48,
    marginLeft: "auto",
    justifyContent: "center",
    alignItems: "center",
  },
});
