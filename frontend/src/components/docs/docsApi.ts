import axios from 'axios';
import { API_BASE_URL, getErrorMessage } from '../../services/api.ts';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });
const root = '/project-docs';

export type Block = { kind: 'paragraph' | 'heading' | 'bullet'; text: string };
export type Section = { id: string; group: 'pitch' | 'technical'; title: string; blocks: Block[] };
export type Member = { name: string; role: string; email: string; show_email: boolean; photo: string };
export type Roadmap = { name: string; status: 'upcoming' | 'planned' };
export type DocsDocument = {
  title: string; tagline: string; team_name: string;
  sections: Section[]; team: Member[]; architecture: string[]; data_flow: string[];
  roadmap: Roadmap[]; show_metrics: boolean;
};
export type Release = { revision: number; title: string; published_at: number };
export type Live = {
  as_of: number; version: string; registered_models: number;
  features: { name: string; status: 'live' | 'unavailable' }[];
  endpoints: { path: string; methods: string[]; description: string; auth: string }[];
  metrics: { registered_accounts: number; prediction_events: number; approved_listings: number } | null;
  changelog?: Release[];
};
export type Visibility = { enabled: boolean; mode: 'always' | 'scheduled'; starts_at: number | null; ends_at: number | null; available: boolean };
export type AdminData = { revision: number; published_revision: number; role: string; draft: DocsDocument; visibility: Visibility; live: Live };
export type Publication = { document: DocsDocument | null; published_revision: number; ends_at: number | null; live: Live };
export type VisibilityChange = { enabled: boolean; mode: 'always' | 'scheduled' | 'duration'; starts_at?: string; ends_at?: string; duration_minutes?: number };

function staff(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const docsApi = {
  async public(revision: number | undefined, signal: AbortSignal) {
    return (await client.get<Publication>(root + '/public', { params: { known_revision: revision }, signal })).data;
  },
  async admin(token: string) {
    return (await client.get<AdminData>(root + '/admin', staff(token))).data;
  },
  async save(token: string, revision: number, document: DocsDocument) {
    return (await client.put<AdminData>(root + '/admin/draft', { revision, document }, staff(token))).data;
  },
  async publish(token: string, revision: number) {
    return (await client.post<AdminData>(root + '/admin/publish', { revision }, staff(token))).data;
  },
  async visibility(token: string, revision: number, next: VisibilityChange) {
    return (await client.put<AdminData>(root + '/admin/visibility', { revision, ...next }, staff(token))).data;
  },
  async restore(token: string, revision: number, version: number) {
    return (await client.post<AdminData>(`${root}/admin/versions/${version}/restore`, { revision }, staff(token))).data;
  },
};

export function statusOf(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export function describeDocsError(error: unknown) {
  if (axios.isAxiosError(error) && Array.isArray(error.response?.data?.detail)) {
    const issue = error.response.data.detail[0] as { msg?: string; loc?: (string | number)[] } | undefined;
    if (issue?.msg) return `${issue.loc?.slice(1).join(' › ') || 'Field'} — ${issue.msg}`;
  }
  return getErrorMessage(error);
}

export const dhakaDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short',
});

export function localInput(seconds: number | null) {
  if (seconds === null) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(seconds * 1000));
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function dhakaTimestamp(local: string) {
  return `${local}:00+06:00`;
}
