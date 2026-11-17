import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getErrorMessage } from '../../../services/api.ts';

export const dhakaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const metric = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 2 }).format(n);
export const money = (n: number | null | undefined) => n == null ? '—' : `৳${metric(n)}`;
export const errText = (error: unknown) => {
  const message = getErrorMessage(error);
  return /[\u0980-\u09ff]/.test(message) ? message : 'অনুরোধ সম্পন্ন হয়নি। তথ্য ও সংযোগ যাচাই করে আবার চেষ্টা করুন।';
};
export const hub = {
  get: async <T,>(path: string, signal?: AbortSignal) => (await api.get<T>(`/farm-hub${path}`, { signal })).data,
  post: async <T,>(path: string, data?: unknown) => (await api.post<T>(`/farm-hub${path}`, data)).data,
  put: async (path: string, data: unknown) => api.put(`/farm-hub${path}`, data),
  patch: async (path: string, data: unknown) => api.patch(`/farm-hub${path}`, data),
  remove: async (path: string) => api.delete(`/farm-hub${path}`),
};

export function useHub<T>(path: string | null, version = 0, poll = 0) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    const abort = new AbortController();
    let pending = false;
    async function load() {
      if (!path || pending || abort.signal.aborted) return;
      pending = true;
      try {
        const data = await hub.get<T>(path, abort.signal);
        if (!abort.signal.aborted) setState({ path, data });
      } catch (error) {
        if (!abort.signal.aborted) setState((previous) => ({ path, data: previous?.path === path ? previous.data : undefined, error: errText(error) }));
      } finally { pending = false; }
    }
    void load();
    const timer = poll ? window.setInterval(() => { if (!document.hidden) void load(); }, poll) : undefined;
    return () => { abort.abort(); window.clearInterval(timer); };
  }, [path, version, poll]);
  return state?.path === path ? state : undefined;
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="fh-card"><h2>{title}</h2>{children}</section>;
}

export function Feedback({ error, pending }: { error?: string; pending?: boolean }) {
  return error ? <p className="fh-error" role="alert">{error}</p> : pending ? <p role="status">তথ্য আনা হচ্ছে…</p> : null;
}

export function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="fh-field"><span>{label}</span>{children}</label>;
}
