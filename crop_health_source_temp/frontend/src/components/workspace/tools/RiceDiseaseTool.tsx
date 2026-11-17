import { useState, useRef, type ChangeEvent } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, RefreshCw, AlertCircle, Eye } from 'lucide-react';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';
import { Button } from '../../common/Button.tsx';
import { PredictionResultCard } from '../PredictionResultCard.tsx';

interface RiceDiseaseToolProps {
  onViewHistory?: (recordId: number) => void;
}

export function RiceDiseaseTool({ onViewHistory }: RiceDiseaseToolProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a valid JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image exceeds the maximum allowed size of 5 MiB.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  // Generate synthesized sample rice leaf
  const handleLoadSample = (sampleType: 'healthy' | 'blast') => {
    setError(null);
    setResult(null);

    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1c3b28';
    ctx.fillRect(0, 0, 224, 224);

    // Rice blade shape (long slender leaf)
    ctx.beginPath();
    ctx.moveTo(112, 10);
    ctx.quadraticCurveTo(80, 112, 95, 214);
    ctx.lineTo(129, 214);
    ctx.quadraticCurveTo(144, 112, 112, 10);
    ctx.fillStyle = sampleType === 'healthy' ? '#469c5e' : '#738a4d';
    ctx.fill();

    // Central vein
    ctx.beginPath();
    ctx.moveTo(112, 10);
    ctx.lineTo(112, 214);
    ctx.strokeStyle = '#2d633b';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (sampleType === 'blast') {
      // Draw spindle-shaped diamond lesions (Rice Blast characteristic)
      ctx.beginPath();
      ctx.ellipse(112, 90, 8, 22, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#8a532d';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(112, 90, 4, 12, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#e8ded8';
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(115, 150, 7, 18, 0.2, 0, 2 * Math.PI);
      ctx.fillStyle = '#8a532d';
      ctx.fill();
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `rice_sample_${sampleType}.png`, { type: 'image/png' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }, 'image/png');
  };

  const handleDiagnose = async () => {
    if (!selectedFile) {
      setError('Please upload or select a rice leaf image.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await predictionApi.predictImage('rice_disease', selectedFile);
      setResult(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-charcoal-900">
              Rice Foliar Disease Classifier
            </h2>
            <p className="text-xs text-sage-600">
              Model: <code className="font-mono text-forest-800">rice_disease</code> • 7-Class Keras CNN (TensorFlow 2.21)
            </p>
          </div>
        </div>
        <p className="text-xs text-charcoal-700 mt-2 leading-relaxed">
          Submits leaf blade imagery to diagnose 7 rice conditions: Healthy, Insect, Leaf Scald, Rice Blast, Rice Leaffolder, Rice Stripes, and Rice Tungro.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs space-y-4">
        
        {/* Sample Leaves */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-sage-100">
          <span className="text-xs font-semibold text-charcoal-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-forest-600" />
            Quick Test Samples:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleLoadSample('healthy')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Healthy Rice Leaf
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('blast')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Rice Blast Spindle Lesion
            </button>
          </div>
        </div>

        {/* Upload Container */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            previewUrl
              ? 'border-forest-400 bg-forest-50/20'
              : 'border-sage-300 hover:border-forest-500 hover:bg-cream-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-forest-600 shadow-md mb-3 bg-charcoal-900 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Rice leaf preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-charcoal-800">{selectedFile?.name}</p>
              <p className="text-[11px] text-sage-600">
                {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''} • Click to change image
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-sage-100 text-sage-600 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-charcoal-900 mb-1">
                Click to upload rice leaf photograph
              </p>
              <p className="text-xs text-sage-600 max-w-sm">
                Supports JPEG, PNG, WebP up to 5 MiB. Embedded model logic automatically resizes to 224x224 RGB.
              </p>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="primary"
            size="md"
            onClick={handleDiagnose}
            isLoading={isSubmitting}
            disabled={!selectedFile}
            leftIcon={<ImageIcon className="w-4 h-4" />}
            className="font-semibold shadow-sm"
          >
            Run Rice Condition Classifier
          </Button>

          {previewUrl && (
            <Button
              variant="ghost"
              size="md"
              onClick={handleReset}
              leftIcon={<RefreshCw className="w-4 h-4 text-sage-600" />}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Result Display */}
      {result && <PredictionResultCard result={result} onViewHistory={onViewHistory} />}
    </div>
  );
}
