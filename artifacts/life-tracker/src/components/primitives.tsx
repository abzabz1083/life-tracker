import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "../../components/KeyboardAwareScrollViewCompat";
import { useColors } from "../../hooks/useColors";

export function Page({
  children,
  bottomSpace = 104,
}: {
  children: ReactNode;
  bottomSpace?: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: Platform.OS === "web" ? Math.max(67, insets.top) + 16 : insets.top + 14,
          paddingBottom: Math.max(bottomSpace, Platform.OS === "web" ? 34 : insets.bottom + 28),
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {children}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, detail }: { children: string; detail?: string }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{children}</Text>
      {detail ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  multiline?: boolean;
  secureTextEntry?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize="sentences"
        style={[
          styles.input,
          { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border },
          multiline ? styles.multiline : undefined,
        ]}
      />
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  icon,
  secondary = false,
  disabled = false,
  loading = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? colors.secondary : colors.primary,
          borderColor: secondary ? colors.border : colors.primary,
          opacity: disabled ? 0.48 : pressed ? 0.78 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.foreground : colors.primaryForeground} size="small" />
      ) : icon ? (
        <Feather name={icon} size={16} color={secondary ? colors.foreground : colors.primaryForeground} />
      ) : null}
      <Text style={[styles.buttonText, { color: secondary ? colors.foreground : colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
    >
      <Feather name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.detail, { color: colors.mutedForeground }]}>{detail}</Text>
    </View>
  );
}

export function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 29, lineHeight: 35, letterSpacing: -0.7 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: 20, padding: 17, marginBottom: 14 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, letterSpacing: -0.2 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: 14 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  button: { minHeight: 46, paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 12, gap: 5 },
  emptyTitle: { fontFamily: "Inter_500Medium", fontSize: 14 },
  divider: { height: 1, marginVertical: 13 },
});
