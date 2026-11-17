import { useEffect, useRef, useState } from "react";
import defaultLogo from "./logo.png";
import "./NewChatWelcome.css";

const T = {
  bn: {
    eyebrow: "মাটি থেকে বাজার — এক AI সিস্টেম",
    hello: "আসসালামু আলাইকুম",
    intro: "আমি আমাদের কৃষি AI। আপনার জমি, ফসল, মাটি বা বাজার নিয়ে যা জানতে চান, সহজ ভাষায় জিজ্ঞেস করুন।",
    ph: "এখানে আপনার প্রশ্ন লিখুন… যেমন: আমার জমিতে কোন সার দেব?",
    askTitle: "কী জানতে চান? একটি বেছে নিন",
    scan: "পাতার ছবি তুলুন",
    scanSub: "রোগ ও পোকা সাথে সাথে শনাক্ত করুন",
    mic: "বলে প্রশ্ন করুন",
    img: "ছবি যোগ করুন",
    send: "পাঠান",
    hint: "Enter চাপলে পাঠাবে • নতুন লাইনে যেতে Shift + Enter",
    note: "এটি সিদ্ধান্ত-সহায়ক পরামর্শ। বড় সিদ্ধান্তের আগে স্থানীয় কৃষি কর্মকর্তার সাথে কথা বলুন।",
    steps: ["১. প্রশ্ন লিখুন বা বলুন", "২. ছবি থাকলে যোগ করুন", "৩. কারণসহ পরামর্শ পান"],
  },
  en: {
    eyebrow: "FROM SOIL TO MARKET — ONE AI SYSTEM",
    hello: "Assalamu Alaikum",
    intro: "I'm Amader Krishi AI. Ask me anything about your land, crops, soil or market prices, in plain words.",
    ph: "Type your question… e.g. Which fertilizer should I use?",
    askTitle: "What would you like to know? Pick one",
    scan: "Snap a leaf photo",
    scanSub: "Spot disease and pests instantly",
    mic: "Ask by voice",
    img: "Add a photo",
    send: "Send",
    hint: "Press Enter to send • Shift + Enter for a new line",
    note: "This is decision-support advice. For big decisions, check with your local agriculture officer.",
    steps: ["1. Type or speak", "2. Add a photo if you have one", "3. Get advice with reasons"],
  },
};

const TOPICS = [
  { i: "🧪", tag: "মাটি", tagEn: "Soil", t: "মাটি বিশ্লেষণ", tEn: "Soil analysis", q: "আমার জমির মাটির স্বাস্থ্য কেমন? কোন সার কতটা দেব?", qEn: "How healthy is my soil? Which fertilizer and how much?" },
  { i: "🌦️", tag: "আবহাওয়া", tagEn: "Weather", t: "আবহাওয়া ও ঝুঁকি", tEn: "Weather & risk", q: "এই সপ্তাহে বৃষ্টি, বন্যা বা খরার ঝুঁকি আছে কি?", qEn: "Is there rain, flood or drought risk this week?" },
  { i: "🌾", tag: "পরামর্শ", tagEn: "Advice", t: "ফসল পরামর্শ", tEn: "Crop advice", q: "আমার এলাকায় এখন কোন ফসল লাগালে ভালো লাভ হবে?", qEn: "Which crop should I plant now for the best profit?" },
  { i: "📈", tag: "পূর্বাভাস", tagEn: "Forecast", t: "ফলন পূর্বাভাস", tEn: "Yield forecast", q: "এক বিঘা জমিতে এবার কত ফলন হতে পারে?", qEn: "How much yield can I expect per bigha this season?" },
  { i: "💰", tag: "বাজার", tagEn: "Market", t: "বাজার দর", tEn: "Market prices", q: "আজ ধান ও সবজির বাজার দর কত? দাম বাড়বে না কমবে?", qEn: "What are today's rice and vegetable prices? Rising or falling?" },
  { i: "🏚️", tag: "সিদ্ধান্ত", tagEn: "Decide", t: "বিক্রি নাকি সংরক্ষণ", tEn: "Sell or store", q: "এখন ফসল বিক্রি করব, নাকি গুদামে রাখব?", qEn: "Should I sell my harvest now or store it?" },
  { i: "📅", tag: "ক্যালেন্ডার", tagEn: "Calendar", t: "এই মাসের কাজ", tEn: "This month's tasks", q: "এই মাসে আমার জমিতে কোন কোন কাজ করতে হবে?", qEn: "What tasks should I do on my farm this month?" },
  { i: "🐛", tag: "সুরক্ষা", tagEn: "Protect", t: "রোগ ও পোকা দমন", tEn: "Pest & disease", q: "ফসলে পোকা বা রোগ হলে কী করব? কোন ওষুধ ভালো?", qEn: "What do I do about pests or disease? Which treatment works?" },
];

export default function NewChatWelcome(props) {
  const { lang = "bn", logoSrc, location, onImage } = props;
  const send = props.onSend || props.onSubmit || props.onSendMessage || props.onPrompt || (() => {});
  const en = lang === "en";
  const t = T[en ? "en" : "bn"];
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  const areaRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  const submit = (value) => {
    const v = (value ?? text).trim();
    if (!v && !preview) return;
    send(v, preview?.file);
    setText("");
    setPreview(null);
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreview({ file: f, url: URL.createObjectURL(f) });
    if (onImage) onImage(f);
    e.target.value = "";
  };

  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert(en ? "Voice input is not supported in this browser." : "এই ব্রাউজারে ভয়েস ইনপুট চলবে না। Chrome ব্যবহার করুন।");
    if (listening) { recRef.current?.stop(); return; }
    const r = new SR();
    r.lang = en ? "en-US" : "bn-BD";
    r.interimResults = true;
    r.onresult = (ev) => setText(Array.from(ev.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="nc-root">
      <div className="nc-glow" aria-hidden="true" />
      <div className="nc-wrap">
        <header className="nc-hero">
          <img className="nc-logo" src={logoSrc || defaultLogo} alt="আমাদের কৃষি" />
          <p className="nc-eyebrow">{t.eyebrow}</p>
          <h1 className="nc-title">{t.hello} <span className="nc-wave">👋</span></h1>
          <p className="nc-intro">{t.intro}</p>
          {location && <span className="nc-loc">📍 {location}</span>}
        </header>

        <section className="nc-composer" aria-label="chat input">
          {preview && (
            <div className="nc-preview">
              <img src={preview.url} alt="" />
              <button type="button" onClick={() => setPreview(null)} aria-label="remove">✕</button>
            </div>
          )}
          <textarea
            ref={areaRef}
            rows={1}
            value={text}
            placeholder={listening ? (en ? "Listening…" : "শুনছি… বলুন") : t.ph}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          />
          <div className="nc-bar">
            <div className="nc-tools">
              <button type="button" className={"nc-tool" + (listening ? " on" : "")} onClick={toggleMic}>
                🎙️ <span>{t.mic}</span>
              </button>
              <button type="button" className="nc-tool" onClick={() => fileRef.current?.click()}>
                🖼️ <span>{t.img}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
            </div>
            <button type="button" className="nc-send" onClick={() => submit()} disabled={!text.trim() && !preview}>
              {t.send} <b>➤</b>
            </button>
          </div>
        </section>
        <p className="nc-hint">{t.hint}</p>

        <ol className="nc-steps">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>

        <h2 className="nc-h2">{t.askTitle}</h2>
        <div className="nc-grid">
          <button type="button" className="nc-card nc-scan" onClick={() => fileRef.current?.click()}>
            <span className="nc-ico">📸</span>
            <strong>{t.scan}</strong>
            <small>{t.scanSub}</small>
          </button>
          {TOPICS.map((x) => (
            <button type="button" key={x.t} className="nc-card" onClick={() => submit(en ? x.qEn : x.q)}>
              <span className="nc-ico">{x.i}</span>
              <em>{en ? x.tagEn : x.tag}</em>
              <strong>{en ? x.tEn : x.t}</strong>
              <small>{en ? x.qEn : x.q}</small>
            </button>
          ))}
        </div>

        <p className="nc-note">{t.note}</p>
      </div>
    </div>
  );
}
