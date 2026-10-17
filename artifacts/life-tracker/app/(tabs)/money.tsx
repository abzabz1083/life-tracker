import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ActionButton, Card, Divider, EmptyState, Field, Page, PageHeading, SectionTitle } from "../../src/components/primitives";
import { Currency, localDateKey, makeId, monthKey, moneyLabel, useLife } from "../../src/state/LifeContext";
import { convertCurrency } from "../../src/lib/money";
import { useColors } from "../../hooks/useColors";

const currencies: Currency[] = ["GBP", "USD", "AED", "EUR"];

export default function MoneyScreen() {
  const { data, update } = useLife();
  const colors = useColors();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(data.settings.baseCurrency);
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCurrency, setBillCurrency] = useState<Currency>(data.settings.baseCurrency);
  const [dueDay, setDueDay] = useState("1");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const thisMonth = monthKey();
  const entries = useMemo(() => data.money.filter((entry) => entry.date.startsWith(thisMonth)), [data.money, thisMonth]);
  const income = entries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.baseAmount, 0);
  const spent = entries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.baseAmount, 0);
  const bills = data.bills.reduce((sum, bill) => sum + bill.baseAmount, 0);
  const needToEarn = spent + bills;
  const remaining = data.settings.monthlyIncomeTarget - needToEarn;
  const categories = entries
    .filter((entry) => entry.kind === "expense")
    .reduce<Record<string, number>>((totals, entry) => {
      totals[entry.category || "Other"] = (totals[entry.category || "Other"] || 0) + entry.baseAmount;
      return totals;
    }, {});
  const categoryRows = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const largestCategory = categoryRows[0]?.[1] || 1;

  const addTransaction = async () => {
    const value = Number(amount);
    if (!title.trim() || !Number.isFinite(value) || value <= 0) {
      setError("Add a description and a valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const baseAmount = await convertCurrency(value, currency, data.settings.baseCurrency);
      update("money", [{
        id: makeId(),
        kind,
        title: title.trim(),
        category: category.trim() || (kind === "income" ? "Income" : "Other"),
        amount: value,
        currency,
        baseAmount,
        date: localDateKey(),
      }, ...data.money]);
      setTitle("");
      setCategory("");
      setAmount("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not convert this amount.");
    } finally {
      setSaving(false);
    }
  };

  const addBill = async () => {
    const value = Number(billAmount);
    const day = Number(dueDay);
    if (!billTitle.trim() || !Number.isFinite(value) || value <= 0 || !Number.isInteger(day) || day < 1 || day > 31) {
      setError("Add a bill name, amount, and due day from 1 to 31.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const baseAmount = await convertCurrency(value, billCurrency, data.settings.baseCurrency);
      update("bills", [{ id: makeId(), title: billTitle.trim(), amount: value, currency: billCurrency, baseAmount, dueDay: day }, ...data.bills]);
      setBillTitle("");
      setBillAmount("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not convert this bill.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeading eyebrow="Your money" title="A plan you can trust." subtitle="Know what comes in, what goes out, and what your life costs each month." />

      <Card>
        <SectionTitle detail={`Monthly view · ${data.settings.baseCurrency}`}>The monthly picture</SectionTitle>
        <View style={styles.bigMetricRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>{moneyLabel(income, data.settings.baseCurrency)}</Text>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Income logged</Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>{moneyLabel(spent + bills, data.settings.baseCurrency)}</Text>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Spend + bills</Text>
          </View>
        </View>
        <Divider />
        <View style={styles.needRow}>
          <View style={styles.needCopy}>
            <Text style={[styles.needTitle, { color: colors.foreground }]}>To afford your current plan</Text>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Monthly expenses and recurring bills</Text>
          </View>
          <Text style={[styles.needAmount, { color: colors.primary }]}>{moneyLabel(needToEarn, data.settings.baseCurrency)}</Text>
        </View>
        {data.settings.monthlyIncomeTarget > 0 ? (
          <Text style={[styles.balanceText, { color: remaining >= 0 ? colors.mutedForeground : colors.destructive }]}>
            {remaining >= 0 ? `${moneyLabel(remaining, data.settings.baseCurrency)} left against your income target` : `${moneyLabel(Math.abs(remaining), data.settings.baseCurrency)} short of your income target`}
          </Text>
        ) : (
          <Text style={[styles.balanceText, { color: colors.mutedForeground }]}>Set your monthly income target in Settings to see your gap.</Text>
        )}
        {data.settings.monthlySpendingBudget > 0 ? (
          <Text style={[styles.balanceText, { color: needToEarn <= data.settings.monthlySpendingBudget ? colors.mutedForeground : colors.destructive }]}>
            {moneyLabel(needToEarn, data.settings.baseCurrency)} of {moneyLabel(data.settings.monthlySpendingBudget, data.settings.baseCurrency)} monthly spending budget · {needToEarn <= data.settings.monthlySpendingBudget ? `${moneyLabel(data.settings.monthlySpendingBudget - needToEarn, data.settings.baseCurrency)} remaining` : `${moneyLabel(needToEarn - data.settings.monthlySpendingBudget, data.settings.baseCurrency)} over`}
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Add a transaction</SectionTitle>
        <View style={styles.choiceRow}>
          {(["expense", "income"] as const).map((option) => {
            const active = kind === option;
            return (
              <Pressable key={option} onPress={() => setKind(option)} style={[styles.choice, { backgroundColor: active ? colors.primary : colors.secondary, borderColor: active ? colors.primary : colors.border }]}>
                <Text style={[styles.choiceText, { color: active ? colors.primaryForeground : colors.foreground }]}>{option === "expense" ? "Expense" : "Income"}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="What was it?" value={title} onChangeText={setTitle} placeholder="Groceries, salary, coffee…" />
        <Field label="Category" value={category} onChangeText={setCategory} placeholder={kind === "income" ? "Salary, freelance…" : "Food, travel, home…"} />
        <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Currency · converted to {data.settings.baseCurrency} when saved</Text>
        <View style={styles.currencyRow}>
          {currencies.map((option) => <Pressable key={option} onPress={() => setCurrency(option)} style={[styles.currencyPill, { borderColor: currency === option ? colors.primary : colors.border, backgroundColor: currency === option ? colors.accent : colors.secondary }]}><Text style={[styles.currencyText, { color: colors.foreground }]}>{option}</Text></Pressable>)}
        </View>
        <ActionButton label="Save transaction" icon="check" onPress={addTransaction} loading={saving} disabled={!title.trim() || !amount} />
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      </Card>

      <Card>
        <SectionTitle detail="Monthly recurring">Bills & due dates</SectionTitle>
        {data.bills.length ? data.bills.map((bill) => (
          <View key={bill.id} style={styles.billRow}>
            <View style={styles.billInfo}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{bill.title}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Due day {bill.dueDay} · {moneyLabel(bill.amount, bill.currency)}</Text>
            </View>
            <Text style={[styles.billValue, { color: colors.foreground }]}>{moneyLabel(bill.baseAmount, data.settings.baseCurrency)}</Text>
            <Pressable accessibilityLabel={`Remove ${bill.title}`} onPress={() => update("bills", data.bills.filter((item) => item.id !== bill.id))} style={styles.removeButton}><Text style={{ color: colors.mutedForeground }}>×</Text></Pressable>
          </View>
        )) : <EmptyState title="No bills added yet" detail="Add the monthly bills you want to plan around." />}
        <Divider />
        <Field label="Bill name" value={billTitle} onChangeText={setBillTitle} placeholder="Rent, phone, internet…" />
        <View style={styles.splitRow}>
          <View style={styles.splitInput}><Field label="Amount" value={billAmount} onChangeText={setBillAmount} placeholder="0.00" keyboardType="decimal-pad" /></View>
          <View style={styles.splitInput}><Field label="Due day" value={dueDay} onChangeText={setDueDay} placeholder="1–31" keyboardType="number-pad" /></View>
        </View>
        <View style={styles.currencyRow}>
          {currencies.map((option) => <Pressable key={option} onPress={() => setBillCurrency(option)} style={[styles.currencyPill, { borderColor: billCurrency === option ? colors.primary : colors.border, backgroundColor: billCurrency === option ? colors.accent : colors.secondary }]}><Text style={[styles.currencyText, { color: colors.foreground }]}>{option}</Text></Pressable>)}
        </View>
        <ActionButton label="Add recurring bill" icon="calendar" secondary onPress={addBill} loading={saving} disabled={!billTitle.trim() || !billAmount} />
      </Card>

      <Card>
        <SectionTitle detail={thisMonth}>Spending review</SectionTitle>
        {categoryRows.length ? categoryRows.map(([name, total]) => (
          <View key={name} style={styles.categoryRow}>
            <View style={styles.categoryTop}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{name}</Text>
              <Text style={[styles.categoryAmount, { color: colors.foreground }]}>{moneyLabel(total, data.settings.baseCurrency)}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.secondary }]}><View style={[styles.fill, { width: `${Math.max(4, total / largestCategory * 100)}%`, backgroundColor: colors.primary }]} /></View>
          </View>
        )) : <EmptyState title="Your review starts here" detail="Log an expense and it will appear in a category breakdown." />}
        {entries.length ? (
          <>
            <Divider />
            <Text style={[styles.sectionMiniTitle, { color: colors.foreground }]}>Recent activity</Text>
            {entries.slice(0, 6).map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyInfo}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>{entry.title}</Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{entry.category} · {entry.date}</Text>
                </View>
                <Text style={[styles.historyAmount, { color: colors.foreground }]}>{entry.kind === "expense" ? "−" : "+"}{moneyLabel(entry.baseAmount, data.settings.baseCurrency)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  bigMetricRow: { flexDirection: "row", gap: 14 },
  metric: { flex: 1 },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 21, letterSpacing: -0.5 },
  metricLabel: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17, marginTop: 4 },
  needRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  needCopy: { flex: 1 },
  needTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  needAmount: { fontFamily: "Inter_700Bold", fontSize: 18 },
  balanceText: { fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 17, marginTop: 10 },
  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 15 },
  choice: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  choiceText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 },
  currencyRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  currencyPill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8 },
  currencyText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  error: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 10, lineHeight: 18 },
  billRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10 },
  billInfo: { flex: 1 },
  rowTitle: { fontFamily: "Inter_500Medium", fontSize: 13 },
  billValue: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  removeButton: { width: 28, height: 30, alignItems: "center", justifyContent: "center" },
  splitRow: { flexDirection: "row", gap: 10 },
  splitInput: { flex: 1 },
  categoryRow: { marginBottom: 14 },
  categoryTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  categoryAmount: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  track: { height: 6, borderRadius: 4, overflow: "hidden" },
  fill: { height: 6, borderRadius: 4 },
  sectionMiniTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 7 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  historyInfo: { flex: 1 },
  historyAmount: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
});
