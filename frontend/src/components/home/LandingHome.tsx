import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, BarChart3, Boxes, Calculator, CalendarDays, Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  CloudSun, FlaskConical, LayoutDashboard, LockKeyhole, MessageCircle, Pause, Play, Search, ShieldCheck,
  ShoppingBasket, Sprout, Users, Wheat, X,
} from 'lucide-react';
import './LandingHome.css';

const media = '/agri-landing';
const market = '/workspace?tab=tools&model=tomato_price';
const seller = market + '&market=sell';
const health = '/workspace?tab=tools&model=tomato_disease_v3';
const weather = '/workspace?tab=tools&model=flood_susceptibility';
const soil = '/workspace?tab=soil_health';
const chat = '/workspace?tab=chat';
const rotationDelay = 3000;
const carouselStyle = { '--ak-slide-duration': `${rotationDelay}ms` } as CSSProperties;
const videoId = '50FDxXZYLww';
const videoUrl = `https://youtu.be/${videoId}`;
const videoEmbedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;

const slides = [
  { title: ['মাটি থেকে', 'বাজারে'], name: 'কৃষি বাজার', image: 'market', action: 'কৃষি বাজার দেখুন', to: market },
  { title: ['ফসলের স্বাস্থ্য', 'বুঝুন'], name: 'ফসল স্বাস্থ্য', image: 'leaf', action: 'পাতা স্ক্যান করুন', to: health },
  { title: ['আবহাওয়া দেখে', 'কাজের পরিকল্পনা'], name: 'আবহাওয়া', image: 'weather', action: 'আবহাওয়া ও ঝুঁকি দেখুন', to: weather },
  { title: ['মাটি বুঝে', 'ফসল বাছুন'], name: 'মাটি ও ফসল', image: 'soil', action: 'মাটি ও ফসল দেখুন', to: soil },
  { title: ['কৃষির প্রশ্ন', 'করুন'], name: 'কৃষি AI', image: 'assistant', action: 'কৃষি AI-কে জিজ্ঞেস করুন', to: chat },
];

const shortcuts = [
  { label: 'ফসল বিক্রি', to: seller, Icon: ShoppingBasket },
  { label: 'ফসল খুঁজুন', to: '/buyer', Icon: Search },
  { label: 'ফসল স্বাস্থ্য', to: health, Icon: Sprout },
];

const features = [
  { title: 'খামারের ড্যাশবোর্ড', description: 'চলতি ফসল, খামারের কাজ আর গুরুত্বপূর্ণ তথ্য একসঙ্গে দেখুন।',
    to: '/workspace?tab=dashboard', Icon: LayoutDashboard, art: 'dashboard', label: 'ড্যাশবোর্ড খুলুন' },
  { title: 'ফসল স্বাস্থ্য', description: 'পাতার ছবি দিয়ে সম্ভাব্য সমস্যা ও পরের করণীয় দেখুন।',
    to: health, Icon: Camera, art: 'leaf', label: 'পাতা স্ক্যান করুন' },
  { title: 'মাটি ও ফসল', description: 'মাটির তথ্য থেকে পুষ্টি ও উপযুক্ত ফসলের ধারণা পান।',
    to: soil, Icon: FlaskConical, art: 'soil', label: 'মাটির তথ্য দেখুন' },
  { title: 'আবহাওয়া ও ক্যালেন্ডার', description: 'আবহাওয়ার ঝুঁকি দেখুন ও পরিচর্যার সময় ঠিক করুন।',
    to: weather, Icon: CloudSun, art: 'weather', label: 'আবহাওয়া দেখুন' },
  { title: 'ফলন ও খামারের হিসাব', description: 'ফলনের অনুমান ও খামারের কাজের হিসাব দেখুন।',
    to: '/workspace?tab=tools&model=regional_crop_yield', Icon: BarChart3, art: 'market', label: 'ফলন পরিকল্পনা দেখুন' },
  { title: 'বাংলা কৃষি AI', description: 'চাষাবাদ নিয়ে বাংলায় প্রশ্ন করুন।',
    to: chat, Icon: MessageCircle, art: 'assistant', label: 'প্রশ্ন করুন' },
];

const moreTools = [
  { label: 'কৃষি ক্যালেন্ডার', to: '/workspace?tab=calendar', Icon: CalendarDays },
  { label: 'কমিউনিটি', to: '/workspace?tab=farm_community', Icon: Users },
  { label: 'ফসল ও গুদাম', to: '/workspace?tab=harvest', Icon: Boxes },
  { label: 'খামার ও রেকর্ড', to: '/workspace?tab=farm_services', Icon: LayoutDashboard },
  { label: 'বাজেট ও লাভ', to: '/workspace?tab=farm_finance', Icon: Calculator },
];

const faqs = [
  { question: 'কীভাবে ফসল বিক্রির আবেদন করব?', answer: 'কৃষকের অ্যাকাউন্টে ঢুকে ফসল বিক্রি বাছুন। ফসলের নাম, এলাকা, পরিমাণ ও দাম দিন। চাইলে ছবিও যোগ করুন। যাচাইয়ের জন্য পাঠালে আমার আবেদন থেকে অবস্থা দেখতে পারবেন।' },
  { question: 'আমার আবেদন কখন ক্রেতার বাজারে দেখা যাবে?', answer: 'অ্যাডমিন যাচাই করে অনুমোদন দিলেই ফসলটি ক্রেতার বাজারে প্রকাশ পাবে। সংশোধনের জন্য ফেরত এলে অ্যাডমিনের মন্তব্য দেখে একই আবেদন আবার পাঠাতে পারবেন।' },
  { question: 'ক্রেতা কীভাবে ফসল খুঁজবেন?', answer: 'হেডারের ক্রেতার বাজার থেকে ফসলের নাম বা এলাকা দিয়ে খুঁজুন। পছন্দের ফসলের পরিমাণ বেছে কেনার অনুরোধ দিতে আপনার অ্যাকাউন্টে লগইন করুন।' },
  { question: 'ফসল স্বাস্থ্য কীভাবে ব্যবহার করব?', id: 'ak-ai-guide', answer: 'ফসল বেছে পাতার ছবি দিন। অ্যাপ যে শ্রেণির সঙ্গে বেশি মিল পায় এবং পরের করণীয় দেখায়, তা মাঠে দেখা লক্ষণের সঙ্গে মিলিয়ে দেখুন। ফল অনিশ্চিত হলে আরেকটি আক্রান্ত পাতা স্ক্যান করতে পারেন।' },
  { question: 'অ্যাডমিন কোথা থেকে লগইন করবেন?', answer: 'হেডারের অ্যাডমিন লগইন বাটন থেকে কৃষি বাজারের অ্যাডমিন অ্যাকাউন্ট দিয়ে ঢুকুন। সেখানেই আবেদনের তালিকা ও পর্যালোচনার কাজ পাওয়া যাবে।' },
];

function Brand() {
  return <Link className="ak-brand" to="/">
    <Sprout size={37} strokeWidth={1.55} aria-hidden="true"/><span>আমাদের কৃষি</span>
  </Link>;
}

function Action({ to, children, variant = 'gold' }: { to: string; children: ReactNode; variant?: 'gold' | 'outline' }) {
  return <Link className={`ak-button ak-button--${variant}`} to={to}>{children}</Link>;
}

function Carousel({ onVideo, videoOpen }: { onVideo: () => void; videoOpen: boolean }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [slideLinkFocused, setSlideLinkFocused] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = slides[index];
  const running = playing && !slideLinkFocused && !hidden && !videoOpen;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const checkPreference = (event: MediaQueryListEvent) => { if (event.matches) setPlaying(false); };
    const visibility = () => setHidden(document.hidden);
    preference.addEventListener('change', checkPreference);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      preference.removeEventListener('change', checkPreference);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % slides.length), rotationDelay);
    return () => window.clearTimeout(timer);
  }, [index, running]);

  function step(by: number) {
    setIndex(value => (value + by + slides.length) % slides.length);
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!touch.current) return;
    const dx = event.clientX - touch.current.x;
    const dy = event.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  }

  return <section className="ak-hero" style={carouselStyle} aria-label="কৃষির হাইলাইট"
    onFocusCapture={event => setSlideLinkFocused(event.target.matches('.ak-hero-actions .ak-button--gold:focus-visible'))}
    onBlurCapture={() => setSlideLinkFocused(false)}
    onKeyDown={event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
      }
    }}>
    <div className="ak-hero-stage" data-image={current.image}
      onPointerDown={event => { if (event.pointerType === 'touch') touch.current = { x: event.clientX, y: event.clientY }; }}
      onPointerCancel={() => { touch.current = null; }}
      onPointerUp={finishSwipe}>
      <div className="ak-hero-photos" aria-hidden="true">
        {slides.map((slide, i) => <img key={slide.image} className="ak-hero-photo"
          data-image={slide.image} data-active={i === index} src={`${media}/${slide.image}.webp`}
          alt="" fetchPriority={i === 0 ? 'high' : 'auto'}/>)}
      </div>
      <div className="ak-hero-shade" aria-hidden="true"/>
      <div className="ak-hero-content" aria-live={running ? 'off' : 'polite'}>
        <h1 key={current.name}>{current.title.map(line => <span key={line}>{line}</span>)}</h1>
        <div className="ak-hero-actions">
          <Action to={current.to}>{current.action}</Action>
          <button type="button" className="ak-button ak-button--video" onClick={onVideo}><Play size={19} fill="currentColor" aria-hidden="true"/>ভিডিও দেখুন</button>
        </div>
      </div>
      <button type="button" className="ak-pause" aria-label={playing ? 'স্লাইড থামান' : 'স্লাইড চালু করুন'}
        title={playing ? 'স্লাইড থামান' : 'স্লাইড চালু করুন'} onClick={() => setPlaying(value => !value)}>
        {playing ? <Pause size={21} aria-hidden="true"/> : <Play size={19} aria-hidden="true"/>}
      </button>
    </div>
    <nav className="ak-hero-rail" aria-label="স্লাইড বাছুন">
      <button type="button" className="ak-rail-arrow" aria-label="আগের স্লাইড" onClick={() => step(-1)}>
        <ChevronUp className="ak-arrow-vertical" size={21} aria-hidden="true"/><ChevronLeft className="ak-arrow-horizontal" size={19} aria-hidden="true"/>
      </button>
      {slides.map((slide, i) => <button type="button" key={slide.image} className="ak-thumb" aria-label={slide.name}
        aria-current={index === i ? 'true' : undefined} data-running={index === i && running} onClick={() => setIndex(i)}>
        <img src={`${media}/${slide.image}.webp`} alt="" loading="eager"/>
      </button>)}
      <button type="button" className="ak-rail-arrow" aria-label="পরের স্লাইড" onClick={() => step(1)}>
        <ChevronDown className="ak-arrow-vertical" size={21} aria-hidden="true"/><ChevronRight className="ak-arrow-horizontal" size={19} aria-hidden="true"/>
      </button>
    </nav>
  </section>;
}

export function LandingHome() {
  const [videoOpen, setVideoOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  function showVideo() {
    dialog.current?.showModal();
    setVideoOpen(true);
  }

  return <div className="ak-home" lang="bn">
    <a className="ak-skip" href="#ak-main">মূল অংশে যান</a>
    <header className="ak-header">
      <div className="ak-header-inner">
        <Brand/>
        <nav className="ak-nav" aria-label="প্রধান লিংক">
          <Link className="ak-nav-action ak-nav-action--farmer" to="/workspace">
            <span className="ak-nav-icon"><Sprout size={18} aria-hidden="true"/></span>
            <span>কৃষকের জন্য</span><ArrowRight className="ak-nav-arrow" size={16} aria-hidden="true"/>
          </Link>
          <Link className="ak-nav-action ak-nav-action--buyer" to="/buyer">
            <span className="ak-nav-icon"><ShoppingBasket size={18} aria-hidden="true"/></span>
            <span>ক্রেতার বাজার</span><ArrowRight className="ak-nav-arrow" size={16} aria-hidden="true"/>
          </Link>
        </nav>
        <Link className="ak-admin" to="/admin"><LockKeyhole size={18} aria-hidden="true"/>অ্যাডমিন লগইন</Link>
      </div>
    </header>

    <main id="ak-main">
      <Carousel onVideo={showVideo} videoOpen={videoOpen}/>

      <div className="ak-container">
        <nav className="ak-shortcuts" aria-label="দ্রুত কাজ">
          {shortcuts.map(({ Icon, label, to }) => <Link key={label} to={to}>
            <Icon size={26} aria-hidden="true"/><span>{label}</span><ChevronRight size={18} aria-hidden="true"/>
          </Link>)}
        </nav>

        <section className="ak-section" aria-labelledby="ak-market-title">
          <div className="ak-section-heading"><h2 id="ak-market-title">কৃষি বাজার</h2><Link to={market}>বাজারদর দেখুন <ArrowUpRight size={17}/></Link></div>
          <div className="ak-market-cards">
            <Link className="ak-market-card" to={seller}>
              <img src={`${media}/market.webp`} alt="" width={790} height={400} loading="lazy"/>
              <div><h3>ফসল বিক্রি করুন</h3><span className="ak-card-arrow" aria-hidden="true"><ArrowRight size={23}/></span></div>
            </Link>
            <Link className="ak-market-card" to="/buyer">
              <img src={`${media}/buyer.webp`} alt="" width={660} height={307} loading="lazy"/>
              <div><h3>ফসল খুঁজুন</h3><span className="ak-card-arrow ak-card-arrow--outline" aria-hidden="true"><ArrowRight size={23}/></span></div>
            </Link>
          </div>
          <ol className="ak-market-flow" aria-label="ফসল বিক্রির ধাপ">
            <li><Wheat size={24} aria-hidden="true"/><strong>কৃষকের আবেদন</strong></li>
            <li><ShieldCheck size={24} aria-hidden="true"/><strong>অ্যাডমিন যাচাই</strong></li>
            <li><ShoppingBasket size={24} aria-hidden="true"/><strong>ক্রেতার বাজারে প্রকাশ</strong></li>
          </ol>
        </section>

        <section className="ak-section" aria-labelledby="ak-tools-title">
          <div className="ak-section-heading"><h2 id="ak-tools-title">কৃষির টুল এক জায়গায়</h2></div>
          <div className="ak-features">
            {features.map(({ Icon, to, title, description, label, art }, i) => <article className={`ak-feature ak-feature--${i}`} key={title}>
              {art === 'dashboard' ? <div className="ak-board-preview" aria-hidden="true">
                <div><Sprout size={23}/><LayoutDashboard size={18}/><CalendarDays size={18}/><BarChart3 size={18}/></div>
                <div><strong>আমার খামার</strong><span>চলতি ফসল</span><span>পরিচর্যার সময়</span><span>আবহাওয়া ও ঝুঁকি</span></div>
              </div> : <img src={`${media}/${art}.webp`} alt="" width="470" height="264" loading="lazy"/>}
              <div className="ak-feature-body"><span className="ak-feature-icon"><Icon size={23} aria-hidden="true"/></span>
                <h3>{title}</h3><p>{description}</p><Link to={to}>{label}<ArrowRight size={16} aria-hidden="true"/></Link>
              </div>
            </article>)}
          </div>
          <nav className="ak-more" aria-label="খামারের আরও টুল">
            {moreTools.map(({ label, to, Icon }) => <Link key={label} to={to}><Icon size={18} aria-hidden="true"/>{label}<ChevronRight size={15} aria-hidden="true"/></Link>)}
          </nav>
        </section>

        <section className="ak-section ak-watch" aria-labelledby="ak-video-title">
          <div><h2 id="ak-video-title">কীভাবে শুরু করবেন</h2>
            <p>ফসলের তথ্য জমা দেওয়া থেকে ক্রেতার বাজারে প্রকাশ পর্যন্ত পুরো পথটি দেখুন।</p>
            <button type="button" className="ak-button ak-button--outline" onClick={showVideo}><Play size={19} fill="currentColor" aria-hidden="true"/>ভিডিও দেখুন</button>
          </div>
          <button type="button" className="ak-video-poster" aria-label="কৃষি বাজারের ভিডিও গাইড চালান" onClick={showVideo}>
            <img src={`${media}/video-poster.webp`} alt="" width={1280} height={720} loading="lazy"/>
            <span><Play size={32} fill="currentColor" aria-hidden="true"/></span>
          </button>
        </section>

        <section id="ak-faq" className="ak-section ak-faq" aria-labelledby="ak-faq-title">
          <div className="ak-section-heading"><h2 id="ak-faq-title">সাধারণ প্রশ্ন</h2></div>
          <div>{faqs.map(({ question, answer, id }) => <details key={question} id={id} name="ak-faq">
            <summary>{question}<ChevronDown size={20} aria-hidden="true"/></summary><p>{answer}</p>
          </details>)}</div>
        </section>

        <section className="ak-final-cta" aria-labelledby="ak-start-title">
          <h2 id="ak-start-title">কৃষির কাজ শুরু করুন</h2>
          <div><Action to="/workspace">কৃষক পোর্টাল <ArrowRight size={17}/></Action><Action to="/buyer" variant="outline">ক্রেতার বাজার</Action></div>
        </section>
      </div>
    </main>

    <footer className="ak-footer">
      <Brand/>
      <nav aria-label="সহায়তার লিংক">
        <a href="#ak-faq">সহায়তা</a>
        <a href="#ak-ai-guide" onClick={() => document.getElementById('ak-ai-guide')?.setAttribute('open', '')}>AI ব্যবহারের নির্দেশনা</a>
        <Link to="/admin">অ্যাডমিন লগইন</Link>
        <Link to="/docs">ডকুমেন্টেশন</Link>
      </nav>
    </footer>

    <dialog ref={dialog} className="ak-video-dialog" aria-labelledby="ak-guide-title"
      onClose={() => setVideoOpen(false)}>
      <header><h2 id="ak-guide-title">কৃষি বাজারের ভিডিও গাইড</h2>
        <button type="button" aria-label="ভিডিও বন্ধ করুন" onClick={() => dialog.current?.close()}><X size={22} aria-hidden="true"/></button>
      </header>
      {videoOpen && <iframe className="ak-video-player" src={videoEmbedUrl} title="আমাদের কৃষির YouTube ভিডিও"
        referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>}
      <a className="ak-video-fallback" href={videoUrl} target="_blank" rel="noopener noreferrer">
        YouTube-এ খুলুন <ArrowUpRight size={16} aria-hidden="true"/>
      </a>
    </dialog>
  </div>;
}
