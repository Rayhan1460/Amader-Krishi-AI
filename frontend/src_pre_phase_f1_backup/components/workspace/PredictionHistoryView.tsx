import { useState, useEffect } from 'react';
import {
  History,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Layers,
  Waves,
  TrendingUp,
  Loader2,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';
import { historyApi, getErrorMessage } from '../../services/api.ts';
import type { PredictionRecord } from '../../types/index.ts';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';

interface PredictionHistoryViewProps {
  initialRecordId?: number | null;
}

export function PredictionHistoryView({ initialRecordId }: PredictionHistoryViewProps) {
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PredictionRecord | null>(null);
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await historyApi.listHistory(100, modelFilter === 'all' ? undefined : modelFilter);
      setRecords(data);
      if (initialRecordId) {
        const found = data.find((r) => r.id === initialRecordId);
        if (found) setSelectedRecord(found);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [modelFilter]);

  const handleDelete = async (recordId: number) => {
    try {
      await historyApi.deleteRecord(recordId);
      setRecords(records.filter((r) => r.id !== recordId));
      if (selectedRecord?.id === recordId) {
        setSelectedRecord(null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.model_id.toLowerCase().includes(term) ||
      JSON.stringify(r.response).toLowerCase().includes(term)
    );
  });

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('disease')) return <Eye className="w-4 h-4 text-rose-700" />;
    if (modelId.includes('crop') || modelId.includes('yield'))
      return <Layers className="w-4 h-4 text-emerald-700" />;
    if (modelId.includes('flood')) return <Waves className="w-4 h-4 text-sky-700" />;
    if (modelId.includes('price')) return <TrendingUp className="w-4 h-4 text-amber-700" />;
    return <History className="w-4 h-4 text-forest-700" />;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-sage-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-charcoal-900">
                Prediction Audit History
              </h2>
              <p className="text-xs text-sage-600">
                Chronological log of model executions linked to your account
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchHistory}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="self-start sm:self-auto"
          >
            Refresh Log
          </Button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search history by model ID, diagnosed class, or keywords..."
              className="w-full text-xs rounded-xl py-2 pl-9 pr-3 bg-cream-50/60 border border-sage-300 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-sage-600 shrink-0 hidden sm:block" />
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="w-full sm:w-auto text-xs rounded-xl py-2 px-3 bg-cream-50/60 border border-sage-300 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-200"
            >
              <option value="all">All Models</option>
              <option value="tomato_disease_v3">Tomato Disease</option>
              <option value="rice_disease">Rice Disease</option>
              <option value="crop_recommendation">Crop Recommendation</option>
              <option value="regional_crop_yield">Regional Yield</option>
              <option value="flood_susceptibility">Flood Risk</option>
              <option value="tomato_price">Tomato Price</option>
              <option value="boro_rice_price">Boro Rice Price</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Records List / Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Records Cards */}
        <div className={`${selectedRecord ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
          {isLoading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-sage-200">
              <Loader2 className="w-6 h-6 animate-spin text-forest-700 mx-auto mb-2" />
              <p className="text-xs text-sage-600">Retrieving logged records from SQLite database...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-sage-200">
              <History className="w-8 h-8 text-sage-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-charcoal-800">No predictions recorded yet</p>
              <p className="text-xs text-sage-600 max-w-sm mx-auto mt-1">
                Run inference with any of the 7 research models to automatically record auditable predictions.
              </p>
            </div>
          ) : (
            filteredRecords.map((r) => {
              const isSelected = selectedRecord?.id === r.id;
              const topOutput =
                r.response?.predicted_class ||
                r.response?.recommended_crop ||
                (r.response?.predicted_yield ? `${Number(r.response.predicted_yield).toFixed(2)} t/ha` : null) ||
                r.response?.susceptibility_category ||
                (r.response?.recommended_price ? `${Number(r.response.recommended_price).toFixed(2)} BDT/kg` : null) ||
                'Inference Completed';

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRecord(r)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                    isSelected
                      ? 'border-forest-600 ring-2 ring-forest-200 shadow-sm'
                      : 'border-sage-200 hover:border-forest-400 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sage-50 flex items-center justify-center shrink-0">
                        {getModelIcon(r.model_id)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-bold text-forest-900">
                            {r.model_id}
                          </code>
                          <Badge variant="sage" size="sm">
                            #{r.id}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-charcoal-800 mt-0.5">{topOutput}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <div className="text-[11px] text-sage-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {r.timestamp
                            ? new Date(r.timestamp).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(r.id);
                        }}
                        className="p-1 rounded-lg hover:bg-red-50 text-sage-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Record Detail Modal / Panel */}
        {selectedRecord && (
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-sage-200 shadow-sm sticky top-20 self-start">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-sage-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sage-600">
                  Record #{selectedRecord.id}
                </span>
                <span className="text-xs font-mono text-forest-800 font-semibold">
                  {selectedRecord.model_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-sage-500 hover:text-charcoal-900 hover:bg-sage-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="font-semibold text-charcoal-800 block mb-1">
                  Logged Timestamp:
                </span>
                <p className="font-mono text-sage-600 text-[11px]">
                  {selectedRecord.timestamp || 'N/A'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-charcoal-800 block mb-1">
                  Request Payload:
                </span>
                <pre className="p-3 bg-cream-50 rounded-xl border border-sage-200 font-mono text-[11px] overflow-x-auto max-h-40">
                  {JSON.stringify(selectedRecord.request_payload, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-semibold text-charcoal-800 block mb-1">
                  Model Response:
                </span>
                <pre className="p-3 bg-charcoal-950 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56">
                  {JSON.stringify(selectedRecord.response, null, 2)}
                </pre>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(selectedRecord.id)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Record
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
