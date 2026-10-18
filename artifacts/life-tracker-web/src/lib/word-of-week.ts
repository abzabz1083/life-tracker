export type WeeklyWord = {
  word: string;
  partOfSpeech: string;
  definition: string;
  sentence: string;
  conversation: readonly [string, string];
};

const WORDS: readonly WeeklyWord[] = [
  {
    word: "articulate",
    partOfSpeech: "verb",
    definition: "To express an idea clearly and effectively.",
    sentence: "She articulated her concerns before the team made a decision.",
    conversation: [
      "Could you explain why the deadline should change?",
      "Sure. Let me articulate the main reasons.",
    ],
  },
  {
    word: "nuanced",
    partOfSpeech: "adjective",
    definition: "Showing small but important differences or details.",
    sentence: "His review gave a nuanced view of the new plan.",
    conversation: [
      "Was the new policy simply good or bad?",
      "It was more nuanced than that; it helped some people but made things harder for others.",
    ],
  },
  {
    word: "deliberate",
    partOfSpeech: "adjective",
    definition: "Done intentionally and with careful thought.",
    sentence: "She made a deliberate choice to save before spending.",
    conversation: [
      "Did you choose that course by chance?",
      "No, it was a deliberate choice because it fits my goals.",
    ],
  },
  {
    word: "resilient",
    partOfSpeech: "adjective",
    definition: "Able to recover and keep going after difficulty.",
    sentence: "A resilient routine can survive an unexpectedly busy week.",
    conversation: [
      "How did you restart after missing a few workouts?",
      "I kept the plan simple and tried to be resilient rather than perfect.",
    ],
  },
  {
    word: "pragmatic",
    partOfSpeech: "adjective",
    definition: "Focused on what will work in real situations.",
    sentence: "They chose a pragmatic solution that fit the budget.",
    conversation: [
      "Should we rebuild the whole process?",
      "A pragmatic first step is to fix the part causing the delays.",
    ],
  },
  {
    word: "concise",
    partOfSpeech: "adjective",
    definition: "Brief but clear, with no unnecessary detail.",
    sentence: "Her concise update made the next steps easy to understand.",
    conversation: [
      "Can you summarize the meeting?",
      "Yes, I’ll keep it concise and focus on the decisions.",
    ],
  },
  {
    word: "plausible",
    partOfSpeech: "adjective",
    definition: "Reasonable or likely enough to be believed.",
    sentence: "That is a plausible explanation for the higher bill.",
    conversation: [
      "Do you think the delivery was late because of the weather?",
      "That’s plausible, but we should check the tracking update.",
    ],
  },
  {
    word: "resourceful",
    partOfSpeech: "adjective",
    definition: "Good at finding useful ways to solve problems.",
    sentence: "He was resourceful and made dinner with what was already in the kitchen.",
    conversation: [
      "How did you finish the project without the usual software?",
      "I found a resourceful workaround using the tools we had.",
    ],
  },
  {
    word: "prioritize",
    partOfSpeech: "verb",
    definition: "To decide which things are most important and do them first.",
    sentence: "She prioritizes sleep when planning her week.",
    conversation: [
      "There are too many things to finish today.",
      "Let’s prioritize the two that have the closest deadlines.",
    ],
  },
  {
    word: "sustainable",
    partOfSpeech: "adjective",
    definition: "Able to continue over time without causing harm or exhaustion.",
    sentence: "A sustainable meal plan should fit your everyday life.",
    conversation: [
      "Can you keep training six days a week?",
      "Not comfortably; three sessions feels more sustainable for me.",
    ],
  },
  {
    word: "clarify",
    partOfSpeech: "verb",
    definition: "To make something easier to understand.",
    sentence: "He asked one question to clarify the instructions.",
    conversation: [
      "I’m not sure which file you mean.",
      "Let me clarify: use the latest version in the shared folder.",
    ],
  },
  {
    word: "consistent",
    partOfSpeech: "adjective",
    definition: "Behaving or happening in a steady, reliable way.",
    sentence: "Consistent practice helped her remember the new vocabulary.",
    conversation: [
      "How did you build the habit?",
      "I kept the sessions short and consistent.",
    ],
  },
  {
    word: "perspective",
    partOfSpeech: "noun",
    definition: "A particular way of seeing or thinking about something.",
    sentence: "Talking to her colleague gave him a different perspective.",
    conversation: [
      "Why do you support that change?",
      "From my perspective, it saves time for the whole team.",
    ],
  },
  {
    word: "acknowledge",
    partOfSpeech: "verb",
    definition: "To recognize that something is true or exists.",
    sentence: "The report acknowledges that the estimate may be wrong.",
    conversation: [
      "Did the team notice the delay?",
      "Yes, they acknowledged it and shared a revised timeline.",
    ],
  },
  {
    word: "mitigate",
    partOfSpeech: "verb",
    definition: "To make a problem or its effects less severe.",
    sentence: "Setting aside a small buffer can mitigate surprise expenses.",
    conversation: [
      "How can we reduce the risk of running late?",
      "We can mitigate it by leaving extra time for the connection.",
    ],
  },
  {
    word: "anticipate",
    partOfSpeech: "verb",
    definition: "To expect something and prepare for it.",
    sentence: "They anticipated a busy month and planned their spending early.",
    conversation: [
      "Why did you book the appointment now?",
      "I anticipate the schedule will fill up soon.",
    ],
  },
  {
    word: "collaborate",
    partOfSpeech: "verb",
    definition: "To work together with someone toward a shared result.",
    sentence: "The designers and engineers collaborated on the new feature.",
    conversation: [
      "Who is handling the presentation?",
      "We’re going to collaborate and split the sections.",
    ],
  },
  {
    word: "candid",
    partOfSpeech: "adjective",
    definition: "Honest and direct, while remaining respectful.",
    sentence: "She gave candid feedback that helped improve the draft.",
    conversation: [
      "What did you think of my proposal?",
      "Can I be candid? The idea is strong, but the timeline needs work.",
    ],
  },
  {
    word: "efficient",
    partOfSpeech: "adjective",
    definition: "Achieving a result with little wasted time or effort.",
    sentence: "Preparing meals in batches is an efficient way to save time.",
    conversation: [
      "How can we make this meeting shorter?",
      "An efficient agenda would help us stay on topic.",
    ],
  },
  {
    word: "reflect",
    partOfSpeech: "verb",
    definition: "To think carefully about an experience or decision.",
    sentence: "He took a few minutes to reflect on what went well.",
    conversation: [
      "Are you changing your study plan?",
      "I want to reflect on this week before I decide.",
    ],
  },
  {
    word: "constructive",
    partOfSpeech: "adjective",
    definition: "Useful and intended to help something improve.",
    sentence: "The coach gave constructive advice about her technique.",
    conversation: [
      "How was the feedback?",
      "It was constructive; I know exactly what to improve next.",
    ],
  },
  {
    word: "advocate",
    partOfSpeech: "verb",
    definition: "To publicly support or recommend an idea or action.",
    sentence: "She advocates taking regular breaks during long work sessions.",
    conversation: [
      "Why did you suggest flexible hours?",
      "I advocate them because they help people do focused work.",
    ],
  },
  {
    word: "negotiate",
    partOfSpeech: "verb",
    definition: "To discuss something in order to reach an agreement.",
    sentence: "They negotiated a payment schedule that worked for both sides.",
    conversation: [
      "Can we change the delivery date?",
      "Let’s negotiate a date that works for both teams.",
    ],
  },
  {
    word: "feasible",
    partOfSpeech: "adjective",
    definition: "Possible to do successfully with the time and resources available.",
    sentence: "The team checked whether the proposal was feasible this quarter.",
    conversation: [
      "Could we finish the redesign by Friday?",
      "It’s feasible if we keep the first version small.",
    ],
  },
  {
    word: "empathetic",
    partOfSpeech: "adjective",
    definition: "Able to understand and consider how another person feels.",
    sentence: "An empathetic response can make a difficult conversation easier.",
    conversation: [
      "What should I say to someone who is stressed?",
      "Try an empathetic response: ask what would help them right now.",
    ],
  },
  {
    word: "versatile",
    partOfSpeech: "adjective",
    definition: "Useful in many different situations or for many purposes.",
    sentence: "A versatile jacket works for both travel and everyday wear.",
    conversation: [
      "Why did you choose this exercise?",
      "It’s versatile and works several muscle groups.",
    ],
  },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FIRST_MONDAY_UTC = Date.UTC(1970, 0, 5);

export function getWordOfWeek(date = new Date()): WeeklyWord {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const weekIndex = Math.floor((day - FIRST_MONDAY_UTC) / WEEK_MS);
  const index = ((weekIndex % WORDS.length) + WORDS.length) % WORDS.length;
  return WORDS[index];
}
