import { staffSessionKey } from '../services/marketAdminSession.ts';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, GripVertical, Leaf, Plus, Save, Trash2 } from 'lucide-react';
import { DocsContent } from '../components/docs/DocsContent.tsx';
import {
  describeDocsError, dhakaDate, dhakaTimestamp, docsApi, localInput, statusOf,
  type AdminData, type Block, type DocsDocument, type Member, type Section, type VisibilityChange,
} from '../components/docs/docsApi.ts';
import '../components/docs/projectDocs.css';

function reorder<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function replaceAt<T>(items: T[], index: number, item: T) {
  return items.map((value, i) => i === index ? item : value);
}

async function cropPortrait(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 12_000_000) {
    throw new Error('Choose a JPEG, PNG, WebP or AVIF image smaller than 12 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot process profile photos.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.fillStyle = '#f2f6ec';
    context.fillRect(0, 0, 320, 320);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 320, 320);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    bitmap.close();
  }
}

function EditableBlock({ block, onChange }: { block: Block; onChange: (block: Block) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== block.text) ref.current.innerText = block.text;
  }, [block.text]);

  return <div
    ref={ref}
    contentEditable="plaintext-only"
    className="akdocs-edit-block"
    data-kind={block.kind}
    role="textbox"
    aria-label={`Edit ${block.kind}`}
    aria-multiline="true"
    onInput={event => onChange({ ...block, text: event.currentTarget.innerText })}
  />;
}

function SectionEditor({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  function changeBlock(index: number, block: Block) {
    onChange({ ...section, blocks: replaceAt(section.blocks, index, block) });
  }

  return <div className="akdocs-editor-section">
    <label>Section title<input required maxLength={110} value={section.title} onChange={event => onChange({ ...section, title: event.target.value })}/></label>
    <label>Part<select value={section.group} onChange={event => onChange({ ...section, group: event.target.value as Section['group'] })}>
      <option value="pitch">Pitch deck</option><option value="technical">Technical documentation</option>
    </select></label>
    {section.blocks.map((block, index) => <div className="akdocs-editor-block" key={index}>
      <div className="akdocs-actions">
        <select aria-label={`Block ${index + 1} style`} value={block.kind} onChange={event => changeBlock(index, { ...block, kind: event.target.value as Block['kind'] })}>
          <option value="paragraph">Paragraph</option><option value="heading">Heading</option><option value="bullet">Bullet</option>
        </select>
        <button type="button" className="akdocs-button" aria-label={`Remove block ${index + 1}`} onClick={() => onChange({ ...section, blocks: section.blocks.filter((_, i) => i !== index) })}><Trash2 size={16}/></button>
      </div>
      <EditableBlock block={block} onChange={value => changeBlock(index, value)}/>
    </div>)}
    <button className="akdocs-button" type="button" disabled={section.blocks.length >= 16} onClick={() => onChange({ ...section, blocks: [...section.blocks, { kind: 'paragraph', text: '' }] })}><Plus size={16}/>Add block</button>
  </div>;
}

function VisibilityEditor({ data, busy, onChange }: { data: AdminData; busy: boolean; onChange: (value: VisibilityChange) => void }) {
  const visibility = data.visibility;
  const [start, setStart] = useState(() => localInput(visibility.starts_at));
  const [end, setEnd] = useState(() => localInput(visibility.ends_at === null ? null : visibility.ends_at - 1));
  const [duration, setDuration] = useState(60);

  function schedule(event: FormEvent) {
    event.preventDefault();
    if (!start || !end) return;
    const inclusiveEnd = new Date(new Date(dhakaTimestamp(end)).getTime() + 60_000);
    onChange({ enabled: true, mode: 'scheduled', starts_at: dhakaTimestamp(start), ends_at: inclusiveEnd.toISOString() });
  }

  function disable() {
    const { starts_at, ends_at } = visibility;
    onChange({ enabled: false, mode: visibility.mode,
      starts_at: starts_at ? new Date(starts_at * 1000).toISOString() : undefined,
      ends_at: ends_at ? new Date(ends_at * 1000).toISOString() : undefined,
    });
  }

  return <section className="akdocs-section akdocs-admin-section">
    <div className="akdocs-section-title"><h2>Public access</h2><span data-status={visibility.available ? 'live' : 'unavailable'}>{visibility.available ? 'Open now' : 'Closed now'}</span></div>
    <p>{visibility.enabled ? visibility.mode === 'always' ? 'Always open' : 'Scheduled in Asia/Dhaka' : 'Public access disabled'}</p>
    {visibility.mode === 'scheduled' && visibility.starts_at !== null && visibility.ends_at !== null && <p>
      {dhakaDate.format(visibility.starts_at * 1000)} → {dhakaDate.format((visibility.ends_at - 1) * 1000)} · Dhaka
    </p>}
    <div className="akdocs-actions">
      <button className="akdocs-button akdocs-primary" type="button" disabled={busy} onClick={() => onChange({ enabled: true, mode: 'always' })}>Open immediately</button>
      <button className="akdocs-button" type="button" disabled={busy || !visibility.enabled} onClick={disable}>Close immediately</button>
    </div>
    <form className="akdocs-schedule" onSubmit={schedule}>
      <label>Start · Dhaka<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)}/></label>
      <label>End · Dhaka, inclusive<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)}/></label>
      <button className="akdocs-button" disabled={busy}>Apply schedule</button>
    </form>
    <form className="akdocs-schedule" onSubmit={event => {
      event.preventDefault();
      onChange({ enabled: true, mode: 'duration', duration_minutes: duration });
    }}>
      <label>Duration in minutes<input type="number" min="1" max="43200" step="1" required value={duration} onChange={e => setDuration(Number(e.target.value))}/></label>
      <button className="akdocs-button" disabled={busy}>Open for duration</button>
    </form>
  </section>;
}

export default function ProjectDocsAdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(staffSessionKey) ?? '');
  const [data, setData] = useState<AdminData>();
  const [draft, setDraft] = useState<DocsDocument>();
  const [active, setActive] = useState('problem');
  const [panel, setPanel] = useState<'sections' | 'team' | 'diagrams' | 'versions'>('sections');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const working = useRef(false);
  const dragged = useRef(-1);

  function invalidateSession() {
    sessionStorage.removeItem(staffSessionKey);
    setToken('');
    setData(undefined);
    setDraft(undefined);
  }

  useEffect(() => {
    if (!token) return;
    let activeRequest = true;
    setError('');
    void docsApi.admin(token).then(next => {
      if (!activeRequest) return;
      setData(next);
      setDraft(next.draft);
    }).catch(failure => {
      if (!activeRequest) return;
      if (statusOf(failure) === 401) invalidateSession();
      setError(describeDocsError(failure));
    });
    return () => { activeRequest = false; };
  }, [reload, token]);

  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try { await action(); }
    catch (failure) {
      if (statusOf(failure) === 401) invalidateSession();
      setError(describeDocsError(failure));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  if (!token || !data || !draft) return <main className="akdocs akdocs-gate"><div>
    <Leaf size={26} aria-hidden/><h1>Documentation editor</h1>
    <p>{error || (token ? 'Checking your admin session…' : 'Sign in through the Krishi Market admin panel to edit this documentation.')}</p>
    <div className="akdocs-actions"><Link className="akdocs-button akdocs-primary" to="/admin">Open admin sign-in</Link><Link className="akdocs-button" to="/docs">Public view</Link></div>
    {token && error && <button className="akdocs-button" type="button" onClick={() => setReload(value => value + 1)}>Retry</button>}
  </div></main>;

  const section = draft.sections.find(item => item.id === active) ?? draft.sections[0];
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.draft);

  function save(publish: boolean) {
    const current = { ...draft!, architecture: draft!.architecture.map(item => item.trim()).filter(Boolean),
      data_flow: draft!.data_flow.map(item => item.trim()).filter(Boolean) };
    void run(async () => {
      let next = data!;
      if (dirty) {
        next = await docsApi.save(token, next.revision, current);
        setData(next);
        setDraft(next.draft);
      }
      if (publish) {
        next = await docsApi.publish(token, next.revision);
        setData(next);
        setDraft(next.draft);
      }
      setMessage(publish ? `Revision ${next.published_revision} published. The current access settings still apply.` : 'Draft saved.');
    });
  }

  function changeVisibility(next: VisibilityChange) {
    void run(async () => {
      const result = await docsApi.visibility(token, data!.revision, next);
      setData(result);
      setMessage(result.visibility.available ? 'Public access is open.' : 'Public access settings saved. The page is currently closed.');
    });
  }

  function changeMember(index: number, member: Member) {
    setDraft(current => current && { ...current, team: replaceAt(current.team, index, member) });
  }

  function addPhoto(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void run(async () => {
      const photo = await cropPortrait(file);
      setDraft(current => current && { ...current, team: current.team.map((member, i) => i === index ? { ...member, photo } : member) });
    });
  }

  return <main className="akdocs akdocs-admin">
    <header className="akdocs-top"><Link className="akdocs-brand" to="/admin"><Leaf size={21}/> আমাদের কৃষি AI</Link><Link className="akdocs-button" to="/docs"><Eye size={16}/>Public view</Link></header>
    <div className="akdocs-admin-wrap">
      <div className="akdocs-admin-title"><div><p>{data.role} · Published revision {data.published_revision}</p><h1>Documentation editor</h1></div>
        <div className="akdocs-actions">
          <button className="akdocs-button" type="button" disabled={busy} onClick={() => setPreview(value => !value)}><Eye size={16}/>{preview ? 'Back to editor' : 'Preview draft'}</button>
          <button className="akdocs-button" type="button" disabled={busy || !dirty} onClick={() => save(false)}><Save size={16}/>Save draft</button>
          <button className="akdocs-button akdocs-primary" type="button" disabled={busy} onClick={() => save(true)}>Publish version</button>
        </div>
      </div>
      {error && <div className="akdocs-notice error" role="alert">{error} <button type="button" className="akdocs-button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload saved draft</button></div>}
      {message && <p className="akdocs-notice" role="status">{message}</p>}
      {preview ? <DocsContent document={draft} live={{ ...data.live, metrics: draft.show_metrics ? data.live.metrics : null }} revision={data.published_revision} preview/> : <>
        <VisibilityEditor key={JSON.stringify([data.visibility.starts_at, data.visibility.ends_at])} busy={busy} data={data} onChange={changeVisibility}/>
        <section className="akdocs-section akdocs-admin-section">
          <h2>Title and publication options</h2>
          <fieldset disabled={busy} className="akdocs-editor-section">
            <label>Project title<input required maxLength={110} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/></label>
            <label>Summary<input maxLength={300} value={draft.tagline} onChange={e => setDraft({ ...draft, tagline: e.target.value })}/></label>
            <label className="akdocs-check"><input type="checkbox" checked={draft.show_metrics} onChange={e => setDraft({ ...draft, show_metrics: e.target.checked })}/> Show aggregate activity in the public release</label>
          </fieldset>
        </section>
        <nav className="akdocs-editor-tabs" aria-label="Editing sections">
          {(['sections', 'team', 'diagrams', 'versions'] as const).map(item => <button className="akdocs-button" key={item} type="button" aria-pressed={panel === item} onClick={() => setPanel(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </nav>
        <fieldset disabled={busy} className="akdocs-section akdocs-admin-section">
          {panel === 'sections' && <div className="akdocs-editor-grid">
            <div>
              <h2>Sections</h2>
              <ol className="akdocs-order">
                {draft.sections.map((item, index) => <li key={item.id} draggable={!busy} onDragStart={event => {
                  dragged.current = index;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', item.id);
                }} onDragEnd={() => { dragged.current = -1; }} onDragOver={event => {
                  if (dragged.current >= 0) event.preventDefault();
                }} onDrop={event => {
                  event.preventDefault();
                  setDraft({ ...draft, sections: reorder(draft.sections, dragged.current, index) });
                  dragged.current = -1;
                }}>
                  <GripVertical size={16} aria-hidden/>
                  <button type="button" className="akdocs-order-select" aria-pressed={item.id === section.id} onClick={() => setActive(item.id)}>{item.title}</button>
                  <button type="button" aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => setDraft({ ...draft, sections: reorder(draft.sections, index, index - 1) })}><ArrowUp size={14}/></button>
                  <button type="button" aria-label={`Move ${item.title} down`} disabled={index === draft.sections.length - 1} onClick={() => setDraft({ ...draft, sections: reorder(draft.sections, index, index + 1) })}><ArrowDown size={14}/></button>
                </li>)}
              </ol>
              <button type="button" className="akdocs-button" disabled={draft.sections.length >= 40} onClick={() => {
                const id = `custom-${crypto.randomUUID()}`;
                setDraft({ ...draft, sections: [...draft.sections, { id, group: 'technical', title: 'New section', blocks: [] }] });
                setActive(id);
              }}><Plus size={16}/>Add section</button>
            </div>
            <div>
              <SectionEditor key={section.id} section={section} onChange={value => setDraft({ ...draft, sections: draft.sections.map(item => item.id === value.id ? value : item) })}/>
              {section.id.startsWith('custom-') && <button type="button" className="akdocs-button akdocs-remove" onClick={() => setDraft({ ...draft, sections: draft.sections.filter(item => item.id !== section.id) })}><Trash2 size={16}/>Remove section</button>}
            </div>
          </div>}
          {panel === 'team' && <div className="akdocs-editor-section">
            <h2>Team and contributors</h2>
            <label>Team name<input maxLength={110} value={draft.team_name} onChange={event => setDraft({ ...draft, team_name: event.target.value })}/></label>
            {draft.team.map((member, index) => <div className="akdocs-team-editor" key={index}>
              {member.photo ? <img src={member.photo} alt="" width="72" height="72"/> : <span className="akdocs-avatar" aria-hidden>{member.name.slice(0, 2) || '—'}</span>}
              <div className="akdocs-editor-section">
                <label>Full name<input required maxLength={110} value={member.name} onChange={event => changeMember(index, { ...member, name: event.target.value })}/></label>
                <label>Role<input required maxLength={110} value={member.role} onChange={event => changeMember(index, { ...member, role: event.target.value })}/></label>
                <label>Email address<input type="email" required value={member.email} onChange={event => changeMember(index, { ...member, email: event.target.value })}/></label>
                <label className="akdocs-check"><input type="checkbox" checked={member.show_email} onChange={event => changeMember(index, { ...member, show_email: event.target.checked })}/> Publish this contact email</label>
                <label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => addPhoto(index, event)}/></label>
                <div className="akdocs-actions">
                  {member.photo && <button type="button" className="akdocs-button" onClick={() => changeMember(index, { ...member, photo: '' })}>Remove photo</button>}
                  <button type="button" className="akdocs-button" onClick={() => setDraft({ ...draft, team: draft.team.filter((_, i) => index !== i) })}>Remove member</button>
                </div>
              </div>
            </div>)}
            <button type="button" className="akdocs-button" disabled={draft.team.length >= 16} onClick={() => setDraft({ ...draft, team: [...draft.team, { name: '', role: '', email: '', photo: '', show_email: false }] })}><Plus size={16}/>Add member</button>
          </div>}
          {panel === 'diagrams' && <div className="akdocs-editor-section">
            <h2>Diagrams and feature roadmap</h2>
            <p>Enter two to eight steps per diagram. Use one step per line.</p>
            <label>Architecture<textarea rows={5} value={draft.architecture.join('\n')} onChange={event => setDraft({ ...draft, architecture: event.target.value.split('\n') })}/></label>
            <label>Data flow<textarea rows={5} value={draft.data_flow.join('\n')} onChange={event => setDraft({ ...draft, data_flow: event.target.value.split('\n') })}/></label>
            {draft.roadmap.map((item, index) => <div key={index} className="akdocs-roadmap-edit">
              <input aria-label={`Roadmap item ${index + 1}`} required maxLength={110} value={item.name} onChange={e => setDraft({ ...draft, roadmap: replaceAt(draft.roadmap, index, { ...item, name: e.target.value }) })}/>
              <select aria-label={`Roadmap item ${index + 1} status`} value={item.status} onChange={e => setDraft({ ...draft, roadmap: replaceAt(draft.roadmap, index, { ...item, status: e.target.value as 'planned' | 'upcoming' }) })}><option value="upcoming">Upcoming</option><option value="planned">Planned</option></select>
              <button className="akdocs-button" type="button" aria-label={`Remove roadmap item ${index + 1}`} onClick={() => setDraft({ ...draft, roadmap: draft.roadmap.filter((_, i) => i !== index) })}><Trash2 size={16}/></button>
            </div>)}
            <button className="akdocs-button" type="button" disabled={draft.roadmap.length >= 24} onClick={() => setDraft({ ...draft, roadmap: [...draft.roadmap, { name: '', status: 'planned' }] })}><Plus size={16}/>Add roadmap item</button>
          </div>}
          {panel === 'versions' && <div>
            <h2>Published versions</h2>
            {!!data.live.changelog?.length ? <ul className="akdocs-releases">{data.live.changelog.map(version => <li key={version.revision}>
              <div><strong>Revision {version.revision}</strong><p>{version.title} · {dhakaDate.format(version.published_at * 1000)}</p></div>
              <button type="button" className="akdocs-button" disabled={dirty} onClick={() => void run(async () => {
                const next = await docsApi.restore(token, data.revision, version.revision);
                setData(next);
                setDraft(next.draft);
                setMessage(`Revision ${version.revision} restored to the draft.`);
              })}>Restore to draft</button>
            </li>)}</ul> : <p>Published revisions will appear here.</p>}
            {dirty && <p>Save your edits before restoring a previous revision.</p>}
          </div>}
        </fieldset>
      </>}
    </div>
  </main>;
}
