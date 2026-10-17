import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useTranscribeLifeVoiceNote, useCreateLifeInsight } from "@workspace/api-client-react";
import { ActionButton, Card, Divider, EmptyState, Field, Page, PageHeading, SectionTitle } from "../../src/components/primitives";
import { Currency, localDateKey, makeId, monthKey, moneyLabel, useLife } from "../../src/state/LifeContext";
import { convertCurrency } from "../../src/lib/money";
import { useColors } from "../../hooks/useColors";

function parseSpokenSpend(text: string) {
  if (!/\b(spent|paid|bought|expense|cost)\b/i.test(text)) return null;
  const match = text.match(/(?:\$|£|د\.إ\s*)?(\d+(?:[.,]\d{1,2})?)\s*(GBP|USD|AED|EUR|\$|£)?/i);
  if (!match) return null;
  const currencyMatch = match[2]?.toUpperCase();
  const currency: Currency = currencyMatch === "$" ? "USD" : currencyMatch === "£" ? "GBP" : (currencyMatch as Currency) || "GBP";
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const title = text.replace(match[0], "").replace(/\b(spent|paid|bought|expense|cost|on|for)\b/gi, "").trim();
  return { amount, currency, title: title || "Voice expense" };
}

function dateLabel() {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

export default function TodayScreen() {
  const { data, update, ready } = useLife();
  const colors = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const transcribe = useTranscribeLifeVoiceNote();
  const insightRequest = useCreateLifeInsight();
  const [isRecording, setIsRecording] = useState(false);
  const [micCanAskAgain, setMicCanAskAgain] = useState(true);
  const [taskTitle, setTaskTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [review, setReview] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [savingSpend, setSavingSpend] = useState(false);
  const [spendError, setSpendError] = useState("");
  const dayTasks = useMemo(
    () => data.tasks.filter((task) => task.date === localDateKey()),
    [data.tasks],
  );
  const monthMoney = useMemo(
    () => data.money.filter((item) => item.date.startsWith(monthKey())),
    [data.money],
  );
  const monthlySpend = monthMoney.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.baseAmount, 0);
  const billTotal = data.bills.reduce((sum, bill) => sum + bill.baseAmount, 0);
  const affordableIncome = monthlySpend + billTotal;
  const todayMeals = data.meals.filter((meal) => meal.date === localDateKey());
  const todayCalories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const spokenSpend = parseSpokenSpend(transcript);

  const addTask = () => {
    const title = taskTitle.trim();
    if (!title) return;
    update("tasks", [{ id: makeId(), title, done: false, date: localDateKey() }, ...data.tasks]);
    setTaskTitle("");
  };

  const toggleTask = (id: string) => {
    update("tasks", data.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  };

  const toggleRecording = async () => {
    setVoiceError("");
    try {
      if (!isRecording) {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setMicCanAskAgain(permission.canAskAgain);
          setVoiceError("Microphone access is needed to record a voice note. You can still add tasks by typing.");
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setIsRecording(true);
        return;
      }
      await recorder.stop();
      setIsRecording(false);
      if (!recorder.uri) throw new Error("The recording was not saved. Please try again.");
      const audioBase64 = await FileSystem.readAsStringAsync(recorder.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const result = await transcribe.mutateAsync({
        data: { audioBase64, format: "m4a" },
      });
      setTranscript(result.transcript);
      if (result.transcript.trim()) {
        update("voiceNotes", [
          { id: makeId(), text: result.transcript.trim(), createdAt: new Date().toISOString() },
          ...data.voiceNotes,
        ]);
      }
      const taskMatch = result.transcript.match(/(?:need to|remember to|todo:?)\s+(.+)/i);
      if (taskMatch?.[1]) {
        const title = taskMatch[1].replace(/[.!?]+$/, "").trim();
        update("tasks", [{ id: makeId(), title, done: false, date: localDateKey() }, ...data.tasks]);
      }
    } catch (error) {
      setIsRecording(false);
      setVoiceError(error instanceof Error ? error.message : "Voice note could not be transcribed.");
    }
  };

  const saveSpokenSpend = async () => {
    if (!spokenSpend || savingSpend) return;
    setSpendError("");
    setSavingSpend(true);
    try {
      const baseAmount = await convertCurrency(spokenSpend.amount, spokenSpend.currency, data.settings.baseCurrency);
      update("money", [{
        id: makeId(),
        kind: "expense",
        title: spokenSpend.title,
        category: "Voice note",
        amount: spokenSpend.amount,
        currency: spokenSpend.currency,
        baseAmount,
        date: localDateKey(),
      }, ...data.money]);
      setTranscript("");
    } catch (error) {
      setSpendError(error instanceof Error ? error.message : "Conversion failed; the expense was not saved.");
    } finally {
      setSavingSpend(false);
    }
  };

  const createReview = async () => {
    setReview("");
    setReviewError("");
    const spendingBreakdown = monthMoney
      .filter((item) => item.kind === "expense")
      .reduce<Record<string, number>>((totals, item) => {
        totals[item.category] = (totals[item.category] || 0) + item.baseAmount;
        return totals;
      }, {});
    const categorySummary = Object.entries(spendingBreakdown)
      .map(([category, total]) => `${category}: ${moneyLabel(total, data.settings.baseCurrency)}`)
      .join("; ") || "no expenses logged yet";
    const mealSummary = todayMeals
      .map((meal) => `${meal.time} ${meal.name}, ${Math.round(meal.calories)} kcal, ${Math.round(meal.protein)} g protein`)
      .join("; ") || "no meals logged yet";
    const workoutSummary = data.workouts
      .slice(0, 6)
      .map((entry) => `${entry.date}: ${entry.exercise}, ${entry.weight} kg, ${entry.sets} sets of ${entry.reps}`)
      .join("; ") || "no workout entries yet";
    const studySummary = data.modules
      .slice(0, 5)
      .map((module) => `${module.category} / Module ${module.moduleNumber}: ${module.title}`)
      .join("; ") || "no modules logged yet";
    const snapshot = [
      `Date: ${dateLabel()}`,
      `Tasks completed: ${dayTasks.filter((task) => task.done).length} of ${dayTasks.length}.`,
      `This month's spending: ${moneyLabel(monthlySpend, data.settings.baseCurrency)} (${categorySummary}); recurring bills: ${moneyLabel(billTotal, data.settings.baseCurrency)}.`,
      `Monthly income target: ${moneyLabel(data.settings.monthlyIncomeTarget, data.settings.baseCurrency)}.`,
      `Today's meals: ${mealSummary}. Daily total ${Math.round(todayCalories)} calories and ${Math.round(todayMeals.reduce((sum, meal) => sum + meal.protein, 0))} g protein; targets ${data.settings.calorieTarget} kcal and ${data.settings.proteinTarget} g.`,
      `Recent training: ${workoutSummary}.`,
      `Recent learning: ${studySummary}.`,
    ].join("\n");
    try {
      const result = await insightRequest.mutateAsync({ data: { snapshot } });
      setReview(result.summary);
    } catch {
      setReviewError("Couldn't create your review right now. Please try again.");
    }
  };

  if (!ready) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <Page>
      <PageHeading
        eyebrow={dateLabel()}
        title="Your day, in focus."
        subtitle="A clear view of what matters today."
        right={<Pressable onPress={() => router.push("/(tabs)/settings")} accessibilityLabel="Open settings"><View style={[styles.settingsMark, { backgroundColor: colors.secondary }]}><Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12 }}>LT</Text></View></Pressable>}
      />

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{dayTasks.filter((task) => task.done).length}<Text style={[styles.statDim, { color: colors.mutedForeground }]}>/{dayTasks.length}</Text></Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Tasks done</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{Math.round(todayCalories).toLocaleString()}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Calories today</Text>
        </Card>
      </View>

      <Card>
        <SectionTitle detail={`${dayTasks.length - dayTasks.filter((task) => task.done).length} left`}>Today’s tasks</SectionTitle>
        {dayTasks.length ? dayTasks.map((task) => (
          <Pressable key={task.id} onPress={() => toggleTask(task.id)} style={styles.taskRow} accessibilityRole="checkbox" accessibilityState={{ checked: task.done }}>
            <View style={[styles.checkbox, { borderColor: task.done ? colors.primary : colors.border, backgroundColor: task.done ? colors.primary : "transparent" }]}>
              {task.done ? <Text style={[styles.checkmark, { color: colors.primaryForeground }]}>✓</Text> : null}
            </View>
            <Text style={[styles.taskText, { color: task.done ? colors.mutedForeground : colors.foreground, textDecorationLine: task.done ? "line-through" : "none" }]}>{task.title}</Text>
          </Pressable>
        )) : <EmptyState title="Start with one small win" detail="Add the first task you want to finish today." />}
        <Divider />
        <Field label="New task" value={taskTitle} onChangeText={setTaskTitle} placeholder="What needs your attention?" testID="task-title" />
        <ActionButton label="Add task" icon="plus" onPress={addTask} disabled={!taskTitle.trim()} testID="add-task" />
      </Card>

      <Card>
        <SectionTitle>Voice capture</SectionTitle>
        <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
          Say a task or expense naturally. Your transcript is saved and you can review it before logging money.
        </Text>
        <ActionButton
          label={isRecording ? "Finish recording" : "Record a voice note"}
          icon={isRecording ? "square" : "mic"}
          onPress={toggleRecording}
          loading={transcribe.isPending}
          testID="voice-record"
        />
        {voiceError ? <Text style={[styles.error, { color: colors.destructive }]}>{voiceError}</Text> : null}
        {!micCanAskAgain && Platform.OS !== "web" ? (
          <View style={styles.settingsButton}>
            <ActionButton label="Open device settings" icon="settings" secondary onPress={() => { void Linking.openSettings().catch(() => setVoiceError("Device settings could not be opened.")); }} />
          </View>
        ) : null}
        {transcript ? (
          <View style={[styles.transcriptBox, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.transcript, { color: colors.foreground }]}>{transcript}</Text>
            {spokenSpend ? (
              <View style={styles.transcriptAction}>
                <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                  Expense detected: {moneyLabel(spokenSpend.amount, spokenSpend.currency)}. It will be converted to {data.settings.baseCurrency}.
                </Text>
                <ActionButton label="Log this expense" icon="arrow-down-left" onPress={saveSpokenSpend} loading={savingSpend} />
                {spendError ? <Text style={[styles.error, { color: colors.destructive }]}>{spendError}</Text> : null}
              </View>
            ) : (
              <View style={styles.transcriptAction}>
                <ActionButton label="Add transcript as a task" icon="check" secondary onPress={() => {
                  update("tasks", [{ id: makeId(), title: transcript.trim(), done: false, date: localDateKey() }, ...data.tasks]);
                  setTranscript("");
                }} />
              </View>
            )}
          </View>
        ) : null}
        {data.voiceNotes.length ? <Text style={[styles.noteHint, { color: colors.mutedForeground }]}>{data.voiceNotes.length} saved voice notes</Text> : null}
      </Card>

      <Card>
        <SectionTitle detail={data.settings.baseCurrency}>Monthly breathing room</SectionTitle>
        <Text style={[styles.bigMoney, { color: colors.foreground }]}>{moneyLabel(affordableIncome, data.settings.baseCurrency)}</Text>
        <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>
          Logged spending plus recurring bills. Your settings can add an income target to compare against this.
        </Text>
        <ActionButton label="Open money plan" icon="arrow-up-right" secondary onPress={() => router.push("/(tabs)/money")} />
      </Card>

      <Card>
        <View style={styles.sectionTitleInline}>
          <SectionTitle>Weekly check-in</SectionTitle>
          <Text style={[styles.aiLabel, { color: colors.mutedForeground }]}>AI</Text>
        </View>
        <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>Get a practical review of your tasks, money, meals, learning and training.</Text>
        <ActionButton label="Create my review" icon="star" onPress={createReview} loading={insightRequest.isPending} testID="create-review" />
        {reviewError ? <Text style={[styles.error, { color: colors.destructive }]}>{reviewError}</Text> : null}
        {review ? <View style={[styles.reviewBox, { backgroundColor: colors.secondary }]}><Text style={[styles.reviewText, { color: colors.foreground }]}>{review}</Text></View> : null}
      </Card>

      {data.bills.length > 0 ? (
        <Card>
          <SectionTitle detail="This month">Upcoming bills</SectionTitle>
          {data.bills.slice(0, 3).map((bill) => (
            <View style={styles.billRow} key={bill.id}>
              <View style={[styles.billDot, { backgroundColor: colors.primary }]} />
              <View style={styles.billName}><Text style={[styles.taskText, { color: colors.foreground }]}>{bill.title}</Text><Text style={[styles.detailText, { color: colors.mutedForeground }]}>Due day {bill.dueDay}</Text></View>
              <Text style={[styles.billAmount, { color: colors.foreground }]}>{moneyLabel(bill.baseAmount, data.settings.baseCurrency)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  settingsMark: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, padding: 15 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 25, letterSpacing: -0.8 },
  statDim: { fontSize: 15, fontFamily: "Inter_500Medium" },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 5 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 },
  checkbox: { width: 21, height: 21, borderWidth: 1.5, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  checkmark: { fontSize: 12, fontWeight: "700" },
  taskText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19 },
  cardCopy: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginBottom: 13 },
  transcriptBox: { borderRadius: 14, padding: 13, marginTop: 14 },
  transcript: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 20 },
  transcriptAction: { marginTop: 12, gap: 10 },
  detailText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  error: { fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 18, marginTop: 10 },
  noteHint: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 11 },
  bigMoney: { fontFamily: "Inter_700Bold", fontSize: 26, marginBottom: 6, letterSpacing: -0.6 },
  sectionTitleInline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  settingsButton: { marginTop: 10 },
  aiLabel: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, marginBottom: 12 },
  reviewBox: { borderRadius: 14, padding: 14, marginTop: 13 },
  reviewText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  billRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  billDot: { width: 7, height: 7, borderRadius: 4 },
  billName: { flex: 1 },
  billAmount: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
});
