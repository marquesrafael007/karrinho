import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";
import { useCart } from "@/storage/cart-context";
import { cartTotals } from "@/utils/cart";
import { formatPrice } from "@/utils/format-price";

export function CartOverview({ compact = false }: { compact?: boolean }) {
  const { colors } = useDesign();
  const { products, loading } = useCart();
  const totals = cartTotals(products);
  const pending = products.filter(
    (product) => product.status !== "ready",
  ).length;
  const stores = new Set(products.map((product) => product.store)).size;
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: colors.muted }]}>
            Total confirmado
          </Text>
          {totals.length ? (
            totals.map((total) => (
              <Text
                key={total.currency}
                selectable
                style={[styles.total, { color: colors.ink }]}
              >
                {formatPrice(total.total.toFixed(2), total.currency)}
              </Text>
            ))
          ) : (
            <Text style={[styles.total, { color: colors.ink }]}>
              {loading || products.length ? "—" : "R$ 0,00"}
            </Text>
          )}
          <Text style={[styles.caption, { color: colors.muted }]}>
            {products.length} {products.length === 1 ? "produto" : "produtos"} ·{" "}
            {stores} {stores === 1 ? "loja" : "lojas"}
          </Text>
        </View>
        {!compact && (
          <View
            aria-hidden
            style={[styles.icon, { backgroundColor: colors.accentSoft }]}
          >
            <Ionicons
              name="bag-handle-outline"
              size={24}
              color={colors.accent}
            />
          </View>
        )}
      </View>
      {pending > 0 && (
        <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
          <View aria-hidden>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.warning}
            />
          </View>
          <Text style={[styles.noteText, { color: colors.warning }]}>
            {pending}{" "}
            {pending === 1
              ? "produto a conferir, fora do total."
              : "produtos a conferir, fora do total."}
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 16 },
  row: { flexDirection: "row", gap: 16, alignItems: "center" },
  copy: { flex: 1, gap: 6, minWidth: 0 },
  label: { fontFamily: Type.regular, fontSize: 14, lineHeight: 20 },
  total: {
    fontFamily: Type.medium,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  caption: { fontFamily: Type.regular, fontSize: 14, lineHeight: 20 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  noteText: { fontFamily: Type.regular, fontSize: 14, lineHeight: 20, flex: 1 },
});
