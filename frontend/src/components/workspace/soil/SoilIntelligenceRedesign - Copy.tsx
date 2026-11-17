// Soil Intelligence — real SoilTest measurements; no invented nutrient percentages.
import { useEffect, useState } from 'react';
import { soilApi, farmApi } from '../../../services/api.ts';
import type { SoilTest, FarmProfile } from '../../../types/index.ts';

interface SoilIntelligenceRedesignProps {
  initialFarmId?: number | null;
  // Maintain the parent WorkspacePage callback contract without pretending this view uses it.
  onNavigateToTab?: (tab: 'soil', modelIdOrFarmId?: string, extraId?: number) => void;
  onNavigateToModel?: (modelId: string) => void;
}

function MeasuredValue({
  label, value, unit,
}: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-forest-700/60 bg-forest-900/50 px-3 py-3">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-sm font-semibold text-gold-400">
        {value == null ? 'পরিমাপ নেই' : `${value} ${unit}`}
      </span>
    </div>
  );
}

export function SoilIntelligenceRedesign({ initialFarmId }: SoilIntelligenceRedesignProps) {
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId ?? null);
  const [soilTests, setSoilTests] = useState<SoilTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFarmId(initialFarmId ?? null);
  }, [initialFarmId]);

  useEffect(() => {
    let active = true;
    async function loadFarms() {
      try {
        const list = await farmApi.listFarms();
        if (!active) return;
        setFarms(list);
        setSelectedFarmId(current => current ?? list[0]?.id ?? null);
      } catch {
        if (active) setError('খামারের তালিকা লোড করতে ব্যর্থ হয়েছে।');
      }
    }
    void loadFarms();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const farmId = selectedFarmId;
    if (farmId === null) {
      setSoilTests([]);
      setLoading(false);
      return;
    }

    // Capture a non-null farm ID before entering the asynchronous function.
    const currentFarmId = farmId;
    let active = true;
    setSoilTests([]); // Do not show records from another farm while switching.
    setLoading(true);
    setError(null);

    async function loadTests() {
      try {
        const tests = await soilApi.getFarmSoilTests(currentFarmId);
        if (active) setSoilTests(tests);
      } catch {
        if (active) setError('মাটির টেস্ট লোড করতে ব্যর্থ হয়েছে।');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTests();
    return () => { active = false; };
  }, [selectedFarmId]);

  return (
    <div className="min-h-screen bg-forest-900 p-4 text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gold-400">মাটির বুদ্ধিমত্তা</h1>
        {farms.length > 0 && (
          <select
            aria-label="খামার নির্বাচন করুন"
            className="rounded bg-forest-800 p-2 text-white"
            value={selectedFarmId ?? ''}
            onChange={(event: { target: { value: string } }) => {
              const raw = event.target.value;
              if (!raw) { setSelectedFarmId(null); return; }
              const nextId = Number(raw);
              if (Number.isSafeInteger(nextId) && nextId > 0) setSelectedFarmId(nextId);
            }}
          >
            {farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
          </select>
        )}
      </div>

      {loading && <div role="status" className="animate-pulse text-center">লোড হচ্ছে…</div>}
      {error && <div role="alert" className="mb-4 text-red-400">{error}</div>}

      {!loading && !error && soilTests.length === 0 && (
        <div className="mt-8 rounded-2xl border border-forest-700/60 bg-forest-800 p-6 text-center">
          <p>{farms.length === 0 ? 'কোনো খামার পাওয়া যায়নি।' : 'কোনো মাটির বিশ্লেষণ পাওয়া যায়নি।'}</p>
          <p className="mt-2 text-sm text-gray-400">
            নতুন Soil Test যোগ করার ফর্ম এই ভিউতে সংযুক্ত নেই।
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {soilTests.map(test => (
          <article key={test.id} className="rounded-xl border border-forest-700/60 bg-forest-800 p-4 shadow transition hover:shadow-lg">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-gray-300">{test.sample_date}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-gold-400 px-2 py-1 text-xs text-black">pH {test.soil_ph ?? 'পরিমাপ নেই'}</span>
                <span className="text-xs text-gray-400">
                  {test.test_source === 'laboratory' ? 'ল্যাবরেটরি' : 'কৃষকের দেওয়া তথ্য'}
                </span>
              </div>
            </div>
            <MeasuredValue label="নাইট্রোজেন (N)" value={test.nitrogen_n} unit={test.measurement_unit_n} />
            <MeasuredValue label="ফসফরাস (P)" value={test.phosphorus_p} unit={test.measurement_unit_p} />
            <MeasuredValue label="পটাসিয়াম (K)" value={test.potassium_k} unit={test.measurement_unit_k} />
            {test.organic_matter_percent != null && (
              <MeasuredValue label="জৈব পদার্থ" value={test.organic_matter_percent} unit="%" />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
