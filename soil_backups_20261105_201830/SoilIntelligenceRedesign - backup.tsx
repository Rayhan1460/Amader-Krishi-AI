// SoilIntelligenceRedesign.tsx – Premium UI for the Soil Intelligence page
// This component replaces the previous SoilHealthDashboard UI while preserving the same props contract.

import { useEffect, useState } from 'react';
import { soilApi, farmApi } from '../../../services/api.ts';
import type { SoilTest, FarmProfile } from '../../../types/index.ts';


interface SoilIntelligenceRedesignProps {
  initialFarmId?: number | null;
}

export function SoilIntelligenceRedesign({
  initialFarmId,
}: SoilIntelligenceRedesignProps) {


  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId || null);
  const [soilTests, setSoilTests] = useState<SoilTest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load farms on mount
  useEffect(() => {
    let mounted = true;
    async function loadFarms() {
      try {
        const list = await farmApi.listFarms();
        if (mounted) {
          setFarms(list);
          if (!selectedFarmId && list.length > 0) {
            setSelectedFarmId(list[0].id);
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.detail || 'ফার্ম লোড করতে ব্যর্থ হয়েছে।');
      }
    }
    loadFarms();
    return () => { mounted = false; };
  }, []);

  // Load soil tests when farm changes
  useEffect(() => {
    if (selectedFarmId === null) { setSoilTests([]); return; }
    let mounted = true;
    async function loadTests() {
      setLoading(true);
      setError(null);
      try {
        const tests = await soilApi.getFarmSoilTests(selectedFarmId as number);
        if (mounted) setSoilTests(tests);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.detail || 'মাটির টেস্ট লোড করতে ব্যর্থ হয়েছে।');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadTests();
    return () => { mounted = false; };
  }, [selectedFarmId]);



  const renderBar = (label: string, value: number | null, max: number, unit: string) => (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{value ?? '-'} {unit}</span>
      </div>
      <div className="w-full h-4 bg-forest-800 rounded">
        <div className="h-4 bg-gold-500 rounded" style={{ width: value !== null ? `${(value / max) * 100}%` : '0%' }} />
      </div>
    </div>
  );

  return (
    <div className="p-4 bg-forest-900 min-h-screen text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gold-400">মাটির বুদ্ধিমত্তা</h1>
        {farms.length > 0 && (
          <select
            className="bg-forest-800 text-white rounded p-2"
            value={selectedFarmId ?? ''}
            onChange={e => setSelectedFarmId(Number(e.target.value))}
          >
            {farms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <div className="animate-pulse text-center">লোড হচ্ছে…</div>}
      {error && <div className="text-red-400 mb-4">{error}</div>}

      {!loading && soilTests.length === 0 && (
        <div className="text-center mt-8">
          <p className="mb-4">কোনো মাটির বিশ্লেষণ পাওয়া যায়নি।</p>
          <button className="bg-gold-500 text-black px-4 py-2 rounded" onClick={() => { /* placeholder */ }}>
            নতুন টেস্ট যোগ করুন
          </button>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {soilTests.map(test => (
          <div key={test.id} className="bg-forest-800 rounded-xl p-4 shadow hover:shadow-lg transition">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-300">{new Date(test.sample_date).toLocaleDateString()}</div>
              <div className="flex items-center space-x-2">
                <span className="bg-gold-400 text-black text-xs px-2 py-1 rounded">pH {test.soil_ph ?? '-'}</span>
                {test.test_source && <span className="text-xs text-gray-400">{test.test_source}</span>}
              </div>
            </div>
            {renderBar('নাইট্রোজেন (N)', test.nitrogen_n, 200, test.measurement_unit_n)}
            {renderBar('ফসফরাস (P)', test.phosphorus_p, 100, test.measurement_unit_p)}
            {renderBar('পটাসিয়াম (K)', test.potassium_k, 200, test.measurement_unit_k)}
            {test.organic_matter_percent !== undefined && test.organic_matter_percent !== null && (
              <div className="text-sm mt-2">ইউক্লিক সুনির্বাচন: {test.organic_matter_percent}%</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
