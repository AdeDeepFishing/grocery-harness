import OpenAI from "openai";
import "dotenv/config";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Case, ListItem } from "./cases.js";

// Any OpenAI-compatible endpoint. Tonight: ai& (https://api.aiand.com/v1).
const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1",
  apiKey: process.env.LLM_API_KEY ?? process.env.OPENROUTER_API_KEY,
});

export const MODEL = process.env.MODEL ?? "google/gemma-4-31b-it";

type Messages = ChatCompletionMessageParam[];

async function ask(messages: Messages): Promise<string> {
  const response = await client.chat.completions.create({ model: MODEL, messages, max_tokens: 20000 });
  const reply = response.choices[0].message.content ?? "";
  messages.push({ role: "assistant", content: reply });
  return reply;
}

export function parseJson(reply: string): any {
  const fenced = reply.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  const text = fenced ? fenced[1] : reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
  return JSON.parse(text);
}

// The same rules go to both agents, so the only difference is the harness.
const RULES = `
Rules:
- Units are only g, ml or pcs. Convert pantry notes to these (1 kg = 1000 g, 1 L = 1000 ml, a dozen = 12).
- The same ingredient can appear in several meals: add them all up.
- Subtract what is already in the pantry. If the pantry covers it, do not buy it.
- If a pantry note gives no usable amount ("almost out", "some", "a little"), count it as 0 in stock.
- Name each ingredient as the meal plan does, lowercase and singular ("egg", "chicken thigh").
`.trim();

const material = (c: Case) => `MEAL PLAN\n${c.mealPlan}\n\nPANTRY NOTES\n${c.pantry}`;

// ── Bare model: one call, "here is your list" ───────────────────────
export async function bareList(c: Case): Promise<{ list: ListItem[]; confident: boolean; note: string }> {
  const messages: Messages = [
    {
      role: "user",
      content:
        `Make my grocery list for this week from the meal plan and pantry notes.\n\n${RULES}\n\n${material(c)}\n\n` +
        `Reply with JSON only: {"list":[{"item":"egg","qty":6,"unit":"pcs"}]}`,
    },
  ];
  let list: ListItem[] = [];
  try {
    list = parseJson(await ask(messages)).list ?? [];
  } catch {
    // unparseable output counts as an empty list
  }

  // "Are you done?" — the question every agent answers yes to.
  messages.push({
    role: "user",
    content:
      `Before I go shopping: is this list completely correct, every item and every quantity? ` +
      `Reply with JSON only: {"confident": true or false, "note": "one short sentence"}`,
  });
  let confident = true;
  let note = "";
  try {
    const selfReport = parseJson(await ask(messages));
    confident = selfReport.confident !== false;
    note = String(selfReport.note ?? "");
  } catch {
    note = "(no parseable self-report)";
  }
  return { list, confident, note };
}

// ── Harnessed model: it only READS. It fills in a ledger and cites its sources. ──
export type Ledger = {
  lines: {
    item: string;
    unit: string;
    uses: { quote: string; qty: number }[];
    have: { quote: string; qty: number } | null;
  }[];
};

export function startLedger(c: Case): Messages {
  return [
    {
      role: "user",
      content:
        `I need a ledger of every ingredient in this week's meal plan. Do NOT work out what to buy: ` +
        `I will do the arithmetic myself. Your job is only to read carefully and cite your sources.\n\n${RULES}\n\n` +
        `For each ingredient give one line:\n` +
        `- "uses": one entry per ingredient line in the meal plan that uses it. "quote" is that line copied exactly (without the leading "- "), "qty" is the number in it.\n` +
        `- "have": the pantry note for this ingredient. "quote" is the note copied exactly, "qty" is the amount in stock converted to the line's unit. Use null if the pantry does not mention it.\n\n` +
        `${material(c)}\n\n` +
        `Reply with JSON only:\n` +
        `{"lines":[{"item":"egg","unit":"pcs","uses":[{"quote":"4 eggs","qty":4}],"have":{"quote":"eggs: half a dozen","qty":6}}]}`,
    },
  ];
}

export async function writeLedger(messages: Messages): Promise<Ledger | null> {
  try {
    const parsed = parseJson(await ask(messages));
    if (!Array.isArray(parsed.lines)) return null;
    // Models write "no pantry note" three ways: null, {quote: null}, {quote: ""}. Treat them the same.
    for (const line of parsed.lines) if (!line.have || !line.have.quote || line.have.quote === "null") line.have = null;
    return parsed as Ledger;
  } catch {
    return null;
  }
}

export function feedback(problems: string[]): ChatCompletionMessageParam {
  return {
    role: "user",
    content:
      `I checked your ledger against the meal plan and pantry notes. ${problems.length} problem(s):\n\n` +
      problems.map((p) => `- ${p}`).join("\n") +
      `\n\nFix these and reply with the complete corrected ledger as JSON only.`,
  };
}
