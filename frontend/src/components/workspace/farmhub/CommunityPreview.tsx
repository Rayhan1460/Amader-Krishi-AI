import { useEffect, useState, type FormEvent } from 'react';
import { Camera, ChevronLeft, Heart, ImagePlus, Leaf, MapPin, MessageCircle, Phone, Send, Share2, Sprout, Tractor, Users, Wheat, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.tsx';
import { metric } from './shared.tsx';

const groups = [
  { id: 'rice', name: 'নরসিংদী ধানচাষি দল', area: 'নরসিংদী', crop: 'ধান', member: 'শিউলি', icon: Wheat, work: 'আমন ধানের বীজতলা, সেচ ও পরিচর্যার অভিজ্ঞতা শেয়ার করছি।', sample: 'এবার বীজতলা তৈরির কাজ শুরু করেছি। আপনারা কোন জাতের ধান লাগাচ্ছেন?' },
  { id: 'vegetable', name: 'বগুড়া সবজি চাষি', area: 'বগুড়া', crop: 'সবজি', member: 'সাবিনা', icon: Sprout, work: 'সবজির চারা তৈরি, মাচা বানানো ও ক্ষেতে পোকা পর্যবেক্ষণ করছি।', sample: 'লাউয়ের জন্য মাচা তৈরি করছি। আপনাদের মাচার ছবি শেয়ার করুন।' },
  { id: 'mango', name: 'রাজশাহী আমবাগান', area: 'রাজশাহী', crop: 'আম', member: 'তানভীর', icon: Leaf, work: 'বাগানের পরিচর্যা ও ফল সংগ্রহের অভিজ্ঞতা বিনিময় করছি।', sample: 'বাগানের পরিচর্যার কাজ নোট করছি। কে কীভাবে নিজের কাজের হিসাব রাখেন?' },
  { id: 'equipment', name: 'যশোর কৃষি যন্ত্র সহায়তা', area: 'যশোর', crop: 'যন্ত্রপাতি', member: 'জাহিদ', icon: Tractor, work: 'রিপার ও পাওয়ার টিলার ভাড়ার খোঁজ এবং ব্যবহারের অভিজ্ঞতা শেয়ার করছি।', sample: 'আগামী সপ্তাহে রিপার প্রয়োজন। কারও কাছে ভাড়ায় পাওয়া যাবে?' },
  { id: 'haor', name: 'সুনামগঞ্জ হাওর কৃষক', area: 'সুনামগঞ্জ', crop: 'বোরো ধান', member: 'মেহেদী', icon: Wheat, work: 'হাওরের পানি পর্যবেক্ষণ ও বোরো ধান কাটার প্রস্তুতি নিচ্ছি।', sample: 'ধান কাটার প্রস্তুতিতে এই সপ্তাহে কোন কাজটি আগে করছেন?' },
  { id: 'seed', name: 'মানিকগঞ্জ বীজ ও চারা', area: 'মানিকগঞ্জ', crop: 'বীজ ও চারা', member: 'রওশন', icon: Sprout, work: 'মৌসুমি বীজ, চারা ও স্থানীয় নার্সারির খোঁজ শেয়ার করছি।', sample: 'লাউয়ের চারা খুঁজছি। কারও কাছে থাকলে জানাবেন?' },
] as const;
const labels = { update: 'আপডেট', question: 'প্রশ্ন', request: 'আমার প্রয়োজন' };
type Kind = keyof typeof labels;
type Post = { id: string; kind: Kind; text: string; image?: string };
type Message = { id: string; text: string; demo: boolean };
type Room = { joined?: boolean; posts?: Post[]; likes?: Record<string, boolean>; comments?: Record<string, Message[]>; chat?: Record<string, Message[]> };
type Rooms = Record<string, Room>;
const empty: Room = {};
const id = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const getGroup = () => {
  const link = new URLSearchParams(location.search).get('practice');
  return groups.find(group => group.id === link);
};

async function compress(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) {
    throw new Error('৬ এমবির মধ্যে JPG, PNG বা WebP ছবি দিন।');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 24_000_000) throw new Error('ছবিটি ছোট করে আবার দিন।');
    const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ছবিটি প্রক্রিয়া করা যায়নি।');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .77);
  } finally { URL.revokeObjectURL(url); }
}

function loadRooms(key: string): Rooms {
  try { return JSON.parse(localStorage.getItem(key) || '{}') ?? {}; }
  catch { return {}; }
}

export function CommunityPreview() {
  const { user } = useAuth();
  return <Preview key={user?.id ?? 'guest'} storage={`agri-community-preview-2:${user?.id ?? 'guest'}`}/>;
}

function Preview({ storage }: { storage: string }) {
  const [rooms, setRooms] = useState<Rooms>(() => loadRooms(storage));
  const [group, setGroup] = useState(getGroup);
  const [active, setActive] = useState<'feed' | 'chat'>('feed');
  const [kind, setKind] = useState<Kind>('update');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [comments, setComments] = useState('');
  const [thread, setThread] = useState<'group' | 'dm'>('group');
  const [calling, setCalling] = useState<'closed' | 'ringing' | 'connected'>('closed');
  const room = group ? rooms[group.id] ?? empty : empty;

  useEffect(() => {
    if (calling !== 'ringing') return;
    const timer = window.setTimeout(() => setCalling('connected'), 1000);
    return () => window.clearTimeout(timer);
  }, [calling]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === storage) setRooms(loadRooms(storage)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storage]);

  function change(groupId: string, apply: (current: Room) => Room) {
    const stored = loadRooms(storage);
    const next = { ...stored, [groupId]: apply(stored[groupId] ?? empty) };
    try {
      localStorage.setItem(storage, JSON.stringify(next));
      setRooms(next); setError('');
      return true;
    } catch {
      setError('এই ব্রাউজারে সেভ করার জায়গা নেই। ছোট ছবি দিয়ে বা ছবি ছাড়া আবার চেষ্টা করুন।');
      return false;
    }
  }

  function open(item: typeof group) {
    setGroup(item); setActive('feed'); setKind('update'); setText(''); setImage(''); setNotice(''); setShareLink('');
    setError(''); setThread('group'); setCalling('closed'); setComments('');
  }
  function addPost(event: FormEvent) {
    event.preventDefault();
    if (!group || !room.joined || processing || (!text.trim() && !image)) return;
    const post = { id: id(), kind, text: text.trim(), image: image || undefined };
    if (change(group.id, current => ({ ...current, posts: [post, ...(current.posts ?? [])] }))) {
      setText(''); setImage(''); setKind('update'); setNotice('নমুনা ফিডে পোস্ট সেভ হয়েছে।');
    }
  }
  async function share(post: Post) {
    if (!group) return;
    const url = new URL(location.href);
    url.search = new URLSearchParams({tab: 'farm_community', practice: group.id}).toString();
    // Only a sample group link is portable. User-created practice posts stay in this browser.
    if (post.id === 'sample') url.hash = 'community-preview-sample';
    setShareLink(url.toString());
    setNotice(post.id === 'sample' ? 'নমুনা দলের পোস্টের লিংক।' : 'এই পোস্ট ব্রাউজারে সেভ আছে। দলের নমুনা লিংক শেয়ার করতে পারবেন।');
    try {
      if (navigator.share) await navigator.share({title: group.name, url: url.toString()});
      else if (navigator.clipboard) await navigator.clipboard.writeText(url.toString());
    } catch { /* The link remains selectable below. */ }
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group || !room.joined) return;
    const form = event.currentTarget;
    const value = String(new FormData(form).get('text') ?? '').trim();
    if (!value) return;
    const rows = [{id: id(), text: value, demo: false}, {id: id(), text: thread === 'dm'
      ? 'বার্তা পেয়েছি! এটি অনুশীলনের জন্য স্বয়ংক্রিয় উত্তর।'
      : 'দলের আলোচনায় স্বাগতম। এটি অনুশীলনের জন্য স্বয়ংক্রিয় উত্তর।', demo: true}];
    if (change(group.id, current => ({ ...current, chat: { ...current.chat, [thread]: [...(current.chat?.[thread] ?? []), ...rows].slice(-100) } }))) form.reset();
  }

  if (!group) return <section className="soc-stack soc-practice" aria-labelledby="community-samples">
    <header className="soc-heading"><div><h2 id="community-samples">কৃষক দল ঘুরে দেখুন</h2><p className="fh-muted">ছয়টি নমুনা দলের কাজ ও আলোচনা দেখুন।</p></div></header>
    <div className="soc-groups">{groups.map(item => <article key={item.id} className="soc-card soc-group">
      <div className={`soc-cover ${item.id}`}><span><item.icon size={22}/></span><small>নমুনা দল</small></div>
      <div className="soc-group-content"><span className="soc-tag">{item.crop}</span>
        <h3>{item.name}</h3><p className="soc-meta"><MapPin size={15}/>{item.area} <Users size={15}/>{metric(rooms[item.id]?.joined ? 2 : 1)} নমুনা সদস্য</p>
        <p>{item.work}</p>
        <button type="button" className="fh-primary" onClick={() => {
          open(item);
          if (!rooms[item.id]?.joined) change(item.id, current => ({ ...current, joined: true }));
        }}>{rooms[item.id]?.joined ? 'দল খুলুন' : 'যোগ দিন'}</button>
      </div>
    </article>)}</div>
  </section>;

  const posts: Post[] = [...(room.posts ?? []), {id: 'sample', text: group.sample, kind: group.id === 'seed' || group.id === 'equipment' ? 'request' : 'update'}];
  return <section className="soc-stack soc-practice">
    <div className="soc-heading"><button type="button" onClick={() => open(undefined)}><ChevronLeft size={17}/>সব নমুনা দল</button><span className="soc-tag">এই ব্রাউজারের নমুনা</span></div>
    <div className="soc-card soc-room"><h2>{group.name}</h2><p>{group.work}</p>
      {room.joined ? <nav className="soc-filters" aria-label="নমুনা দলের বিভাগ">
        <button type="button" aria-pressed={active === 'feed'} onClick={() => {setActive('feed');setCalling('closed');}}><Camera size={18}/>পোস্ট</button>
        <button type="button" aria-pressed={active === 'chat'} onClick={() => setActive('chat')}><MessageCircle size={18}/>চ্যাট ও কল</button>
      </nav> : <button type="button" className="fh-primary" onClick={() => change(group.id, current => ({ ...current, joined: true }))}>যোগ দিন</button>}
    </div>
    {error && <p role="alert" className="fh-error">{error}</p>}
    {notice && <p role="status" className="soc-confirm">{notice}</p>}
    {shareLink && <label className="soc-inline">শেয়ার লিংক<input readOnly value={shareLink} onFocus={e => e.target.select()}/></label>}
    {room.joined && active === 'feed' && <>
      <form className="soc-card soc-compose" onSubmit={addPost}>
        <div className="soc-heading"><h2>পোস্ট লিখুন</h2><select aria-label="পোস্টের ধরন" value={kind} onChange={e => setKind(e.target.value as Kind)}>
          {Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
        <textarea aria-label="পোস্টের লেখা" value={text} onChange={e => setText(e.target.value)} maxLength={2000}
          placeholder={kind === 'request' ? 'যেমন, রিপার লাগবে। কারও কাছে আছে?' : 'কৃষক দলের সঙ্গে কী শেয়ার করবেন?'}/>
        {image && <div className="soc-preview"><img src={image} alt="আপলোডের আগে ছবির প্রিভিউ"/><button type="button" aria-label="ছবি সরান" onClick={() => setImage('')}><X size={18}/></button></div>}
        <div className="soc-actions"><label className="soc-photo-label"><ImagePlus size={17}/>ছবি দিন
          <input aria-label="ছবি দিন" type="file" accept="image/jpeg,image/png,image/webp" disabled={processing} onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = '';
            if (!file) return;
            setProcessing(true); setError('');
            try { setImage(await compress(file)); }
            catch (failure) { setError(failure instanceof Error ? failure.message : 'ছবি যোগ করা যায়নি।'); }
            finally { setProcessing(false); }
          }}/></label><button type="submit" className="fh-primary" disabled={processing || (!text.trim() && !image)}>{processing ? 'ছবি প্রস্তুত হচ্ছে…' : 'পোস্ট করুন'}</button></div>
      </form>
      {posts.map(post => <article className="soc-card soc-post" id={post.id === 'sample' ? 'community-preview-sample' : undefined} key={post.id}>
        <header className="soc-post-head"><span className="soc-avatar">{post.id === 'sample' ? group.member.slice(0, 1) : 'আ'}</span>
          <div><strong>{post.id === 'sample' ? group.member : 'আপনি'}</strong><time>{post.id === 'sample' ? 'নমুনা পোস্ট' : 'অনুশীলনের পোস্ট'}</time></div><span className={`soc-tag ${post.kind}`}>{labels[post.kind]}</span></header>
        {post.image && <img className="soc-photo" src={post.image} alt="পোস্টে যোগ করা ছবি"/>}
        {post.text && <p className="soc-body">{post.text}</p>}
        <div className="soc-actions"><button type="button" aria-pressed={!!room.likes?.[post.id]} onClick={() => change(group.id, current => ({...current, likes: {...current.likes, [post.id]: !current.likes?.[post.id]}}))}>
          <Heart size={17}/>লাইক {metric(room.likes?.[post.id] ? 1 : 0)}</button>
          <button type="button" aria-expanded={comments === post.id} onClick={() => setComments(comments === post.id ? '' : post.id)}><MessageCircle size={17}/>কমেন্ট {metric(room.comments?.[post.id]?.length ?? 0)}</button>
          <button type="button" onClick={() => void share(post)}><Share2 size={17}/>শেয়ার</button></div>
        {comments === post.id && <div className="soc-comments">{room.comments?.[post.id]?.map(comment => <div key={comment.id}><strong>আপনি</strong><p>{comment.text}</p></div>)}
          <form className="soc-inline-form" onSubmit={event => {
            event.preventDefault();
            const form = event.currentTarget;
            const value = String(new FormData(form).get('message') ?? '').trim();
            if (value && change(group.id, current => ({...current, comments: {...current.comments,
              [post.id]: [...(current.comments?.[post.id] ?? []), {id: id(), text: value, demo: false}].slice(-100)}}))) form.reset();
          }}><input name="message" aria-label="কমেন্ট লিখুন" placeholder="কমেন্ট লিখুন" required maxLength={1000}/><button type="submit">পাঠান</button></form></div>}
      </article>)}
    </>}
    {room.joined && active === 'chat' && <div className="soc-card soc-room">
      <div className="soc-heading"><h2>চ্যাট</h2><button type="button" onClick={() => setCalling('ringing')}><Phone size={17}/>নমুনা কল</button></div>
      {calling !== 'closed' && <div className="soc-call" role="status"><Phone size={18}/>
        {calling === 'ringing' ? `${group.member} · নমুনা কল হচ্ছে…` : 'নমুনা কল যুক্ত হয়েছে · কোনো ফোন নম্বর ব্যবহার হয়নি।'}
        <button type="button" onClick={() => setCalling('closed')}>কল শেষ করুন</button></div>}
      <div className="soc-filters"><button type="button" aria-pressed={thread === 'group'} onClick={() => setThread('group')}>দলীয় চ্যাট</button>
        <button type="button" aria-pressed={thread === 'dm'} onClick={() => setThread('dm')}>{group.member} · ব্যক্তিগত বার্তা</button></div>
      <div className="fh-messages soc-messages" role="log">
        <article><strong>{group.member} · নমুনা সদস্য</strong><p>স্বাগতম! এখানে বার্তা পাঠিয়ে দেখতে পারেন।</p></article>
        {room.chat?.[thread]?.map(message => <article key={message.id} data-mine={!message.demo}><strong>{message.demo ? `${group.member} · স্বয়ংক্রিয়` : 'আপনি'}</strong><p>{message.text}</p></article>)}
      </div>
      <form className="soc-inline-form" onSubmit={send} key={thread}><input name="text" aria-label="বার্তা লিখুন" placeholder="বার্তা লিখুন" required maxLength={2000}/>
        <button type="submit" className="fh-primary"><Send size={17}/>পাঠান</button></form>
    </div>}
  </section>;
}
