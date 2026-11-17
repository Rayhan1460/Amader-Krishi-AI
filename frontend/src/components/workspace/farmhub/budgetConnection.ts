import { useEffect, useState } from 'react';
import { isAxiosError, type AxiosResponse } from 'axios';
import { api, getErrorMessage } from '../../../services/api.ts';
import { kinds, stages, type BudgetPayload, type FarmBudgetRecord, type Summary } from './budgetModel.ts';

type Inputs = Pick<BudgetPayload, 'available' | 'sales' | 'saleable_kg' | 'offer' | 'lines'>;
type Decimal = { value: bigint; scale: bigint };

function decimal(value: number): Decimal {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const [integer, fraction = ''] = mantissa.split('.');
  const places = fraction.length - Number(exponent);
  const digits = BigInt(integer + fraction);
  return places > 0 ? { value: digits, scale: 10n ** BigInt(places) } :
    { value: digits * 10n ** BigInt(-places), scale: 1n };
}

function round(numerator: bigint, denominator: bigint): bigint {
  return numerator < 0n ? -round(-numerator, denominator) : (numerator * 2n + denominator) / (denominator * 2n);
}

function cents(value: number): bigint {
  const a = decimal(value);
  return round(a.value * 100n, a.scale);
}

function product(a: Decimal, b: Decimal): Decimal {
  return { value: a.value * b.value, scale: a.scale * b.scale };
}

// The server's calculation rounds each expense to paisa before summing.
export function calculateLocally(data: Inputs): Summary {
  const resultPhases = {} as Summary['phases'];
  const resultCosts = {} as Summary['costs'];
  const cashByStage = new Map(Object.keys(stages).map(key => [key, 0n]));
  const costByKind = new Map(Object.keys(kinds).map(key => [key, 0n]));
  let cash = 0n;
  let total = 0n;
  for (const line of data.lines) {
    const value = product(decimal(line.quantity), decimal(line.rate));
    const amount = round(value.value * 100n, value.scale);
    costByKind.set(line.kind, (costByKind.get(line.kind) ?? 0n) + amount);
    total += amount;
    if (line.kind !== 'own' && line.kind !== 'family') {
      cash += amount;
      cashByStage.set(line.stage, (cashByStage.get(line.stage) ?? 0n) + amount);
    }
  }
  const asTaka = (value: bigint) => Number(value) / 100;
  cashByStage.forEach((value, key) => { resultPhases[key as keyof Summary['phases']] = asTaka(value); });
  costByKind.forEach((value, key) => { resultCosts[key as keyof Summary['costs']] = asTaka(value); });
  const sold = data.sales == null ? null : cents(data.sales);
  const quantity = data.saleable_kg ? decimal(data.saleable_kg) : null;
  const proposed = quantity && data.offer != null ? product(quantity, decimal(data.offer)) : null;
  return {
    cash: asTaka(cash),
    economic: asTaka(total),
    cash_surplus: sold == null ? null : asTaka(sold - cash),
    profit: sold == null ? null : asTaka(sold - total),
    break_even: quantity ? asTaka(round(total * quantity.scale, quantity.value)) : null,
    offer_profit: proposed ? asTaka(round(proposed.value * 100n - total * proposed.scale, proposed.scale)) : null,
    budget_left: data.available == null ? null : asTaka(cents(data.available) - cash),
    phases: resultPhases, costs: resultCosts,
  };
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function isSummary(result: unknown): result is Summary {
  if (!result || typeof result !== 'object') return false;
  const view = result as Partial<Summary>;
  return isNumber(view.cash) && isNumber(view.economic)
    && [view.profit, view.cash_surplus, view.break_even, view.offer_profit, view.budget_left].every(value => value === null || isNumber(value))
    && Object.keys(kinds).every(key => isNumber(view.costs?.[key as keyof Summary['costs']]))
    && Object.keys(stages).every(key => isNumber(view.phases?.[key as keyof Summary['phases']]));
}

export function budgetError(error: unknown): string {
  const detail = getErrorMessage(error);
  if (/[\u0980-\u09ff]/.test(detail)) return detail;
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) return 'লগইনের সময় শেষ হয়েছে। আবার লগইন করে খসড়াটি খুলুন।';
    if (status === 403) return 'এই হিসাব ব্যবহারের অনুমতি পাওয়া যায়নি।';
    if (status === 400 || status === 422) return 'খরচ, ফলন ও বিক্রির টাকার ঘরগুলো যাচাই করুন।';
    if (status === 404 || status === 405) return 'ফার্ম বাজেটের অনুরোধটি সার্ভারে পাওয়া যায়নি। ব্যাকএন্ড চালু করে আবার চেষ্টা করুন।';
    if (status === 429) return 'অনেকগুলো অনুরোধ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।';
    if (status && status >= 500) return 'সার্ভার এখন হিসাবটি নিতে পারছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।';
    if (!status || status === 408) return 'সার্ভারে সংযোগ হয়নি। সংযোগ ফিরে এলে আবার চেষ্টা করুন।';
  }
  return 'অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।';
}

const budgetApi = '/farms/budget';
const legacyBudgetApi = '/farm-hub';

function isMissingRoute(error: unknown) {
  if (!isAxiosError(error)) return false;
  const response = error.response;
  if (response?.status === 405) return true;
  // A JSON 404 for a farm, budget, or plan is a business error.
  if (response?.status !== 404) return false;
  const body: unknown = response.data;
  if (typeof body === 'string') return true;
  return typeof body === 'object' && body !== null && 'detail' in body && body.detail === 'Not Found';
}

async function budgetRequest<T>(
  path: string,
  send: (url: string) => Promise<AxiosResponse<T>>,
  onAttempt?: (url: string) => void,
) {
  const primary = budgetApi + path;
  onAttempt?.(primary);
  try {
    return await send(primary);
  } catch (error) {
    if (!isMissingRoute(error)) throw error;
    const legacy = legacyBudgetApi + path;
    onAttempt?.(legacy);
    return await send(legacy);
  }
}

export type BudgetNotice = { text: string; detail: string };

export function useBudgetRecords(farmId: number | null, version: number) {
  const [state, setState] = useState<{ farmId: number; data?: FarmBudgetRecord[]; error?: string }>();
  useEffect(() => {
    if (farmId == null) return;
    const controller = new AbortController();
    void budgetRequest(`/budgets/${farmId}`, url => api.get<unknown>(url, { signal: controller.signal }))
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data)) throw new Error('সার্ভার থেকে সংরক্ষিত বাজেটের তালিকা পাওয়া যায়নি।');
        setState({ farmId, data: data as FarmBudgetRecord[] });
      }).catch(error => {
        if (!controller.signal.aborted) setState(previous => ({
          farmId, data: previous?.farmId === farmId ? previous.data : undefined, error: budgetError(error),
        }));
      });
    return () => controller.abort();
  }, [farmId, version]);
  return state?.farmId === farmId ? state : undefined;
}

export async function saveBudget(data: BudgetPayload & {
  crop: string; season: string; kind: FarmBudgetRecord['kind']; farm_id: number; plan_id: number | null;
}, id?: number): Promise<FarmBudgetRecord> {
  const { data: record } = id == null
    ? await budgetRequest('/budgets', url => api.post<FarmBudgetRecord>(url, data))
    : await budgetRequest(`/budgets/${id}`, url => api.put<FarmBudgetRecord>(url, data));
  return record;
}

export async function removeBudget(id: number) {
  await budgetRequest(`/budgets/${id}`, url => api.delete(url));
}

export async function fetchBudgetSummary(data: BudgetPayload): Promise<{ summary: Summary; notice?: BudgetNotice }> {
  const inputs: Inputs = {
    available: data.available, sales: data.sales, saleable_kg: data.saleable_kg, offer: data.offer, lines: data.lines,
  };
  const attempts: string[] = [];
  const localResult = (reason: string, diagnostic: string) => ({
    summary: calculateLocally(inputs),
    notice: { text: reason + ' ফলাফল ডিভাইসেই হিসাব করা হয়েছে।', detail: `POST ${attempts.join(' → ')} · ${diagnostic}` },
  });
  try {
    const response = await budgetRequest('/calculate', url => api.post<unknown>(url, inputs, { timeout: 8000 }), url => attempts.push(url));
    if (isSummary(response.data)) return { summary: response.data };
    return localResult('সার্ভার থেকে হিসাবের তথ্য পাওয়া যায়নি।', `HTTP ${response.status} · হিসাবের উত্তর পাওয়া যায়নি`);
  } catch (error) {
    if (!isAxiosError(error)) throw error;
    const status = error.response?.status;
    if (status && status < 500 && ![401, 404, 405, 408, 429].includes(status)) throw error;
    const timeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    return localResult(budgetError(error),
      status ? `HTTP ${status}` : timeout ? 'সময়সীমার মধ্যে উত্তর আসেনি' : 'কোনো HTTP উত্তর পাওয়া যায়নি');
  }
}
