import { dhakaDay } from './shared.tsx';

export const kinds = {
  input: 'বীজ, সার ও উপকরণ', hired: 'ভাড়া করা শ্রম', own: 'নিজের শ্রম',
  family: 'পরিবারের শ্রম', land: 'জমি ও যন্ত্রপাতি', machine: 'যন্ত্র, পানি ও সেচ',
  transport: 'পরিবহন', interest: 'সুদ', other: 'অন্যান্য',
};
export const stages = { setup: 'এখন', season: 'চলতি মৌসুমে', harvest: 'ফসল তোলা ও পরিবহন' };
export const priceLabels = { farm: 'খামারদর', transport: 'পরিবহন', wholesale: 'পাইকারি দর', retail: 'খুচরা দর' };
export type ExpenseKind = keyof typeof kinds;
export type Stage = keyof typeof stages;
export type PriceKey = keyof typeof priceLabels;
export type BudgetKind = 'estimate' | 'actual';
export type Page = 'home' | 'start' | 'expenses' | 'income' | 'result' | 'compare' | 'saved';
export type Expense = { key: string; name: string; kind: ExpenseKind; stage: Stage; quantity: string; rate: string };
type ApiLine = Omit<Expense, 'key' | 'quantity' | 'rate'> & { quantity: number; rate: number };
export type Summary = {
  cash: number; economic: number; cash_surplus: number | null; profit: number | null;
  break_even: number | null; offer_profit: number | null; budget_left: number | null;
  phases: Record<Stage, number>; costs: Record<ExpenseKind, number>;
};
export type BudgetPayload = {
  available: number | null; sales: number | null; saleable_kg: number | null;
  offer: number | null; area_shatak: number | null; price_steps: Record<PriceKey, number | null>;
  lines: ApiLine[];
};
export type FarmBudgetRecord = BudgetPayload & {
  id: number; crop: string; season: string; kind: BudgetKind; plan_id?: number | null;
  planned_profit?: number | null; result: Summary;
};
export type Budget = {
  id?: number; planId?: number; plannedProfit?: number | null; kind: BudgetKind;
  mode: 'limit' | 'work'; crop: string; season: string; area: string; available: string;
  lines: Expense[]; kg: string; incomeMode: 'total' | 'unit'; sales: string; unit: string;
  offer: string; prices: Record<PriceKey, string>;
};
export const isLabor = (kind: ExpenseKind) => kind === 'own' || kind === 'family';
export const cleanNumber = (raw: string) => raw.replace(/[০-৯]/g, value => String('০১২৩৪৫৬৭৮৯'.indexOf(value))).replace(/[,\s]/g, '');
const limit = 100_000_000;
export function readNumber(raw: string): number | null {
  const clean = cleanNumber(raw);
  if (!clean) return null;
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(clean) || Number(clean) > limit) {
    throw new Error('শূন্য বা তার বেশি সঠিক সংখ্যা লিখুন। দশমিকের পরে দুই ঘর পর্যন্ত দেওয়া যাবে।');
  }
  return Number(clean);
}
export const filled = (value: number | null | undefined) => value == null ? '' : String(value);
export function moneyInPaisa(raw: number) {
  return Math.round(raw * 100);
}
export function amountForLine(quantity: number, rate: number) {
  const paisa = (BigInt(moneyInPaisa(quantity)) * BigInt(moneyInPaisa(rate)) + 50n) / 100n;
  return Number(paisa) / 100;
}

export function startBudget(mode: Budget['mode'], kind: BudgetKind = 'estimate', area?: number): Budget {
  return {
    mode, kind, crop: '', season: '', area: filled(area ? Number(area.toFixed(2)) : undefined),
    available: '', kg: '', sales: '', unit: '', incomeMode: kind === 'actual' ? 'total' : 'unit',
    offer: '', prices: { farm: '', transport: '', wholesale: '', retail: '' }, lines: [],
  };
}
export const seasonHint = () => 'যেমন রবি ' + dhakaDay().slice(0, 4);
export function fromRecord(row: FarmBudgetRecord): Budget {
  return {
    ...startBudget(row.available == null ? 'work' : 'limit', row.kind),
    id: row.id, planId: row.plan_id ?? undefined, plannedProfit: row.planned_profit,
    crop: row.crop, season: row.season, area: filled(row.area_shatak), available: filled(row.available),
    lines: row.lines.map((line, index) => ({ ...line, key: 'saved-' + index, quantity: filled(line.quantity), rate: filled(line.rate) })),
    kg: filled(row.saleable_kg), incomeMode: 'total', sales: filled(row.sales), offer: filled(row.offer),
    prices: { farm: filled(row.price_steps?.farm), transport: filled(row.price_steps?.transport),
      wholesale: filled(row.price_steps?.wholesale), retail: filled(row.price_steps?.retail) },
  };
}

export function salesFor(budget: Budget): number | null {
  if (budget.incomeMode === 'total') return readNumber(budget.sales);
  const quantity = readNumber(budget.kg);
  const rate = readNumber(budget.unit);
  if (quantity == null || rate == null) return null;
  const amount = amountForLine(quantity, rate);
  if (amount > limit) throw new Error('মোট বিক্রির টাকা ১০ কোটির মধ্যে লিখুন।');
  return amount;
}
export function toPayload(budget: Budget): BudgetPayload {
  return {
    available: readNumber(budget.available), sales: salesFor(budget), saleable_kg: readNumber(budget.kg),
    offer: readNumber(budget.offer), area_shatak: readNumber(budget.area),
    price_steps: {
      farm: readNumber(budget.prices.farm), transport: readNumber(budget.prices.transport),
      wholesale: readNumber(budget.prices.wholesale), retail: readNumber(budget.prices.retail),
    },
    lines: budget.lines.map(line => ({
      name: line.name.trim(), kind: line.kind, stage: line.stage,
      quantity: Number(cleanNumber(line.quantity)), rate: Number(cleanNumber(line.rate)),
    })),
  };
}

export function costsFor(lines: Expense[]) {
  let cash = 0;
  let labor = 0;
  for (const line of lines) {
    const amount = amountForLine(Number(cleanNumber(line.quantity)), Number(cleanNumber(line.rate)));
    if (isLabor(line.kind)) labor += moneyInPaisa(amount);
    else cash += moneyInPaisa(amount);
  }
  return { cash: cash / 100, labor: labor / 100, total: (cash + labor) / 100 };
}

type Draft = { budget: Budget; page: 'start' | 'expenses' | 'income' };
export function readDraft(key: string): Draft | undefined {
  if (!key) return;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const draft = JSON.parse(raw) as Draft;
      if (['start', 'expenses', 'income'].includes(draft.page) && Array.isArray(draft.budget.lines)) return draft;
    }
  } catch {
    // Browsers can disable storage or discard a saved draft.
  }
}
export function writeDraft(key: string, draft?: Draft): boolean {
  if (!key) return false;
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
