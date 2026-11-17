import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Beaker,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  Info,
  Leaf,
  Loader2,
  Plus,
  Sprout,
} from 'lucide-react';
import type { WorkspaceTab } from './WorkspaceSidebar';
import { farmApi, soilApi } from '../../services/api';
import type { FarmProfile, SoilTest } from '../../types';
import SoilTestForm from './soil/SoilTestForm';

interface SoilHealthDashboardProps {
  initialFarmId?: number | null;
  onNavigateToTab?: (
    tab: WorkspaceTab,
    modelIdOrFarmId?: string,
    extraId?: number
  ) => void;
  onNavigateToModel?: (modelId: string) => void;
}

function ValueTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string | null;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#204735] bg-[#052518] px-4 py-3.5 transition-colors hover:border-[#a77d35]/55">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#e9ad46]" />
        <span className="text-xs font-medium tracking-wide text-[#b6cbbd]">{label}</span>
      </div>
      <p className="break-words text-xl font-semibold tracking-tight text-[#f8f7f0]">
        {value == null ? (
          <span className="text-base font-medium text-[#8aa497]">তথ্য নেই</span>
        ) : (
          <>
            {value}
            {unit ? <span className="ml-1.5 text-xs font-medium text-[#a8c2b0]">{unit}</span> : null}
          </>
        )}
      </p>
    </div>
  );
}

export function SoilHealthDashboard({ initialFarmId }: SoilHealthDashboardProps) {
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId ?? null);
  const [soilTests, setSoilTests] = useState<SoilTest[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [loadingTests, setLoadingTests] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (initialFarmId != null) setSelectedFarmId(initialFarmId);
  }, [initialFarmId]);

  useEffect(() => {
    let active = true;
    setLoadingFarms(true);
    void farmApi.listFarms()
      .then((list) => {
        if (!active) return;
        setFarms(list);
        setSelectedFarmId((current) =>
          current !== null && list.some((farm) => farm.id === current)
            ? current
            : (list[0]?.id ?? null)
        );
      })
      .catch(() => {
        if (active) setError('খামারের তালিকা লোড করা যায়নি। আবার চেষ্টা করুন।');
      })
      .finally(() => {
        if (active) setLoadingFarms(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const farmId = selectedFarmId;
    setSoilTests([]);
    setError(null);
    if (farmId == null) {
      setLoadingTests(false);
      return;
    }

    let active = true;
    setLoadingTests(true);
    void soilApi.getFarmSoilTests(farmId)
      .then((tests) => {
        if (active) setSoilTests(tests);
      })
      .catch(() => {
        if (active) setError('মাটির পরীক্ষার তথ্য লোড করা যায়নি।');
      })
      .finally(() => {
        if (active) setLoadingTests(false);
      });
    return () => { active = false; };
  }, [selectedFarmId, refreshVersion]);

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId);
  const latestTest = useMemo(() => {
    if (soilTests.length === 0) return null;
    return [...soilTests].sort((a, b) => {
      const dateOrder = b.sample_date.localeCompare(a.sample_date);
      return dateOrder || b.id - a.id;
    })[0];
  }, [soilTests]);

  const isLoading = loadingFarms || loadingTests;
  const canAddTest = selectedFarmId != null;
  const sourceText = latestTest?.test_source === 'laboratory'
    ? 'ল্যাবরেটরি রিপোর্ট'
    : latestTest ? 'কৃষকের দেওয়া তথ্য' : 'রেকর্ড নেই';

  return (
    <main className="min-h-screen bg-[#001b11] px-4 pb-16 pt-7 text-[#f8f7f0] sm:px-7 lg:px-10 lg:pt-9">
      <div className="mx-auto w-full max-w-[1190px]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.29em] text-[#e9ad46]">
              SOIL INTELLIGENCE · মাটি ও পুষ্টি
            </p>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
              প্লট ও মাটির অবস্থা
            </h1>
            <p className="mt-2 text-sm text-[#a4bdae]">
              {selectedFarm ? `${selectedFarm.name} · ` : ''}
              {latestTest ? `সর্বশেষ নমুনা: ${latestTest.sample_date} · ${sourceText}` : 'বাস্তব মাটির পরীক্ষার তথ্য ও রেকর্ড'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {farms.length > 0 && (
              <label className="relative">
                <span className="sr-only">খামার নির্বাচন করুন</span>
                <select
                  aria-label="খামার নির্বাচন করুন"
                  className="min-h-10 max-w-[190px] appearance-none rounded-xl border border-[#24543d] bg-[#0e3625] py-2 pl-3 pr-9 text-sm text-white outline-none focus:border-[#e9ad46]"
                  value={selectedFarmId ?? ''}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    if (Number.isSafeInteger(nextId) && nextId > 0) {
                      setShowForm(false);
                      setSoilTests([]);
                      setLoadingTests(true);
                      setSelectedFarmId(nextId);
                    }
                  }}
                >
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>{farm.name}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#e9ad46]">⌄</span>
              </label>
            )}
            <button
              type="button"
              disabled={!canAddTest}
              onClick={() => setShowForm(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#b68638] bg-[#e9ad46] px-4 py-2 text-sm font-semibold text-[#172416] transition-colors hover:bg-[#f1c16d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f1c16d] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus size={16} /> নতুন মাটির পরীক্ষা
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-rose-600/50 bg-rose-950/40 p-3 text-sm text-rose-200">
            <AlertCircle size={17} className="shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.95fr)_minmax(290px,1fr)]">
          <section className="min-w-0 rounded-[19px] border border-[#1b4934] bg-gradient-to-br from-[#0b3524] to-[#06271a] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.14)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <FlaskConical size={18} className="text-[#e9ad46]" /> মাটির বিশ্লেষণ
              </h2>
              <span className="rounded-full border border-[#305d45] bg-[#153f2d] px-3 py-1 text-[11px] text-[#c2d5c7]">
                {latestTest ? 'সর্বশেষ রেকর্ড' : 'পরীক্ষার তথ্য নেই'}
              </span>
            </div>

            {isLoading ? (
              <div role="status" className="flex min-h-[185px] items-center justify-center gap-2 text-[#a7c0b1]">
                <Loader2 size={19} className="animate-spin" /> তথ্য লোড হচ্ছে…
              </div>
            ) : !selectedFarm ? (
              <div className="flex min-h-[185px] flex-col items-center justify-center gap-2 text-center">
                <Sprout size={26} className="text-[#e9ad46]" />
                <h3 className="font-semibold">কোনো খামার পাওয়া যায়নি</h3>
                <p className="text-sm text-[#a8c2b0]">মাটির রেকর্ড দেখতে প্রথমে একটি খামার তৈরি করুন।</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ValueTile label="নাইট্রোজেন (N)" value={latestTest?.nitrogen_n} unit={latestTest?.measurement_unit_n} />
                  <ValueTile label="ফসফরাস (P)" value={latestTest?.phosphorus_p} unit={latestTest?.measurement_unit_p} />
                  <ValueTile label="পটাসিয়াম (K)" value={latestTest?.potassium_k} unit={latestTest?.measurement_unit_k} />
                  <ValueTile label="মাটির আর্দ্রতা" value={latestTest?.soil_moisture_percent} unit="%" />
                  <ValueTile label="মাটির pH" value={latestTest?.soil_ph} />
                  <ValueTile label="জৈব পদার্থ" value={latestTest?.organic_matter_percent} unit="%" />
                </div>
                {!latestTest && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#476347] bg-[#0b2d20] px-4 py-3">
                    <p className="flex items-center gap-2 text-sm text-[#b7cebb]">
                      <Info size={16} className="shrink-0 text-[#e9ad46]" /> এখনো কোনো মাটির পরীক্ষার তথ্য সংরক্ষিত নেই।
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#e9ad46] hover:underline"
                    >
                      প্রথম পরীক্ষা যোগ করুন <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="min-w-0 rounded-[19px] border border-[#1b4934] bg-gradient-to-b from-[#0c3525] to-[#082a1e] p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Leaf size={18} className="text-[#e9ad46]" /> কী করবেন
            </h2>
            {latestTest ? (
              <div className="space-y-4 text-sm leading-7 text-[#d1e2d6]">
                <p>সর্বশেষ মাটির পরীক্ষার পরিমাপগুলো বাম পাশের কার্ডে দেখানো হয়েছে।</p>
                <p className="text-[#9fc0ac]">N, P ও K-এর একক এবং তথ্যের উৎস মিলিয়ে দেখুন। কোনো মান অনুপস্থিত থাকলে নতুন পরীক্ষার রিপোর্টে তা যোগ করতে পারেন।</p>
                <div className="rounded-xl border border-[#30553f] bg-[#0a291c] p-3 text-xs leading-6 text-[#a9c4b3]">
                  <p className="font-semibold text-[#e9ad46]">রেকর্ডের উৎস</p>
                  <p>{sourceText}{latestTest.laboratory_name ? ` · ${latestTest.laboratory_name}` : ''}</p>
                  <p>নমুনার তারিখ: {latestTest.sample_date}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm leading-7 text-[#d1e2d6]">
                <p>মাটির অবস্থা জানতে নমুনার তারিখ, pH এবং পাওয়া গেলে N, P, K-এর পরিমাপ সংরক্ষণ করুন।</p>
                <p className="text-[#9fc0ac]">ল্যাব রিপোর্টের তথ্য ও নিজের পর্যবেক্ষণ আলাদা উৎস হিসেবে চিহ্নিত করুন। পরিমাপ না থাকলে ফাঁকা রাখুন।</p>
                <div className="flex items-start gap-2 rounded-xl border border-[#30553f] bg-[#0b291d] p-3 text-xs leading-6 text-[#bdd0c2]">
                  <Info size={16} className="mt-1 shrink-0 text-[#e9ad46]" />
                  রেকর্ডের মান দিয়ে নিজে থেকে কোনো সারের পরিমাণ বা মাটির ঘাটতি নিশ্চিত করা হচ্ছে না।
                </div>
              </div>
            )}
          </aside>
        </div>

        {soilTests.length > 0 && !isLoading && (
          <section className="mt-6 rounded-[19px] border border-[#1b4934] bg-[#08291c] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <ClipboardList size={18} className="text-[#e9ad46]" /> মাটির পরীক্ষার ইতিহাস
              </h2>
              <span className="text-xs text-[#a9c4b3]">মোট {soilTests.length} টি রেকর্ড</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[...soilTests]
                .sort((a, b) => b.sample_date.localeCompare(a.sample_date) || b.id - a.id)
                .map((test) => (
                  <article key={test.id} className="rounded-xl border border-[#25513a] bg-[#052419] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-2 font-semibold text-[#eff9ef]">
                        <Beaker size={16} className="shrink-0 text-[#e9ad46]" />
                        <span className="truncate">{test.sample_label}</span>
                      </p>
                      <span className="text-xs text-[#abc2b2]">{test.test_source === 'laboratory' ? 'ল্যাব রিপোর্ট' : 'কৃষক প্রদত্ত'}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#acc7b5]">
                      <span className="flex items-center gap-1"><CalendarDays size={13} /> {test.sample_date}</span>
                      <span>pH: {test.soil_ph ?? '—'}</span>
                      <span>N: {test.nitrogen_n == null ? '—' : `${test.nitrogen_n} ${test.measurement_unit_n}`}</span>
                      <span>P: {test.phosphorus_p == null ? '—' : `${test.phosphorus_p} ${test.measurement_unit_p}`}</span>
                      <span>K: {test.potassium_k == null ? '—' : `${test.potassium_k} ${test.measurement_unit_k}`}</span>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        )}
      </div>

      {showForm && selectedFarmId != null && (
        <SoilTestForm
          farmId={selectedFarmId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setRefreshVersion((version) => version + 1);
          }}
        />
      )}
    </main>
  );
}
