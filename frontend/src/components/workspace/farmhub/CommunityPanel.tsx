import { GroupSelling } from './GroupSelling.tsx';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CommunityPreview } from './CommunityPreview.tsx';
import { SocialFeed } from './SocialFeed.tsx';
import './Community.css';
import { LotPanel } from './LotPanel.tsx';
import { ArrowLeft, Camera, Leaf, MapPin, MessageCircle, Phone, Plus, Send, Sprout, Tractor, Users, Wheat } from 'lucide-react';
import { Card, errText, Feedback, Field, hub, metric, useHub } from './shared.tsx';

type Circle = { id: number; name: string; district: string; crop: string; description: string; members: number; joined: boolean; lot: { target: number; declared: number; final: boolean; wanted: string } | null };
type Demo = { id: number; key: string; author: string; author_id: number };
const icons = { rice: Wheat, vegetable: Sprout, mango: Leaf, equipment: Tractor, haor: Wheat, seed: Sprout };
const getLinkId = (key: string) => {
  const value = Number(new URLSearchParams(window.location.search).get(key));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};
const demoReply = 'ধন্যবাদ! এটি নমুনা উত্তর। আসল সদস্যরা এই চ্যাটে নিজেদের অ্যাকাউন্ট থেকে উত্তর দিতে পারবেন।';
type Member = { id: number; name: string; phone: string | null; leader: boolean; self: boolean };
type Message = { id: number; name: string; mine: boolean; body: string; sent: string };

export function CommunityPanel({ district }: { district?: string }) {
  const query = new URLSearchParams(window.location.search);
  const [groupChat, setGroupChat] = useState<number>();
  const [mode, setMode] = useState<'practice' | 'live' | 'sell'>(query.has('circle') && !query.has('practice') ? 'live' : 'practice');
  return <div className="soc-shell">
    <nav className="soc-filters soc-mode" aria-label="কমিউনিটি মোড">
      <button type="button" aria-pressed={mode === 'practice'} onClick={() => setMode('practice')}>নমুনা দল</button>
      <button type="button" aria-pressed={mode === 'live'} onClick={() => {setGroupChat(undefined); setMode('live');}}>আসল দল</button>
      <button type="button" aria-pressed={mode === 'sell'} onClick={() => setMode('sell')}><Wheat size={17}/>একসঙ্গে ফসল বিক্রি</button>
    </nav>
    {mode === 'practice' && <CommunityPreview/>}
    {mode === 'live' && <LiveCommunity district={district} chatGroup={groupChat}/>}
    {mode === 'sell' && <GroupSelling district={district} onOpenChat={id => { setGroupChat(id); setMode('live'); }}/>}
  </div>;
}

function LiveCommunity({ district, chatGroup }: { district?: string; chatGroup?: number }) {
  const [nearby, setNearby] = useState(false);
  const [circle, setCircle] = useState<number | null>(chatGroup ?? getLinkId('circle') ?? null);
  const [linkedPost, setLinkedPost] = useState(chatGroup ? undefined : getLinkId('post'));
  const [view, setView] = useState<'feed' | 'chat' | 'lot'>(chatGroup ? 'chat' : 'feed');
  const [createOpen, setCreateOpen] = useState(false);
  const [myGroups, setMyGroups] = useState(false);
  const [callDemo, setCallDemo] = useState(false);
  const [joined, setJoined] = useState<number[]>([]);
  const [newGroups, setNewGroups] = useState<Circle[]>([]);
  const [withLot, setWithLot] = useState(false);
  const [peer, setPeer] = useState<Member | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [older, setOlder] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const circles = useHub<Circle[]>('/circles', version, 30000);
  const demos = useHub<Demo[]>('/community/demo', version);
  const linkedGroup = useHub<Circle>(circle && !circles?.data?.some(group => group.id === circle) ? `/community/circles/${circle}` : null, version);
  const groups = Array.from(new Map([...newGroups, ...(circles?.data ?? []), ...(linkedGroup?.data ? [linkedGroup.data] : [])].map(x => [x.id, x])).values());
  const demoGroups = demos?.data?.filter(item => !groups.some(group => item.id === group.id)) ?? [];
  const olderDemos = useHub<Circle[]>(demoGroups.length ? '/community/rooms' : null, version);
  for (const group of olderDemos?.data ?? []) if (!groups.some(item => item.id === group.id)) groups.push(group);
  const activeGroup = groups.find(item => item.id === circle);
  const demo = demos?.data?.find(item => item.id === circle);
  const canView = !!circle && (activeGroup?.joined || joined.includes(circle));
  const members = useHub<Member[]>(canView && view === 'chat' ? `/circles/${circle}/members` : null, version, 15000);
  const contact = useHub<{ phone: string }>(canView && view === 'chat' ? '/contact' : null, version);
  const threadPath = canView && view === 'chat' ? `/circles/${circle}/messages${peer ? `?peer=${peer.id}` : ''}` : null;
  const messages = useHub<Message[]>(threadPath, version, 5000);
  const activeThread = useRef(threadPath);
  activeThread.current = threadPath;
  useEffect(() => { setOlder([]); setHasMore(true); }, [threadPath]);

  async function mutate(task: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await task(); setVersion(v => v + 1); setNotice(success); }
    catch (failure) { setError(errText(failure)); }
    finally { setBusy(false); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    void mutate(async () => {
      const row = await hub.post<{ id: number }>('/circles', { ...payload, target: payload.target ? Number(payload.target) : null });
      setNewGroups(previous => [...previous, { id: row.id, name: String(payload.name), district: String(payload.district),
        crop: String(payload.crop), description: String(payload.description), joined: true, members: 1, lot: payload.target ?
          { target: Number(payload.target), declared: 0, final: false, wanted: String(payload.wanted ?? '') } : null }]);
      form.reset(); setWithLot(false); setCreateOpen(false); openGroup(row.id);
    }, 'দল তৈরি হয়েছে।');
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body || !circle) return;
    void mutate(async () => {
      await hub.post(`/circles/${circle}/messages`, { body, target_id: peer?.id });
      form.reset();
    }, 'বার্তা পাঠানো হয়েছে।');
  }

  function openGroup(id: number) {
    setCircle(id); setPeer(null); setView('feed'); setCallDemo(false);
    if (circle !== id) setLinkedPost(undefined);
  }
  function joinGroup(id: number) {
    void mutate(async () => {
      await hub.post(`/circles/${id}/join`);
      setJoined(previous => previous.includes(id) ? previous : [...previous, id]);
      openGroup(id);
    }, 'দলে যোগ দিয়েছেন।');
  }
  const shownGroups = groups.filter(group => (!nearby || group.district.trim().toLowerCase() === district?.trim().toLowerCase()) &&
    (!myGroups || group.joined || joined.includes(group.id)));

  const conversation = [...older, ...messages?.data ?? []];
  const visible = conversation.filter((item, i, all) => all.findIndex(other => other.id === item.id) === i);
  async function loadOlder() {
    if (!threadPath || !visible[0]) return;
    const path = threadPath;
    try {
      const items = await hub.get<Message[]>(`${path}${path.includes('?') ? '&' : '?'}before=${visible[0].id}`);
      if (activeThread.current !== path) return;
      setHasMore(items.length >= 80);
      setOlder(current => [...items, ...current]);
    } catch (failure) { setError(errText(failure)); }
  }

  return <div className="soc-shell">
    <div className="soc-heading"><div><h2>{circle ? 'কৃষক দলের আড্ডা' : 'কৃষক কমিউনিটি'}</h2>
      <p className="fh-muted">অভিজ্ঞতা শেয়ার করুন, প্রশ্ন করুন, সাহায্য খুঁজুন।</p></div>
      {circle ? <button type="button" onClick={() => { setCircle(null); setPeer(null); setLinkedPost(undefined); }}><ArrowLeft size={17}/>সব দল</button>
        : <button type="button" className="fh-primary" onClick={() => setCreateOpen(open => !open)}><Plus size={17}/>নতুন দল</button>}
    </div>
    <Feedback error={error} pending={busy || !circles}/>
    {circles?.error && <div className="soc-connection" role="status">
      <div><strong>আসল দলের সার্ভার এখন পাওয়া যাচ্ছে না।</strong><p>Backend চালু করে আবার চেষ্টা করুন। নমুনা দলের কাজ এই ব্রাউজারেই চালু আছে।</p></div>
      <button type="button" onClick={() => setVersion(v => v + 1)}>আবার সংযোগ করুন</button>
    </div>}
    {notice && <p role="status" className="soc-confirm">{notice}</p>}
    {!circle && <>
      <div className="soc-filters"><button type="button" aria-pressed={!nearby && !myGroups} onClick={() => {setNearby(false);setMyGroups(false);}}>সব দল</button>
      <button type="button" aria-pressed={myGroups} onClick={() => {setNearby(false);setMyGroups(true);}}>আমার দল</button>
      {district && <button type="button" aria-pressed={nearby} onClick={() => {setNearby(true);setMyGroups(false);}}><MapPin size={16}/>আমার জেলা</button>}</div>
      {circles?.data && shownGroups.length === 0 && <p className="soc-card">এই তালিকায় কোনো দল নেই।</p>}
      <div className="soc-groups">{shownGroups.map(item => {
        const sample = demos?.data?.find(row => row.id === item.id);
        const glyph = sample?.key as keyof typeof icons | undefined;
        const Icon = (glyph && icons[glyph]) || Users;
        return <article className="soc-card soc-group" key={item.id}>
          <div className={`soc-cover ${sample?.key ?? 'farm'}`}><span><Icon size={23}/></span>{sample && <small>নমুনা দল</small>}</div>
          <div className="soc-group-content"><span className="soc-tag">{item.crop}</span><h3>{item.name}</h3>
            <p className="soc-meta"><MapPin size={14}/>{item.district} <Users size={14}/>{metric(item.members)} জন</p>
            <p>{item.description}</p>
            {item.lot && <p>সংগ্রহ {metric(item.lot.declared)}/{metric(item.lot.target)} কেজি</p>}
            {item.joined || joined.includes(item.id) ? <button type="button" onClick={() => openGroup(item.id)}>দল খুলুন</button>
              : <button type="button" className="fh-primary" disabled={busy} onClick={() => joinGroup(item.id)}>যোগ দিন</button>}
          </div>
        </article>;
      })}</div>
    </>}
    {createOpen && !circle && <Card title="নতুন কৃষক দল">
      <form className="fh-stack" onSubmit={create}>
        <Field label="দলের নাম"><input name="name" required maxLength={120}/></Field>
        <div className="fh-fields"><Field label="জেলা"><input name="district" required maxLength={120} defaultValue={district}/></Field>
          <Field label="আলোচনার বিষয় বা ফসল"><input name="crop" required maxLength={120}/></Field></div>
        <Field label="দলের বিবরণ"><textarea name="description" maxLength={2000}/></Field>
        <label className="fh-check"><input type="checkbox" checked={withLot} onChange={e => setWithLot(e.target.checked)}/>দলীয় ফসল সংগ্রহ যোগ করুন</label>
        {withLot && <div className="fh-fields"><Field label="সংগ্রহের লক্ষ্য (কেজি)"><input type="number" name="target" min="1" max="10000000" required/></Field>
        <Field label="জানা ক্রেতার চাহিদার নোট"><input name="wanted" maxLength={2000}/></Field></div>}
        <button className="fh-primary" disabled={busy || !circles?.data}>দল তৈরি করুন</button>
      </form>
    </Card>}
    {circle && activeGroup && <section className="soc-card soc-room">
      <div className="soc-heading"><div><span className="soc-tag">{demo ? 'নমুনা দল' : activeGroup.crop}</span>
        <h2>{activeGroup.name}</h2><p>{activeGroup.description}</p></div>
        {!canView && <button className="fh-primary" type="button" disabled={busy} onClick={() => joinGroup(circle)}>যোগ দিয়ে পোস্ট দেখুন</button>}</div>
      {canView && <nav aria-label="দলের বিভাগ" className="soc-filters">
        <button type="button" aria-pressed={view === 'feed'} onClick={() => setView('feed')}><Camera size={17}/>পোস্ট</button>
        <button type="button" aria-pressed={view === 'chat'} onClick={() => setView('chat')}><MessageCircle size={17}/>চ্যাট ও কল</button>
        {activeGroup.lot && <button type="button" aria-pressed={view === 'lot'} onClick={() => setView('lot')}><Wheat size={17}/>দলীয় সংগ্রহ</button>}
      </nav>}
    </section>}
    {circle && !activeGroup && linkedGroup?.error && <p className="soc-card">এই দলটি তালিকায় পাওয়া যায়নি।</p>}
    {circle && canView && view === 'feed' && <SocialFeed key={circle} circle={circle} highlight={linkedPost}/>}
    {circle && canView && view === 'lot' && activeGroup?.lot && <LotPanel key={circle} circle={circle} version={version} busy={busy} update={(path, data, final) =>
      void mutate(() => final ? hub.post(path, data) : hub.put(path, data), final ? 'লট চূড়ান্ত হয়েছে।' : 'ফসলের তথ্য সংরক্ষিত হয়েছে।')}/>}
    {circle && canView && view === 'chat' && <div className="soc-chat-grid">
      <Card title="দলের সদস্য">
        <Feedback error={members?.error} pending={!members}/>
        <button type="button" aria-pressed={!peer} onClick={() => { setPeer(null);setCallDemo(false); }}>দলীয় চ্যাট</button>
        {members?.data?.map(member => {
          const sample = member.id === demo?.author_id;
          const name = sample ? demo.author : member.name;
          return <div className="fh-row" key={member.id}><div><strong>{name}</strong><p>{member.leader ? 'দলনেতা' : 'সদস্য'}{member.self && ' · আপনি'}</p></div>
            {!member.self && <div className="fh-actions"><button type="button" aria-pressed={peer?.id === member.id} aria-label={`${name}-কে বার্তা`} onClick={() => {setPeer({...member,name});setCallDemo(false);}}><MessageCircle size={17}/></button>
              {sample && <button type="button" aria-label="নমুনা কল" onClick={() => setCallDemo(true)}><Phone size={17}/></button>}
              {!sample && member.phone && <a className="fh-button" aria-label={`${name}-কে ফোন করুন`} href={`tel:${member.phone}`}><Phone size={17}/></a>}</div>}
          </div>;
        })}
        {callDemo && <div className="soc-call" role="status"><Phone size={18}/>নমুনা কল স্ক্রিন · কোনো নম্বর ডায়াল হয়নি। <button type="button" onClick={() => setCallDemo(false)}>বন্ধ করুন</button></div>}
        <details><summary>কলের জন্য নিজের নম্বর শেয়ার</summary><p className="fh-muted">নম্বর সেভ করলে দলের সদস্যরা ফোনের ডায়ালার থেকে আপনাকে কল করতে পারবেন। নম্বর মুছে সেভ করলে শেয়ার বন্ধ হবে।</p>
          <Feedback error={contact?.error} pending={!contact}/>
          {contact?.data && <form className="fh-actions" onSubmit={event => {
            event.preventDefault();
            const phone = new FormData(event.currentTarget).get('phone');
            void mutate(() => hub.put('/contact', { phone }), 'ফোনের সেটিংস সংরক্ষিত হয়েছে।');
          }}><Field label="নিজের মোবাইল নম্বর"><input name="phone" type="tel" defaultValue={contact.data.phone} maxLength={16}/></Field>
          <button type="submit" disabled={busy}>সংরক্ষণ</button></form>}
        </details>
      </Card>
      <Card title={peer ? `${peer.name} · ব্যক্তিগত বার্তা` : 'দলের আলোচনা'}>
        <Feedback error={messages?.error} pending={!messages}/>
        {hasMore && visible.length >= 80 && <button type="button" onClick={() => void loadOlder()}>আগের বার্তা দেখুন</button>}
        <div className="fh-messages soc-messages" aria-label="বার্তার তালিকা" role="log">
          {messages?.data?.length === 0 && <p>আলোচনা শুরু করুন।</p>}
          {visible.map(message => <div key={message.id}>
            <article data-mine={message.mine}><strong>{message.mine ? 'আপনি' : message.name.startsWith(`sample-${demo?.key}-`) ? demo?.author : message.name}</strong><p>{message.body}</p></article>
            {peer && peer.id === demo?.author_id && message.mine &&
              <article><strong>{demo.author}</strong><p>{demoReply}</p></article>}
          </div>)}
        </div>
        <form key={threadPath} className="soc-inline-form" onSubmit={send}>
          <input name="body" aria-label="বার্তা" placeholder="বার্তা লিখুন…" required maxLength={2000}/>
          <button type="submit" className="fh-primary" disabled={busy}><Send size={16}/>পাঠান</button>
        </form>
      </Card>
    </div>}
  </div>;
}
