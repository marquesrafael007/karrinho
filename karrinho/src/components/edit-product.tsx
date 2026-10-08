import { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "@/components/atoms/pressable";
import { InputURL } from "@/components/input";
import { Button } from "@/components/button";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";
import type { SavedProduct } from "@/types/product";
import { cartRepository } from "@/storage/cart";

export function EditProduct({
  product,
  onClose,
}: {
  product: SavedProduct;
  onClose(): void;
}) {
  const { colors } = useDesign();
  const { width, fontScale } = useWindowDimensions();
  const [title, setTitle] = useState(product.title ?? "");
  const [price, setPrice] = useState(product.price ?? "");
  const [currency, setCurrency] = useState(product.currency ?? "BRL");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setError(null);
    setSaving(true);
    try {
      await cartRepository.edit(product.id, { title, price, currency });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }
  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.container,
              { justifyContent: width >= 700 ? "center" : "flex-end" },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View
              accessibilityViewIsModal
              style={[
                styles.panel,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <View style={styles.top}>
                <Text
                  accessibilityRole="header"
                  style={[styles.heading, { color: colors.ink }]}
                >
                  Editar produto
                </Text>
                <Pressable
                  accessibilityLabel="Fechar edição"
                  onPress={onClose}
                  disabled={saving}
                  style={[styles.close, { backgroundColor: colors.soft }]}
                >
                  <View aria-hidden>
                    <Ionicons name="close" size={20} color={colors.muted} />
                  </View>
                </Pressable>
              </View>
              <Text style={[styles.help, { color: colors.muted }]}>
                Confira na loja o preço total e a variação escolhida.
              </Text>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.ink }]}>
                  Nome do produto
                </Text>
                <InputURL
                  accessibilityLabel="Nome do produto"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={500}
                  editable={!saving}
                />
              </View>
              <View
                style={[
                  styles.priceRow,
                  fontScale > 1.3 && { flexDirection: "column" },
                ]}
              >
                <View
                  style={[
                    styles.field,
                    styles.priceField,
                    fontScale > 1.3 && { flex: 0 },
                  ]}
                >
                  <Text style={[styles.label, { color: colors.ink }]}>
                    Preço total
                  </Text>
                  <InputURL
                    accessibilityLabel="Preço total"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    editable={!saving}
                  />
                </View>
                <View
                  style={[
                    styles.field,
                    fontScale <= 1.3 && styles.currencyField,
                  ]}
                >
                  <Text style={[styles.label, { color: colors.ink }]}>
                    Moeda
                  </Text>
                  <InputURL
                    accessibilityLabel="Moeda"
                    value={currency}
                    onChangeText={setCurrency}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={3}
                    editable={!saving}
                  />
                </View>
              </View>
              {error && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.error, { color: colors.danger }]}
                >
                  {error}
                </Text>
              )}
              <View
                style={[
                  styles.actions,
                  fontScale > 1.3 && { flexDirection: "column" },
                ]}
              >
                <Button
                  label="Salvar dados"
                  onPress={() => void save()}
                  disabled={saving}
                  accessibilityState={{ busy: saving }}
                  style={[styles.save, fontScale > 1.3 && { flex: 0 }]}
                />
                <Button
                  label="Cancelar"
                  variant="secondary"
                  onPress={onClose}
                  disabled={saving}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "#14211ac0" },
  container: { flexGrow: 1, padding: 16 },
  panel: {
    padding: 20,
    borderWidth: 1,
    borderRadius: 24,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 22,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: {
    fontFamily: Type.bold,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.5,
    flex: 1,
  },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  help: { fontFamily: Type.regular, fontSize: 16, lineHeight: 24 },
  field: { gap: 8 },
  label: { fontFamily: Type.medium, fontSize: 16, lineHeight: 22 },
  priceRow: { flexDirection: "row", gap: 16 },
  priceField: { flex: 1, minWidth: 0 },
  currencyField: { width: 88 },
  actions: { flexDirection: "row", gap: 12, marginTop: 2 },
  save: { flex: 1 },
  error: { fontFamily: Type.regular, fontSize: 16, lineHeight: 24 },
});
