import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Heart, ImagePlus, MessageCircle, Share2, X } from 'lucide-react';
import { api } from '../../../services/api.ts';
import { errText, Feedback, hub, metric, useHub } from './shared.tsx';

type Kind = 'update' | 'question' | 'request';
type Post = { id: number; author: string; kind: Kind; body: string; has_image: boolean; created: string; likes: number; liked: boolean; comments: number };
type Comment = { id: number; author: string; body: string };
const labels = { update: 'আপডেট', question: 'প্রশ্ন', request: 'আমার প্রয়োজন' };
const date = new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' });

function useImage(file: Blob | null) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview;
}

function PostPhoto({ id }: { id: number }) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const image = useImage(photo);
  useEffect(() => {
    const abort = new AbortController();
    void api.get<Blob>(`/farm-hub/posts/${id}/image`, { responseType: 'blob', signal: abort.signal })
      .then(response => { if (!abort.signal.aborted) setPhoto(response.data); })
      .catch(failure => { if (!abort.signal.aborted) setError(errText(failure)); });
    return () => abort.abort();
  }, [id]);
  return image ? <img className="soc-photo" src={image} alt="পোস্টে যোগ করা ছবি" /> : <Feedback error={error} pending={!photo}/>;
}

function PostCard({ post, circle, highlighted }: { post: Post; circle: number; highlighted: boolean }) {
  const [liked, setLiked] = useState(post.liked);
  const [count, setCount] = useState(post.likes);
  const [localComments, setLocalComments] = useState(0);
  const [isOpen, setOpen] = useState(highlighted);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [earlier, setEarlier] = useState<Comment[]>([]);
  const [more, setMore] = useState(true);
  const comments = useHub<Comment[]>(isOpen ? `/posts/${post.id}/comments` : null, version);
  const commentsVisible = Array.from(new Map([...earlier, ...(comments?.data ?? [])].map(x => [x.id, x])).values());
  useEffect(() => { setLiked(post.liked); setCount(post.likes); }, [post.likes, post.liked]);
  useEffect(() => { setLocalComments(0); }, [post.comments]);

  async function interact(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (failure) { setError(errText(failure)); }
    finally { setBusy(false); }
  }
  async function share() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ tab: 'farm_community', circle: String(circle), post: String(post.id) }).toString();
    try {
      if (navigator.share) await navigator.share({ title: 'আমাদের কৃষি · কমিউনিটি পোস্ট', url: url.toString() });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url.toString()); setNotice('পোস্টের লিংক কপি হয়েছে।'); }
      else setShareLink(url.toString());
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === 'AbortError')) setShareLink(url.toString());
    }
  }

  return <article className={`soc-card soc-post${highlighted ? ' soc-highlight' : ''}`} id={`community-post-${post.id}`}>
    <header className="soc-post-head"><span className="soc-avatar">{Array.from(post.author)[0]}</span><div><strong>{post.author}</strong><time dateTime={post.created}>{date.format(new Date(post.created))}</time></div><span className={`soc-tag ${post.kind}`}>{labels[post.kind]}</span></header>
    {post.body && <p className="soc-body">{post.body}</p>}
    {post.has_image && <PostPhoto id={post.id}/>}
    <div className="soc-actions">
      <button type="button" aria-pressed={liked} disabled={busy} onClick={() => void interact(async () => {
        const result = (await hub.put(`/posts/${post.id}/like`, { liked: !liked })).data;
        setLiked(result.liked); setCount(result.likes);
      })}><Heart size={17}/>লাইক <span>{metric(count)}</span></button>
      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(open => !open)}><MessageCircle size={17}/>কমেন্ট <span>{metric(post.comments + localComments)}</span></button>
      <button type="button" onClick={() => void share()}><Share2 size={17}/>শেয়ার</button>
    </div>
    <Feedback error={error}/>
    {notice && <p className="soc-inline" role="status">{notice}</p>}
    {shareLink && <label className="soc-inline">সদস্যদের জন্য পোস্টের লিংক <input readOnly value={shareLink} onFocus={e => e.target.select()}/></label>}
    {isOpen && <div className="soc-comments"><Feedback error={comments?.error} pending={!comments}/>
      {more && commentsVisible.length >= 30 && <button type="button" disabled={busy} onClick={() => void interact(async () => {
        const items = await hub.get<Comment[]>(`/posts/${post.id}/comments?before=${commentsVisible[0].id}`);
        setEarlier(previous => [...items, ...previous]); setMore(items.length >= 30);
      })}>আগের কমেন্ট</button>}
      {commentsVisible.map(comment => <div key={comment.id}><strong>{comment.author}</strong><p>{comment.body}</p></div>)}
      <form className="soc-inline-form" onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = String(new FormData(form).get('body') ?? '').trim();
        if (!body) return;
        void interact(async () => { await hub.post(`/posts/${post.id}/comments`, { body }); form.reset(); setLocalComments(v => v + 1); setVersion(v => v + 1); });
      }}><input required name="body" maxLength={1000} placeholder="কমেন্ট লিখুন" aria-label="কমেন্ট লিখুন"/><button type="submit" disabled={busy}>পাঠান</button></form>
    </div>}
  </article>;
}

export function SocialFeed({ circle, highlight }: { circle: number; highlight?: number }) {
  const [version, setVersion] = useState(0);
  const [kind, setKind] = useState<Kind>('update');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [older, setOlder] = useState<Post[]>([]);
  const [more, setMore] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const preview = useImage(file);
  const posts = useHub<Post[]>(`/circles/${circle}/posts`, version);
  const linked = useHub<Post>(highlight ? `/posts/${highlight}` : null);
  const all = [...(posts?.data ?? []), ...older];
  const visible = Array.from(new Map(all.map(x => [x.id, x])).values());
  if (linked?.data && !visible.some(x => x.id === linked.data?.id)) visible.unshift(linked.data);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (!text.trim() && !file)) return;
    setBusy(true); setError('');
    const data = new FormData();
    data.append('kind', kind); data.append('body', text.trim());
    if (file) data.append('image', file);
    try {
      await api.post(`/farm-hub/circles/${circle}/posts`, data, { headers: { 'Content-Type': undefined } });
      setText(''); setFile(null); setKind('update'); setVersion(v => v + 1);
    } catch (failure) { setError(errText(failure)); }
    finally { setBusy(false); }
  }
  return <div className="soc-stack">
    <form className="soc-card soc-compose" onSubmit={submit}>
      <div className="soc-heading"><h2>একটি পোস্ট লিখুন</h2><select value={kind} aria-label="পোস্টের ধরন" onChange={e => setKind(e.target.value as Kind)}>
        {Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
      <textarea aria-label="পোস্টের লেখা" value={text} onChange={e => setText(e.target.value)} maxLength={2000}
        placeholder={kind === 'request' ? 'যেমন, আগামী সপ্তাহে রিপার লাগবে। কোথায় পাওয়া যাবে?' : kind === 'question' ? 'কৃষক দলের কাছে কী জানতে চান?' : 'আজ খামারে কী করছেন?'} />
      <input hidden type="file" ref={input} accept="image/jpeg,image/png,image/webp" onChange={e => {
        setError('');
        const newFile = e.target.files?.[0];
        e.target.value = '';
        if (!newFile) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(newFile.type) || newFile.size > 6 * 1024 * 1024) {
          setError('৬ এমবির মধ্যে JPG, PNG অথবা WebP ছবি বেছে নিন।'); return;
        }
        setFile(newFile);
      }}/>
      {preview && <div className="soc-preview"><img src={preview} alt="আপলোডের আগে ছবির প্রিভিউ"/><button type="button" aria-label="ছবি সরান" onClick={() => setFile(null)}><X size={18}/></button></div>}
      <div className="soc-actions"><button type="button" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={17}/>ছবি দিন</button>
        <button type="submit" className="fh-primary" disabled={busy || (!text.trim() && !file)}>{busy ? 'পোস্ট হচ্ছে…' : 'পোস্ট করুন'}</button></div>
      <Feedback error={error}/>
    </form>
    <Feedback error={posts?.error || linked?.error} pending={!posts}/>
    {posts?.data?.length === 0 && <p className="soc-card">এই দলে প্রথম পোস্টটি লিখুন।</p>}
    {visible.map(post => <PostCard key={post.id} post={post} circle={circle} highlighted={post.id === highlight}/>)}
    {more && all.length >= 20 && <button className="soc-more" type="button" onClick={async () => {
      try {
        const list = await hub.get<Post[]>(`/circles/${circle}/posts?before=${all[all.length - 1].id}`);
        setOlder(previous => [...previous, ...list]); setMore(list.length >= 20);
      } catch (failure) { setError(errText(failure)); }
    }}>আগের পোস্ট দেখুন</button>}
  </div>;
}
