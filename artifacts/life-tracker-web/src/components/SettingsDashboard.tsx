import { useEffect, useState } from "react";
import {
  Activity,
  Check,
  Clock3,
  History,
  Heart,
  LoaderCircle,
  LogOut,
  Settings2,
  Wallet,
} from "lucide-react";
import { useClerk } from "@clerk/react";
import {
  useGetLifeReminderSettings,
  useSendLifeTelegramTest,
  useSyncLifeReminderSnapshot,
  useUpdateLifeReminderSettings,
} from "@workspace/api-client-react";
import type { Currency, LifeData, Settings } from "@/lib/life-data";
import HistoryTab from "@/components/HistoryTab";
import "./settings-dashboard.css";

type Props = {
  data: LifeData;
  update: <K extends keyof LifeData>(key: K, value: LifeData[K]) => void;
};

const currencies: Currency[] = ["GBP", "USD", "AED", "EUR"];
const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function exchangeRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${from}/${to}`);
  if (!response.ok) throw new Error(`Currency conversion from ${from} to ${to} is unavailable.`);
  const result = (await response.json()) as { rate?: number };
  if (typeof result.rate !== "number" || !Number.isFinite(result.rate)) {
    throw new Error(`No ${from} to ${to} exchange rate was returned.`);
  }
  return result.rate;
}

export function SettingsDashboard({ data, update }: Props) {
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<"preferences" | "history">("preferences");
  const reminderQuery = useGetLifeReminderSettings();
  const saveReminder = useUpdateLifeReminderSettings();
  const testTelegram = useSendLifeTelegramTest();
  const syncReminderItems = useSyncLifeReminderSnapshot();
  const [reminder, setReminder] = useState({
    chatId: "",
    time: "09:00",
    timezone: "Asia/Dubai",
    enabled: false,
    tokenConfigured: false,
  });
  const [botToken, setBotToken] = useState("");
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const [currencyError, setCurrencyError] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderError, setReminderError] = useState("");

  useEffect(() => {
    if (reminderQuery.data) {
      setReminder(reminderQuery.data);
    }
  }, [reminderQuery.data]);

  const change = (key: keyof Settings, value: string | number) =>
    update("settings", { ...data.settings, [key]: value } as Settings);

  const changeCurrency = async (next: Currency) => {
    const previous = data.settings.baseCurrency;
    if (next === previous) return;
    setCurrencyBusy(true);
    setCurrencyError("");
    try {
      const rate = await exchangeRate(previous, next);
      const revalue = (value: number) => Math.round(value * rate * 100) / 100;
      update(
        "money",
        data.money.map((entry) => ({ ...entry, baseAmount: revalue(entry.baseAmount) })),
      );
      update(
        "bills",
        data.bills.map((bill) => ({ ...bill, baseAmount: revalue(bill.baseAmount) })),
      );
      update("settings", {
        ...data.settings,
        baseCurrency: next,
        monthlyIncomeTarget: revalue(data.settings.monthlyIncomeTarget),
        monthlySpendingBudget: revalue(data.settings.monthlySpendingBudget),
      });
    } catch (error) {
      setCurrencyError(
        error instanceof Error
          ? `${error.message} Your settings and records were not changed.`
          : "Currency could not be changed. Your records were not changed.",
      );
    } finally {
      setCurrencyBusy(false);
    }
  };

  const save = async () => {
    setReminderError("");
    setReminderMessage("");
    let saved: typeof reminder;
    try {
      saved = await saveReminder.mutateAsync({
        data: {
          chatId: reminder.chatId.trim(),
          time: reminder.time,
          timezone: reminder.timezone.trim(),
          enabled: reminder.enabled,
          ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
        },
      });
    } catch (error) {
      setReminderError(
        error instanceof Error ? error.message : "Reminder settings could not be saved.",
      );
      return;
    }
    setReminder(saved);
    setBotToken("");
    try {
      await syncReminderItems.mutateAsync({
        data: {
          tasks: data.tasks.map(({ id, title, done, date }) => ({ id, title, done, date })),
          modules: data.modules.map(({ id, title, category, moduleNumber, done }) => ({
            id,
            title,
            category,
            moduleNumber,
            done: Boolean(done),
          })),
        },
      });
      setReminderMessage("Reminder settings saved securely.");
    } catch (error) {
      setReminderError(
        `Reminder settings were saved, but today's tasks and modules did not sync: ${
          error instanceof Error ? error.message : "please try saving again."
        }`,
      );
    }
  };

  const sendTest = async () => {
    setReminderError("");
    setReminderMessage("");
    try {
      const result = await testTelegram.mutateAsync({ data: {} });
      if (result.sent) setReminderMessage("Test message sent to Telegram.");
      else setReminderError(result.error || "Telegram could not send the test message.");
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "Telegram test failed.");
    }
  };

  const removeSavedToken = async () => {
    setReminderError("");
    setReminderMessage("");
    try {
      const saved = await saveReminder.mutateAsync({
        data: {
          chatId: reminder.chatId,
          time: reminder.time,
          timezone: reminder.timezone,
          enabled: false,
          botToken: null,
        },
      });
      setReminder(saved);
      setBotToken("");
      setReminderMessage("Saved bot token removed. Background reminders are disabled.");
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "The saved token could not be removed.");
    }
  };

  const reminderCanSave =
    reminder.chatId.trim().length > 0 &&
    reminder.timezone.trim().length > 0 &&
    (!reminder.enabled || reminder.tokenConfigured || botToken.trim().length >= 10);

  return (
    <div className="settings-dashboard">
      <header className="settings-dashboard-heading">
        <p className="eyebrow">PERSONAL PREFERENCES</p>
        <h1 className="serif">Make it yours.</h1>
        <p>Choose your preferences or look back at what you have tracked.</p>
      </header>

      <div className="settings-section-tabs" role="tablist" aria-label="Settings sections">
        <button
          className="settings-section-tab"
          id="settings-tab-preferences"
          data-testid="settings-tab-preferences"
          type="button"
          role="tab"
          aria-selected={activeTab === "preferences"}
          aria-controls="settings-panel-preferences"
          onClick={() => setActiveTab("preferences")}
        >
          <Settings2 size={15} /> Preferences
        </button>
        <button
          className="settings-section-tab"
          id="settings-tab-history"
          data-testid="settings-tab-history"
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          aria-controls="settings-panel-history"
          onClick={() => setActiveTab("history")}
        >
          <History size={15} /> History
          {data.weeklyReviews.length > 0 && (
            <span className="settings-history-count" data-testid="settings-history-review-badge">
              {data.weeklyReviews.length}
            </span>
          )}
        </button>
      </div>

      <div
        className="settings-history-panel"
        id="settings-panel-history"
        role="tabpanel"
        aria-labelledby="settings-tab-history"
        data-testid="settings-panel-history"
        hidden={activeTab !== "history"}
      >
        <HistoryTab data={data} />
      </div>
      <div
        className="settings-dashboard-grid"
        id="settings-panel-preferences"
        role="tabpanel"
        aria-labelledby="settings-tab-preferences"
        data-testid="settings-panel-preferences"
        hidden={activeTab !== "preferences"}
      >
        <section className="settings-card">
          <div className="settings-card-heading">
            <span><Wallet size={18} /></span>
            <div><h2>Money preferences</h2><p>Keep your plan in one base currency.</p></div>
          </div>
          <label className="settings-field">
            <span>Main currency</span>
            <select
              data-testid="setting-currency"
              value={data.settings.baseCurrency}
              disabled={currencyBusy}
              onChange={(event) => void changeCurrency(event.target.value as Currency)}
            >
              {currencies.map((currency) => <option key={currency}>{currency}</option>)}
            </select>
          </label>
          <p className="settings-helper">Existing totals are revalued at the current exchange rate when you change this.</p>
          <label className="settings-field">
            <span>Monthly income target ({data.settings.baseCurrency})</span>
            <input
              data-testid="setting-income-target"
              type="number"
              min="0"
              value={data.settings.monthlyIncomeTarget || ""}
              onChange={(event) => change("monthlyIncomeTarget", Number(event.target.value) || 0)}
              placeholder="Set a monthly target"
            />
          </label>
          <label className="settings-field">
            <span>Monthly spending budget ({data.settings.baseCurrency})</span>
            <input
              data-testid="setting-spending-budget"
              type="number"
              min="0"
              value={data.settings.monthlySpendingBudget || ""}
              onChange={(event) => change("monthlySpendingBudget", Number(event.target.value) || 0)}
              placeholder="Set a comfortable limit"
            />
          </label>
          {currencyError && <p className="settings-error" role="alert">{currencyError}</p>}
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <span><Heart size={18} /></span>
            <div><h2>Nutrition targets</h2><p>Used in your daily food totals and meal helper.</p></div>
          </div>
          <label className="settings-field">
            <span>Daily calorie target</span>
            <input
              data-testid="setting-calorie-target"
              type="number"
              min="0"
              value={data.settings.calorieTarget}
              onChange={(event) => change("calorieTarget", Number(event.target.value) || 0)}
            />
          </label>
          <label className="settings-field">
            <span>Daily protein target (g)</span>
            <input
              data-testid="setting-protein-target"
              type="number"
              min="0"
              value={data.settings.proteinTarget}
              onChange={(event) => change("proteinTarget", Number(event.target.value) || 0)}
            />
          </label>
          <div className="settings-field-pair">
            <label className="settings-field">
              <span>Default meal time</span>
              <input
                type="time"
                value={data.settings.mealPrompt}
                onChange={(event) => change("mealPrompt", event.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>Default workout finish</span>
              <input
                type="time"
                value={data.settings.workoutPrompt}
                onChange={(event) => change("workoutPrompt", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="settings-card settings-reminder-card">
          <div className="settings-card-heading">
            <span><Activity size={18} /></span>
            <div><h2>Daily Telegram reminders</h2><p>Messages only cover unchecked daily tasks and unfinished modules.</p></div>
          </div>
          <div className="settings-reminder-callout">
            <Clock3 size={16} />
            <p>Scheduled for 9:00 AM Asia/Dubai by default. It can send while the app is closed. Meals and gym activity are not sent to Telegram.</p>
          </div>
          <label className="settings-field">
            <span>Telegram chat ID</span>
            <input
              data-testid="telegram-chat-id"
              value={reminder.chatId}
              onChange={(event) => setReminder((current) => ({ ...current, chatId: event.target.value }))}
              placeholder="Your private or group chat ID"
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>Bot API token</span>
            <input
              data-testid="telegram-token"
              type="password"
              value={botToken}
              onChange={(event) => setBotToken(event.target.value)}
              placeholder={reminder.tokenConfigured ? "Saved encrypted — leave blank to keep it" : "Paste your bot token"}
              autoComplete="new-password"
            />
            {reminder.tokenConfigured && !botToken && (
              <small className="settings-token-state">A token is saved encrypted for background delivery.</small>
            )}
          </label>
          <div className="settings-field-pair">
            <label className="settings-field">
              <span>Send time</span>
              <input
                data-testid="telegram-time"
                type="time"
                value={reminder.time}
                onChange={(event) => setReminder((current) => ({ ...current, time: event.target.value }))}
              />
            </label>
            <label className="settings-field">
              <span>Timezone</span>
              <input
                data-testid="telegram-timezone"
                value={reminder.timezone}
                onChange={(event) => setReminder((current) => ({ ...current, timezone: event.target.value }))}
                placeholder="Asia/Dubai"
              />
            </label>
          </div>
          <label className="settings-switch">
            <input
              data-testid="telegram-enabled"
              type="checkbox"
              checked={reminder.enabled}
              onChange={(event) => setReminder((current) => ({ ...current, enabled: event.target.checked }))}
            />
            <span className="settings-switch-track" aria-hidden="true" />
            <span><b>Enable background reminders</b><small>Only sends when something is still unchecked.</small></span>
          </label>
          <div className="settings-button-row">
            <button
              className="settings-primary-button"
              data-testid="save-telegram-settings"
              type="button"
              onClick={() => void save()}
              disabled={!reminderCanSave || saveReminder.isPending || reminderQuery.isLoading}
            >
              {saveReminder.isPending ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
              Save reminder settings
            </button>
            <button
              className="settings-secondary-button"
              data-testid="test-telegram"
              type="button"
              onClick={() => void sendTest()}
              disabled={!reminder.tokenConfigured || testTelegram.isPending}
            >
              {testTelegram.isPending ? <LoaderCircle size={15} className="spin" /> : null}
              Send test
            </button>
          </div>
          {reminder.tokenConfigured && (
            <button
              className="settings-remove-token"
              type="button"
              onClick={() => void removeSavedToken()}
              disabled={saveReminder.isPending}
            >
              Remove saved token and disable reminders
            </button>
          )}
          {reminderQuery.isLoading && <p className="settings-helper">Loading protected reminder settings…</p>}
          {reminderMessage && <p className="settings-success" role="status">{reminderMessage}</p>}
          {reminderError && <p className="settings-error" role="alert">{reminderError}</p>}
          <p className="settings-privacy">
            Only your Telegram settings and the pending task/module checklist are stored on the server. Your finances, meals, workouts, notes, and photos stay in this browser.
          </p>
        </section>

        <section className="settings-card settings-account-card">
          <div className="settings-card-heading">
            <span><Settings2 size={18} /></span>
            <div><h2>Account and local data</h2><p>Your main tracker records remain on this device.</p></div>
          </div>
          <p className="settings-helper">Package photos and workout images are stored in this browser. Food-label photos are sent for transcription only when you request it, then remain local.</p>
          <button
            className="settings-secondary-button"
            type="button"
            onClick={() => void signOut({ redirectUrl: appBasePath || "/" })}
          >
            <LogOut size={15} /> Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
