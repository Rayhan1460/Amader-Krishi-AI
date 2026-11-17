import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Camera, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, Crop as CropIcon,
  FileText, Focus, ImagePlus, Info, Leaf, LoaderCircle, Maximize2, ScanLine, Sparkles, Sun, Upload, X,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { PredictionRecord, PredictionResponse } from '../../../types/index.ts';
import { LeafObservationForm } from './LeafObservationForm.tsx';
import { capturePhoto, MAX_UPLOAD, openPdf, prepareScan, previewImage, renderPage, type PageDocument, type Region } from './cropScanMedia.ts';
import { confidenceInfo, cropNames, getCropGuide, labelName, models, scanError, scanHistory, scanLeaf,
  type Crop, type CropGuide } from './cropHealthModel.ts';
import './LeafScan.css';

type Step = 'home' | 'upload' | 'review' | 'result' | 'history';
type Preview = { blob: Blob; title: string; kind: 'photo' | 'camera' | 'pdf' };
const tomatoArt = '/crop-health-tomato.webp';
const riceArt = '/crop-health-rice.webp';
const formatScoreWidth = (score: number) => `${score * 100}%`;

function Sheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`chs-card ${className}`}>{children}</section>;
}

export function DiseaseScanPanel({ crop: initialCrop, onViewHistory }: {
  crop: Crop; onViewHistory?: (recordId: number) => void;
}) {
  const { lang } = useLanguage();
  const language = lang === 'bn' ? 'bn' : 'en';
  const bn = language === 'bn';
  const t = (a: string, b: string) => bn ? a : b;
  const [step, setStep] = useState<Step>('home');
  const [crop, setCrop] = useState<Crop>(initialCrop);
  const [preview, setPreview] = useState<Preview>();
  const [photoUrl, setPhotoUrl] = useState('');
  const [pdfDoc, setPdfDoc] = useState<PageDocument>();
  const [page, setPage] = useState(1);
  const [cropping, setCropping] = useState(false);
  const [region, setRegion] = useState<Region>();
  const [camera, setCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraHint, setCameraHint] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [photoIssue, setPhotoIssue] = useState('');
  const [prediction, setPrediction] = useState<PredictionResponse>();
  const [guide, setGuide] = useState<CropGuide>();
  const [notice, setNotice] = useState('');
  const [readingGuide, setReadingGuide] = useState(false);
  const [history, setHistory] = useState<PredictionRecord[]>([]);
  const [filter, setFilter] = useState<Crop | ''>('');
  const [query, setQuery] = useState('');
  const choicesHeading = useRef<HTMLHeadingElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const nativeCamera = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | undefined>(undefined);
  const content = useRef<HTMLElement>(null);
  const photoDialog = useRef<HTMLDialogElement>(null);
  const operation = useRef(0);
  const apiRequest = useRef<AbortController | undefined>(undefined);
  const pointer = useRef<{ x: number; y: number } | undefined>(undefined);
  const cropName = cropNames[crop][bn ? 0 : 1];
  const modelInfo = confidenceInfo(prediction?.prediction);
  const status = photoIssue ? 'uncertain' : modelInfo.status;
  const resultName = status === 'possible' ? labelName(modelInfo.label, language) :
    status === 'healthy' ? t('সুস্থ পাতার সঙ্গে মিল', 'Healthy-leaf match') :
    photoIssue ? t('আরেকটি পরিষ্কার ছবি দিন', 'Try a clearer photo') :
      t('মডেল স্পষ্ট মিল পায়নি', 'The model found no clear match');

  useEffect(() => {
    if (!preview) { setPhotoUrl(''); return; }
    const url = URL.createObjectURL(preview.blob);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
  useEffect(() => () => { if (pdfDoc) void pdfDoc.destroy().catch(() => undefined); }, [pdfDoc]);
  useEffect(() => () => {
    operation.current += 1;
    apiRequest.current?.abort();
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);
  useEffect(() => {
    if (!camera || !video.current || !stream.current) return;
    video.current.srcObject = stream.current;
    void video.current.play().catch(() => undefined);
  }, [camera]);

  function go(next: Step) {
    setStep(next);
    requestAnimationFrame(() => {
      const heading = content.current?.querySelector<HTMLElement>('h1');
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
  }
  function stopCamera() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = undefined;
    setCamera(false);
    setCameraReady(false);
  }
  function reset() {
    operation.current += 1;
    apiRequest.current?.abort();
    stopCamera();
    setPreview(undefined); setPdfDoc(undefined); setRegion(undefined); setCropping(false);
    setPrediction(undefined); setGuide(undefined); setReadingGuide(false); setPhotoIssue('');
    setError(''); setNotice(''); setPending(''); setCameraHint(false); setPage(1);
  }
  function choose(next: Crop) { reset(); setCrop(next); go('upload'); }
  async function openCamera() {
    if (pending) return;
    const id = ++operation.current;
    if (!navigator.mediaDevices?.getUserMedia) { nativeCamera.current?.click(); return; }
    setPending(t('ক্যামেরা খোলা হচ্ছে…', 'Opening camera…'));
    setError('');
    setCameraHint(false);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (id !== operation.current) { next.getTracks().forEach(track => track.stop()); return; }
      stream.current = next;
      setCamera(true);
    } catch {
      if (id !== operation.current) return;
      setCameraHint(true);
      setError(t('ক্যামেরা খোলেনি। অনুমতি দিয়ে আবার চেষ্টা করুন অথবা ফোনের ক্যামেরা থেকে ছবি দিন।',
        'Camera unavailable. Allow camera access or use the native camera picker.'));
    } finally { if (id === operation.current) setPending(''); }
  }
  async function takePhoto() {
    if (!video.current || !cameraReady || pending) return;
    const id = ++operation.current;
    setPending(t('ছবি প্রস্তুত হচ্ছে…', 'Preparing photo…'));
    try {
      const blob = await capturePhoto(video.current);
      if (id !== operation.current) return;
      stopCamera();
      setPdfDoc(undefined);
      setPreview({ blob, title: t('ক্যামেরার ছবি', 'Camera photo'), kind: 'camera' });
      setError('');
      go('review');
    } catch {
      if (id === operation.current) setError(t('ছবি তোলা যায়নি। আবার চেষ্টা করুন।', 'Could not capture the photo. Try again.'));
    } finally { if (id === operation.current) setPending(''); }
  }
  async function useFile(file: File) {
    if (pending) return;
    if (!file.size || file.size > MAX_UPLOAD) {
      setError(t('১২ MiB-এর মধ্যে একটি ছবি বা PDF বাছুন।', 'Choose an image or PDF under 12 MiB.'));
      return;
    }
    stopCamera();
    const id = ++operation.current;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    setPending(t('ফাইল প্রস্তুত হচ্ছে…', 'Preparing file…'));
    setError(''); setRegion(undefined); setCropping(false);
    let document: PageDocument | undefined;
    try {
      let blob: Blob;
      if (isPdf) {
        document = await openPdf(file);
        blob = await renderPage(document, 1);
      } else {
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name)) throw new Error('Unsupported file');
        blob = await previewImage(file);
      }
      if (id !== operation.current) {
        if (document) await document.destroy();
        return;
      }
      setPdfDoc(document);
      setPage(1);
      setPreview({ blob, title: file.name, kind: isPdf ? 'pdf' : 'photo' });
      go('review');
    } catch {
      if (document) await document.destroy().catch(() => undefined);
      if (id === operation.current) setError(isPdf
        ? t('PDF খোলা যায়নি। পাসওয়ার্ড ছাড়া সচল PDF বা পাতার ছবি দিন।', 'Could not open this PDF. Try an unlocked PDF or an image.')
        : t('ছবি খোলা যায়নি। JPG, PNG বা WebP ছবি চেষ্টা করুন।', 'Could not open the image. Try JPG, PNG or WebP.'));
    } finally { if (id === operation.current) setPending(''); }
  }
  function fromInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void useFile(file);
  }
  async function changePage(next: number) {
    if (!pdfDoc || !preview || next < 1 || next > pdfDoc.numPages || pending) return;
    const id = ++operation.current;
    setPending(t('পৃষ্ঠা দেখা হচ্ছে…', 'Loading PDF page…'));
    setError('');
    try {
      const blob = await renderPage(pdfDoc, next);
      if (id !== operation.current) return;
      setPage(next); setRegion(undefined); setCropping(false);
      setPreview({ ...preview, blob });
    } catch {
      if (id === operation.current) setError(t('এই পৃষ্ঠাটি দেখা যায়নি। অন্য পৃষ্ঠা বা ছবি চেষ্টা করুন।', 'Could not read this page. Try another page or image.'));
    } finally { if (id === operation.current) setPending(''); }
  }
  function point(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const bound = (value: number) => Math.max(0, Math.min(1, value));
    return { x: bound((event.clientX - box.left) / box.width), y: bound((event.clientY - box.top) / box.height) };
  }
  function resizeRegion(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current) return;
    const end = point(event);
    const start = pointer.current;
    setRegion({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) });
  }
  async function analyze() {
    if (!preview || pending || cropping) return;
    const id = ++operation.current;
    apiRequest.current?.abort();
    const controller = new AbortController();
    apiRequest.current = controller;
    setPending(t('পাতা বিশ্লেষণ হচ্ছে…', 'Analyzing the leaf…'));
    setError(''); setPhotoIssue(''); setPrediction(undefined); setGuide(undefined); setNotice('');
    try {
      const prepared = await prepareScan(preview.blob, region);
      if (id !== operation.current) return;
      if (!prepared.file) {
        setPhotoIssue(prepared.issue === 'small'
          ? t('বাছাই করা অংশটি খুব ছোট। কাছে থেকে পাতার বড় ছবি দিন।', 'The selected area is too small. Take a closer leaf photo.')
          : t('ছবির আলো বা দাগ যথেষ্ট স্পষ্ট নয়। দিনের আলোয় আবার ছবি তুলুন।', 'The image is too dark, bright, or flat. Retake in daylight.'));
        go('result');
        return;
      }
      const data = await scanLeaf(crop, prepared.file, controller.signal);
      if (id !== operation.current) return;
      setPrediction(data);
      setPending('');
      go('result');
      if (data.record_id) {
        setReadingGuide(true);
        try {
          const next = await getCropGuide(data.record_id, language, false, controller.signal);
          if (id === operation.current) setGuide(next);
        } catch { /* Local result text is always available. */ }
        finally { if (id === operation.current) setReadingGuide(false); }
      }
    } catch (failure) {
      if (id === operation.current && !controller.signal.aborted) setError(scanError(failure, language));
    } finally { if (id === operation.current) setPending(''); }
  }
  async function explain() {
    if (!prediction?.record_id || !guide?.gemini_available || readingGuide) return;
    const id = operation.current;
    const request = new AbortController();
    apiRequest.current = request;
    setReadingGuide(true); setNotice('');
    try {
      const next = await getCropGuide(prediction.record_id, language, true, request.signal);
      if (id === operation.current) {
        setGuide(next);
        if (next.provider !== 'gemini') setNotice(t('সহায়িকা থেকে সংক্ষিপ্ত করণীয় দেখানো হচ্ছে।', 'The reference guide is shown for this scan.'));
      }
    } catch {
      if (id === operation.current) setNotice(t('এখন সহায়িকা থেকে পাওয়া করণীয় দেখুন।', 'The reference guide remains available.'));
    } finally { if (id === operation.current) setReadingGuide(false); }
  }
  async function openHistory() {
    reset(); go('history');
    const id = operation.current;
    setPending(t('আগের স্ক্যান আনা হচ্ছে…', 'Loading scan history…'));
    try {
      const rows = await scanHistory();
      if (id === operation.current) setHistory(rows);
    } catch (failure) {
      if (id === operation.current) setError(scanError(failure, language));
    } finally { if (id === operation.current) setPending(''); }
  }

  const instructions = <>
    <li><Sun size={19}/><div><strong>{t('দিনের আলো নিন', 'Use daylight')}</strong><p>{t('ছায়া ও ঝলক এড়িয়ে চলুন।', 'Avoid glare and deep shadows.')}</p></div></li>
    <li><Focus size={19}/><div><strong>{t('একটি পাতা ফ্রেমে রাখুন', 'Frame one leaf')}</strong><p>{t('দাগ ও পাতার কিনারা যেন দেখা যায়।', 'Show the affected area and edges clearly.')}</p></div></li>
    <li><Camera size={19}/><div><strong>{t('কাছে থেকে স্থির ছবি তুলুন', 'Hold steady close to the leaf')}</strong><p>{t('ছবি ঝাপসা হলে আবার তুলুন।', 'Retake if the image is blurry.')}</p></div></li>
  </>;
  const stepIndex = step === 'home' ? 0 : step === 'result' ? 2 : 1;
  const defaultSummary = status === 'healthy'
    ? t('এই ছবি মডেলের সুস্থ পাতার শ্রেণির সঙ্গে মিলেছে। গাছে অন্য লক্ষণ থাকলে আক্রান্ত পাতার ছবি দিন।',
      'The photo matches the model’s healthy class. Scan an affected leaf if you see other symptoms.')
    : t('মডেলের এই শ্রেণিটির সঙ্গে পাতার ছবির বেশি মিল পাওয়া গেছে। পাশের পাতার লক্ষণও মিলিয়ে দেখুন।',
      'This was the top match in the model. Compare the symptoms on nearby leaves.');
  const uncertaintyCopy = {
    missing_scores: t('মডেলের ফলাফলে তুলনা করার মতো পূর্ণ স্কোর পাওয়া যায়নি।',
      'The scan did not return enough model scores to compare results.'),
    unmapped_label: t('মডেল একটি শ্রেণির নাম দিয়েছে, কিন্তু অ্যাপ সেই নামটি চিনতে পারছে না।',
      'The model returned a class name that the app does not recognize.'),
    low_score: t('ছবিটি স্ক্যান হয়েছে। যে শ্রেণির সঙ্গে সবচেয়ে বেশি মিল, তার স্কোরও কম।',
      'The photo was scanned. Even the best matching class had a low score.'),
    close_scores: t('ছবিটি স্ক্যান হয়েছে। প্রথম দুই শ্রেণির স্কোর কাছাকাছি, তাই নির্ভরযোগ্যভাবে একটি বেছে নেওয়া যায়নি।',
      'The photo was scanned. The two leading scores were too close to select one reliably.'),
  };
  const uncertainActions = photoIssue
    ? [t('দিনের আলোয় কাছে থেকে একটি পাতার ছবি তুলুন।', 'Take a close-up of one leaf in daylight.'),
      t('PDF হলে পাতার অংশটুকু আলাদা করে বাছুন।', 'For a PDF, select just the part with the leaf.')]
    : [t('একই গাছের অন্য একটি আক্রান্ত পাতা আলাদা করে স্ক্যান করুন।',
      'Scan a different affected leaf from the same plant.'),
      t('ফল অনিশ্চিত থাকলে দাগের কাছের ছবি ও পুরো গাছের ছবি স্থানীয় কৃষি কর্মকর্তাকে দেখান।',
        'If the result stays uncertain, show a close-up of the marks and a whole-plant photo to a local agricultural officer.')];
  const setupActions = [
    t('মডেলের বিস্তারিত খুলে এই স্ক্যানের তথ্য দেখুন।', 'Open Model details to check the scan information.'),
    t('সমস্যা আবার দেখা দিলে স্ক্যান রেকর্ডের নম্বরসহ অ্যাপের সহায়তা নিন।',
      'If it happens again, share the scan record number with app support.'),
  ];
  const formatScore = (score: number) =>
    new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 }).format(score);
  const actions = [t('পাশের পাতায় একই লক্ষণ আছে কি না দেখুন।', 'Check nearby leaves for similar marks.'),
    t('দাগের কাছের ছবি ও পুরো গাছের একটি ছবি রাখুন।', 'Keep one close-up and one whole-plant photo.')];
  const modelSetupIssue = prediction && (modelInfo.reason === 'missing_scores' || modelInfo.reason === 'unmapped_label');
  const nextActions = modelSetupIssue ? setupActions : status === 'uncertain' ? uncertainActions
    : guide?.status === status ? guide.steps : actions;
  const rows = history.filter(row => !filter || row.model_id === models[filter]).filter(row => {
    const info = confidenceInfo(row.response);
    const name = info.status === 'uncertain' ? t('অনিশ্চিত', 'Uncertain') : labelName(info.label, language);
    return (name + ' ' + cropNames[row.model_id === models.rice ? 'rice' : 'tomato'][bn ? 0 : 1]).toLowerCase().includes(query.toLowerCase().trim());
  });

  return <section className="chs" ref={content} lang={language} aria-label={t('ফসল স্বাস্থ্য', 'Crop health')}>
    <input ref={photoInput} className="chs-hidden" type="file" accept="image/*" aria-label={t('ছবির ফাইল', 'Image file')} onChange={fromInput}/>
    <input ref={nativeCamera} className="chs-hidden" type="file" accept="image/*" capture="environment" aria-label={t('ফোন ক্যামেরার ছবি', 'Native camera photo')} onChange={fromInput}/>
    <input ref={pdfInput} className="chs-hidden" type="file" accept="application/pdf,.pdf" aria-label="PDF" onChange={fromInput}/>

    <div className="chs-top">
      <span><Leaf size={16}/>{t('খামার ও ফসল', 'Farm & crops')} <ChevronRight size={14}/> <strong>{t('ফসল স্বাস্থ্য', 'Crop health')}</strong></span>
      {step !== 'history' && <button type="button" className="chs-btn chs-compact" onClick={() => void openHistory()}><Clock3 size={16}/>{t('স্ক্যানের ইতিহাস', 'Scan history')}</button>}
    </div>

    {step !== 'home' && step !== 'history' && <ol className="chs-steps" aria-label={t('স্ক্যানের ধাপ', 'Scan steps')}>
      {[t('ফসল বাছাই', 'Choose crop'), t('ছবি দিন', 'Add photo'), t('ফলাফল', 'Results')].map((name, index) =>
        <li key={name} aria-current={index === stepIndex ? 'step' : undefined} className={index <= stepIndex ? 'chs-active' : ''}>
          <b>{bn ? '১২৩'[index] : index + 1}</b>{name}
        </li>)}
    </ol>}
    {error && <p role="alert" className="chs-notice chs-warn"><AlertTriangle size={18}/>{error}</p>}
    {notice && <p role="status" className="chs-notice"><Info size={17}/>{notice}</p>}
    {pending && <p role="status" className="chs-notice"><LoaderCircle className="chs-spin" size={17}/>{pending}</p>}

    {step === 'home' && <>
      <header className="chs-hero chs-enter">
        <span><Leaf size={18}/>{t('ফসল স্বাস্থ্য', 'Crop health')}</span>
        <h1 tabIndex={-1}>{t('পাতার ছবি থেকে সম্ভাব্য রোগ জানুন', 'Check a leaf for possible disease')}</h1>
        <p>{t('ফসল বাছুন, পাতার ছবি দিন, তারপর ফলাফল ও পরের কাজ দেখুন।', 'Choose the crop, add a leaf photo, then see the result and next steps.')}</p>
        <button type="button" className="chs-btn chs-lime" onClick={() => { choicesHeading.current?.focus({ preventScroll: true }); choicesHeading.current?.scrollIntoView({ block: 'center' }); }}><ScanLine size={19}/>{t('স্ক্যান শুরু করুন', 'Start scanning')}</button>
      </header>
      <div className="chs-grid chs-home-grid">
        <section className="chs-crops">
          <h2 tabIndex={-1} ref={choicesHeading}>{t('কোন ফসলের পাতা?', 'Which crop is it?')}</h2>
          <div className="chs-choices">
            {(['tomato', 'rice'] as const).map(item => <button type="button" key={item} className="chs-choice" onClick={() => choose(item)}>
              <img alt="" src={item === 'tomato' ? tomatoArt : riceArt}/>
              <span><strong>{cropNames[item][bn ? 0 : 1]}</strong><small>{t('পাতার লক্ষণ পরীক্ষা', 'Check leaf symptoms')}</small><ArrowRight size={20}/></span>
            </button>)}
          </div>
        </section>
        <Sheet><h2>{t('যেভাবে ছবি তুলবেন', 'Taking a useful photo')}</h2><ul className="chs-tips">{instructions}</ul></Sheet>
      </div>
    </>}

    {step === 'upload' && <div className="chs-enter">
      <div className="chs-heading"><h1 tabIndex={-1}>{t(`${cropName} পাতার ছবি দিন`, `Add a ${cropName.toLowerCase()} leaf photo`)}</h1>
        <button type="button" className="chs-btn" onClick={() => { reset(); go('home'); }}><ArrowLeft size={17}/>{t('ফসল বদলান', 'Change crop')}</button></div>
      <div className="chs-grid">
        <Sheet>
          {camera ? <section className="chs-camera"><div className="chs-video"><video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setCameraReady(true)}/><i aria-hidden="true"/></div>
            <div className="chs-actions"><button type="button" className="chs-btn chs-primary" disabled={!cameraReady || !!pending} onClick={() => void takePhoto()}><Camera size={18}/>{t('ছবি তুলুন', 'Take photo')}</button>
              <button type="button" className="chs-btn" disabled={!!pending} onClick={stopCamera}><X size={17}/>{t('ক্যামেরা বন্ধ করুন', 'Close camera')}</button></div>
          </section> : <div className={`chs-drop ${dragging ? 'chs-drag' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) void useFile(e.dataTransfer.files[0]); }}>
            <Upload size={34}/><h2>{t('যেভাবে দিতে চান, বেছে নিন', 'Choose how to add the leaf')}</h2>
            <p>{t('ছবি বা PDF এখানে টেনেও আনতে পারেন।', 'You can also drag an image or PDF here.')}</p>
            <div className="chs-actions">
              <button type="button" className="chs-btn chs-primary" disabled={!!pending} onClick={() => void openCamera()}><Camera size={18}/>{t('ক্যামেরা খুলুন', 'Open camera')}</button>
              <button type="button" className="chs-btn" disabled={!!pending} onClick={() => photoInput.current?.click()}><ImagePlus size={18}/>{t('ছবি বাছুন', 'Choose image')}</button>
              <button type="button" className="chs-btn" disabled={!!pending} onClick={() => pdfInput.current?.click()}><FileText size={18}/>{t('PDF বাছুন', 'Choose PDF')}</button>
              {cameraHint && <button type="button" className="chs-btn" onClick={() => nativeCamera.current?.click()}>{t('ফোনের ক্যামেরা ব্যবহার করুন', 'Use phone camera picker')}</button>}
            </div>
            <small>{t('JPG, PNG, WebP বা PDF · সর্বোচ্চ ১২ MiB', 'JPG, PNG, WebP or PDF · up to 12 MiB')}</small>
          </div>}
        </Sheet>
        <Sheet><h2>{t('ছবি দেওয়ার আগে', 'Before you add a photo')}</h2><ul className="chs-tips">{instructions}</ul></Sheet>
      </div>
    </div>}

    {step === 'review' && preview && <div className="chs-enter">
      <div className="chs-heading"><div><h1 tabIndex={-1}>{t('ছবিটি ঠিক আছে?', 'Does the photo look right?')}</h1><p>{t('পাতা ও দাগ পরিষ্কার দেখা গেলে বিশ্লেষণ করুন।', 'Analyze when the leaf and marks are clearly visible.')}</p></div>
        <button type="button" className="chs-btn" onClick={() => { reset(); go('upload'); }}><ArrowLeft size={17}/>{t('ছবি বদলান', 'Change photo')}</button></div>
      <div className="chs-grid">
        <Sheet>
          <bdi className="chs-filename">{preview.title}</bdi>
          {pdfDoc && <div className="chs-pager" aria-label={t('PDF পৃষ্ঠা', 'PDF page')}>
            <button type="button" className="chs-btn chs-compact" disabled={page === 1 || !!pending} onClick={() => void changePage(page - 1)} aria-label={t('আগের পৃষ্ঠা', 'Previous page')}><ChevronLeft size={18}/></button>
            <span>{new Intl.NumberFormat(language).format(page)} / {new Intl.NumberFormat(language).format(pdfDoc.numPages)}</span>
            <button type="button" className="chs-btn chs-compact" disabled={page >= pdfDoc.numPages || !!pending} onClick={() => void changePage(page + 1)} aria-label={t('পরের পৃষ্ঠা', 'Next page')}><ChevronRight size={18}/></button>
          </div>}
          <div className="chs-image-stage">
            {photoUrl && <div className={`chs-photo ${cropping ? 'chs-cropping' : ''}`}
              onPointerDown={e => { if (cropping && e.isPrimary) { e.currentTarget.setPointerCapture(e.pointerId); pointer.current = point(e); setRegion(undefined); } }}
              onPointerMove={resizeRegion}
              onPointerUp={e => { resizeRegion(e); pointer.current = undefined; }}
              onPointerCancel={() => { pointer.current = undefined; }}>
              <img src={photoUrl} alt={t('বিশ্লেষণের আগে পাতার ছবি', 'Leaf preview before analysis')} draggable={false}/>
              {region && <i className="chs-region" aria-hidden="true" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }}/>}
            </div>}
          </div>
          <div className="chs-actions">
            <button type="button" className="chs-btn" disabled={!!pending || !photoUrl} aria-pressed={cropping} onClick={() => {
              if (cropping && (!region || region.w < 0.01 || region.h < 0.01)) setRegion(undefined);
              setCropping(!cropping);
            }}><CropIcon size={17}/>{cropping ? t('বাছাই শেষ', 'Done selecting') : t('পাতার অংশ বাছুন', 'Select leaf area')}</button>
            {(region || cropping) && <button type="button" className="chs-btn" onClick={() => { setCropping(false); setRegion(undefined); }}>{t('পুরো ছবি', 'Use whole image')}</button>}
          </div>
          {cropping && <p>{t('পাতার চারপাশে আঙুল বা মাউস টেনে অংশ বাছুন।', 'Drag around the leaf using your finger or mouse.')}</p>}
        </Sheet>
        <Sheet className="chs-next">
          <h2>{t('স্ক্যানের জন্য প্রস্তুত?', 'Ready for the scan?')}</h2>
          <p>{preview.kind === 'pdf'
            ? t('পাতার ছবি আছে এমন পৃষ্ঠা খুলুন। ছবির চারপাশে লেখা থাকলে শুধু পাতার অংশ বাছুন।', 'Open a page with a leaf photo. If there is text around it, select just the leaf area.')
            : t('পাতার দাগ ও কিনারা দেখা যাচ্ছে কি না মিলিয়ে নিন।', 'Make sure the spots and the edges of the leaf are visible.')}</p>
          <button type="button" className="chs-btn chs-primary" disabled={!!pending || cropping || !photoUrl} onClick={() => void analyze()}>
            {pending ? <LoaderCircle className="chs-spin" size={18}/> : <ScanLine size={18}/>}
            {t('পাতা বিশ্লেষণ করুন', 'Analyze leaf')}
          </button>
        </Sheet>
      </div>
    </div>}

    {step === 'result' && <div className="chs-result-page">
      <header className="chs-result-header">
        <h1 tabIndex={-1}>{t('স্ক্যানের ফলাফল', 'Scan result')}</h1>
        <button type="button" className="chs-btn chs-primary" onClick={() => { reset(); go('upload'); }}>
          <Camera size={18}/>{t('আরেকটি ছবি দিন', 'Scan another photo')}
        </button>
      </header>

      <section className={`chs-report chs-report--${status}`} aria-labelledby="chs-report-heading">
        <div className="chs-report-content">
          <div className="chs-report-meta">
            <span className="chs-report-state">
              {status === 'uncertain' ? <AlertTriangle size={16}/> : status === 'healthy' ? <BadgeCheck size={17}/> : <ScanLine size={17}/>}
              {status === 'possible' ? t('সম্ভাব্য মিল', 'Possible match') : status === 'healthy' ? t('সুস্থ শ্রেণির সঙ্গে মিল', 'Healthy match') :
                photoIssue ? t('ছবি প্রস্তুত করা যায়নি', 'Photo needs adjustment') : t('ফলাফল অনিশ্চিত', 'Uncertain result')}
            </span>
            <span className="chs-report-crop"><Leaf size={15}/>{cropName}</span>
          </div>
          <h2 id="chs-report-heading">{resultName}</h2>
          <p className="chs-report-summary">{photoIssue || (modelInfo.reason ? uncertaintyCopy[modelInfo.reason] :
            guide?.status === status ? guide.summary : defaultSummary)}</p>

          {modelInfo.score != null && <div className="chs-report-score">
            <div className="chs-report-score-line">
              <span><BarChart3 size={17}/>{t('মডেলের মিলের স্কোর', 'Model match score')}</span>
              <strong>{formatScore(modelInfo.score)}</strong>
            </div>
            <div className="chs-score-track" aria-hidden="true">
              <span style={{ width: formatScoreWidth(modelInfo.score) }}/>
            </div>
          </div>}
        </div>

        {photoUrl && <button className="chs-report-photo" type="button" onClick={() => photoDialog.current?.showModal()}>
          <img src={photoUrl} alt=""/>
          <span><Maximize2 size={16}/>{t('ছবি বড় করে দেখুন', 'Enlarge photo')}</span>
        </button>}
      </section>

      <div className="chs-insight-grid">
        <Sheet className="chs-insight chs-next-steps">
          <div className="chs-insight-title"><span><ClipboardList size={21}/></span>
            <h2>{t('এখন কী করবেন?', 'What to do next')}</h2>
          </div>
          <ol className="chs-actions-list">{nextActions.map((action, index) => (
            <li key={action}><b aria-hidden="true">{new Intl.NumberFormat(language).format(index + 1)}</b><span>{action}</span></li>
          ))}</ol>
          {guide?.status === status && guide.source_url && <p className="chs-insight-link">
            <a href={guide.source_url} target="_blank" rel="noreferrer">{t('কৃষি সহায়িকার উৎস', 'Agricultural reference')} <ArrowUpRight size={15}/></a>
          </p>}
          {readingGuide && <p role="status" className="chs-inline"><LoaderCircle className="chs-spin" size={16}/>{t('করণীয় প্রস্তুত হচ্ছে…', 'Loading next steps…')}</p>}
          {guide?.status === status && guide.provider === 'gemini' && <small className="chs-inline"><Sparkles size={16}/>{t('যাচাই করা করণীয় Gemini দিয়ে সাজানো', 'Reviewed steps ordered with Gemini')}</small>}
          {guide?.status === status && guide.gemini_available && guide.provider !== 'gemini' && status !== 'uncertain' && <button type="button" className="chs-btn" disabled={readingGuide} onClick={() => void explain()}>
            <Sparkles size={17}/>{t('Gemini দিয়ে করণীয় সাজান', 'Order steps with Gemini')}
          </button>}
        </Sheet>

        {prediction && <Sheet className="chs-insight chs-model-card">
          <details className="chs-details">
            <summary className="chs-insight-title">
              <span><BarChart3 size={21}/></span><strong>{t('মডেলের বিস্তারিত', 'Model details')}</strong><ChevronDown size={20} className="chs-insight-chevron"/>
            </summary>
            <div className="chs-details-body">
              {modelInfo.ranking.length > 0 && <ul className="chs-model-matches">{modelInfo.ranking.map(match => (
                <li key={match.label}>
                  <bdi>{labelName(match.label, language)}</bdi><strong>{formatScore(match.score)}</strong>
                  <div className="chs-score-track" aria-hidden="true"><span style={{ width: formatScoreWidth(match.score) }}/></div>
                </li>
              ))}</ul>}
              {modelInfo.score == null && !modelInfo.ranking.length
                ? <p>{t('এই স্ক্যানের স্কোর পাওয়া যায়নি।', 'There are no scores for this scan.')}</p>
                : <p>{t('স্কোরগুলো মডেলের মিলের মাত্রা বোঝায়। রোগ নিশ্চিত করতে গাছের লক্ষণ মিলিয়ে দেখুন।',
                  'These scores describe model matches. Compare symptoms on the plant to confirm a diagnosis.')}</p>}
              {prediction.record_id && <small>{t('স্ক্যান রেকর্ড', 'Scan record')} #{prediction.record_id}</small>}
            </div>
          </details>
        </Sheet>}
      </div>

      {prediction?.record_id && <div className="chs-result-footer">
        <LeafObservationForm key={prediction.record_id} crop={crop} recordId={prediction.record_id} language={language}/>
        {onViewHistory && <button type="button" className="chs-btn" onClick={() => { if (prediction.record_id) onViewHistory(prediction.record_id); }}><FileText size={16}/>{t('স্ক্যান রেকর্ড খুলুন', 'Open scan record')}</button>}
      </div>}

      {photoUrl && <dialog className="chs-photo-dialog" aria-labelledby="chs-photo-dialog-heading" ref={photoDialog}>
        <header>
          <h2 id="chs-photo-dialog-heading">{t('স্ক্যানের ছবি', 'Scanned photo')}</h2>
          <button type="button" className="chs-btn chs-compact" aria-label={t('ছবি বন্ধ করুন', 'Close photo')} onClick={() => photoDialog.current?.close()}><X size={20}/></button>
        </header>
        <img src={photoUrl} alt={t('স্ক্যানে ব্যবহার করা পাতার ছবি', 'Leaf photo used for the scan')}/>
      </dialog>}
    </div>}

    {step === 'history' && <div className="chs-enter">
      <div className="chs-heading"><div><h1 tabIndex={-1}>{t('স্ক্যানের ইতিহাস', 'Scan history')}</h1><p>{t('এই অ্যাকাউন্টে করা আগের স্ক্যান দেখুন।', 'See previous scans saved to this account.')}</p></div>
        <button type="button" className="chs-btn chs-primary" onClick={() => choose(crop)}><ScanLine size={17}/>{t('নতুন স্ক্যান', 'New scan')}</button></div>
      <Sheet>
        <div className="chs-history-filter"><label>{t('ফসল', 'Crop')}
          <select value={filter} onChange={e => setFilter(e.target.value as Crop | '')}><option value="">{t('সব ফসল', 'All crops')}</option>
            {(['tomato', 'rice'] as const).map(item => <option key={item} value={item}>{cropNames[item][bn ? 0 : 1]}</option>)}</select></label>
          <label>{t('ফলাফল খুঁজুন', 'Find a result')}<input type="search" value={query} onChange={e => setQuery(e.target.value)}/></label>
        </div>
        {!pending && !error && !rows.length && <p>{t('এই বাছাইয়ে কোনো স্ক্যান পাওয়া যায়নি।', 'No matching scans found.')}</p>}
        {error && <button type="button" className="chs-btn" onClick={() => void openHistory()}>{t('আবার চেষ্টা করুন', 'Try again')}</button>}
        {!error && <ul className="chs-history-rows">{rows.map(row => {
          const item = row.model_id === models.rice ? 'rice' : 'tomato';
          const info = confidenceInfo(row.response);
          const name = info.status === 'uncertain' ? t('অনিশ্চিত ফলাফল', 'Uncertain result') : labelName(info.label, language);
          return <li key={row.id}><button type="button" onClick={() => {
            reset(); setCrop(item); setPrediction({ model_id: row.model_id, task: '', prediction: row.response, record_id: row.id, caveat: '' }); go('result');
            const id = operation.current;
            const request = new AbortController();
            apiRequest.current = request;
            setReadingGuide(true);
            void getCropGuide(row.id, language, false, request.signal).then(next => { if (id === operation.current) setGuide(next); })
              .catch(() => undefined).finally(() => { if (id === operation.current) setReadingGuide(false); });
          }}><Leaf size={19}/><span><strong>{name}</strong><small>{cropNames[item][bn ? 0 : 1]} · {new Date(row.timestamp).toLocaleDateString(language)}</small></span><ChevronRight size={19}/></button></li>;
        })}</ul>}
      </Sheet>
    </div>}
  </section>;
}
