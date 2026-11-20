import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, LockKeyhole } from 'lucide-react';
import { docsApi, statusOf, type DocsDocument, type Publication } from '../components/docs/docsApi.ts';
import { DocsContent } from '../components/docs/DocsContent.tsx';
import '../components/docs/projectDocs.css';

type Snapshot = Omit<Publication, 'document'> & { document: DocsDocument };

export default function ProjectDocsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [state, setState] = useState<'loading' | 'ready' | 'closed' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cached: Snapshot | undefined;
    let timer: number | undefined;
    let expiry: number | undefined;
    let pending = false;

    function close() {
      cached = undefined;
      setSnapshot(undefined);
      setState('closed');
    }

    async function poll() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      window.clearTimeout(timer);
      try {
        const next = await docsApi.public(cached?.published_revision, controller.signal);
        if (controller.signal.aborted) return;
        window.clearTimeout(expiry);
        const document = next.document ?? cached?.document;
        if (!document) throw new Error('The published snapshot is incomplete.');
        const remaining = next.ends_at === null ? null : (next.ends_at - next.live.as_of) * 1000;
        if (remaining !== null && remaining <= 0) {
          close();
        } else {
          const live = { ...next.live, changelog: next.live.changelog ?? cached?.live.changelog };
          cached = { ...next, document, live };
          setSnapshot(cached);
          setState('ready');
          if (remaining !== null && remaining <= 2_147_483_647) expiry = window.setTimeout(close, remaining);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        window.clearTimeout(expiry);
        close();
        if (statusOf(error) !== 403) setState('error');
      } finally {
        pending = false;
        if (!controller.signal.aborted) timer = window.setTimeout(poll, 15_000);
      }
    }

    const onFocus = () => { if (!document.hidden) void poll(); };
    const forget = () => { cached = undefined; setSnapshot(undefined); setState('loading'); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', forget);
    window.addEventListener('pageshow', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(expiry);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', forget);
      window.removeEventListener('pageshow', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [attempt]);

  useEffect(() => {
    if (!window.location.hash || !snapshot) return;
    const id = window.location.hash.slice(1);
    window.requestAnimationFrame(() => window.document.getElementById(id)?.scrollIntoView());
  }, [snapshot?.published_revision]);

  if (state === 'ready' && snapshot) return <DocsContent document={snapshot.document} live={snapshot.live} revision={snapshot.published_revision}/>;

  return <main className="akdocs akdocs-gate">
    <div>
      {state === 'closed' ? <LockKeyhole size={25} aria-hidden/> : <Leaf size={25} aria-hidden/>}
      <p>আমাদের কৃষি AI</p>
      <h1>{state === 'closed' ? 'Documentation not available' : state === 'loading' ? 'Loading documentation' : 'Could not load documentation'}</h1>
      <p>{state === 'closed' ? 'This page opens during the scheduled showcase window.' : state === 'error' ? 'Refresh the connection and try again.' : 'Checking publication access…'}</p>
      <div className="akdocs-actions">
        <Link className="akdocs-button akdocs-primary" to="/">Back to home</Link>
        <Link className="akdocs-button" to="/docs/admin">Admin editor</Link>
        {state === 'error' && <button type="button" className="akdocs-button" onClick={() => { setState('loading'); setAttempt(value => value + 1); }}>Try again</button>}
      </div>
    </div>
  </main>;
}
