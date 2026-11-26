/* מנוע: שמירת התקדמות, הקלטה ותמלול, והערכת תשובות (AI או הערכה בסיסית לא מקוונת). */
(function () {
  const STORE_KEY = "moonprep.v1";

  /* ───────── Storage ───────── */
  const defaults = () => ({
    unlocked: { tl: true, tech: false, final: false },
    finished: { hr: true, tl: false, tech: false, final: false },
    attempts: {},       // id -> [{ts, text, code, mode, dur, score, src, fb}]
    sessions: [],       // [{ts, stage, items:[{id, score}], avg}]
    cm: { done: {}, notes: "" },
    settings: { apiKey: "", model: "claude-opus-5-5", provider: "auto", keepAudio: true, theme: "system", qSeconds: 120 }
  });
  let state = defaults();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const d = defaults();
        state = Object.assign(d, s);
        state.settings = Object.assign(d.settings, s.settings || {});
        state.unlocked = Object.assign(d.unlocked, s.unlocked || {});
        state.finished = Object.assign(d.finished, s.finished || {});
        state.cm = Object.assign(d.cm, s.cm || {});
      }
    } catch (e) { state = defaults(); }
    return state;
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }
  function exportJSON() { const s = JSON.parse(JSON.stringify(state)); s.settings.apiKey = ""; return JSON.stringify(s); }
  function importJSON(txt) {
    const s = JSON.parse(txt);
    if (!s || typeof s !== "object" || !s.attempts) throw new Error("bad");
    const key = state.settings.apiKey;
    state = Object.assign(defaults(), s);
    state.settings = Object.assign(defaults().settings, s.settings || {}, { apiKey: key });
    save();
  }
  function reset() { const key = state.settings.apiKey; state = defaults(); state.settings.apiKey = key; save(); }

  function addAttempt(id, a) { (state.attempts[id] = state.attempts[id] || []).push(a); save(); }
  function best(id) { const a = state.attempts[id]; if (!a || !a.length) return null; return Math.max(...a.map(x => x.score ?? 0)); }
  function last(id) { const a = state.attempts[id]; return a && a.length ? a[a.length - 1] : null; }

  /* ───────── Text utils ───────── */
  function norm(s) {
    return (s || "").toLowerCase()
      .replace(/[֑-ׇ]/g, "")        // ניקוד וטעמים
      .replace(/[׳`’‘]/g, "'").replace(/[״“”]/g, '"')
      .replace(/[־–—_]/g, "-")
      .replace(/\s+/g, " ");
  }
  function words(s) { return (s || "").trim().split(/\s+/).filter(Boolean); }
  const FILLERS = ["אממ", "אמממ", "אהה", "אההה", "אמ ", "כאילו", "יעני", "נגיד", "וכזה", "סתם", "את יודע", "אתה יודע"];
  function fillerCount(text) {
    const t = " " + norm(text) + " ";
    const found = {};
    let total = 0;
    FILLERS.forEach(f => {
      const re = new RegExp("(^|\\s)" + f.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|[.,!?]|$)", "g");
      const m = t.match(re);
      if (m && m.length) { found[f.trim()] = m.length; total += m.length; }
    });
    return { total, found };
  }
  function coverage(points, text) {
    const t = norm(text);
    return (points || []).map(([label, kws]) => {
      const list = (kws || "").split("|").map(k => norm(k).trim()).filter(Boolean);
      const hit = list.some(k => t.includes(k));
      return { label, hit };
    });
  }

  /* ───────── Offline evaluation ───────── */
  function offlineEval(item, answer, meta) {
    const text = [answer.text, answer.code].filter(Boolean).join("\n");
    const cov = coverage(item.p, text);
    const hits = cov.filter(c => c.hit).length;
    const ratio = cov.length ? hits / cov.length : 0;
    const wc = words(answer.text).length + (answer.code ? Math.round(words(answer.code).length / 3) : 0);
    let score = 2 + 8 * ratio;
    if (wc < 12) score = Math.min(score, 3);
    else if (wc < 25) score -= 1.5;
    score = Math.max(0, Math.min(10, Math.round(score * 2) / 2));
    return {
      src: "offline",
      score,
      verdict: ratio >= .75 ? "כיסית את רוב הנקודות שמראיין יחפש." : ratio >= .45 ? "כיסית חלק מהנקודות. בדוק מה חסר למטה." : "חסרות נקודות מרכזיות. עבור על נקודות המפתח ונסה שוב.",
      coverage: cov,
      strengths: cov.filter(c => c.hit).map(c => c.label),
      missing: cov.filter(c => !c.hit).map(c => c.label),
      corrections: [],
      interviewer_expects: item.t || "",
      better_phrasing: "",
      delivery: [],
      follow_up: (item.f && item.f[0]) || "",
      note: "הערכה בסיסית לפי מילות מפתח. היא בודקת אילו נושאים הזכרת, לא אם ההסבר נכון. להערכת AI מלאה, הגדר חיבור בלשונית הגדרות."
    };
  }

  /* ───────── AI evaluation ───────── */
  const SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["score", "verdict", "strengths", "corrections", "missing", "interviewer_expects", "delivery", "better_phrasing", "follow_up"],
    properties: {
      score: { type: "number" },
      verdict: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      corrections: { type: "array", items: { type: "object", additionalProperties: false, required: ["issue", "fix"], properties: { issue: { type: "string" }, fix: { type: "string" } } } },
      missing: { type: "array", items: { type: "string" } },
      interviewer_expects: { type: "string" },
      delivery: { type: "array", items: { type: "string" } },
      better_phrasing: { type: "string" },
      follow_up: { type: "string" }
    }
  };

  function buildPrompt(item, answer, meta) {
    const D = window.APP_DATA;
    const kp = (item.p || []).map(p => "- " + p[0]).join("\n");
    const mistakes = (item.m || []).map(x => "- " + x).join("\n") || "-";
    const stageName = meta.stage === "tech" ? "ריאיון טכני (Code Review / Live Coding)" : meta.stage === "final" ? "ריאיון סופי" : "ריאיון שיחה מול Unity Team Lead";
    const del = meta.mode === "voice"
      ? `התשובה נאמרה בעל פה ותומללה אוטומטית (ייתכנו טעויות תמלול – אל תוריד ציון עליהן). משך: ${Math.round(meta.dur || 0)} שניות, ${meta.words} מילים, מילות מילוי שזוהו: ${meta.fillers}.`
      : "התשובה הוקלדה.";
    return `אתה Unity Team Lead מנוסה ב-Moon Active שמראיין מועמד לתפקיד Unity Developer (לא תפקיד ניהולי), ומאמן אותו. הערך את התשובה שלו בכנות ובדיוק.

המשרה (Moon Active, Unity Developer, AI-first mindset):
${D.job.summary}
אחריות: ${D.job.responsibilities.join(" ")}
דרישות: ${D.job.requirements.join(" ")}
יתרונות: ${D.job.advantages.join(" ")}

רקע המועמד (אל תמציא ניסיון מעבר לזה):
${D.profile.facts.map(f => "- " + f).join("\n")}

שלב: ${stageName}
סוג: ${item.k ? D.stage2Kinds[item.k].he : "שאלת שיחה"}

השאלה:
${item.q || item.prompt}
${item.code ? "\nקוד שהוצג למועמד:\n```csharp\n" + item.code + "\n```" : ""}

נקודות שמראיין מצפה לשמוע:
${kp}
טעויות נפוצות:
${mistakes}
${item.sol ? "\nפתרון לדוגמה (להשוואה בלבד, אל תדרוש התאמה מילולית):\n" + item.sol : ""}

${del}

תשובת המועמד:
"""
${answer.text || "(אין הסבר מילולי)"}
"""
${answer.code ? "קוד שהמועמד כתב:\n```csharp\n" + answer.code + "\n```" : ""}

הנחיות:
1. ציון 0-10 (חצאים מותרים). אל תעלה ציון כדי לעודד. 7 = כיוון נכון עם חוסרים, 8.5 = טוב מאוד, 9.5+ = כמעט מושלם.
2. הפרד בין "העיקרון נכון" לבין "המימוש הטכני מדויק". תקן כל טעות טכנית במפורש והסבר בפשטות.
3. אם המועמד אמר שהוא לא יודע משהו, הערך איך התמודד: כנות, עקרונות, ואיך היה חוקר. אל תדרוש שיעמיד פנים.
4. AI הוא יתרון אבל לא תחליף להבנה – אם הוא מציג את ה-AI כמקבל ההחלטות, ציין זאת.
5. better_phrasing: לא תשובה מושלמת לשינון. 2-4 משפטים קצרים שמשמרים את הסגנון שלו ומוסיפים את מה שחסר.
6. delivery: הערות על אופן ההעברה בעל פה (מבנה, אורך, בהירות, מילות מילוי). אם הוקלד – הערות על מבנה ובהירות.
7. follow_up: שאלת המשך אחת חדשה שמראיין היה שואל, שמעמיקה בנקודה החלשה.
8. כתוב הכול בעברית. מונחים טכניים ושמות קוד – באנגלית, בתוך משפט עברי.
9. אל תמציא עובדות על Moon Active או על Coin Master שלא הופיעו כאן.

החזר JSON בלבד לפי המבנה: score, verdict (משפט אחד), strengths[], corrections[{issue, fix}], missing[], interviewer_expects, delivery[], better_phrasing, follow_up.`;
  }

  let sampleFn = null, samplePromise = null;
  function initSample() {
    if (samplePromise) return samplePromise;
    samplePromise = (async () => {
      try {
        if (window.claude && typeof window.claude.use === "function") sampleFn = await window.claude.use("sample");
      } catch (e) { sampleFn = null; }
      return sampleFn;
    })();
    return samplePromise;
  }
  let dictation = null, dictationPromise = null;
  function initDictation() {
    if (dictationPromise) return dictationPromise;
    dictationPromise = (async () => {
      try {
        if (window.claude && typeof window.claude.use === "function") dictation = await window.claude.use("dictation");
      } catch (e) { dictation = null; }
      return dictation;
    })();
    return dictationPromise;
  }

  function providerAvailable() {
    const s = state.settings;
    if (s.provider === "offline") return "offline";
    if ((s.provider === "auto" || s.provider === "claude") && sampleFn) return "claude";
    if ((s.provider === "auto" || s.provider === "api") && s.apiKey) return "api";
    return "offline";
  }

  function parseJSON(text) {
    const t = (text || "").trim();
    try { return JSON.parse(t); } catch (e) { }
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("no json");
  }
  function cleanFb(fb) {
    const arr = v => Array.isArray(v) ? v.filter(x => x != null).map(x => typeof x === "string" ? x : x) : [];
    return {
      score: Math.max(0, Math.min(10, Number(fb.score) || 0)),
      verdict: String(fb.verdict || ""),
      strengths: arr(fb.strengths).map(String),
      corrections: arr(fb.corrections).map(c => typeof c === "string" ? { issue: c, fix: "" } : { issue: String(c.issue || ""), fix: String(c.fix || "") }),
      missing: arr(fb.missing).map(String),
      interviewer_expects: String(fb.interviewer_expects || ""),
      delivery: arr(fb.delivery).map(String),
      better_phrasing: String(fb.better_phrasing || ""),
      follow_up: String(fb.follow_up || "")
    };
  }

  let sdkPromise = null;
  function loadSDK() {
    if (!sdkPromise) sdkPromise = import("https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.7.0/+esm").then(m => m.default || m.Anthropic);
    return sdkPromise;
  }
  async function callAPI(prompt, signal) {
    const Anthropic = await loadSDK();
    const client = new Anthropic({ apiKey: state.settings.apiKey, dangerouslyAllowBrowser: true });
    const model = state.settings.model || "claude-opus-5-5";
    const req = {
      model,
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: prompt }]
    };
    let res;
    if (model === "claude-opus-5-5" || model === "claude-sonnet-5-5") {
      res = await client.beta.messages.create({ ...req, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, { signal });
    } else {
      res = await client.messages.create(req, { signal });
    }
    if (res.stop_reason === "refusal") throw Object.assign(new Error("refusal"), { code: "refusal" });
    const text = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return parseJSON(text);
  }
  async function callSample(prompt, signal) {
    const out = await sampleFn(prompt, { modelTier: "default", signal, cache: false });
    return parseJSON(out.text);
  }

  async function evaluate(item, answer, meta, signal) {
    const fillers = fillerCount(answer.text);
    meta.words = words(answer.text).length;
    meta.fillers = fillers.total ? Object.entries(fillers.found).map(([k, v]) => `${k}×${v}`).join(", ") : "לא זוהו";
    const base = offlineEval(item, answer, meta);
    base.metrics = { dur: meta.dur || 0, words: meta.words, wpm: meta.dur > 5 ? Math.round(meta.words / (meta.dur / 60)) : null, fillers };
    const prov = providerAvailable();
    if (prov === "offline") return base;
    try {
      const prompt = buildPrompt(item, answer, meta);
      const raw = prov === "claude" ? await callSample(prompt, signal) : await callAPI(prompt, signal);
      const fb = cleanFb(raw);
      return Object.assign({}, fb, { src: prov, coverage: base.coverage, metrics: base.metrics });
    } catch (e) {
      if (signal && signal.aborted) throw e;
      base.note = aiErrorText(e) + " מוצגת הערכה בסיסית במקום.";
      return base;
    }
  }
  function aiErrorText(e) {
    const code = e && (e.code || e.status || e.name);
    if (code === "not_granted") return "לא אושרה גישה ל-Claude מהעמוד.";
    if (code === "rate_limited" || code === 429) return "יותר מדי בקשות כרגע. נסה שוב בעוד דקה.";
    if (code === 401 || code === "authentication_error") return "מפתח ה-API לא תקין.";
    if (code === "refusal") return "המודל לא החזיר הערכה לתשובה הזו.";
    if (String(e && e.message || "").includes("Failed to fetch") || String(e).includes("import")) return "אין חיבור לשירות ה-AI.";
    return "הערכת ה-AI נכשלה.";
  }

  async function sessionSummary(items) {
    const prov = providerAvailable();
    if (prov === "offline") return null;
    const lines = items.map((x, i) => `${i + 1}. [${x.score}/10] ${x.q}\nתשובה: ${(x.text || "").slice(0, 900)}\nחסר: ${(x.missing || []).join("; ")}`).join("\n\n");
    const prompt = `אתה Unity Team Lead ב-Moon Active שסיים סימולציית ריאיון עם מועמד ל-Unity Developer. כתוב דוח מסכם קצר בעברית (מונחים טכניים באנגלית): רמת מוכנות כללית במשפט אחד, 3 חוזקות, 3 פערים לעבודה, ו-3 נושאים לחזרה לפני הריאיון האמיתי. אל תמציא עובדות. החזר JSON בלבד: {"readiness":"", "strengths":[], "gaps":[], "review":[]}.\n\n${lines}`;
    try {
      const raw = prov === "claude" ? (await sampleFn(prompt, { modelTier: "default", cache: false })).text : null;
      if (raw) return parseJSON(raw);
      const Anthropic = await loadSDK();
      const client = new Anthropic({ apiKey: state.settings.apiKey, dangerouslyAllowBrowser: true });
      const res = await client.messages.create({ model: state.settings.model, max_tokens: 16000, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] });
      return parseJSON(res.content.filter(b => b.type === "text").map(b => b.text).join(""));
    } catch (e) { return null; }
  }

  /* ───────── Recording & transcription ───────── */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  class Recorder {
    constructor({ onText, onInterim, onState }) {
      this.onText = onText; this.onInterim = onInterim; this.onState = onState;
      this.active = false; this.audioUrl = null; this.chunks = [];
      this.mode = null; this.startedAt = 0; this.elapsed = 0;
    }
    static support() {
      return { dictation: !!dictation, speech: !!SR, media: !!(navigator.mediaDevices && window.MediaRecorder) };
    }
    async start() {
      this.active = true; this.startedAt = performance.now(); this.chunks = [];
      if (this.audioUrl) { URL.revokeObjectURL(this.audioUrl); this.audioUrl = null; }
      // בתוך claude.ai – dictation של הפלטפורמה (חייב להיקרא ישר מהלחיצה)
      if (dictation) {
        this.mode = "dictation";
        this.offs = [
          dictation.onPartial(({ text }) => this.onInterim(text)),
          dictation.onFinal(({ text }) => { this.onInterim(""); this.onText(text); }),
          dictation.onState(({ state, reason }) => {
            if (state === "idle" && this.offs) { this.active = false; this.finish(reason); }
          })
        ];
        dictation.start({ language: "he" }).catch(e => {
          const code = e && e.code;
          if (code === "unavailable" || code === "not_granted") dictation = null;   // נופלים להקלדה / Web Speech
          if (this.offs) { this.active = false; this.finish(code); }
        });
        this.onState("on");
        return;
      }
      if (SR) {
        this.mode = "speech";
        if (state.settings.keepAudio && navigator.mediaDevices && window.MediaRecorder) {
          try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mr = new MediaRecorder(this.stream);
            this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
            this.mr.start();
          } catch (e) { this.mr = null; }
        }
        this.startRecognition();
        this.onState("on");
        return;
      }
      if (navigator.mediaDevices && window.MediaRecorder) {
        this.mode = "audio-only";
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.mr = new MediaRecorder(this.stream);
          this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
          this.mr.start();
          this.onState("on");
          return;
        } catch (e) { this.active = false; this.onState("error", "mic"); return; }
      }
      this.active = false; this.onState("error", "unsupported");
    }
    startRecognition() {
      const r = new SR();
      r.lang = "he-IL"; r.continuous = true; r.interimResults = true;
      r.onresult = ev => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) this.onText(res[0].transcript);
          else interim += res[0].transcript;
        }
        this.onInterim(interim);
      };
      r.onerror = ev => {
        if (ev.error === "audio-capture" && this.mr) {      // המיקרופון תפוס ע"י ההקלטה – ממשיכים בלי הקלטה
          this.stopMedia(false); state.settings.keepAudio = false; save();
        } else if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          this.active = false; this.onState("error", "denied");
        }
      };
      r.onend = () => { if (this.active) { try { r.start(); } catch (e) { } } else this.finish(); };
      this.rec = r;
      try { r.start(); } catch (e) { }
    }
    stopMedia(keep) {
      if (this.mr && this.mr.state !== "inactive") {
        this.mr.onstop = () => {
          if (keep && this.chunks.length) {
            this.audioUrl = URL.createObjectURL(new Blob(this.chunks, { type: this.mr.mimeType || "audio/webm" }));
            this.onState("audio", this.audioUrl);
          }
          this.stream && this.stream.getTracks().forEach(t => t.stop());
        };
        this.mr.stop();
      } else if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    }
    stop() {
      if (!this.active) return;
      this.active = false;
      this.elapsed += (performance.now() - this.startedAt) / 1000;
      if (this.mode === "dictation") { dictation.stop().catch(() => { }); return; }
      if (this.rec) { try { this.rec.stop(); } catch (e) { this.finish(); } }
      else this.finish();
    }
    finish(reason) {
      if (this.offs) { this.offs.forEach(f => { try { f(); } catch (e) { } }); this.offs = null; }
      if (this._done) { this._done = false; }
      this.stopMedia(true);
      this.onInterim("");
      this.onState("off", reason);
    }
    seconds() { return this.elapsed + (this.active ? (performance.now() - this.startedAt) / 1000 : 0); }
    resetTime() { this.elapsed = 0; }
  }

  /* ───────── Speak question (TTS) ───────── */
  function speak(text) {
    if (!("speechSynthesis" in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "he-IL"; u.rate = 1;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("he"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
    return true;
  }

  window.Engine = {
    load, save, get state() { return state; }, exportJSON, importJSON, reset,
    addAttempt, best, last, evaluate, sessionSummary, providerAvailable, initSample, initDictation,
    Recorder, speak, coverage, words, fillerCount
  };
})();
