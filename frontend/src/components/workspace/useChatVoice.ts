import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api.ts';

type Language = 'bn' | 'en';
type VoiceStage = 'requesting' | 'recording' | 'transcribing';
type Translate = (bangla: string, english: string) => string;
type VoiceProps = {
  session: number | null;
  sessionExpired: boolean;
  defaultLanguage: Language;
  t: Translate;
  notify: (message: string) => void;
  onDictation: (text: string) => void;
  onSessionError: (error: unknown) => boolean;
};

const FORMATS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
const MAX_RECORDING_TIME = 25_000;
const BENGALI = /\p{Script=Bengali}/u;
const SPOKEN_CHARACTER = /[\p{Letter}০-৯]/u;
const LANGUAGE_RUN = /[\p{Script=Bengali}\p{Script=Latin}]/gu;

function readingChunks(text: string, size: number) {
  const chunks: string[] = [];
  let chunk = '';
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    if (chunk && chunk.length + word.length + 1 > size) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += chunk ? ` ${word}` : word;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function nativeSegments(text: string, speech: SpeechSynthesis) {
  const voices = speech.getVoices();
  const normalized = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replaceAll('_', '-');
  const find = (code: Language, preferred: string) => voices.find((voice) => normalized(voice) === preferred)
    ?? voices.find((voice) => normalized(voice).split('-')[0] === code);
  const bengali = find('bn', 'bn-bd');
  const english = find('en', 'en-us');
  const segments: { text: string; voice: SpeechSynthesisVoice }[] = [];
  let start = 0;
  let lastLanguage: Language | null = null;

  function append(end: number, language: Language) {
    const voice = language === 'bn' ? bengali : english;
    if (!voice) return false;
    for (const chunk of readingChunks(text.slice(start, end), 160)) segments.push({ text: chunk, voice });
    return true;
  }

  for (const match of text.matchAll(LANGUAGE_RUN)) {
    if (!SPOKEN_CHARACTER.test(match[0])) continue;
    const language = BENGALI.test(match[0]) ? 'bn' : 'en';
    if (lastLanguage && language !== lastLanguage) {
      if (!append(match.index, lastLanguage)) return [];
      start = match.index;
    }
    lastLanguage = language;
  }
  if (!append(text.length, lastLanguage ?? 'en')) return [];
  return segments;
}

function errorMessage(error: unknown, t: Translate) {
  const detail = (error as { response?: { data?: { detail?: string }; status?: number } })?.response;
  switch (detail?.data?.detail) {
    case 'VOICE_NO_SPEECH':
      return t('কথা বোঝা যায়নি। মাইকের কাছে আবার বলুন।', 'No speech was recognized. Try speaking closer to the microphone.');
    case 'VOICE_QUOTA':
      return t('ভয়েসের Gemini কোটা শেষ। পরে আবার চেষ্টা করুন।', 'Gemini voice quota reached. Try again later.');
    case 'GEMINI_API_KEY_MISSING':
    case 'VOICE_MODEL_UNAVAILABLE':
      return t('ভয়েস সেবা পাওয়া যাচ্ছে না। Backend-এর Gemini key ও মডেল অ্যাক্সেস পরীক্ষা করুন।', 'Voice service is unavailable. Check the backend Gemini key and model access.');
    case 'VOICE_RECORDING_TOO_LARGE':
      return t('রেকর্ডিংটি বড় হয়ে গেছে। কম সময় ধরে আবার বলুন।', 'The recording is too large. Try a shorter recording.');
  }
  if (detail?.status === 404) {
    return t('ভয়েস আপডেটের পর Backend আবার চালু করুন।', 'Restart the backend after installing the voice update.');
  }
  return t('ভয়েস সেবা কাজ করেনি। আবার চেষ্টা করুন।', 'Voice service failed. Please try again.');
}

function release(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useChatVoice({ session, sessionExpired, defaultLanguage, t, notify, onDictation, onSessionError }: VoiceProps) {
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [voiceStage, setVoiceStage] = useState<VoiceStage | null>(null);
  const [recordingLanguage, setRecordingLanguage] = useState<Language>(defaultLanguage);
  const [manualPlayback, setManualPlayback] = useState(false);
  const activeReading = useRef<{ key: string; controller: AbortController } | null>(null);
  const activeRecording = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const autoStop = useRef<number | undefined>(undefined);
  const latest = useRef({ onDictation, onSessionError, notify, t });
  latest.current = { onDictation, onSessionError, notify, t };

  function clearSpeech() {
    activeReading.current?.controller.abort();
    activeReading.current = null;
    if (utterance.current) window.speechSynthesis?.cancel();
    utterance.current = null;
    player.current?.pause();
  }

  function clearRecording() {
    activeRecording.current?.abort();
    activeRecording.current = null;
    const recording = recorder.current;
    if (recording && recording.state !== 'inactive') recording.stop();
    recorder.current = null;
    release(streamRef.current);
    streamRef.current = null;
    window.clearTimeout(autoStop.current);
  }

  function stopReading() {
    clearSpeech();
    setSpeaking(null);
    setManualPlayback(false);
  }

  function cancelRecording() {
    clearRecording();
    setVoiceStage(null);
  }

  useEffect(() => {
    setSpeaking(null);
    setVoiceStage(null);
    setManualPlayback(false);
    return () => {
      clearSpeech();
      clearRecording();
    };
  }, [session, sessionExpired]);

  function readAnswer(key: string, text: string) {
    const toggleOff = activeReading.current?.key === key;
    stopReading();
    if (toggleOff || !text.trim()) return;
    cancelRecording();

    const controller = new AbortController();
    const { signal } = controller;
    activeReading.current = { key, controller };
    setSpeaking(key);

    function finish() {
      if (!signal.aborted) stopReading();
    }

    async function playCloud() {
      try {
        for (const chunk of readingChunks(text, 1800)) {
          const { data } = await api.post<Blob>('/chat/voice/read', { text: chunk }, {
            responseType: 'blob', timeout: 65_000, signal,
          });
          if (signal.aborted) return;
          await playAudio(player.current, data, signal, () => setManualPlayback(true));
        }
      } catch (error) {
        if (signal.aborted || latest.current.onSessionError(error)) return;
        const response = (error as { response?: { data?: unknown; status?: number } })?.response;
        if (response?.data instanceof Blob) {
          const payload = await response.data.text().then((data) => JSON.parse(data)).catch(() => null);
          if (!signal.aborted) latest.current.notify(errorMessage({ response: { ...response, data: payload } }, latest.current.t));
        } else {
          latest.current.notify(errorMessage(error, latest.current.t));
        }
      } finally {
        finish();
      }
    }

    const speech = window.speechSynthesis;
    const segments = speech && window.SpeechSynthesisUtterance ? nativeSegments(text, speech) : [];
    if (!segments.length) {
      void playCloud();
      return;
    }

    function speak(index: number) {
      if (signal.aborted) return;
      const segment = segments[index];
      if (!segment) {
        finish();
        return;
      }
      const next = new SpeechSynthesisUtterance(segment.text);
      next.voice = segment.voice;
      next.lang = segment.voice.lang;
      next.onend = () => speak(index + 1);
      next.onerror = () => {
        if (signal.aborted) return;
        if (index === 0) void playCloud();
        else {
          latest.current.notify(latest.current.t('পড়া থেমে গেছে। আবার শুনুন।', 'Playback stopped. Try listening again.'));
          finish();
        }
      };
      utterance.current = next;
      speech.speak(next);
    }
    speak(0);
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  async function startRecording() {
    if (activeRecording.current || sessionExpired) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      notify(t('মাইক চালাতে HTTPS বা localhost-এ সমর্থিত ব্রাউজার ব্যবহার করুন।', 'Use a supported browser on HTTPS or localhost for microphone access.'));
      return;
    }
    stopReading();

    const controller = new AbortController();
    const { signal } = controller;
    activeRecording.current = controller;
    setVoiceStage('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (signal.aborted) {
        release(stream);
        return;
      }
      streamRef.current = stream;
      const mimeType = FORMATS.find((format) => MediaRecorder.isTypeSupported(format));
      const recording = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const blobs: Blob[] = [];
      recording.ondataavailable = ({ data }) => {
        if (data.size) blobs.push(data);
      };
      recording.onerror = () => {
        if (signal.aborted) return;
        latest.current.notify(latest.current.t('মাইকের রেকর্ডিং থেমে গেছে। আবার চেষ্টা করুন।', 'Microphone recording stopped. Try again.'));
        cancelRecording();
      };
      recording.onstop = async () => {
        release(stream);
        if (signal.aborted) return;
        streamRef.current = null;
        window.clearTimeout(autoStop.current);
        setVoiceStage('transcribing');
        try {
          if (!blobs.length) {
            latest.current.notify(latest.current.t('কোনো কথা রেকর্ড হয়নি। আবার বলুন।', 'Nothing was recorded. Please try again.'));
            return;
          }
          const type = (recording.mimeType || blobs[0].type).split(';')[0];
          const audio = new Blob(blobs, { type });
          const { data } = await api.post<{ text: string }>('/chat/voice/transcribe', audio, {
            headers: { 'Content-Type': audio.type },
            params: { language: recordingLanguage },
            timeout: 65_000,
            signal,
          });
          if (!signal.aborted) latest.current.onDictation(data.text.trim());
        } catch (error) {
          if (!signal.aborted && !latest.current.onSessionError(error)) {
            latest.current.notify(errorMessage(error, latest.current.t));
          }
        } finally {
          if (!signal.aborted) cancelRecording();
        }
      };
      recording.start();
      setVoiceStage('recording');
      autoStop.current = window.setTimeout(stopRecording, MAX_RECORDING_TIME);
    } catch (error) {
      if (signal.aborted) return;
      cancelRecording();
      const name = error instanceof Error ? error.name : '';
      const message = name === 'NotAllowedError'
        ? t('মাইকের অনুমতি দিন। ব্রাউজারের পাশে Site permissions দেখুন।', 'Allow microphone access in your browser’s site permissions.')
        : t('মাইক চালু করা যায়নি। মাইক সংযুক্ত আছে কি না দেখুন।', 'Could not start the microphone. Check that it is connected.');
      notify(message);
    }
  }

  return { speaking, readAnswer, stopReading, player, manualPlayback, voiceStage, recordingLanguage, setRecordingLanguage, startRecording, stopRecording, cancelRecording };
}

async function playAudio(player: HTMLAudioElement | null, audio: Blob, signal: AbortSignal, allowManualPlayback: () => void) {
  if (!player || !audio.size) throw new Error('Empty audio');
  const url = URL.createObjectURL(audio);
  try {
    await new Promise<void>((resolve, reject) => {
      function done(error?: unknown) {
        player?.removeEventListener('ended', ended);
        player?.removeEventListener('error', failed);
        signal.removeEventListener('abort', ended);
        if (error) reject(error);
        else resolve();
      }
      const ended = () => done();
      const failed = () => done(new Error('Audio could not play'));
      signal.addEventListener('abort', ended, { once: true });
      player.addEventListener('ended', ended, { once: true });
      player.addEventListener('error', failed, { once: true });
      player.src = url;
      player.play().catch((error: unknown) => {
        if (signal.aborted) return;
        if (error instanceof DOMException && error.name === 'NotAllowedError') allowManualPlayback();
        else done(error);
      });
    });
  } finally {
    if (player.src === url) {
      player.removeAttribute('src');
      player.load();
    }
    URL.revokeObjectURL(url);
  }
}
