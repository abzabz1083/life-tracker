import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  Check,
  Clock3,
  History,
  Heart,
  LoaderCircle,
  LogOut,
  Settings2,
  Sparkles,
  Shuffle,
  Wallet,
} from "lucide-react";
import {
  useGetLifeReminderSettings,
  useSendLifeTelegramTest,
  useSyncLifeReminderSnapshot,
  useUpdateLifeReminderSettings,
} from "@workspace/api-client-react";
import { dateKey, type Currency, type LifeData, type Settings } from "@/lib/life-data";
import { getRandomWord, getSelectedWeeklyWord, getWordOfWeek, type WeeklyWord } from "@/lib/word-of-week";
import HistoryTab from "@/components/HistoryTab";
import "./settings-dashboard.css";

type Props = {
  data: LifeData;
  update: <K extends keyof LifeData>(key: K, value: LifeData[K]) => void;
  onSignOut: () => Promise<void>;
};

const currencies: Currency[] = ["GBP", "USD", "AED", "EUR"];
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

export function SettingsDashboard({ data, update, onSignOut }: Props) {
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
  const [accessError, setAccessError] = useState("");
  const [weeklyWordDraft, setWeeklyWordDraft] = useState<WeeklyWord>(() => {
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    const week = dateKey(monday);
    return data.weeklyWordSelection?.week === week
      ? getSelectedWeeklyWord(data.weeklyWordSelection, today)
      : getWordOfWeek(today);
  });
  const [weeklyWordError, setWeeklyWordError] = useState("");

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

  const lockTracker = async () => {
    setAccessError("");
    try {
      await onSignOut();
    } catch {
      setAccessError("The tracker could not be locked. Check your connection and try again.");
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
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const weeklyWordWeek = dateKey(monday);
  const selectedWeeklyWord =
    data.weeklyWordSelection?.week === weeklyWordWeek
      ? getSelectedWeeklyWord(data.weeklyWordSelection, today)
      : getWordOfWeek(today);
  const weeklyWord = weeklyWordDraft;

  useEffect(() => {
    setWeeklyWordDraft(selectedWeeklyWord);
    setWeeklyWordError("");
  }, [
    weeklyWordWeek,
    data.weeklyWordSelection?.week,
    data.weeklyWordSelection?.word,
    data.weeklyWordSelection?.partOfSpeech,
    data.weeklyWordSelection?.definition,
    data.weeklyWordSelection?.sentence,
    data.weeklyWordSelection?.conversation?.[0],
    data.weeklyWordSelection?.conversation?.[1],
  ]);

  const saveWeeklyWord = () => {
    const word = weeklyWordDraft.word.trim();
    const definition = weeklyWordDraft.definition.trim();
    const sentence = weeklyWordDraft.sentence.trim();
    const firstLine = weeklyWordDraft.conversation[0].trim();
    const secondLine = weeklyWordDraft.conversation[1].trim();
    if (!word || !definition || !sentence || !firstLine || !secondLine) {
      setWeeklyWordError("Add the word, definition, sentence and both conversation lines.");
      return;
    }
    const savedWord: WeeklyWord = {
      word,
      partOfSpeech: weeklyWordDraft.partOfSpeech.trim() || "word",
      definition,
      sentence,
      conversation: [firstLine, secondLine],
    };
    setWeeklyWordDraft(savedWord);
    setWeeklyWordError("");
    update("weeklyWordSelection", {
      week: weeklyWordWeek,
      ...savedWord,
      conversation: [savedWord.conversation[0], savedWord.conversation[1]],
    });
  };

  const randomizeWeeklyWord = () => {
    const nextWord = getRandomWord(weeklyWordDraft.word);
    setWeeklyWordDraft(nextWord);
    setWeeklyWordError("");
    update("weeklyWordSelection", {
      week: weeklyWordWeek,
      ...nextWord,
      conversation: [nextWord.conversation[0], nextWord.conversation[1]],
    });
  };

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
          {data.weeklyReviews.length + data.dailySummaries.length + data.savedWords.length > 0 && (
            <span className="settings-history-count" data-testid="settings-history-review-badge">
              {data.weeklyReviews.length + data.dailySummaries.length + data.savedWords.length}
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

        <section className="settings-card settings-words-card" data-testid="settings-saved-words">
          <div className="settings-card-heading">
            <span><BookOpen size={18} /></span>
            <div><h2>Words</h2><p>Keep useful vocabulary and revisit the complete examples.</p></div>
          </div>
          <div className="settings-weekly-word" data-testid="settings-weekly-word">
            <div className="settings-weekly-word-copy">
              <span className="settings-week-label">WEEK OF {weeklyWordWeek}</span>
              <h3>{weeklyWord.word} <small>{weeklyWord.partOfSpeech}</small></h3>
              <p>{weeklyWord.definition}</p>
              <span className="settings-weekly-word-note">Type any word and add its meaning and examples. It stays for the week once saved.</span>
            </div>
            <div className="settings-weekly-word-actions">
              <label className="settings-field settings-weekly-field">
                <span>Word for this week</span>
                <input
                  data-testid="weekly-word-input"
                  value={weeklyWordDraft.word}
                  onChange={(event) => setWeeklyWordDraft((current) => ({ ...current, word: event.target.value }))}
                  placeholder="Type any word"
                />
              </label>
              <label className="settings-field settings-weekly-field">
                <span>Part of speech</span>
                <input
                  data-testid="weekly-word-part-of-speech"
                  value={weeklyWordDraft.partOfSpeech}
                  onChange={(event) => setWeeklyWordDraft((current) => ({ ...current, partOfSpeech: event.target.value }))}
                  placeholder="Noun, verb, adjective…"
                />
              </label>
              <label className="settings-field settings-weekly-field settings-weekly-field-wide">
                <span>Definition</span>
                <textarea
                  data-testid="weekly-word-definition"
                  value={weeklyWordDraft.definition}
                  onChange={(event) => setWeeklyWordDraft((current) => ({ ...current, definition: event.target.value }))}
                  placeholder="What does the word mean?"
                  rows={2}
                />
              </label>
              <label className="settings-field settings-weekly-field settings-weekly-field-wide">
                <span>Example sentence</span>
                <textarea
                  data-testid="weekly-word-sentence"
                  value={weeklyWordDraft.sentence}
                  onChange={(event) => setWeeklyWordDraft((current) => ({ ...current, sentence: event.target.value }))}
                  placeholder="Use the word in a sentence."
                  rows={2}
                />
              </label>
              <label className="settings-field settings-weekly-field">
                <span>Conversation · A</span>
                <textarea
                  data-testid="weekly-word-conversation-a"
                  value={weeklyWordDraft.conversation[0]}
                  onChange={(event) => setWeeklyWordDraft((current) => ({ ...current, conversation: [event.target.value, current.conversation[1]] }))}
                  placeholder="First line"
                  rows={2}
                />
              </label>
              <label className="settings-field settings-weekly-field">
                <span>Conversation · B</span>
                <textarea
                  data-testid="weekly-word-conversation-b"
                  value={weeklyWordDraft.conversation[1]}
                  onChange={(event) => setWeeklyWordDraft((current) => ({ ...current, conversation: [current.conversation[0], event.target.value] }))}
                  placeholder="Reply using the word"
                  rows={2}
                />
              </label>
              <div className="settings-weekly-word-buttons">
              <button
                className="settings-word-random"
                type="button"
                data-testid="random-weekly-word"
                onClick={randomizeWeeklyWord}
              >
                <Shuffle size={15} /> Random word
              </button>
                <button
                  className="settings-word-save"
                  type="button"
                  data-testid="save-weekly-word"
                  onClick={saveWeeklyWord}
                >
                  <Check size={15} /> Save word
                </button>
              </div>
              {weeklyWordError && <p className="settings-error settings-weekly-word-error" role="alert" data-testid="weekly-word-error">{weeklyWordError}</p>}
            </div>
          </div>
          {data.savedWords.length ? <div className="settings-word-list">{[...data.savedWords].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((word) => (
            <article className="settings-word-entry" key={word.id} data-testid={`settings-word-${word.id}`}>
              <div><h3>{word.word} <small>{word.partOfSpeech}</small></h3><p>{word.definition}</p><blockquote>“{word.sentence}”</blockquote><small>A · {word.conversation[0]}<br/>B · {word.conversation[1]}</small><time dateTime={word.savedAt}>Saved {Number.isFinite(new Date(word.savedAt).getTime()) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(word.savedAt)) : "date not recorded"}</time></div>
              <button className="settings-word-remove" type="button" data-testid={`remove-saved-word-${word.id}`} aria-label={`Remove ${word.word} from saved words`} onClick={() => { if (window.confirm(`Remove “${word.word}” from your saved words?`)) update("savedWords", data.savedWords.filter((item) => item.id !== word.id)); }}>Remove</button>
            </article>
          ))}</div> : <div className="settings-words-empty" data-testid="settings-words-empty"><strong>No words saved yet.</strong><p>Save the Word of the Week on Today to build a personal vocabulary collection.</p></div>}
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
          <label className="settings-field">
            <span>Daily carbohydrates target (g)</span>
            <input
              data-testid="setting-carbs-target"
              type="number"
              min="0"
              value={data.settings.carbsTarget || ""}
              onChange={(event) => change("carbsTarget", Number(event.target.value) || 0)}
              placeholder="Set a target"
            />
          </label>
          <label className="settings-field">
            <span>Daily fat target (g)</span>
            <input
              data-testid="setting-fat-target"
              type="number"
              min="0"
              value={data.settings.fatTarget || ""}
              onChange={(event) => change("fatTarget", Number(event.target.value) || 0)}
              placeholder="Set a target"
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

        <section className="settings-card">
          <div className="settings-card-heading">
            <span><Sparkles size={18} /></span>
            <div><h2>Nutrition AI</h2><p>Choose which assistant reads package labels and plans meals.</p></div>
          </div>
          <div className="settings-ai-choice">
            <div>
              <strong>Claude</strong>
              <p>When enabled, your package photos and meal requests use Claude through Replit AI. Your Claude.ai subscription is not linked; usage is billed to Replit credits, and no personal API key is needed.</p>
            </div>
            <button
              className={data.settings.nutritionAiProvider === "anthropic" ? "settings-ai-toggle is-enabled" : "settings-ai-toggle"}
              type="button"
              data-testid="setting-claude-ai"
              aria-pressed={data.settings.nutritionAiProvider === "anthropic"}
              onClick={() => change("nutritionAiProvider", data.settings.nutritionAiProvider === "anthropic" ? "openai" : "anthropic")}
            >
              {data.settings.nutritionAiProvider === "anthropic" ? "Claude on" : "Use Claude"}
            </button>
          </div>
          <p className="settings-helper">USDA FoodData Central and Open Food Facts are searched first. If they have no match or are unavailable, Claude can estimate common foods; estimates are labeled and are not verified against your packet.</p>
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
            <div><h2>Passcode access</h2><p>Your main tracker records remain on this device.</p></div>
          </div>
          <p className="settings-helper">Package photos and workout images stay in this browser. Voice recordings are sent for transcription, then their transcripts go to Claude to identify the requested action. Food names go to Claude only when you request an estimate or the public database has no match. Label photos are sent for reading only when you request it.</p>
          <button
            className="settings-secondary-button"
            type="button"
            onClick={() => void lockTracker()}
          >
            <LogOut size={15} /> Lock tracker
          </button>
          {accessError && <p className="settings-error" role="alert">{accessError}</p>}
        </section>
      </div>
    </div>
  );
}
