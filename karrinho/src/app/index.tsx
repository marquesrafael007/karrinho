import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AppFrame } from "@/components/app-frame";
import { ProductCard } from "@/components/product-card";
import AnimatedInputBar from "@/components/base/animated-input-bar";
import { Pressable } from "@/components/atoms/pressable";
import { Type } from "@/constants/theme";
import { useDesign } from "@/design/theme-provider";
import { cartRepository } from "@/storage/cart";
import { useCart } from "@/storage/cart-context";

const PLACEHOLDERS = ["Cole o link aqui"];

export default function Home() {
  const router = useRouter();
  const { colors } = useDesign();
  const { fontScale } = useWindowDimensions();
  const { products, loading, error: storageError } = useCart();
  const [productUrl, setProductUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const savingRef = useRef(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const processing = products.some(
    (product) =>
      product.status === "processing" || product.status === "pending",
  );
  useEffect(() => {
    if (!previewId) return;
    const timer = setTimeout(() => setPreviewId(null), 15_000);
    return () => clearTimeout(timer);
  }, [previewId]);

  async function handleAddProduct() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await cartRepository.enqueue(productUrl);
      setPreviewId(saved.id);
      setProductUrl("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }
  const recent = products.slice(0, 4);
  // Keep a just-saved duplicate visible even when it is older than the recent list.
  const preview = products.find((product) => product.id === previewId);
  const visibleProducts =
    preview && !recent.some((product) => product.id === preview.id)
      ? [preview, ...recent.slice(0, 3)]
      : recent;

  return (
    <AppFrame active="home">
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator
              color={colors.accent}
              accessibilityLabel="Carregando produtos"
            />
          ) : products.length > 0 ? (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeading}>
                <Text
                  accessibilityRole="header"
                  style={[styles.sectionTitle, { color: colors.ink }]}
                >
                  Recentes
                </Text>
                <Pressable
                  accessibilityLabel="Ver meu carrinho"
                  onPress={() => router.push("/cart")}
                  style={styles.textAction}
                >
                  <Text style={[styles.link, { color: colors.accent }]}>
                    Ver tudo
                  </Text>
                  <View aria-hidden>
                    <Ionicons
                      name="arrow-forward"
                      size={17}
                      color={colors.accent}
                    />
                  </View>
                </Pressable>
              </View>
              <View testID="recent-grid" style={styles.grid}>
                {[0, 2].map((offset) => {
                  const row = visibleProducts.slice(offset, offset + 2);
                  if (!row.length) return null;
                  return (
                    <View key={offset} style={styles.gridRow}>
                      {row.map((product) => (
                        <View
                          key={product.id}
                          testID="recent-cell"
                          style={styles.gridCell}
                        >
                          <ProductCard
                            product={product}
                            layout="grid"
                            highlighted={product.id === previewId}
                            onPress={() => router.push("/cart")}
                          />
                        </View>
                      ))}
                      {row.length === 1 && <View style={styles.gridCell} />}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Cole um link abaixo para guardar seu primeiro produto. Seus
                achados ficam juntos no carrinho.
              </Text>
            </View>
          )}
          <View testID="home-composer" style={styles.composer}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, { color: colors.ink }]}
            >
              O que você encontrou?
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: focused ? colors.accent : colors.control,
                },
              ]}
            >
              <AnimatedInputBar
                placeholders={PLACEHOLDERS}
                disableAnimations={fontScale > 1.3}
                value={productUrl}
                onChangeText={setProductUrl}
                editable={!saving}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Link do produto"
                returnKeyType="go"
                onSubmitEditing={() => void handleAddProduct()}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                selectionColor={colors.accent}
                placeholderTextColor={colors.muted}
                characterEnterDuration={140}
                characterDelayIncrement={4}
                blurIntensityRange={[0, 0, 0]}
                containerStyle={styles.inputContainer}
                inputWrapperStyle={styles.inputWrapper}
                inputStyle={[styles.input, { color: colors.ink }]}
                placeholderStyle={[styles.input, { color: colors.muted }]}
              />
              <Pressable
                accessibilityLabel="Adicionar produto"
                accessibilityState={{ busy: saving }}
                disabled={saving || !productUrl.trim()}
                onPress={() => void handleAddProduct()}
                style={[
                  styles.submit,
                  {
                    backgroundColor:
                      saving || !productUrl.trim()
                        ? colors.soft
                        : colors.accentFill,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <View aria-hidden>
                    <Ionicons
                      name="arrow-up"
                      size={23}
                      color={
                        !productUrl.trim() ? colors.muted : colors.onAccent
                      }
                    />
                  </View>
                )}
              </Pressable>
            </View>
            <View style={styles.hintRow}>
              <View aria-hidden>
                <Ionicons
                  name={processing ? "time-outline" : "lock-closed-outline"}
                  size={15}
                  color={colors.muted}
                />
              </View>
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.hint, { color: colors.muted }]}
              >
                {saving
                  ? "Salvando link…"
                  : processing
                    ? "Buscando os dados. Pode adicionar outro."
                    : "Seus links ficam salvos neste aparelho."}
              </Text>
            </View>
            {(error || storageError) && (
              <Text
                accessibilityRole="alert"
                style={[styles.error, { color: colors.danger }]}
              >
                {error || storageError}
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppFrame>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: 32, paddingBottom: 24, gap: 32 },
  composer: { gap: 16 },
  heading: {
    fontFamily: Type.bold,
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 19,
    padding: 6,
    gap: 4,
  },
  inputContainer: { flex: 1, minWidth: 0, marginVertical: 0 },
  inputWrapper: { paddingHorizontal: 18, paddingVertical: 14, minHeight: 52 },
  input: { fontFamily: Type.regular, fontSize: 16, lineHeight: 24 },
  submit: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  hint: { fontFamily: Type.regular, fontSize: 13, lineHeight: 19, flex: 1 },
  error: { fontFamily: Type.regular, fontSize: 16, lineHeight: 24 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sectionTitle: {
    fontFamily: Type.medium,
    fontSize: 18,
    lineHeight: 25,
    flexShrink: 1,
  },
  textAction: {
    minHeight: 48,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  link: { fontFamily: Type.medium, fontSize: 14, lineHeight: 20 },
  recentSection: { gap: 14 },
  grid: { gap: 12 },
  gridRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  gridCell: { flex: 1, minWidth: 0 },
  empty: { paddingTop: 8, maxWidth: 320 },
  emptyText: {
    fontFamily: Type.regular,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 480,
  },
});
