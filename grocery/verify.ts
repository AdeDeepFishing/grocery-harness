import type { Case, ListItem, Unit } from "./cases.js";
import type { Ledger } from "./agents.js";

// ─────────────────────────────────────────────
// The harness piece.
//
// None of these checks know the right answer. They only know the source text,
// so they would work on any meal plan, not just our test cases:
//   1. every quote is a real line (no invented ingredients)
//   2. every ingredient line in the plan is accounted for exactly once (nothing skipped)
//   3. the number claimed is the number in the quote
//   4. no ingredient appears twice
//   5. a pantry note that names the ingredient is not ignored
//   6. a pantry note with no amount in it counts as 0
// Then code, not the model, does the adding and subtracting.
// ─────────────────────────────────────────────

const singular = (word: string) =>
  word.endsWith("oes") ? word.slice(0, -2) : word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;

export const normName = (name: string) =>
  String(name).toLowerCase().trim().split(/\s+/).map(singular).join(" ");

const normLine = (line: string) => String(line).toLowerCase().replace(/^-\s*/, "").replace(/\s+/g, " ").trim();

const HAS_AMOUNT = /\d|dozen|half|quarter|third|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const UNITS = ["g", "ml", "pcs"];

export function verifyLedger(ledger: Ledger | null, c: Case): string[] {
  if (!ledger) return ["Your reply was not valid JSON in the requested shape."];
  const problems: string[] = [];

  const planCount = new Map<string, number>();
  for (const line of c.planLines) planCount.set(normLine(line), (planCount.get(normLine(line)) ?? 0) + 1);
  const pantry = new Map(c.pantryLines.map((line) => [normLine(line), line]));
  const pantryByName = new Map(c.pantryLines.map((line) => [normName(line.split(":")[0]), line]));

  const cited = new Map<string, number>();
  const seen = new Set<string>();

  for (const line of ledger.lines) {
    const name = normName(line.item);
    if (seen.has(name)) problems.push(`"${line.item}" appears on more than one line. Merge them.`);
    seen.add(name);
    if (!UNITS.includes(line.unit)) problems.push(`"${line.item}": unit "${line.unit}" is not g, ml or pcs.`);

    for (const use of line.uses ?? []) {
      const quote = normLine(use.quote);
      if (!planCount.has(quote)) {
        problems.push(`"${line.item}": the quote "${use.quote}" is not a line in the meal plan. Copy lines exactly.`);
        continue;
      }
      cited.set(quote, (cited.get(quote) ?? 0) + 1);
      const numbers = (quote.match(/\d+(\.\d+)?/g) ?? []).map(Number);
      if (!numbers.includes(Number(use.qty))) {
        problems.push(`"${line.item}": you wrote qty ${use.qty} for the line "${use.quote}", which says ${numbers.join(", ")}.`);
      }
    }

    const note = pantryByName.get(name);
    if (line.have) {
      if (!pantry.has(normLine(line.have.quote))) {
        problems.push(`"${line.item}": the pantry quote "${line.have.quote}" is not in the pantry notes. Copy it exactly.`);
      } else if (!HAS_AMOUNT.test(line.have.quote) && Number(line.have.qty) !== 0) {
        problems.push(`"${line.item}": the pantry note "${line.have.quote}" gives no usable amount, so stock must be 0, not ${line.have.qty}.`);
      }
      if (!(Number(line.have.qty) >= 0)) problems.push(`"${line.item}": stock qty must be a number, got ${line.have.qty}.`);
    } else if (note) {
      problems.push(`"${line.item}": you said the pantry does not mention it, but there is a note: "${note}".`);
    }
  }

  for (const [quote, count] of planCount) {
    const got = cited.get(quote) ?? 0;
    if (got < count) {
      problems.push(`The meal plan line "${quote}" appears ${count} time(s) but your ledger accounts for it ${got} time(s). Nothing may be skipped.`);
    } else if (got > count) {
      problems.push(`The meal plan line "${quote}" appears ${count} time(s) but your ledger uses it ${got} times. Do not count a line twice.`);
    }
  }
  return problems;
}

// The arithmetic the model is no longer trusted with.
export function listFromLedger(ledger: Ledger | null): ListItem[] {
  if (!ledger) return [];
  const list: ListItem[] = [];
  for (const line of ledger.lines) {
    const needed = (line.uses ?? []).reduce((sum, use) => sum + (Number(use.qty) || 0), 0);
    const buy = needed - (Number(line.have?.qty) || 0);
    if (buy > 0) list.push({ item: line.item, qty: buy, unit: line.unit as Unit });
  }
  return list;
}

// ── Scoring against the answer key (the eval, used only to measure) ──
export type Row = { item: string; unit: string; expected: number; got: number; ok: boolean };

export function score(expected: ListItem[], got: ListItem[]): { correct: boolean; rows: Row[] } {
  const want = new Map(expected.map((e) => [normName(e.item), e]));
  const have = new Map<string, ListItem>();
  for (const g of got) {
    const key = normName(g.item);
    const prev = have.get(key);
    have.set(key, prev ? { ...prev, qty: prev.qty + Number(g.qty) } : { ...g, qty: Number(g.qty) });
  }
  const rows: Row[] = [];
  for (const [key, e] of want) {
    const g = have.get(key);
    const qty = g?.qty ?? 0;
    rows.push({ item: e.item, unit: e.unit, expected: e.qty, got: qty, ok: qty === e.qty && (!g || g.unit === e.unit) });
  }
  for (const [key, g] of have) {
    if (!want.has(key)) rows.push({ item: g.item, unit: g.unit, expected: 0, got: g.qty, ok: false });
  }
  return { correct: rows.every((r) => r.ok), rows };
}
