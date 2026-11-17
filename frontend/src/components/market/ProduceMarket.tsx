import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowRight, BadgeCheck, BarChart3, ClipboardList, Image, Leaf, LogOut, MapPin, PackageCheck, Pencil, RefreshCw, Search, ShieldCheck, ShoppingBag, Sprout, Wheat } from 'lucide-react';
import { api, API_BASE_URL, getErrorMessage } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import './ProduceMarket.css';

type State = 'pending' | 'approved' | 'rejected' | 'needs_revision';
type Listing = { id: number; crop: string; district: string; grade: string; quantity: number; available: number; price: number; notes: string; status: State; has_photo?: boolean; review_note?: string; seller?: string; created?: number; reviewed_at?: number | null; reviewer?: string | null };
type Order = { id: number; crop: string; district: string; quantity: number; total: number; contact: string; status: 'pending' | 'accepted' | 'declined' };
type AdminQueue = { username: string; counts: Partial<Record<State, number>>; items: Listing[] };
type Feed<T> = { scope?: string; loading: boolean; data?: T; error?: string; code?: number; live?: boolean };
const root = '/produce-market';
const staffClient = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
const adminKey = 'agrisphere_market_admin_session';
const bn = new Intl.NumberFormat('bn-BD', {maximumFractionDigits:2});
const money = (value: number) => '৳' + bn.format(value);
const status = { pending: 'যাচাইয়ের অপেক্ষায়', approved: 'বাজারে প্রকাশিত', rejected: 'প্রত্যাখ্যাত', needs_revision: 'সংশোধন প্রয়োজন' };
const orderStatus = { pending: 'কৃষকের উত্তরের অপেক্ষায়', accepted: 'কৃষক গ্রহণ করেছেন', declined: 'কৃষক প্রত্যাখ্যান করেছেন' };

function describe(error: unknown) {
  const message = getErrorMessage(error);
  return /[\u0980-\u09ff]/.test(message) ? message : axios.isAxiosError(error) && error.response?.status === 422
    ? 'পরিমাণ, দাম ও অন্য তথ্য ঠিক আছে কি না দেখুন।'
    : 'বাজারের সার্ভারে সংযোগ হয়নি। আবার চেষ্টা করুন।';
}

function updateScope(path: string) {
  if (path.startsWith('/admin/')) return 'admin';
  if (path.startsWith('/seller/') || path === '/orders?role=seller') return 'seller';
  return path === '/orders' ? 'buyer' : 'public';
}

function useFeed<T>(path: string | null, token: string | undefined, revision: number) {
  const scope = JSON.stringify([path, token]);
  const [state, setState] = useState<Feed<T>>({ loading: true });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const connection = token ? staffClient : api;
    const feed = updateScope(path);
    const config = { signal: controller.signal, ...(token ? {headers: {Authorization: `Bearer ${token}`}} : {}) };
    let pending: Promise<void> | undefined;
    let retryData = false;
    let connectionLive = false;

    async function load() {
      try {
        const { data } = await connection.get<T>(root + path, config);
        if (path?.startsWith('/admin/listings')) {
          if (!Array.isArray((data as AdminQueue)?.items)) throw new Error('Missing staff queue.');
        } else if (!Array.isArray(data)) throw new Error('Marketplace API response is not a list.');
        retryData = false;
        if (!controller.signal.aborted) setState({ scope, data, loading: false, live: connectionLive });
      } catch (failure) {
        retryData = true;
        const code = axios.isAxiosError(failure) ? failure.response?.status : undefined;
        if (!controller.signal.aborted) setState(old => ({
          scope, data: old.scope === scope && code !== 401 ? old.data : undefined, loading: false,
          error: describe(failure), code, live: false,
        }));
      }
    }
    function refresh() {
      if (controller.signal.aborted) return Promise.resolve();
      pending ??= load().finally(() => { pending = undefined; });
      return pending;
    }
    function setLive(live: boolean) {
      connectionLive = live;
      if (!controller.signal.aborted) setState(old => old.scope === scope && old.live !== live ? { ...old, live } : old);
    }
    async function watchChanges() {
      let version: number | undefined;
      while (!controller.signal.aborted) {
        try {
          const { data } = await connection.get<{ version: number }>(root + '/updates', {
            ...config, params: { scope: feed, after: version }, timeout: 26000,
          });
          if (!Number.isSafeInteger(data?.version) || data.version < 0) throw new Error('Missing feed version.');
          setLive(true);
          if (version !== data.version || retryData) {
            version = data.version;
            await pending;
            await refresh();
          }
        } catch (failure) {
          if (controller.signal.aborted) break;
          setLive(false);
          void refresh();
          if (axios.isAxiosError(failure) && failure.response?.status === 401) break;
          await new Promise<void>(resolve => window.setTimeout(resolve, 4200));
        }
      }
    }
    setState(old => ({ scope, data: old.scope === scope ? old.data : undefined, loading: old.scope !== scope || !old.data }));
    void refresh();
    void watchChanges();
    const refreshVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { controller.abort(); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [path, token, revision, scope]);
  return state.scope === scope ? state : { loading: !!path };
}

function LiveStatus({ feed }: { feed: Feed<unknown> }) {
  if (!feed.data || feed.error) return null;
  return <small className="pm-live-status" data-live={!!feed.live}>
    <span aria-hidden="true"/>{feed.live ? 'লাইভ আপডেট চালু' : 'স্বয়ংক্রিয় রিফ্রেশ'}
  </small>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="pm-field"><strong>{label}</strong>{children}</label>;
}
function Notice({ error, notice }: { error?: string; notice?: string }) {
  return error ? <p className="pm-feedback pm-error" role="alert">{error}</p> :
    notice ? <p className="pm-feedback" role="status">{notice}</p> : null;
}
function FeedState({ feed, reload }: { feed: Feed<unknown>; reload: () => void }) {
  if (feed.error) return <div className="pm-alert"><Notice error={feed.error}/><button type="button" onClick={reload}><RefreshCw size={16}/>আবার চেষ্টা করুন</button></div>;
  return feed.loading ? <p role="status">তথ্য লোড হচ্ছে…</p> : null;
}

export function MarketEntrances() {
  return <section className="pm-ui pm-entrances" aria-labelledby="market-portal-title">
    <div className="pm-entrance-head"><h2 id="market-portal-title">কৃষি বাজারে প্রবেশ করুন</h2><p>ফসল বিক্রি, ফসল খোঁজা অথবা বিক্রির আবেদন যাচাই।</p></div>
    <div className="pm-grid">
      <Link to="/workspace?tab=tools&model=tomato_price"><Sprout size={24}/><strong>কৃষক পোর্টাল</strong><span>ফসল বিক্রির আবেদন ও বাজারদর</span><ArrowRight size={18}/></Link>
      <Link to="/buyer"><ShoppingBag size={24}/><strong>ক্রেতার বাজার</strong><span>অনুমোদিত ফসল ও কেনার অনুরোধ</span><ArrowRight size={18}/></Link>
      <Link to="/admin"><ShieldCheck size={24}/><strong>অ্যাডমিন লগইন</strong><span>বিক্রির আবেদন যাচাই ও প্রকাশ</span><ArrowRight size={18}/></Link>
    </div>
  </section>;
}

export function FarmerMarket({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const showSeller = new URLSearchParams(search).get('market') === 'sell';
  const [tab,setTab] = useState<'prices' | 'sell'>(showSeller ? 'sell' : 'prices');
  useEffect(() => { setTab(showSeller ? 'sell' : 'prices'); }, [search, showSeller]);
  return <div className="pm-farmer">
    <div className="pm-ui pm-strip">
      <div><strong>কৃষি বাজার</strong><p>বাজারদর দেখুন বা নিজের ফসল বিক্রির আবেদন করুন।</p></div>
      <nav aria-label="কৃষি বাজারের বিভাগ">
        <button type="button" aria-pressed={tab==='prices'} onClick={()=>setTab('prices')}><BarChart3 size={17}/>বাজারদর</button>
        <button type="button" aria-pressed={tab==='sell'} onClick={()=>setTab('sell')}><Wheat size={17}/>ফসল বিক্রি করুন</button>
      </nav>
    </div>
    <div hidden={tab !== 'prices'}>{children}</div>
    {tab==='sell' && <SellerPanel/>}
  </div>;
}

function SellerPanel() {
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Listing>();
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photo, setPhoto] = useState<File>();
  const [photoError, setPhotoError] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const inFlight = useRef(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const listings = useFeed<Listing[]>('/seller/listings', undefined, version);
  const orders = useFeed<Order[]>('/orders?role=seller', undefined, version);
  const reload = () => setVersion(value => value + 1);
  const estimated = Number(quantity) * Number(price);

  useEffect(() => {
    if (!photo) { setPhotoUrl(''); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function run(work: () => Promise<void>, message: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(message);
      reload();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function choosePhoto(file: File | undefined) {
    setPhotoError('');
    if (!file) { setPhoto(undefined); return; }
    if (file.size > 3 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhoto(undefined);
      if (photoInput.current) photoInput.current.value = '';
      setPhotoError('৩ MB-এর ভেতরে একটি JPG, PNG বা WebP ছবি বেছে নিন।');
      return;
    }
    setPhoto(file);
  }

  function openEditor(item?: Listing) {
    if (inFlight.current) return;
    setEditing(item);
    setError('');
    setNotice('');
    setPhoto(undefined);
    setPhotoError('');
    setQuantity(item ? String(item.quantity) : '');
    setPrice(item ? String(item.price) : '');
    if (item) requestAnimationFrame(() => {
      editorHeading.current?.focus({ preventScroll: true });
      editorHeading.current?.scrollIntoView({ block: 'center' });
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photoError) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    void run(async () => {
      const encoded = photo ? await readPhoto(photo) : undefined;
      const payload = { ...fields, quantity: Number(fields.quantity), photo: encoded };
      if (editing) await api.put(root + `/seller/listings/${editing.id}`, payload);
      else await api.post(root + '/seller/listings', payload);
      form.reset();
      setEditing(undefined);
      setPhoto(undefined);
      setQuantity('');
      setPrice('');
    }, editing ? 'সংশোধিত আবেদন আবার অ্যাডমিনের কাছে পাঠানো হয়েছে।' :
      'আবেদন অ্যাডমিনের কাছে পাঠানো হয়েছে। “আমার আবেদন”-এ অবস্থা দেখুন।');
  }

  return <section className="pm-ui pm-content pm-sell">
    <header className="pm-sell-hero">
      <div><span className="pm-sell-icon"><Wheat size={22}/></span><h2>ফসল বিক্রির আবেদন</h2>
        <p>ফসলের তথ্য দিয়ে আবেদন পাঠান। অ্যাডমিন অনুমোদন দিলে ক্রেতার বাজারে ফসলটি দেখা যাবে।</p>
      </div>
      <ol aria-label="বিক্রির আবেদনের ধাপ">
        <li><span>১</span>আবেদন জমা</li><li><span>২</span>অ্যাডমিন যাচাই</li><li><span>৩</span>বাজারে প্রকাশ</li>
      </ol>
    </header>
    <Notice error={error} notice={notice}/>
    <div className="pm-sell-grid">
      <form key={editing?.id ?? 'new'} className="pm-card pm-form pm-sell-form" onSubmit={submit}>
        <div className="pm-sell-list-head">
          <h3 tabIndex={-1} ref={editorHeading}>{editing ? 'আবেদন সংশোধন করুন' : 'ফসলের তথ্য দিন'}</h3>
          {editing && <button type="button" disabled={busy} onClick={() => openEditor()}>সংশোধন বন্ধ করুন</button>}
        </div>
        {editing?.review_note && <p className="pm-review-note">অ্যাডমিনের নির্দেশনা · {editing.review_note}</p>}
        <div className="pm-fields">
          <Field label="ফসলের নাম"><input name="crop" defaultValue={editing?.crop} required maxLength={120} placeholder="যেমন বোরো ধান"/></Field>
          <Field label="জেলা বা সংগ্রহের এলাকা"><input name="district" defaultValue={editing?.district} required maxLength={120} placeholder="যেমন নরসিংদী"/></Field>
          <Field label="মান বা গ্রেড"><input name="grade" defaultValue={editing?.grade} required maxLength={120} placeholder="যেমন পরিষ্কার ও শুকনা"/></Field>
          <Field label="পরিমাণ (কেজি)"><input name="quantity" type="number" required min="1" max="1000000" step="1"
            value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="যেমন ২৫০"/></Field>
          <Field label="দর (৳/কেজি)"><input name="price" type="number" required min=".01" max="100000" step=".01"
            value={price} onChange={event => setPrice(event.target.value)} placeholder="যেমন ৩২"/></Field>
        </div>
        <Field label="সংগ্রহের সময় বা অতিরিক্ত তথ্য"><textarea name="notes" defaultValue={editing?.notes} maxLength={1000} placeholder="কবে ও কোথা থেকে ফসল নেওয়া যাবে"/></Field>
        <div className="pm-sell-photo">
          {photoUrl && <img src={photoUrl} alt="ফসলের আপলোড করা ছবির প্রিভিউ"/>}
          <div className="pm-form">
            <Field label="ফসলের ছবি (ঐচ্ছিক)"><input type="file" ref={photoInput} accept="image/jpeg,image/png,image/webp"
              aria-describedby="pm-photo-hint" onChange={event => choosePhoto(event.target.files?.[0])}/></Field>
            <p id="pm-photo-hint">{editing?.has_photo ? "আগের ছবি আছে। বদলাতে নতুন ছবি বাছুন।" : "JPG, PNG বা WebP · সর্বোচ্চ ৩ MB"}</p>
            {(photo || photoError) && <button type="button" className="pm-clear-photo" onClick={() => {
              if (photoInput.current) photoInput.current.value = '';
              choosePhoto(undefined);
            }}>ছবি সরান</button>}
          </div>
        </div>
        <Notice error={photoError}/>
        <div className="pm-sell-bottom">
          {estimated > 0 && Number.isFinite(estimated) && <div className="pm-sell-total">
            <span>সব ফসল বিক্রি হলে মোট দাম</span><strong>{money(estimated)}</strong>
          </div>}
          <button type="submit" className="pm-primary" disabled={busy || !!photoError}>
            {busy ? 'আবেদন পাঠানো হচ্ছে…' : editing ? 'আবার যাচাইয়ের জন্য পাঠান' : 'যাচাইয়ের জন্য পাঠান'} <ArrowRight size={17}/>
          </button>
        </div>
      </form>
      <section className="pm-card pm-form pm-sell-list">
        <div className="pm-sell-list-head"><h3><ClipboardList size={20}/>আমার আবেদন</h3>
          <button type="button" aria-label="আবেদনের তালিকা আপডেট করুন" onClick={reload}><RefreshCw size={16}/></button>
        </div>
        <LiveStatus feed={listings}/>
        <FeedState feed={listings} reload={reload}/>
        {listings.data?.length === 0 && <p className="pm-sell-empty">আবেদন জমা দিলে এখানে তার অবস্থা দেখা যাবে।</p>}
        {listings.data?.map(item => <article key={item.id} className="pm-row pm-sell-row">
          {item.has_photo && <PrivatePhoto item={item}/>}
          <div><strong>{item.crop}</strong><p>{item.district} · {bn.format(item.quantity)} কেজি · {money(item.price)}/কেজি</p>
            {item.review_note && <p>অ্যাডমিনের মন্তব্য · {item.review_note}</p>}
          </div>
          <span className="pm-badge" data-status={item.status}>{status[item.status]}</span>
          {item.status === 'needs_revision' && <button type="button" disabled={busy} onClick={() => openEditor(item)}>
            <Pencil size={16}/>সংশোধন করুন
          </button>}
        </article>)}
      </section>
    </div>
    <OrderList feed={orders} reload={reload} seller busy={busy} onDecision={(id, accepted) => void run(async () => {
      await api.put(root + `/seller/orders/${id}`, { status: accepted ? 'accepted' : 'declined' });
    }, accepted ? 'কেনার অনুরোধ গ্রহণ করা হয়েছে।' : 'কেনার অনুরোধ প্রত্যাখ্যাত হয়েছে।')}/>
  </section>;
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data !== 'string' || !data.includes(',')) reject(new Error('Cannot read photo'));
      else resolve(data.slice(data.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function PrivatePhoto({ item, token, expanded = false }: { item: Listing; token?: string; expanded?: boolean }) {
  const [opened, setOpened] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const visible = expanded || opened;
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl = '';
    setError(false);
    setUrl('');
    const path = root + `/${token ? 'admin' : 'seller'}/listings/${item.id}/photo`;
    const config = { responseType: 'blob' as const, signal: controller.signal, ...(token ? {headers:{Authorization:`Bearer ${token}`}} : {}) };
    void (token ? staffClient : api).get<Blob>(path, config).then(response => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(response.data);
      setUrl(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id, item.reviewed_at, token, visible]);
  const picture = url ? <img src={url} alt={item.crop}/> :
    <p role="status">{error ? 'ছবি পাওয়া যায়নি।' : 'ছবি লোড হচ্ছে…'}</p>;
  if (expanded) return <div className="pm-admin-photo">{picture}</div>;
  return <details className="pm-listing-photo" onToggle={event => {
    setOpened(event.currentTarget.open);
    if (!event.currentTarget.open) setUrl('');
  }}>
    <summary><Image size={16}/>ফসলের ছবি দেখুন</summary>
    {opened && picture}
  </details>;
}

function OrderList({ feed, reload, seller=false, busy=false, onDecision }: {
  feed: Feed<Order[]>; reload:()=>void; seller?:boolean; busy?:boolean; onDecision?:(id:number, accepted:boolean)=>void;
}) {
  return <section className="pm-card pm-form"><h3>{seller?'ক্রেতার কেনার অনুরোধ':'আমার কেনার অনুরোধ'}</h3><FeedState feed={feed} reload={reload}/>
    {feed.data?.length===0 && <p>কোনো অনুরোধ নেই।</p>}
    {feed.data?.map(item=><article className="pm-row" key={item.id}><div><strong>{item.crop} · {bn.format(item.quantity)} কেজি</strong>
      <p>{item.district} · {money(item.total)} · {orderStatus[item.status]}</p>{seller && <p>ক্রেতার যোগাযোগ · {item.contact}</p>}</div>
      {seller && item.status==='pending' && <div className="pm-actions"><button type="button" className="pm-primary" disabled={busy} onClick={()=>onDecision?.(item.id,true)}>গ্রহণ করুন</button>
        <button type="button" disabled={busy} onClick={()=>onDecision?.(item.id,false)}>প্রত্যাখ্যান</button></div>}
    </article>)}
  </section>;
}

function Portal({ name, children }: { name:string; children:ReactNode }) {
  return <div className="pm-ui pm-portal"><header className="pm-top"><div><Sprout size={22}/><strong>আমাদের কৃষি</strong><span>{name}</span></div>
    <Link to="/"><ArrowLeft size={17}/>ল্যান্ডিং পেজ</Link></header><main>{children}</main></div>;
}
const examples = [
  { id:-1, crop:'বোরো ধান', district:'বগুড়া', grade:'শুকনা ধান · গ্রেড A', quantity:850, price:32, notes:'স্থানীয় সংগ্রহ কেন্দ্র থেকে তোলা যাবে।' },
  { id:-2, crop:'মৌসুমি টমেটো', district:'যশোর', grade:'বাছাই করা', quantity:420, price:27, notes:'সকালের সংগ্রহের জন্য উপযোগী।' },
  { id:-3, crop:'সরিষা', district:'মানিকগঞ্জ', grade:'পরিষ্কার ও শুকনা', quantity:250, price:79, notes:'বস্তাভিত্তিক সংগ্রহ।' },
];

export function BuyerMarketPage() {
  const { isAuthenticated, isDemo } = useAuth();
  const location = useLocation();
  const [revision,setRevision] = useState(0);
  const [tab,setTab] = useState<'market' | 'orders'>('market');
  const [search,setSearch] = useState('');
  const [district,setDistrict] = useState('');
  const [picked,select] = useState<number>();
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const feed=useFeed<Listing[]>('/listings',undefined,revision);
  const orders=useFeed<Order[]>(tab==='orders' && isAuthenticated && !isDemo ? '/orders' : null,undefined,revision);
  const items=[...(feed.data??[]).map(x=>({...x, demo:false})),...examples.map(x=>({...x,available:x.quantity,has_photo:false,demo:true}))];
  const visible=items.filter(x=>(!district||x.district===district)&&`${x.crop} ${x.district}`.toLowerCase().includes(search.trim().toLowerCase()));
  const chosen=feed.data?.find(x=>x.id===picked);
  async function buy(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen || busy) return;
    const data=Object.fromEntries(new FormData(event.currentTarget));
    setError('');setNotice('');setBusy(true);
    try {
      await api.post(root+`/listings/${chosen.id}/orders`,{ quantity:Number(data.quantity), contact:data.contact });
      select(undefined);setTab('orders');setRevision(v=>v+1);setNotice('কেনার অনুরোধ কৃষকের কাছে পাঠানো হয়েছে।');
    } catch(failure) {setError(describe(failure));}
    finally {setBusy(false);}
  }
  return <Portal name="ক্রেতা পোর্টাল">
    <div className="pm-hero"><span className="pm-emblem"><ShoppingBag size={25}/></span><h1>ক্রেতার কৃষি বাজার</h1><p>এলাকা ধরে অনুমোদিত ফসল খুঁজুন। পরিমাণ বেছে কৃষকের কাছে কেনার অনুরোধ পাঠান।</p></div>
    <div className="pm-tabs"><button type="button" aria-pressed={tab==='market'} onClick={()=>setTab('market')}>ফসলের তালিকা</button>
      <button type="button" aria-pressed={tab==='orders'} onClick={()=>setTab('orders')}>আমার অনুরোধ</button></div>
    <Notice error={error} notice={notice}/>
    {tab==='market' ? <>
      <div className="pm-fields pm-card pm-search">
        <Field label="ফসল বা এলাকা খুঁজুন"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="যেমন ধান"/></Field>
        <Field label="এলাকা"><select value={district} onChange={e=>setDistrict(e.target.value)}><option value="">সব এলাকা</option>
          {[...new Set(items.map(x=>x.district))].map(x=><option key={x}>{x}</option>)}</select></Field>
      </div>
      <LiveStatus feed={feed}/>
      <FeedState feed={feed} reload={()=>setRevision(v=>v+1)}/>
      {chosen && <form className="pm-card pm-form pm-purchase" onSubmit={buy}>
        <div className="pm-row"><div><h3>{chosen.crop} কেনার অনুরোধ</h3><p>{money(chosen.price)}/কেজি · আছে {bn.format(chosen.available)} কেজি</p></div><button type="button" onClick={()=>select(undefined)}>বন্ধ করুন</button></div>
        <div className="pm-fields"><Field label="কত কেজি চান"><input name="quantity" type="number" required min="1" max={chosen.available}/></Field>
          <Field label="কৃষকের জন্য আপনার যোগাযোগ"><input name="contact" required maxLength={120} placeholder="ফোন নম্বর বা ইমেইল"/></Field></div>
        <button type="submit" className="pm-primary" disabled={busy}>অনুরোধ পাঠান</button>
      </form>}
      {picked && !chosen && <p className="pm-feedback" role="status">বেছে নেওয়া ফসলের স্টক বদলেছে। তালিকা থেকে আবার বেছে নিন।</p>}
      {!visible.length && <p>এই খোঁজে ফসল পাওয়া যায়নি।</p>}
      <div className="pm-grid">{visible.map((item,index)=><article className="pm-card pm-product" key={item.id}>
        <div className={`pm-cover${item.has_photo ? ' pm-cover-photo' : ''}`} data-tone={index%3}>
          {item.has_photo ? <img loading="lazy" src={API_BASE_URL + root + `/listings/${item.id}/photo`} alt={item.crop}/> : <span><Leaf size={25}/></span>}
          <span className="pm-badge">{item.demo?'নমুনা':'অনুমোদিত'}</span></div>
        <div className="pm-form pm-product-body"><h2>{item.crop}</h2><p className="pm-meta"><MapPin size={15}/>{item.district} · {item.grade}</p>
          <div className="pm-product-price"><strong>{money(item.price)}<small>/কেজি</small></strong><span>{bn.format(item.available)} কেজি</span></div><p>{item.notes}</p>
          {item.demo ? <small>বাজারের নমুনা তালিকা</small> : isAuthenticated && !isDemo ?
            <button type="button" className="pm-primary" onClick={()=>{select(item.id);setError('');requestAnimationFrame(()=>document.querySelector('.pm-purchase')?.scrollIntoView({block:'center'}));}}>কেনার অনুরোধ</button>
            : <Link className="pm-primary" to="/login" state={{from:location}}>কেনার জন্য লগইন করুন</Link>}
        </div>
      </article>)}</div>
    </> : isAuthenticated && !isDemo ? <OrderList feed={orders} reload={()=>setRevision(v=>v+1)}/> :
      <Link to="/login" state={{from:location}}>কেনার অনুরোধ দেখতে লগইন করুন</Link>}
  </Portal>;
}

const reviewTabs = [
  { key: 'pending', label: 'যাচাই বাকি', Icon: ClipboardList },
  { key: 'needs_revision', label: 'সংশোধনের অপেক্ষায়', Icon: Pencil },
  { key: 'approved', label: 'বাজারে প্রকাশিত', Icon: BadgeCheck },
  { key: 'rejected', label: 'প্রত্যাখ্যাত', Icon: PackageCheck },
] as const;
const decisionMessage: Record<Exclude<State, 'pending'>, string> = {
  approved: 'আবেদন অনুমোদিত। ক্রেতার বাজারে প্রকাশ হয়েছে।',
  needs_revision: 'আবেদনটি সংশোধনের জন্য কৃষকের কাছে ফেরত পাঠানো হয়েছে।',
  rejected: 'আবেদন প্রত্যাখ্যান করা হয়েছে।',
};
const reviewDate = new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' });

export function AdminMarketPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(adminKey) ?? '');
  const [tab, setTab] = useState<State | 'all'>('pending');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const working = useRef(false);
  const detail = useRef<HTMLElement>(null);
  const queue = useFeed<AdminQueue>(token ? `/admin/listings?status=${tab}` : null, token || undefined, revision);
  const items = (queue.data?.items ?? []).filter(item =>
    `${item.crop} ${item.district} ${item.seller ?? ''} ${item.id} ${bn.format(item.id)}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const item = items.find(row => row.id === selected) ?? items[0];
  const reload = () => setRevision(value => value + 1);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  function setSession(value: string) {
    if (value) sessionStorage.setItem(adminKey, value);
    else sessionStorage.removeItem(adminKey);
    setToken(value);
  }

  useEffect(() => {
    if (queue.code !== 401 || !token) return;
    sessionStorage.removeItem(adminKey);
    setToken('');
    setNotice('');
    setError('সেশনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।');
  }, [queue.code, token]);

  async function run(work: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try { await work(); }
    catch (failure) { setError(describe(failure)); }
    finally {
      working.current = false;
      setBusy(false);
    }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    void run(async () => {
      const response = await staffClient.post<{ token: string }>(root + '/admin/login', values);
      if (typeof response.data.token !== 'string') throw new Error('Missing admin token.');
      setTab('pending');
      setQuery('');
      setSelected(undefined);
      setSession(response.data.token);
      reload();
    });
  }

  function signOut() {
    void run(async () => {
      try { await staffClient.post(root + '/admin/logout', null, auth); }
      catch (failure) { if (!axios.isAxiosError(failure) || failure.response?.status !== 401) throw failure; }
      setSession('');
    });
  }

  function chooseTab(next: State | 'all') {
    setTab(next);
    setSelected(undefined);
    setQuery('');
    setError('');
  }

  function review(event: FormEvent<HTMLFormElement>, current: Listing) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (!submitter || !Object.hasOwn(decisionMessage, submitter.value)) return;
    const action = submitter.value as Exclude<State, 'pending'>;
    const noteField = event.currentTarget.elements.namedItem('note');
    const note = noteField instanceof HTMLTextAreaElement ? noteField.value.trim() : '';
    if (action !== 'approved' && !note && noteField instanceof HTMLTextAreaElement) {
      noteField.setCustomValidity('কৃষকের জন্য কারণ বা নির্দেশনা লিখুন।');
      noteField.reportValidity();
      noteField.setCustomValidity('');
      return;
    }
    void run(async () => {
      try {
        await staffClient.put(root + `/admin/listings/${current.id}`, {
          action, note, expected_reviewed_at: current.reviewed_at ?? null,
        }, auth);
        setNotice(decisionMessage[action]);
        setSelected(undefined);
      } catch (failure) {
        if (axios.isAxiosError(failure) && failure.response?.status === 401) setSession('');
        throw failure;
      } finally { reload(); }
    });
  }

  return <Portal name="অ্যাডমিন প্যানেল">
    {!token ? <div className="pm-admin-signin">
      <section className="pm-admin-banner">
        <span><ShieldCheck size={22}/>কৃষি বাজার</span><h1>আবেদন যাচাই ও প্রকাশ</h1>
        <p>কৃষকের ফসলের তথ্য যাচাই করে ক্রেতার বাজারে প্রকাশ করুন।</p>
      </section>
      <form className="pm-card pm-form pm-login pm-admin-login" onSubmit={signIn}>
        <h2>অ্যাডমিন লগইন</h2>
        <Notice error={error}/>
        <Field label="অ্যাডমিন ব্যবহারকারীর নাম"><input name="username" required autoComplete="username" maxLength={64}/></Field>
        <Field label="পাসওয়ার্ড"><input name="password" type="password" required autoComplete="current-password" maxLength={256}/></Field>
        <button type="submit" className="pm-primary" disabled={busy}>লগইন করুন <ArrowRight size={17}/></button>
      </form>
    </div> : <>
      <header className="pm-admin-banner pm-admin-banner--workspace">
        <div><span><ShieldCheck size={19}/>কৃষি বাজার</span><h1>আবেদন পর্যালোচনা</h1></div>
        <div className="pm-admin-account">
          {queue.data?.username && <bdi>{queue.data.username}</bdi>}
          <button type="button" disabled={busy} onClick={signOut}><LogOut size={17}/>লগআউট</button>
        </div>
      </header>
      <nav className="pm-admin-stats" aria-label="আবেদনের অবস্থা">
        {reviewTabs.map(({ key, label, Icon }) => <button type="button" key={key} data-state={key}
          aria-pressed={tab === key} onClick={() => chooseTab(key)}>
          <span className="pm-admin-stat-icon"><Icon size={20}/></span>
          <span>{label}<strong>{queue.data ? bn.format(queue.data.counts?.[key] ?? 0) : '—'}</strong></span>
        </button>)}
      </nav>
      <Notice error={error} notice={notice}/>
      <div className="pm-admin-workspace">
        <section className="pm-card pm-form pm-admin-queue" aria-labelledby="pm-admin-queue-title">
          <header><h2 id="pm-admin-queue-title">আবেদনের তালিকা</h2>
            <button type="button" onClick={reload} aria-label="আবেদনের তালিকা আপডেট করুন"><RefreshCw size={17}/></button>
          </header>
          <div className="pm-admin-list-tools">
            <label className="pm-admin-search"><Search size={17}/>
              <input type="search" aria-label="এই তালিকায় আবেদন খুঁজুন" placeholder="ফসল, এলাকা বা আবেদন নম্বর"
                value={query} onChange={e => setQuery(e.target.value)}/>
            </label>
            <button type="button" aria-pressed={tab === 'all'} onClick={() => chooseTab('all')}>সব আবেদন</button>
          </div>
          <LiveStatus feed={queue}/>
          <FeedState feed={queue} reload={reload}/>
          {queue.data && !items.length && <div className="pm-admin-empty">
            <PackageCheck size={23}/><p>{query.trim() ? 'এই খোঁজে কোনো আবেদন পাওয়া যায়নি।' : 'এই তালিকায় কোনো আবেদন নেই।'}</p>
          </div>}
          <ul className="pm-admin-list">{items.map(row => <li key={row.id}>
            <button type="button" aria-pressed={item?.id === row.id} onClick={() => {
              setSelected(row.id);
              if (window.matchMedia('(max-width: 760px)').matches) {
                detail.current?.scrollIntoView({ block: 'start' });
                detail.current?.focus({ preventScroll: true });
              }
            }}>
              <span><strong>{row.crop}</strong><small>{row.district} · #{bn.format(row.id)}</small></span>
              <span className="pm-badge" data-status={row.status}>{status[row.status]}</span>
            </button>
          </li>)}</ul>
        </section>

        {item && <section className="pm-card pm-form pm-admin-detail" ref={detail} tabIndex={-1} aria-label="নির্বাচিত আবেদন">
          <div className="pm-admin-detail-head">
            <div><p>আবেদন #{bn.format(item.id)}{item.status === 'pending' && item.reviewed_at ? ' · সংশোধিত' : ''}</p><h2>{item.crop}</h2></div>
            <span className="pm-badge" data-status={item.status}>{status[item.status]}</span>
          </div>
          <div className="pm-admin-dossier">
            {item.has_photo ? <PrivatePhoto key={item.id} item={item} token={token} expanded/> :
              <div className="pm-admin-photo pm-admin-photo--empty"><Image size={26}/><span>ছবি সংযুক্ত নেই</span></div>}
            <dl>
              <div><dt>আবেদনকারী</dt><dd><bdi>{item.seller}</bdi></dd></div>
              <div><dt>সংগ্রহের এলাকা</dt><dd>{item.district}</dd></div>
              <div><dt>মান বা গ্রেড</dt><dd>{item.grade}</dd></div>
              <div><dt>পরিমাণ</dt><dd>{bn.format(item.quantity)} কেজি</dd></div>
              <div><dt>প্রতি কেজির দাম</dt><dd>{money(item.price)}</dd></div>
              <div><dt>জমার তারিখ</dt><dd>{item.created ? reviewDate.format(new Date(item.created * 1000)) : '—'}</dd></div>
            </dl>
          </div>
          {item.notes && <div className="pm-admin-note"><h3>কৃষকের দেওয়া অতিরিক্ত তথ্য</h3><p>{item.notes}</p></div>}
          {item.status === 'pending' ? <form className="pm-form pm-admin-review" key={`${item.id}-${item.reviewed_at}`} onSubmit={e => review(e, item)}>
            <Field label="কৃষকের জন্য মন্তব্য বা নির্দেশনা">
              <textarea name="note" maxLength={1000} placeholder="কী সংশোধন করতে হবে বা সিদ্ধান্তের কারণ লিখুন"/>
            </Field>
            <div className="pm-actions">
              <button type="submit" className="pm-primary" value="approved" disabled={busy}><BadgeCheck size={17}/>অনুমোদন ও প্রকাশ</button>
              <button type="submit" value="needs_revision" disabled={busy}><Pencil size={16}/>সংশোধনের জন্য ফেরত</button>
              <button type="submit" className="pm-admin-reject" value="rejected" disabled={busy}>প্রত্যাখ্যান</button>
            </div>
          </form> : <>
            {item.review_note && <div className="pm-review-note"><strong>অ্যাডমিনের মন্তব্য</strong><p>{item.review_note}</p></div>}
            {item.reviewer && item.reviewed_at && <p className="pm-admin-attribution">
              সিদ্ধান্ত নিয়েছেন <bdi>{item.reviewer}</bdi> · {reviewDate.format(new Date(item.reviewed_at * 1000))}
            </p>}
          </>}
        </section>}
      </div>
    </>}
  </Portal>;
}
