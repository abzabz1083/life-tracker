import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ActionButton, Card, Field, Page, PageHeading, SectionTitle } from "../../src/components/primitives";
import { Currency, useLife } from "../../src/state/LifeContext";
import { useColors } from "../../hooks/useColors";

const currencies: Currency[] = ["GBP", "USD", "AED", "EUR"];
const TELEGRAM_TOKEN_KEY = "life-tracker-telegram-bot-token";

export default function SettingsScreen() {
  const { data, update } = useLife();
  const colors = useColors();
  const [telegramToken, setTelegramToken] = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState("");
  const [telegramError, setTelegramError] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(TELEGRAM_TOKEN_KEY)
      .then((value) => {
        if (active && value) setTelegramToken(value);
      })
      .catch(() => {
        if (active) setTelegramError("Secure storage is unavailable on this device.");
      })
      .finally(() => {
        if (active) setTokenReady(true);
      });
    return () => { active = false; };
  }, []);

  const saveToken = async () => {
    setTelegramError("");
    setTelegramStatus("");
    if (!telegramToken.trim()) {
      setTelegramError("Paste a bot token first, or remove the saved token.");
      return;
    }
    setSaving(true);
    try {
      await SecureStore.setItemAsync(TELEGRAM_TOKEN_KEY, telegramToken.trim());
      setTelegramStatus("Bot token saved securely on this device.");
    } catch {
      setTelegramError("Could not save the token securely. Check device storage and try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeToken = async () => {
    setTelegramError("");
    setTelegramStatus("");
    try {
      await SecureStore.deleteItemAsync(TELEGRAM_TOKEN_KEY);
      setTelegramToken("");
      setTelegramStatus("Saved bot token removed from this device.");
    } catch {
      setTelegramError("Could not remove the saved token.");
    }
  };

  const testTelegram = async () => {
    const token = telegramToken.trim();
    const chatId = data.settings.telegramChatId.trim();
    setTelegramError("");
    setTelegramStatus("");
    if (!token || !chatId) {
      setTelegramError("Add both the bot token and chat ID first.");
      return;
    }
    setSaving(true);
    try {
      await SecureStore.setItemAsync(TELEGRAM_TOKEN_KEY, token);
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "Life Tracker is connected and ready." }),
      });
      const body = await response.json() as { ok?: boolean; description?: string };
      if (!response.ok || !body.ok) throw new Error(body.description || "Telegram did not accept the test message.");
      setTelegramStatus("Test message sent. Telegram is connected.");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "Telegram connection failed. Check the bot token and chat ID.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeading eyebrow="Personal preferences" title="Make it yours." subtitle="Set the numbers and connections that shape your daily view." />

      <Card>
        <SectionTitle>Money preferences</SectionTitle>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Main currency</Text>
        <View style={styles.currencyRow}>
          {currencies.map((currency) => {
            const selected = data.settings.baseCurrency === currency;
            return (
              <Pressable
                key={currency}
                onPress={() => update("settings", { ...data.settings, baseCurrency: currency })}
                style={[styles.currencyChoice, { backgroundColor: selected ? colors.primary : colors.secondary, borderColor: selected ? colors.primary : colors.border }]}
              >
                <Text style={[styles.currencyText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{currency}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>New income, expenses and bills are converted to this currency when saved.</Text>
        <Field
          label={`Monthly income target (${data.settings.baseCurrency})`}
          value={data.settings.monthlyIncomeTarget ? String(data.settings.monthlyIncomeTarget) : ""}
          onChangeText={(value) => update("settings", { ...data.settings, monthlyIncomeTarget: Number(value) || 0 })}
          keyboardType="decimal-pad"
          placeholder="Set your target"
        />
        <Field
          label={`Monthly spending budget (${data.settings.baseCurrency})`}
          value={data.settings.monthlySpendingBudget ? String(data.settings.monthlySpendingBudget) : ""}
          onChangeText={(value) => update("settings", { ...data.settings, monthlySpendingBudget: Number(value) || 0 })}
          keyboardType="decimal-pad"
          placeholder="Set a monthly limit"
        />
      </Card>

      <Card>
        <SectionTitle>Nutrition preferences</SectionTitle>
        <Field
          label="Daily calorie target"
          value={String(data.settings.calorieTarget)}
          onChangeText={(value) => update("settings", { ...data.settings, calorieTarget: Number(value) || 0 })}
          keyboardType="number-pad"
        />
        <Field
          label="Daily protein target (g)"
          value={String(data.settings.proteinTarget)}
          onChangeText={(value) => update("settings", { ...data.settings, proteinTarget: Number(value) || 0 })}
          keyboardType="number-pad"
        />
        <Field
          label="Meal check-in time"
          value={data.settings.mealPrompt}
          onChangeText={(value) => update("settings", { ...data.settings, mealPrompt: value })}
          placeholder="13:00"
        />
        <Field
          label="Workout check-in time"
          value={data.settings.workoutPrompt}
          onChangeText={(value) => update("settings", { ...data.settings, workoutPrompt: value })}
          placeholder="20:00"
        />
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Meal and workout logs ask for the time you ate and the time you finished. The check-in times are saved as personal preferences.</Text>
      </Card>

      <Card>
        <SectionTitle>Telegram connection</SectionTitle>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Connect your Telegram bot to send a test message. Create a bot with Telegram’s BotFather, then paste its token and your chat ID below.
        </Text>
        <Field
          label="Bot API token"
          value={telegramToken}
          onChangeText={setTelegramToken}
          placeholder={tokenReady ? "Saved securely on this device" : "Loading secure storage…"}
          secureTextEntry={!showToken}
          testID="telegram-token"
        />
        <Pressable onPress={() => setShowToken((visible) => !visible)} style={styles.showToken}>
          <Text style={[styles.showTokenText, { color: colors.foreground }]}>{showToken ? "Hide token" : "Show token"}</Text>
        </Pressable>
        <Field
          label="Telegram chat ID"
          value={data.settings.telegramChatId}
          onChangeText={(value) => update("settings", { ...data.settings, telegramChatId: value })}
          placeholder="Your personal or group chat ID"
          keyboardType="default"
          testID="telegram-chat-id"
        />
        <View style={styles.actionStack}>
          <ActionButton label="Save token securely" icon="lock" onPress={saveToken} loading={saving} disabled={!tokenReady} testID="save-telegram-token" />
          <ActionButton label="Send test message" icon="send" onPress={testTelegram} secondary loading={saving} disabled={!tokenReady} testID="test-telegram" />
          {telegramToken ? <ActionButton label="Remove saved token" icon="trash-2" onPress={removeToken} secondary disabled={saving} /> : null}
        </View>
        {telegramStatus ? <Text style={[styles.message, { color: colors.primary }]}>{telegramStatus}</Text> : null}
        {telegramError ? <Text style={[styles.message, { color: colors.destructive }]}>{telegramError}</Text> : null}
        <View style={[styles.privacyNote, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>Your token is kept in this phone’s secure storage. It is sent only to Telegram when you test the connection; it is not saved with your tracker data.</Text>
        </View>
      </Card>

      <Card>
        <SectionTitle>Data & AI</SectionTitle>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Tasks, finances, meals, workouts and modules are stored on this device. Voice transcription, exercise-photo identification and AI reviews send only the requested recording, photo or summary snapshot to Replit’s managed OpenAI service.
        </Text>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Nutrition search uses USDA FoodData Central and Open Food Facts. Food matches and portion sizes can vary; compare the selected entry with the product label when precision matters.
        </Text>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 },
  currencyRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  currencyChoice: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  currencyText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  helper: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  showToken: { alignSelf: "flex-start", paddingVertical: 3, marginTop: -4, marginBottom: 8 },
  showTokenText: { fontFamily: "Inter_600SemiBold", fontSize: 11, textDecorationLine: "underline" },
  actionStack: { gap: 9, marginTop: 2 },
  message: { fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 18, marginTop: 11 },
  privacyNote: { padding: 12, borderRadius: 13, marginTop: 14 },
});
