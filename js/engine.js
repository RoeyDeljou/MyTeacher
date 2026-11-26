/* מנוע: שמירת התקדמות, הקלטה ותמלול, והערכת תשובות (AI או הערכה בסיסית לא מקוונת). */
(function () {
  const STORE_KEY = "moonprep.v1";
  const Q_VERSION = 3;

  /* ───────── Storage ───────── */
  const defaults = () => ({
    qVersion: Q_VERSION,
    unlocked: { tl: true, tech: false, final: false },
    finished: { hr: true, tl: false, tech: false, final: false },
    attempts: {},       // id -> [{ts, text, code, mode, dur, score, src, fb}]
    sessions: [],       // [{ts, stage, items:[{id, score}], avg}]
    cm: { done: {}, notes: "" },
    settings: { apiKey: "", groqKey: "", sttEngine: "auto", model: "claude-opus-5-5", provider: "auto", keepAudio: true, theme: "system", qSeconds: 120 }
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
        // השאלות נוסחו מחדש בסגנון שיחה (גרסה 2): מאפסים תשובות וציונים ישנים פעם אחת
        if (!s.qVersion || s.qVersion < Q_VERSION) {
          const had = Object.keys(s.attempts || {}).length > 0 || (s.sessions || []).length > 0;
          state.attempts = {}; state.sessions = []; state.qVersion = Q_VERSION;
          state.justMigrated = had;
          save();
        }
      }
    } catch (e) { state = defaults(); }
    return state;
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }
  function exportJSON() { const s = JSON.parse(JSON.stringify(state)); s.settings.apiKey = ""; s.settings.groqKey = ""; return JSON.stringify(s); }
  function importJSON(txt) {
    const s = JSON.parse(txt);
    if (!s || typeof s !== "object" || !s.attempts) throw new Error("bad");
    const key = state.settings.apiKey, gk = state.settings.groqKey;
    state = Object.assign(defaults(), s);
    state.settings = Object.assign(defaults().settings, s.settings || {}, { apiKey: key, groqKey: gk });
    save();
  }
  function resetAnswers() { state.attempts = {}; state.sessions = []; save(); }
  function reset() { const key = state.settings.apiKey, gk = state.settings.groqKey; state = defaults(); state.settings.apiKey = key; state.settings.groqKey = gk; save(); }

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

${item.k ? "נקודות שמראיין מצפה לשמוע:" : "מה מראיין מצפה לראות בתשובה (רעיונות ודרך חשיבה – לא מילים מסוימות):"}
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
0. ${item.k ? "זה תרגיל טכני: בדוק נכונות, איכות קוד והסבר." : `זה ריאיון שיחה, לא מבחן מונחים. מראיין מנוסה בודק ארבעה דברים:
   א. האם המועמד הבין את הבעיה ומה כנראה גורם לה.
   ב. האם יש לו דרך עבודה מסודרת (למשל: לשחזר, למדוד, לאתר, לתקן, לבדוק שוב).
   ג. האם כיוון הפתרון והשיקולים הארכיטקטוניים הגיוניים, כולל שיקולי Trade-off.
   ד. האם הוא מסביר בבהירות מה הוא היה עושה בפועל, ומתי היה מתקשר עם הצוות.
   מונחים: אל תוריד ציון על מונח שלא נאמר אם הרעיון עצמו מתואר נכון במילים פשוטות. אל תתגמל רשימת מונחים בלי הסבר של תהליך. מספיק ששיטה מרכזית אחת או שתיים מוזכרות כשהן באמת לב הפתרון.`}
1. ציון 0-10 (חצאים מותרים). אל תעלה ציון כדי לעודד. 7 = מבין את הבעיה וכיוון נכון אבל חסר תהליך או שיקול חשוב, 8.5 = תשובה טובה מאוד של מפתח מנוסה, 9.5+ = כמעט מושלמת.
2. corrections: רק טעויות אמיתיות – דבר שגוי, או החלטה שתגרום לבעיה. "לא הזכרת את המונח X" אינה טעות. הסבר כל תיקון בשפה פשוטה.
2א. missing: רעיונות, שלבים או שיקולים שחסרים בתשובה – לא שמות של מונחים.
3. אם המועמד אמר שהוא לא יודע משהו, הערך איך התמודד: כנות, עקרונות, ואיך היה חוקר. אל תדרוש שיעמיד פנים.
4. AI הוא יתרון אבל לא תחליף להבנה – אם הוא מציג את ה-AI כמקבל ההחלטות, ציין זאת.
5. better_phrasing: לא תשובה מושלמת לשינון. 2-4 משפטים קצרים בשפה מדוברת, בסגנון שלו, שמוסיפים את מה שחסר בתהליך או בשיקולים. בלי להעמיס מונחים.
6. delivery: הערות על אופן ההעברה בעל פה (מבנה, אורך, בהירות, מילות מילוי). אם הוקלד – הערות על מבנה ובהירות.
7. follow_up: שאלת המשך אחת שמעמיקה בנקודה החלשה, מנוסחת כמו ש-Team Lead אומר אותה בעל פה בשיחה: מצב או בעיה ("ומה קורה אם…", "נגיד ש…"), משפט אחד או שניים, בלי רשימת מונחים ובלי לרמוז על התשובה. לכל היותר מונח טכני אחד.
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
  const IN_CLAUDE = !!(window.claude && typeof window.claude.use === "function");
  let dictation = null, dictationPromise = null, tts = null, perms = null;
  function initDictation() {
    if (dictationPromise) return dictationPromise;
    dictationPromise = (async () => {
      try {
        if (IN_CLAUDE) {
          const [d, t, p] = await Promise.all(["dictation", "tts", "permissions"].map(n => window.claude.use(n).catch(() => null)));
          dictation = d; tts = t; perms = p;
        }
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
  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let srBroken = false;
  /* Whisper (Groq) דרך פונקציית השרת /api/transcribe */
  const WHISPER_PROMPT = "ריאיון עבודה למשרת Unity Developer ב-Moon Active. מונחים: Unity, C#, MonoBehaviour, Coroutine, async/await, Task, CancellationToken, Addressables, ScriptableObject, Object Pooling, Garbage Collection, GC Alloc, Profiler, Draw Calls, Batching, Canvas, Prefab, Singleton, Events, Dependency Injection, Server Authoritative, Idempotency, Claude Code, Cursor, LLM, Agent, MCP, RAG, Firebase, Coin Master, Space Roads, AddForce, Bagira.";
  function whisperReady() { return !IN_CLAUDE && state.settings.sttEngine !== "browser" && /^gsk_/.test(state.settings.groqKey || "") && !!(navigator.mediaDevices && window.MediaRecorder) && location.protocol.startsWith("http"); }
  async function transcribe(blob) {
    const res = await fetch("api/transcribe", {
      method: "POST",
      headers: { "content-type": blob.type || "audio/webm", "x-groq-key": state.settings.groqKey, "x-model": "whisper-large-v3", "x-prompt": encodeURIComponent(WHISPER_PROMPT) },
      body: blob
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "stt"), { code: data.error, status: res.status, detail: data.message });
    return (data.text || "").trim();
  }
  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(t)) return t;
    return "";
  }

  class Recorder {
    constructor({ onText, onInterim, onState }) {
      this.onText = onText; this.onInterim = onInterim; this.onState = onState;
      this.active = false; this.audioUrl = null; this.chunks = [];
      this.mode = null; this.startedAt = 0; this.elapsed = 0;
    }
    static support() {
      if (IN_CLAUDE) return { dictation: !!dictation, speech: false, media: false, whisper: false };
      return { dictation: false, speech: !!SR && !srBroken, media: !!(navigator.mediaDevices && window.MediaRecorder), whisper: whisperReady() };
    }
    /* הקלטה מלאה ותמלול אחרי עצירה */
    async startWhisper() {
      this.mode = "whisper";
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (e) { this.active = false; this.finished = true; this.onState("error", "denied"); return; }
      if (!this.active) { this.stream.getTracks().forEach(t => t.stop()); return; }
      const mime = pickMime();
      try { this.mr = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 }); }
      catch (e) { this.mr = new MediaRecorder(this.stream); }
      this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.mr.onstop = () => {
        this.stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(this.chunks, { type: (this.mr.mimeType || mime || "audio/webm").split(";")[0] });
        this.lastBlob = blob;
        if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
        this.audioUrl = URL.createObjectURL(blob);
        this.onState("audio", this.audioUrl);
        this.runTranscribe(blob);
      };
      this.mr.start(1000);
      this.onState("on");
    }
    async runTranscribe(blob) {
      this.onState("transcribing");
      try {
        const text = await transcribe(blob || this.lastBlob);
        if (text) this.onText(text);
        this.finished = true; this.onInterim("");
        this.onState("off", text ? "transcribed" : "empty");
      } catch (e) {
        this.finished = true;
        this.onState("off", "stt-" + (e.code || "error") + (e.status ? ":" + e.status : ""));
      }
    }
    async start() {
      if (this.active) return;
      this.active = true; this.finished = false; this.quickEnds = 0; this.lastError = null;
      this.startedAt = performance.now(); this.chunks = [];
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
      if (IN_CLAUDE) { this.active = false; this.onState("error", "claude-frame"); return; }
      if (whisperReady()) { this.startWhisper(); return; }
      if (SR && !srBroken) {
        this.mode = "speech";
        try { this.startRecognition(); } catch (e) { this.active = false; this.onState("error", "unsupported"); return; }   // קודם התמלול – עוד בתוך הלחיצה (חשוב ב-iPhone)
        this.onState("on");
        // הקלטת קול במקביל רק כשאין התנגשות ידועה (ב-iOS המיקרופון לא מתחלק בין השניים)
        if (state.settings.keepAudio && !IS_IOS && navigator.mediaDevices && window.MediaRecorder) {
          try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!this.active) { this.stream.getTracks().forEach(t => t.stop()); return; }
            this.mr = new MediaRecorder(this.stream);
            this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
            this.mr.start();
          } catch (e) { this.mr = null; }
        }
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
      const emitted = new Set();               // ב-Safari אותה תוצאה סופית יכולה לחזור – לא לכפול
      this.pending = "";
      r.onresult = ev => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) { if (!emitted.has(i)) { emitted.add(i); this.onText(res[0].transcript); } }
          else interim += res[0].transcript;
        }
        this.pending = interim;
        this.onInterim(interim);
      };
      r.onerror = ev => {
        this.lastError = ev.error;
        if (ev.error === "audio-capture" && this.mr) {      // המיקרופון תפוס ע"י ההקלטה – ממשיכים בלי הקלטה
          this.stopMedia(false); this.mr = null; state.settings.keepAudio = false; save();
        } else if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          this.active = false; clearTimeout(this.restartT);
          try { r.abort(); } catch (e) { }
          if (ev.error === "service-not-allowed") srBroken = true;   // בדרך כלל: Dictation/Siri כבויים ב-iOS
          this.onState("error", ev.error === "service-not-allowed" ? "ios-dictation" : "denied");
        }
      };
      r.onend = () => {
        if (this.rec !== r) return;                          // אירוע של מופע ישן
        if (this.pending) { this.onText(this.pending); this.pending = ""; }   // לא לאבד טקסט שלא סומן סופי
        if (this.active) {
          // Safari עוצר אחרי שקט. ממשיכים – אבל אף פעם לא באותו רגע ולא בלולאה.
          const life = performance.now() - this.recStartedAt;
          this.quickEnds = life < 1500 ? this.quickEnds + 1 : 0;
          if (this.quickEnds >= 3) { this.active = false; this.finish("speech-ended"); return; }
          clearTimeout(this.restartT);
          this.restartT = setTimeout(() => {
            if (!this.active) return;
            try { this.startRecognition(); }
            catch (e) { this.active = false; this.finish("speech-ended"); }
          }, 350);
          return;
        }
        this.finish(this.lastError);
      };
      this.rec = r;
      this.recStartedAt = performance.now();
      r.start();
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
      if (this.finished) return;
      const wasActive = this.active;
      this.active = false;
      clearTimeout(this.restartT);
      if (wasActive) this.elapsed += (performance.now() - this.startedAt) / 1000;
      if (this.mode === "dictation") { dictation.stop().catch(() => { }); setTimeout(() => this.finish(), 1500); return; }
      if (this.mode === "whisper") {
        if (this.mr && this.mr.state !== "inactive") { try { this.mr.stop(); } catch (e) { this.finish(); } }
        else if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.finish(); }
        else this.finish();
        return;
      }
      const r = this.rec;
      if (r) {
        try { r.stop(); } catch (e) { }
        // אם הדפדפן לא מסיים בעצמו – עוצרים בכוח ומעדכנים את המסך
        setTimeout(() => { if (!this.finished) { try { r.abort(); } catch (e) { } if (this.pending) { this.onText(this.pending); this.pending = ""; } this.finish(); } }, 800);
      } else this.finish();
    }
    finish(reason) {
      if (this.finished) return;                             // פעם אחת בלבד
      this.finished = true; this.active = false;
      clearTimeout(this.restartT);
      if (this.offs) { this.offs.forEach(f => { try { f(); } catch (e) { } }); this.offs = null; }
      this.stopMedia(true);
      this.onInterim("");
      this.onState("off", reason);
    }
    seconds() { return this.elapsed + (this.active ? (performance.now() - this.startedAt) / 1000 : 0); }
    resetTime() { this.elapsed = 0; }
  }

  /* ───────── Speak question (TTS) ───────── */
  function speak(text) {
    if (tts) {
      tts.speak(text, { language: "he" }).catch(e => {
        if (e && e.code === "unavailable") tts.speak(text).catch(() => browserSpeak(text));
        else if (e && e.code !== "viewer_stopped") browserSpeak(text);
      });
      return true;
    }
    return browserSpeak(text);
  }
  function stopSpeak() { try { tts && tts.stop(); } catch (e) { } if ("speechSynthesis" in window) speechSynthesis.cancel(); }
  function browserSpeak(text) {
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
    load, save, get state() { return state; }, exportJSON, importJSON, reset, resetAnswers,
    addAttempt, best, last, evaluate, sessionSummary, providerAvailable, initSample, initDictation,
    Recorder, speak, stopSpeak, coverage, words, fillerCount,
    inClaude: IN_CLAUDE, isIOS: IS_IOS, whisperReady,
    standalone: !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true,
    async diag() {
      await initDictation();
      let mic = null;
      try { if (perms && dictation) mic = await perms.state("dictation"); } catch (e) { }
      return { inClaude: IN_CLAUDE, dictation: !!dictation, dictationState: mic, tts: !!tts, speechAPI: !!SR, synth: "speechSynthesis" in window };
    },
    async openPermissions() { if (!perms) throw new Error("unavailable"); await perms.manage(); }
  };
})();
