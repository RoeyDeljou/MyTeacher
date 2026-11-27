/* ממשק האפליקציה: ניווט, מסכים, סימולציה ומשוב. */
(function () {
  const D = window.APP_DATA, E = window.Engine;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 1 6.5 19H20"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9a3 3 0 0 0-2.8-1.5c-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2A3.2 3.2 0 0 1 9 15M12 6v1.5M12 16.5V18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    spk: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    back: '<path d="M9 18l6-6-6-6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };
  const icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  const STAGES = [
    { key: "hr", n: 1, short: "HR", name: "ריאיון HR", desc: "הושלם", items: () => [] },
    { key: "tl", n: 2, short: "Team Lead", name: "ריאיון מול Unity Team Lead", desc: "שיחה: על עצמך, AI ו-Unity. התשובות בעל פה.", items: () => D.stage1 },
    { key: "tech", n: 3, short: "טכני ו-Live Coding", name: "ריאיון טכני ו-Live Coding", desc: "Code Review, מציאת באגים, כתיבת קוד וחשיבה בקול.", items: () => D.stage2 },
    { key: "final", n: 4, short: "סופי", name: "ריאיון סופי", desc: "System Design, מוטיבציה ושאלות לצוות. הפורמט בפועל לא ידוע – הכנה כללית.", items: () => D.stage3 }
  ];
  const stageOf = k => STAGES.find(s => s.key === k);
  const currentStage = () => { const st = E.state; return !st.finished.tl ? "tl" : !st.finished.tech ? "tech" : "final"; };
  const allItems = () => [...D.stage1.map(x => ({ ...x, _s: "tl" })), ...D.stage2.map(x => ({ ...x, _s: "tech" })), ...D.stage3.map(x => ({ ...x, _s: "final" }))];
  const findItem = id => allItems().find(x => x.id === id);
  const qText = it => it.q || it.prompt;
  const catLabel = it => it.k ? D.stage2Kinds[it.k].he : (D.cats[it.c] ? D.cats[it.c].he : "");
  const scoreCls = s => s == null ? "" : s >= 8 ? "good" : s >= 6 ? "warn" : "bad";
  const KB_TIP = "המיקרופון של הדפדפן חסום כאן. לחץ על אייקון המיקרופון 🎤 במקלדת של הטלפון (בתוך התיבה) ודבר – זה עובד בדיוק כמו הקלטה, והתמלול נכנס לתיבה.";
  const fmt = s => s == null ? "–" : (Math.round(s * 10) / 10).toString();

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function applyTheme() {
    const t = E.state.settings.theme;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }

  /* ───────── Stats ───────── */
  function stageStats(key) {
    const items = stageOf(key).items();
    const answered = items.filter(i => E.best(i.id) != null);
    const avg = answered.length ? answered.reduce((a, i) => a + E.best(i.id), 0) / answered.length : null;
    const weak = answered.filter(i => E.best(i.id) < 7).length;
    return { total: items.length, answered: answered.length, avg, weak };
  }

  /* ───────── Router ───────── */
  const views = { home: viewHome, practice: viewPractice, sim: viewSim, terms: viewTerms, coin: viewCoin, settings: viewSettings };
  let cleanup = null;
  function route() {
    if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; }
    const h = (location.hash || "#home").slice(1);
    const main = $("#main");
    let navKey = h;
    if (h.startsWith("q-")) { navKey = "practice"; viewQuestion(main, h.slice(2)); }
    else (views[h] || viewHome)(main);
    if (!views[h] && !h.startsWith("q-")) navKey = "home";
    if (navKey === "sim") navKey = "practice";
    document.querySelectorAll(".nav a").forEach(a => a.setAttribute("aria-current", a.dataset.k === navKey ? "page" : "false"));
    $("#stagePill").textContent = "שלב: " + stageOf(currentStage()).short;
    window.scrollTo(0, 0);
  }

  /* ───────── Home ───────── */
  function viewHome(main) {
    const st = E.state, cur = currentStage(), ss = stageStats(cur);
    const prov = E.providerAvailable();
    const resume = D.stage1.find(x => x.resume);
    const resumeDone = resume && E.best(resume.id) != null;
    main.innerHTML = `
    <section class="card hero">
      <div class="row between"><span class="badge violet">Moon Active · Unity Developer · AI-first</span><span class="badge">${esc(D.job.location.split("·")[0].trim())}</span></div>
      <h1>${cur === "tl" ? "מתכוננים לריאיון מול ה-Unity Team Lead" : cur === "tech" ? "מתכוננים לריאיון הטכני ול-Live Coding" : "מתכוננים לריאיון הסופי"}</h1>
      <p class="muted">${esc(stageOf(cur).desc)}</p>
      <div class="grid2">
        <div class="stat"><b>${ss.answered}/${ss.total}</b><span>שאלות שתרגלת בשלב</span></div>
        <div class="stat"><b>${fmt(ss.avg)}</b><span>ממוצע הציון הטוב ביותר</span></div>
      </div>
      <div class="bar" aria-hidden="true"><i style="width:${ss.total ? Math.round(ss.answered / ss.total * 100) : 0}%"></i></div>
      <div class="grid2 stack-sm">
        <a class="btn primary" href="#sim">${icon("mic")} סימולציית ריאיון</a>
        <button class="btn" id="randQ">${icon("spark")} שאלה חדשה אקראית</button>
      </div>
      ${ss.answered ? `<button class="btn" id="againQ">${icon("mic")} תרגל שוב שאלות שכבר ענית (${ss.answered})</button>` : ""}
      ${ss.weak ? `<button class="btn ghost sm" id="weakQ">חזרה על ${ss.weak} שאלות עם ציון מתחת ל-7</button>` : ""}
    </section>

    ${cur === "tl" && resume && !resumeDone ? `
    <section class="card">
      <div class="row between"><h2>נקודת ההמשך מהשיחה הקודמת</h2><span class="badge gold">לא נענתה</span></div>
      <p>${esc(resume.q)}</p>
      <a class="btn" href="#q-${resume.id}">${icon("mic")} ענה עכשיו</a>
    </section>` : ""}

    <section class="card">
      <h2>שלבי התהליך</h2>
      <div class="stages">
        ${STAGES.map(s => {
          const done = st.finished[s.key], unlocked = s.key === "hr" || st.unlocked[s.key], active = s.key === cur;
          const cls = done ? "done" : active ? "active" : unlocked ? "" : "locked";
          const stt = s.key !== "hr" && unlocked ? stageStats(s.key) : null;
          return `<div class="stage ${cls}">
            <div class="dot">${done ? "✓" : unlocked ? s.n : icon("lock")}</div>
            <div><b>${esc(s.name)}</b><small>${done ? "הושלם" : unlocked ? (stt ? `${stt.answered}/${stt.total} תורגלו · ממוצע ${fmt(stt.avg)}` : esc(s.desc)) : "נפתח אחרי סיום השלב הקודם"}</small></div>
            <div>${unlocked && s.key !== "hr" ? `<a class="btn sm ghost" href="#practice" data-stage="${s.key}">תרגול</a>` : ""}</div>
          </div>`;
        }).join("")}
      </div>
      ${cur !== "final" || !st.finished.final ? `<div id="finishBox">
        <button class="btn block" id="finishBtn">${icon("check")} ${cur === "tl" ? "סיימתי את ריאיון ה-Team Lead – פתח את השלב הבא" : cur === "tech" ? "סיימתי את הריאיון הטכני – פתח את הריאיון הסופי" : "סיימתי את הריאיון הסופי"}</button>
      </div>` : ""}
    </section>

    <section class="card">
      <h2>הערכת התשובות</h2>
      ${prov === "offline"
        ? `<p class="note">כרגע ההערכה בסיסית: בודקת אילו נקודות מפתח הזכרת, בלי לבדוק דיוק. כדי לקבל ציון, תיקונים ומשוב של מראיין, חבר AI בלשונית <a href="#settings">הגדרות</a>.</p>`
        : `<p class="note violet">הערכת AI פעילה (${prov === "claude" ? "Claude דרך claude.ai" : "Claude API עם המפתח שלך"}). כל תשובה מקבלת ציון, תיקונים, מה המראיין מצפה לשמוע ושאלת המשך.</p>`}
      ${!E.inClaude && !E.whisperReady() ? `<p class="note">לתמלול מדויק של הדיבור (Whisper) הוסף מפתח Groq חינמי ב<a href="#settings">הגדרות</a>.</p>` : ""}
      <p class="small muted">איך עונים: לוחצים על המיקרופון ומדברים כמו בריאיון. התמלול מופיע בתיבה ואפשר לתקן אותו לפני שליחה. אם התמלול לא עובד במכשיר, אפשר להשתמש במיקרופון של המקלדת בתוך התיבה.</p>
    </section>

    <details class="card flat"><summary>המסרים שלך – לשמר בכל תשובה</summary>
      <p class="note">${esc(D.profile.oneLiner)}</p>
      <ul>${D.profile.messages.map(m => `<li>${esc(m)}</li>`).join("")}</ul>
      <h3>פערים שסומנו לחיזוק</h3>
      <ul>${D.profile.gaps.map(m => `<li>${esc(m)}</li>`).join("")}</ul>
    </details>

    <details class="card flat"><summary>תיאור המשרה ומה הוא אומר לך</summary>
      <p class="small muted">מקור: <span class="ltr">jobs.ashbyhq.com</span> · ${esc(D.job.location)}</p>
      <div class="ltr small">${esc(D.job.summary)}</div>
      <h3>Responsibilities</h3><ul class="ltr small job">${D.job.responsibilities.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      <h3>Requirements</h3><ul class="ltr small job">${D.job.requirements.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      <h3>Advantages</h3><ul class="ltr small job">${D.job.advantages.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      <h3>הדגשים בעברית ומה מתרגלים לכל אחד</h3>
      <ul>${D.job.focus.map(f => `<li>${esc(f.he)} – ${f.cats.map(c => `<span class="badge">${esc(D.cats[c].he)}</span>`).join(" ")}</li>`).join("")}</ul>
    </details>

    <details class="card flat"><summary>22 התרגולים שכבר עשית ב-ChatGPT – התיקונים לזכור</summary>
      <p class="small muted">השאלות האלה לא נשאלות שוב באותו ניסוח. כאן רק התיקונים, לחזרה מהירה.</p>
      ${D.pastPractice.map(p => `<div class="stack"><div class="row between"><b>${esc(p.q)}</b>${p.s ? `<span class="badge">${esc(p.s)}/10</span>` : ""}</div><ul class="small">${p.fix.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>`).join("<hr>")}
    </details>`;

    $("#randQ").onclick = () => { const it = pickNew(cur); if (it) location.hash = "q-" + it.id; };
    const ag = $("#againQ"); if (ag) ag.onclick = () => {
      const ids = buildSim(cur, Math.min(8, ss.answered), "answered");
      sim = { stage: cur, ids, i: 0, results: [], done: false };
      location.hash = "sim";
    };
    const w = $("#weakQ"); if (w) w.onclick = () => { const it = pickWeak(cur); if (it) location.hash = "q-" + it.id; };
    main.querySelectorAll("[data-stage]").forEach(a => a.onclick = () => { practiceState.stage = a.dataset.stage; });
    const fb = $("#finishBtn");
    if (fb) fb.onclick = () => {
      const box = $("#finishBox");
      const s2 = stageStats(cur);
      box.innerHTML = `<div class="confirm">
        <b>לסמן את השלב כגמור?</b>
        <p class="small">תרגלת ${s2.answered} מתוך ${s2.total} שאלות בשלב, ממוצע ${fmt(s2.avg)}. ${s2.answered < s2.total / 3 ? "תרגלת פחות משליש מהשאלות. אם הריאיון עוד לא התקיים, כדאי להמשיך." : ""} סימון השלב פותח את השלב הבא. שאלות השלב הזה יישארו זמינות לתרגול.</p>
        <div class="row"><button class="btn gold" id="yesFinish">כן, השלב הסתיים</button><button class="btn ghost" id="noFinish">עוד לא</button></div>
      </div>`;
      $("#noFinish").onclick = () => viewHome(main);
      $("#yesFinish").onclick = () => {
        st.finished[cur] = true;
        if (cur === "tl") st.unlocked.tech = true;
        if (cur === "tech") st.unlocked.final = true;
        E.save(); toast("השלב הבא נפתח"); route();
      };
    };
  }

  function pickNew(stageKey, cat) {
    let pool = stageOf(stageKey).items().filter(i => !cat || i.c === cat || i.k === cat);
    const fresh = pool.filter(i => E.best(i.id) == null);
    const src = fresh.length ? fresh : pool;
    return src[Math.floor(Math.random() * src.length)];
  }
  function pickWeak(stageKey) {
    const pool = stageOf(stageKey).items().filter(i => { const b = E.best(i.id); return b != null && b < 7; });
    return pool.sort((a, b) => E.best(a.id) - E.best(b.id))[0];
  }

  /* ───────── Practice list ───────── */
  const practiceState = { stage: null, cat: "", filter: "all" };
  function viewPractice(main) {
    const st = E.state;
    if (!practiceState.stage || (practiceState.stage !== "tl" && !st.unlocked[practiceState.stage])) practiceState.stage = currentStage();
    const sk = practiceState.stage;
    const items = stageOf(sk).items();
    const cats = sk === "tech" ? Object.entries(D.stage2Kinds).map(([k, v]) => [k, v.he]) : [...new Set(items.map(i => i.c))].map(c => [c, D.cats[c].he]);
    let list = items.filter(i => !practiceState.cat || i.c === practiceState.cat || i.k === practiceState.cat);
    if (practiceState.filter === "new") list = list.filter(i => E.best(i.id) == null);
    if (practiceState.filter === "done") list = list.filter(i => E.best(i.id) != null);
    if (practiceState.filter === "weak") list = list.filter(i => { const b = E.best(i.id); return b != null && b < 7; });
    main.innerHTML = `
    <section class="stack">
      <div class="row between"><h1>בנק שאלות</h1><a class="btn sm primary" href="#sim">${icon("mic")} סימולציה</a></div>
      <div class="chips" role="group" aria-label="שלב">
        ${STAGES.filter(s => s.key !== "hr").map(s => {
          const open = s.key === "tl" || st.unlocked[s.key];
          return `<button class="chip" data-st="${s.key}" aria-pressed="${s.key === sk}" ${open ? "" : "disabled"}>${open ? "" : "🔒 "}${esc(s.short)}</button>`;
        }).join("")}
      </div>
      <div class="chips" role="group" aria-label="נושא">
        <button class="chip" data-cat="" aria-pressed="${!practiceState.cat}">הכול (${items.length})</button>
        ${cats.map(([k, he]) => `<button class="chip" data-cat="${k}" aria-pressed="${practiceState.cat === k}">${esc(he)}</button>`).join("")}
      </div>
      <div class="chips" role="group" aria-label="סינון">
        ${[["all", "הכול"], ["new", "לא תורגלו"], ["done", "כבר ענית"], ["weak", "ציון מתחת ל-7"]].map(([k, he]) => `<button class="chip" data-f="${k}" aria-pressed="${practiceState.filter === k}">${he}</button>`).join("")}
      </div>
    </section>
    <section class="qlist">
      ${list.length ? list.map(i => {
        const b = E.best(i.id);
        return `<button class="qitem" data-id="${i.id}">
          <div><p>${esc(i.title ? i.title + " – " + qText(i) : qText(i))}</p>
          <div class="meta"><span class="badge">${esc(catLabel(i))}</span><span class="badge">רמה ${i.lv}</span>${i.time ? `<span class="badge">${i.time} דק'</span>` : ""}${i.resume ? `<span class="badge gold">נקודת ההמשך</span>` : ""}${(E.state.attempts[i.id] || []).length ? `<span class="badge violet">ענית ${(E.state.attempts[i.id] || []).length} פעמים</span>` : ""}</div></div>
          <span class="score-dot ${scoreCls(b)}">${fmt(b)}</span></button>`;
      }).join("") : `<div class="empty">אין שאלות שמתאימות לסינון.</div>`}
    </section>`;
    main.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { practiceState.stage = b.dataset.st; practiceState.cat = ""; viewPractice(main); });
    main.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { practiceState.cat = b.dataset.cat; viewPractice(main); });
    main.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { practiceState.filter = b.dataset.f; viewPractice(main); });
    main.querySelectorAll("[data-id]").forEach(b => b.onclick = () => { location.hash = "q-" + b.dataset.id; });
  }

  /* ───────── Single question ───────── */
  function viewQuestion(main, id) {
    const it = findItem(id);
    if (!it) { main.innerHTML = `<div class="empty">השאלה לא נמצאה. <a href="#practice">לבנק השאלות</a></div>`; return; }
    const stageKey = it._s;
    main.innerHTML = `<div class="row"><a class="btn sm ghost" href="#practice">${icon("back")} לבנק השאלות</a></div><div id="runner"></div>`;
    runQuestion($("#runner"), it, {
      stage: stageKey,
      onNext: () => { const n = pickNew(stageKey, it.c || it.k); location.hash = "q-" + (n && n.id !== it.id ? n.id : pickNew(stageKey).id); }
    });
  }

  /* ───────── Runner ───────── */
  function runQuestion(root, it, opts) {
    const isTech = !!it.k;
    const prevAttempts = E.state.attempts[it.id] || [];
    let kbStart = 0, text = "", interimText = "", audioUrl = null, mode = "text", timerId = null, ctl = null, evaluated = null;
    let openedAt = performance.now();
    const target = isTech ? (it.time || 10) * 60 : E.state.settings.qSeconds;

    const rec = new E.Recorder({
      onText: t => { const ta = $("#ans", root); const v = ta.value; ta.value = (v && !/\s$/.test(v) ? v + " " : v) + t.trim(); text = ta.value; },
      onInterim: t => { interimText = t; const el = $("#interim", root); if (el) el.textContent = t; },
      onState: (s, extra) => {
        const b = $("#recBtn", root);
        if (s === "on") { mode = "voice"; b.classList.add("on", "stop"); b.innerHTML = icon("stop"); b.setAttribute("aria-label", "עצור הקלטה"); $("#recHint", root).textContent = sup.whisper ? "מקליט… דבר כמו בריאיון ולחץ שוב כשסיימת" : "מקליט… דבר כמו בריאיון"; }
        if (s === "off") { stopTimer(); b.classList.remove("on", "stop"); b.innerHTML = icon("mic"); b.setAttribute("aria-label", "התחל הקלטה"); $("#recHint", root).textContent = extra && extra !== "stopped" && extra !== "viewer_stopped" ? recError(extra) : "ההקלטה נעצרה. אפשר לתקן את התמלול ואז לבקש משוב."; }
        if (s === "transcribing") { b.classList.remove("on", "stop"); b.innerHTML = '<span class="spinner"></span>'; b.disabled = true; $("#recHint", root).textContent = "מתמלל את ההקלטה עם Whisper…"; }
        if (s === "off") { b.disabled = false; }
        if (s === "audio") { audioUrl = extra; const a = $("#audioBox", root); a.innerHTML = `<p class="small muted">ההקלטה שלך – שמע את עצמך:</p><audio controls src="${extra}"></audio>`; }
        if (s === "error") { b.classList.remove("on", "stop"); b.innerHTML = icon("mic"); stopTimer(); $("#recHint", root).textContent = recError(extra); }
      }
    });

    function recError(r) {
      if (r === "ios-dictation") { keyboardMic(); return "ה-iPhone לא מאפשר תמלול כרגע. בדוק בהגדרות: כללי ← מקלדת ← \"הפעל הכתבה\" מופעל, ו-Siri מופעל. בינתיים: לחץ על 🎤 במקלדת בתוך התיבה ודבר."; }
      if (r === "claude-frame" || r === "unavailable" || r === "unsupported") { keyboardMic(); return KB_TIP; }
      if (r === "not_granted" && E.inClaude) { showPermBtn(); keyboardMic(); return "ההכתבה של claude.ai כבויה לעמוד הזה. אפשר להפעיל אותה בכפתור ההרשאות, או לענות עכשיו עם המיקרופון של המקלדת."; }
      if (r === "denied" || r === "not_granted") { keyboardMic(); return E.isIOS ? "אין הרשאה למיקרופון. ב-iPhone: הגדרות ← Safari ← מיקרופון ← \"שאל\" או \"אפשר\". בינתיים אפשר לענות עם 🎤 של המקלדת." : "אין הרשאה למיקרופון. אפשר להפעיל אותה בהגדרות האתר בדפדפן, או לענות עם המיקרופון של המקלדת."; }
      if (r === "unsupported" || r === "unavailable") return "התמלול לא נתמך כאן. אפשר להקליד, או להשתמש במיקרופון של המקלדת בתוך התיבה.";
      if (r === "mic") return "לא הצלחתי לפתוח את המיקרופון.";
      if (r === "hidden") return "ההקלטה נעצרה כי המסך הוסתר.";
      if (r === "transcribed") return "התמלול נוסף לתיבה. אפשר לתקן, להוסיף הקלטה, או לבקש משוב.";
      if (r === "empty") return "לא זוהה דיבור בהקלטה. נסה שוב, קרוב יותר למיקרופון.";
      if (r && r.startsWith("stt-")) { showRetry(); return r.includes("401") || r.includes("missing_key") ? "מפתח Groq לא תקין. בדוק אותו בהגדרות. ההקלטה נשמרה – אפשר לנסות שוב." : r.includes("429") ? "הגעת למגבלת התמלול החינמית לדקה זו. נסה שוב בעוד רגע – ההקלטה נשמרה." : r.includes("too_large") ? "ההקלטה ארוכה מדי לתמלול אחד. נסה תשובה קצרה יותר." : "התמלול נכשל (בעיית רשת?). ההקלטה נשמרה – אפשר לנסות שוב."; }
      if (r === "speech-ended") return "התמלול נעצר אחרי שקט. מה שנאמר נשמר בתיבה – לחץ שוב על המיקרופון כדי להמשיך.";
      return "ההקלטה נעצרה.";
    }

    function showRetry() {
      const box = $("#audioBox", root); if (!box || $("#sttRetry", root)) return;
      const b = document.createElement("button"); b.className = "btn sm"; b.id = "sttRetry"; b.textContent = "נסה לתמלל שוב";
      b.onclick = () => { b.remove(); rec.runTranscribe(); };
      box.appendChild(b);
    }
    function keyboardMic() { const t = $("#ans", root); if (t) { t.focus(); t.scrollIntoView({ block: "center", behavior: "smooth" }); } }
    function showPermBtn() {
      const b = $("#permBtn", root); if (!b) return;
      b.hidden = false;
      b.onclick = () => E.openPermissions().then(() => { $("#recHint", root).textContent = "אם הפעלת הכתבה, לחץ שוב על המיקרופון."; }).catch(() => toast("פתח את תפריט ההרשאות של העמוד ב-claude.ai"));
    }
    const sup = E.Recorder.support();
    const canRec = sup.dictation || sup.speech || sup.media;
    root.innerHTML = `
    <section class="card">
      <div class="row between">
        <div class="row" style="gap:6px">${opts.position ? `<span class="badge violet">${opts.position}</span>` : ""}<span class="badge">${esc(catLabel(it))}</span><span class="badge">רמה ${it.lv}</span>${it.resume ? '<span class="badge gold">נקודת ההמשך</span>' : ""}</div>
        ${prevAttempts.length ? `<span class="badge ${scoreCls(E.best(it.id))}">ניסיון ${prevAttempts.length + 1} · הכי טוב ${fmt(E.best(it.id))} · אחרון ${fmt(prevAttempts[prevAttempts.length - 1].score)}</span>` : ""}
      </div>
      ${it.title ? `<h2>${esc(it.title)}</h2>` : ""}
      <p class="qtext">${esc(qText(it))}</p>
      ${it.code ? `<pre class="code">${esc(it.code)}</pre>` : ""}
      <div class="row"><button class="btn sm ghost" id="speakBtn">${icon("spk")} הקרא לי את השאלה</button>
      <span class="small muted">${isTech ? `זמן מומלץ: ${it.time} דקות` : "יעד: 1-2 דקות דיבור"}</span></div>
    </section>

    <section class="card">
      <div class="rec">
        <button class="recbtn" id="recBtn" aria-label="${canRec ? "התחל הקלטה" : "ענה בעל פה עם מיקרופון המקלדת"}">${icon("mic")}</button>
        <div class="stack" style="gap:2px;flex:1;min-width:0">
          <span class="timer" id="timer">00:00</span>
          <span class="small muted" id="recHint">${!canRec ? KB_TIP : sup.whisper ? "לחץ, דבר, ולחץ שוב לסיום. התמלול (Whisper) יופיע בתיבה אחרי העצירה." : "לחץ והתחל לדבר. התמלול יופיע בתיבה."}</span>
          <button class="btn sm ghost" id="permBtn" hidden>פתח הרשאות של העמוד</button>
        </div>
      </div>
      <p class="interim" id="interim" aria-live="polite"></p>
      <label class="field" for="ans">${isTech ? "ההסבר שלך (בעל פה או בהקלדה)" : "התשובה שלך (תמלול – אפשר לערוך)"}</label>
      <textarea id="ans" class="answer" dir="rtl" placeholder="${isTech ? "תסביר כאן את מה שמצאת ואת ההחלטות שלך…" : "התמלול יופיע כאן, או הקלד…"}"></textarea>
      ${isTech && it.k !== "explain" ? `<label class="field" for="codeAns">הקוד שלך</label><textarea id="codeAns" class="answer codeed" dir="ltr" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(it.code || "")}</textarea>` : ""}
      <div id="audioBox"></div>
      <div id="resetAnsBox"><button class="btn ghost sm" id="resetAnsBtn">↺ התחל את התשובה מחדש</button></div>
      <button class="btn primary block" id="evalBtn">${icon("spark")} קבל משוב</button>
    </section>
    <div id="fb"></div>
    <details class="card flat" id="peek"><summary>${it.k ? "הצצה לנקודות המפתח (עדיף אחרי שעונים)" : "הצצה למה שמראיין רוצה לשמוע (עדיף אחרי שעונים)"}</summary>
      <ul class="points">${(it.p || []).map(p => `<li class="miss"><span class="ic">•</span><span>${esc(p[0])}</span></li>`).join("")}</ul>
      ${it.t ? `<p class="note">${esc(it.t)}</p>` : ""}
    </details>
    ${prevAttempts.length ? `<details class="card flat"><summary>ניסיונות קודמים (${prevAttempts.length})</summary>${prevAttempts.slice(-5).reverse().map(a => `<div class="stack"><div class="row between"><span class="small muted">${new Date(a.ts).toLocaleString("he-IL")}</span><span class="badge ${scoreCls(a.score)}">${fmt(a.score)}</span></div><p class="small">${esc((a.text || "").slice(0, 400))}${(a.text || "").length > 400 ? "…" : ""}</p></div>`).join("<hr>")}</details>` : ""}`;

    const ta = $("#ans", root);
    ta.addEventListener("input", () => { text = ta.value; });
    $("#speakBtn", root).onclick = () => { if (!E.speak(qText(it))) toast("הקראה לא נתמכת בדפדפן הזה"); };
    $("#recBtn", root).onclick = () => {
      if (!E.Recorder.support().dictation && !E.Recorder.support().speech && !E.Recorder.support().media) { keyboardMic(); $("#recHint", root).textContent = KB_TIP; mode = "voice"; if (!kbStart) kbStart = performance.now(); startTimer(); return; }
      if (rec.active || $("#recBtn", root).classList.contains("on")) { rec.stop(); stopTimer(); $("#recHint", root).textContent = "עוצר…"; if (rec.finished) rec.onState("off"); }
      else { rec.start(); startTimer(); }          // start נקרא ישירות מהלחיצה
    };
    function startTimer() {
      stopTimer();
      timerId = setInterval(() => {
        const s = isTech ? (performance.now() - openedAt) / 1000 : kbStart ? (performance.now() - kbStart) / 1000 : rec.seconds();
        const el = $("#timer", root); if (!el) return;
        el.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(Math.floor(s % 60)).padStart(2, "0");
        el.classList.toggle("over", s > target);
      }, 250);
    }
    function stopTimer() { if (timerId && !isTech) { clearInterval(timerId); timerId = null; } }
    if (isTech) startTimer();

    function renderResetBtn() {
      const box = $("#resetAnsBox", root);
      box.innerHTML = `<button class="btn ghost sm" id="resetAnsBtn">↺ התחל את התשובה מחדש</button>`;
      $("#resetAnsBtn", root).onclick = askReset;
    }
    function askReset() {
      const box = $("#resetAnsBox", root);
      box.innerHTML = `<div class="confirm"><b>להתחיל את התשובה מחדש?</b><p class="small">התמלול וההקלטה יימחקו והשעון יתאפס.</p><div class="row"><button class="btn gold sm" id="yesResetAns">כן, מחדש</button><button class="btn ghost sm" id="noResetAns">ביטול</button></div></div>`;
      $("#noResetAns", root).onclick = renderResetBtn;
      $("#yesResetAns", root).onclick = () => {
        rec.cancel();
        if (timerId) { clearInterval(timerId); timerId = null; }
        kbStart = 0; mode = "text"; text = ""; interimText = "";
        ta.value = "";
        $("#interim", root).textContent = "";
        $("#audioBox", root).innerHTML = "";
        const tm = $("#timer", root); tm.textContent = "00:00"; tm.classList.remove("over");
        const b = $("#recBtn", root); b.disabled = false; b.classList.remove("on", "stop"); b.innerHTML = icon("mic"); b.setAttribute("aria-label", "התחל הקלטה");
        $("#recHint", root).textContent = "התשובה אופסה. לחץ על המיקרופון כדי להתחיל מחדש.";
        if (isTech) { openedAt = performance.now(); startTimer(); }
        renderResetBtn();
      };
    }
    renderResetBtn();

    $("#evalBtn", root).onclick = async () => {
      if (rec.active) rec.stop();
      const answer = { text: ta.value.trim(), code: ($("#codeAns", root) || {}).value };
      if (answer.code && answer.code.trim() === (it.code || "").trim()) answer.code = "";
      if (!answer.text && !answer.code) { toast("אין עדיין תשובה. הקלט או הקלד קודם."); return; }
      const btn = $("#evalBtn", root);
      btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${E.providerAvailable() === "offline" ? "בודק…" : "המראיין קורא את התשובה…"}`;
      ctl = new AbortController();
      const meta = { stage: opts.stage, mode, dur: mode === "voice" ? (kbStart ? (performance.now() - kbStart) / 1000 : rec.seconds()) : 0 };
      let fb;
      try { fb = await E.evaluate(it, answer, meta, ctl.signal); }
      catch (e) { btn.disabled = false; btn.innerHTML = `${icon("spark")} קבל משוב`; return; }
      if (!(it.p && it.p.length) && fb.src === "offline") fb.score = null;
      evaluated = { answer, fb, meta };
      E.addAttempt(it.id, { ts: Date.now(), text: answer.text, code: answer.code || "", mode, dur: Math.round(meta.dur), score: fb.score, src: fb.src, fb: slimFb(fb) });
      btn.disabled = false; btn.innerHTML = `${icon("spark")} קבל משוב שוב (אחרי תיקון)`;
      renderFeedback($("#fb", root), it, fb, opts, answer);
      $("#peek", root).remove();
      $("#fb", root).scrollIntoView({ behavior: "smooth", block: "start" });
    };

    cleanupPush(() => { if (rec.active) rec.stop(); if (timerId) clearInterval(timerId); if (ctl) ctl.abort(); E.stopSpeak(); });
  }
  function slimFb(fb) { const { coverage, metrics, ...rest } = fb; return rest; }
  function cleanupPush(fn) { const prev = cleanup; cleanup = () => { if (prev) prev(); fn(); }; }

  function renderFeedback(box, it, fb, opts, answer) {
    const s = fb.score;
    const ringColor = s == null ? "var(--ink-2)" : s >= 8 ? "var(--good)" : s >= 6 ? "var(--warn)" : "var(--bad)";
    const m = fb.metrics || {};
    const fillers = m.fillers && m.fillers.total ? Object.entries(m.fillers.found).map(([k, v]) => `${k} ×${v}`).join(" · ") : "לא זוהו";
    box.innerHTML = `
    <section class="card">
      <div class="fb-head">
        <div class="ring" style="--p:${s == null ? 0 : s * 10};--ring-c:${ringColor}"><span>${s == null ? "–" : fmt(s)}</span></div>
        <div class="stack" style="gap:4px;min-width:0">
          <span class="badge ${fb.src === "offline" ? "" : "violet"}">${fb.src === "offline" ? "הערכה בסיסית" : "משוב AI של מראיין"}</span>
          <b>${esc(fb.verdict || (s == null ? "לשאלת המשך אין נקודות מפתח מוגדרות. לקבלת ציון צריך הערכת AI." : ""))}</b>
        </div>
      </div>
      ${fb.note ? `<p class="note">${esc(fb.note)}</p>` : ""}

      ${fb.src !== "offline" && fb.strengths && fb.strengths.length ? `<div class="fb-sec"><h3>מה היה טוב</h3><ul>${fb.strengths.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${fb.corrections && fb.corrections.length ? `<div class="fb-sec"><h3>תיקונים טכניים</h3>${fb.corrections.map(c => `<div class="fix"><b>${esc(c.issue)}</b>${c.fix ? `<span>${esc(c.fix)}</span>` : ""}</div>`).join("")}</div>` : ""}
      ${fb.src !== "offline" && fb.missing && fb.missing.length ? `<div class="fb-sec"><h3>מה חסר</h3><ul>${fb.missing.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}

      ${fb.coverage && fb.coverage.length ? `<div class="fb-sec"><h3>${it.k ? "נקודות המפתח שמראיין יחפש" : "מה מראיין רוצה לשמוע ממך – רעיונות ודרך חשיבה, לא מונחים"}</h3>
        <ul class="points" id="cov">${fb.coverage.map((c, i) => `<li class="${c.hit ? "hit" : "miss"}"><span class="ic">${c.hit ? "✓" : "–"}</span><span>${esc(c.label)}</span></li>`).join("")}</ul>
        ${fb.src === "offline" ? `<p class="small muted">✓ = נראה שהתייחסת לרעיון הזה. ההערכה הבסיסית מזהה מילים בלבד, ולכן היא עלולה לפספס רעיון שתיארת במילים אחרות. בדוק את עצמך מול הרשימה.</p>` : ""}
      </div>` : ""}

      ${fb.interviewer_expects ? `<div class="fb-sec"><h3>מה מראיין מנוסה מצפה לשמוע</h3><p>${esc(fb.interviewer_expects)}</p></div>` : ""}
      ${fb.better_phrasing ? `<div class="fb-sec"><h3>איך לחזק את התשובה בסגנון שלך</h3><p class="note violet">${esc(fb.better_phrasing)}</p></div>` : ""}

      <div class="fb-sec"><h3>העברה בעל פה</h3>
        <div class="metrics">
          <div class="stat"><b>${m.dur ? Math.round(m.dur) + "ש'" : "–"}</b><span>משך</span></div>
          <div class="stat"><b>${m.words ?? "–"}</b><span>מילים</span></div>
          <div class="stat"><b>${m.wpm ?? "–"}</b><span>מילים לדקה</span></div>
          <div class="stat"><b>${m.fillers ? m.fillers.total : 0}</b><span>מילות מילוי</span></div>
        </div>
        <p class="small muted">מילות מילוי שזוהו: ${esc(fillers)}. התמלול האוטומטי לא תמיד קולט "אממ".</p>
        ${m.dur > 180 && !it.k ? `<p class="note">התשובה ארוכה מ-3 דקות. בריאיון שיחה כדאי לכוון ל-1-2 דקות ולתת למראיין לשאול המשך.</p>` : ""}
        ${fb.delivery && fb.delivery.length ? `<ul>${fb.delivery.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </div>

      ${it.sol ? `<details><summary>פתרון לדוגמה</summary><pre class="code ${it.k === "review" || it.k === "explain" ? "wrap-pre" : ""}" ${it.k === "review" || it.k === "explain" ? 'dir="rtl" style="direction:rtl;text-align:right;font-family:var(--f-body);font-size:.9rem"' : ""}>${esc(it.sol)}</pre></details>` : ""}
      ${it.m && it.m.length ? `<details><summary>טעויות נפוצות בשאלה הזו</summary><ul>${it.m.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
      ${it.t ? `<p class="note">${esc(it.t)}</p>` : ""}

      ${fb.follow_up ? `<div class="fb-sec"><h3>שאלת המשך של המראיין</h3><p class="qtext">${esc(fb.follow_up)}</p><button class="btn" id="followBtn">${icon("mic")} ענה על שאלת ההמשך</button></div>` : ""}

      <div class="grid2 stack-sm">
        <button class="btn" id="retryBtn">נסה שוב את אותה שאלה</button>
        <button class="btn primary" id="nextBtn">${opts.nextLabel || "לשאלה הבאה"}</button>
      </div>
    </section>`;
    $("#retryBtn", box).onclick = () => { const r = box.parentElement; runQuestion(r, it, opts); window.scrollTo(0, 0); };
    $("#nextBtn", box).onclick = () => opts.onNext && opts.onNext(fb);
    const fbtn = $("#followBtn", box);
    if (fbtn) fbtn.onclick = () => {
      const follow = { id: it.id + "-f" + Date.now().toString(36), c: it.c, k: undefined, lv: it.lv, q: fb.follow_up, p: [], m: [], t: "", _parent: it.id };
      const holder = document.createElement("div");
      holder.className = "stack";
      box.after(holder);
      runQuestion(holder, follow, { ...opts, position: "שאלת המשך", onNext: opts.onNext });
      holder.scrollIntoView({ behavior: "smooth" });
    };
  }

  /* ───────── Simulation ───────── */
  let sim = null;
  function viewSim(main) {
    const st = E.state;
    if (!sim || sim.done) {
      const cur = currentStage();
      main.innerHTML = `
      <section class="card hero">
        <h1>סימולציית ריאיון</h1>
        <p class="muted">שאלה אחת בכל פעם, בסדר של ריאיון אמיתי. עונים בעל פה, מקבלים משוב אחרי כל תשובה, ובסוף דוח מסכם. המערכת מעדיפה שאלות שעוד לא תרגלת.</p>
        <label class="field" for="simStage">שלב</label>
        <select id="simStage" class="search">${STAGES.filter(s => s.key !== "hr" && (s.key === "tl" || st.unlocked[s.key])).map(s => `<option value="${s.key}" ${s.key === cur ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
        <label class="field" for="simLen">אורך</label>
        <select id="simLen" class="search"><option value="5">קצרה – 5 שאלות (כ-15 דקות)</option><option value="8" selected>רגילה – 8 שאלות (כ-25 דקות)</option><option value="11">מלאה – 11 שאלות (כ-40 דקות)</option></select>
        <label class="field" for="simSrc">אילו שאלות</label>
        <select id="simSrc" class="search">
          <option value="new">חדשות קודם (מומלץ)</option>
          <option value="answered">תרגול חוזר – רק שאלות שכבר ענית</option>
          <option value="all">הכול באקראי</option>
        </select>
        <button class="btn primary block" id="simGo">${icon("play")} התחל סימולציה</button>
      </section>
      ${st.sessions.length ? `<section class="card"><h2>סימולציות קודמות</h2>
        <p class="small muted">כל סימולציה שסיימת נשמרת כאן. "חזור על הסימולציה" מריץ בדיוק את אותן שאלות באותו סדר, ומשווה לניסיון הקודם.</p>
        <div class="stack">${prevSimsHtml(st.sessions)}</div></section>` : ""}`;
      main.querySelectorAll("[data-retake]").forEach(b => b.onclick = () => {
        const sess = st.sessions[+b.dataset.retake];
        const ids = (sess.ids || sess.items.map(x => x.id)).filter(id => findItem(id));
        if (!ids.length) { toast("השאלות של הסימולציה הזו כבר לא קיימות"); return; }
        sim = { stage: sess.stage, ids, origin: sess.origin || sess.ts, i: 0, results: [], done: false };
        viewSim(main); window.scrollTo(0, 0);
      });
      main.querySelectorAll("[data-sdetail]").forEach(b => b.onclick = () => { const d = $("#sd-" + b.dataset.sdetail); d.hidden = !d.hidden; });
      $("#simGo").onclick = () => {
        const stage = $("#simStage").value, n = +$("#simLen").value, src = $("#simSrc").value;
        const ids = buildSim(stage, n, src);
        if (!ids.length) { toast("עוד לא ענית על שאלות בשלב הזה. בחר 'חדשות קודם'."); return; }
        sim = { stage, ids, i: 0, results: [], done: false };
        viewSim(main);
      };
      return;
    }
    const id = sim.ids[sim.i];
    const it = { ...findItem(id) };
    main.innerHTML = `<div class="row between"><button class="btn sm ghost" id="simQuit">יציאה מהסימולציה</button><span class="badge violet">${sim.i + 1} / ${sim.ids.length}</span></div><div class="bar"><i style="width:${(sim.i) / sim.ids.length * 100}%"></i></div><div id="runner"></div>`;
    $("#simQuit").onclick = () => { if (sim.results.length) finishSim(main); else { sim = null; viewSim(main); } };
    runQuestion($("#runner"), it, {
      stage: sim.stage, position: `שאלה ${sim.i + 1} מתוך ${sim.ids.length}`,
      nextLabel: sim.i + 1 < sim.ids.length ? "לשאלה הבאה" : "סיום וקבלת דוח",
      onNext: fb => {
        const a = E.last(it.id);
        sim.results.push({ id: it.id, q: qText(it), score: a ? a.score : null, text: a ? a.text : "", missing: a && a.fb ? a.fb.missing : [] });
        sim.i++;
        if (sim.i >= sim.ids.length) finishSim(main); else viewSim(main);
      }
    });
  }
  function prevSimsHtml(sessions) {
    const rows = sessions.map((s, idx) => ({ s, idx })).reverse().slice(0, 20);
    return rows.map(({ s, idx }) => {
      const origin = s.origin || s.ts;
      const same = sessions.filter(x => (x.origin || x.ts) === origin);
      const n = same.indexOf(s) + 1;
      const prev = n > 1 ? same[n - 2] : null;
      const delta = prev && prev.avg != null && s.avg != null ? s.avg - prev.avg : null;
      const ids = s.ids || s.items.map(x => x.id);
      const scoreOf = id => { const it = s.items.find(x => x.id === id); return it ? it.score : null; };
      return `<div class="term">
        <div class="row between">
          <div class="stack" style="gap:2px">
            <b>${new Date(s.ts).toLocaleDateString("he-IL")} ${new Date(s.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</b>
            <span class="small muted">${esc(stageOf(s.stage).short)} · ${ids.length} שאלות${s.partial ? " · לא הושלמה" : ""}${n > 1 ? ` · ניסיון ${n}` : ""}</span>
          </div>
          <div class="row" style="gap:6px">${delta != null ? `<span class="badge ${delta >= 0 ? "good" : "bad"}">${delta >= 0 ? "+" : ""}${fmt(delta)}</span>` : ""}<span class="score-dot ${scoreCls(s.avg)}">${fmt(s.avg)}</span></div>
        </div>
        <div class="row"><button class="btn sm primary" data-retake="${idx}">${icon("play")} חזור על הסימולציה</button><button class="btn sm ghost" data-sdetail="${idx}">השאלות</button></div>
        <ol class="small" id="sd-${idx}" hidden>${ids.map(id => { const it = findItem(id); return it ? `<li>${esc(qText(it))} <span class="badge ${scoreCls(scoreOf(id))}">${fmt(scoreOf(id))}</span></li>` : ""; }).join("")}</ol>
      </div>`;
    }).join("");
  }
  function buildSim(stage, n, source = "new") {
    const all = stageOf(stage).items();
    if (source === "answered") {
      // תרגול חוזר: קודם הציונים הנמוכים, ואז מה שלא תורגל הכי הרבה זמן
      const lastTs = id => { const a = E.last(id); return a ? a.ts : 0; };
      return all.filter(i => E.best(i.id) != null)
        .sort((a, b) => (E.best(a.id) - E.best(b.id)) || (lastTs(a.id) - lastTs(b.id)))
        .slice(0, n).map(i => i.id);
    }
    if (source === "all") {
      return all.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).slice(0, n).map(x => x[1].id);
    }
    const items = all;
    const fresh = i => E.best(i.id) == null;
    const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
    const chosen = [];
    if (stage === "tl") {
      const resume = items.find(x => x.resume && fresh(x));
      if (resume) chosen.push(resume.id);
      const flow = D.simFlow.slice(0, n);
      for (const c of flow) {
        if (chosen.length >= n) break;
        const pool = shuffle(items.filter(i => i.c === c && !chosen.includes(i.id)));
        const pick = pool.find(fresh) || pool[0];
        if (pick) chosen.push(pick.id);
      }
    }
    const rest = shuffle(items.filter(i => !chosen.includes(i.id)));
    rest.sort((a, b) => (fresh(b) ? 1 : 0) - (fresh(a) ? 1 : 0));
    while (chosen.length < n && rest.length) chosen.push(rest.shift().id);
    return chosen.slice(0, n);
  }
  async function finishSim(main) {
    sim.done = true;
    const scored = sim.results.filter(r => r.score != null);
    const avg = scored.length ? scored.reduce((a, r) => a + r.score, 0) / scored.length : null;
    const sessTs = Date.now();
    E.state.sessions.push({ ts: sessTs, stage: sim.stage, ids: sim.ids.slice(), origin: sim.origin || sessTs, partial: sim.results.length < sim.ids.length, items: sim.results.map(r => ({ id: r.id, score: r.score })), avg });
    E.save();
    const weak = sim.results.filter(r => r.score != null && r.score < 7);
    main.innerHTML = `
    <section class="card hero">
      <h1>דוח סימולציה</h1>
      <div class="grid2"><div class="stat"><b>${fmt(avg)}</b><span>ציון ממוצע</span></div><div class="stat"><b>${sim.results.length}</b><span>שאלות</span></div></div>
      <div id="aiSum" class="stack">${E.providerAvailable() !== "offline" ? `<p class="row small muted"><span class="spinner"></span> המראיין כותב סיכום…</p>` : ""}</div>
    </section>
    <section class="card"><h2>פירוט</h2>
      ${sim.results.map(r => `<a class="qitem" href="#q-${r.id}" style="text-decoration:none;color:inherit"><div><p>${esc(r.q)}</p></div><span class="score-dot ${scoreCls(r.score)}">${fmt(r.score)}</span></a>`).join("")}
    </section>
    ${weak.length ? `<section class="card"><h2>לחזור עליהן</h2><p class="small muted">שאלות עם ציון מתחת ל-7. לחיצה פותחת את השאלה לתרגול חוזר.</p></section>` : ""}
    <button class="btn block" id="redo">${icon("mic")} ענה שוב על אותן שאלות</button>
    <div class="grid2 stack-sm"><button class="btn primary" id="again">סימולציה חדשה</button><a class="btn" href="#home">למסך הבית</a></div>`;
    $("#again").onclick = () => { sim = null; viewSim(main); };
    const redoIds = sim.ids.slice(), redoStage = sim.stage, redoOrigin = sim.origin || sessTs;
    $("#redo").onclick = () => { sim = { stage: redoStage, ids: redoIds, origin: redoOrigin, i: 0, results: [], done: false }; viewSim(main); window.scrollTo(0, 0); };
    const sum = await E.sessionSummary(sim.results);
    const box = $("#aiSum");
    if (!box) return;
    if (!sum) { box.innerHTML = E.providerAvailable() === "offline" ? "" : `<p class="small muted">הסיכום לא נוצר הפעם.</p>`; return; }
    box.innerHTML = `<p><b>${esc(sum.readiness || "")}</b></p>
      ${sum.strengths && sum.strengths.length ? `<h3>חוזקות</h3><ul>${sum.strengths.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${sum.gaps && sum.gaps.length ? `<h3>פערים</h3><ul>${sum.gaps.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${sum.review && sum.review.length ? `<h3>לחזרה לפני הריאיון</h3><ul>${sum.review.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`;
  }

  /* ───────── Terms ───────── */
  const termState = { q: "", cat: "", pr: "" };
  function viewTerms(main) {
    main.innerHTML = `
    <section class="stack">
      <h1>מילון מונחים</h1>
      <p class="small muted">${D.glossary.length} מונחים מתוך השיחה, מסמך ההקשר ותיאור המשרה. עדיפות 1 = חובה לדעת להסביר עם דוגמה.</p>
      <input class="search" id="tq" type="search" placeholder="חיפוש: GC, Addressables, RAG…" value="${esc(termState.q)}" aria-label="חיפוש מונח">
      <div class="chips" role="group" aria-label="קטגוריה"><button class="chip" data-c="" aria-pressed="${!termState.cat}">הכול</button>${Object.entries(D.glossaryCats).map(([k, v]) => `<button class="chip" data-c="${k}" aria-pressed="${termState.cat === k}">${esc(v)}</button>`).join("")}</div>
      <div class="chips" role="group" aria-label="עדיפות">${[["", "כל העדיפויות"], ["1", "חובה"], ["2", "חשוב מאוד"], ["3", "יתרון"]].map(([k, v]) => `<button class="chip" data-p="${k}" aria-pressed="${termState.pr === k}">${v}</button>`).join("")}</div>
    </section>
    <section class="stack" id="tlist"></section>`;
    const draw = () => {
      const q = termState.q.trim().toLowerCase();
      const list = D.glossary.filter(g => (!termState.cat || g.c === termState.cat) && (!termState.pr || String(g.pr) === termState.pr) && (!q || (g.t + " " + g.d + " " + g.ex).toLowerCase().includes(q)));
      const srcName = { chat: "מהשיחה", doc: "מסמך ההקשר", job: "תיאור המשרה", core: "יסודות Unity/C#" };
      $("#tlist").innerHTML = list.length ? list.map(g => `<article class="term">
        <div class="row between"><h3 class="ltr">${esc(g.t)}</h3><div class="row"><span class="badge ${g.pr === 1 ? "gold" : ""}">${g.pr === 1 ? "חובה" : g.pr === 2 ? "חשוב" : "יתרון"}</span></div></div>
        <p>${esc(g.d)}</p>
        ${g.ex ? `<p class="ex">${esc(g.ex)}</p>` : ""}
        <span class="small muted">${esc(D.glossaryCats[g.c])} · ${esc(srcName[g.src] || "")}</span>
      </article>`).join("") : `<div class="empty">לא נמצא מונח.</div>`;
    };
    draw();
    $("#tq").addEventListener("input", e => { termState.q = e.target.value; draw(); });
    main.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { termState.cat = b.dataset.c; viewTerms(main); });
    main.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { termState.pr = b.dataset.p; viewTerms(main); });
  }

  /* ───────── Coin Master ───────── */
  function viewCoin(main) {
    const C = D.coinMaster, cm = E.state.cm;
    const total = C.sessions.reduce((a, s) => a + s.tasks.length, 0);
    const done = Object.values(cm.done).filter(Boolean).length;
    main.innerHTML = `
    <section class="card hero">
      <div class="row between"><h1>Coin Master</h1><span class="badge gold">${done}/${total} משימות</span></div>
      <p>${esc(C.intro)}</p>
      <div class="bar"><i style="width:${Math.round(done / total * 100)}%"></i></div>
    </section>
    <section class="card">
      <h2>ה-Core Loop</h2>
      <div class="grid2">${C.loop.map(l => `<div class="stat"><b class="ltr" style="font-size:1.1rem">${esc(l.k)}</b><span>${esc(l.d)}</span></div>`).join("")}</div>
      <p class="small muted">${esc(C.loopNote)}</p>
      <h3>מנגנונים שמרחיבים את הלולאה</h3>
      <ul>${C.extras.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="small muted">המידע כאן מסוכם מהשיחה. אמת כל פרט בזמן שאתה משחק.</p>
    </section>
    ${C.sessions.map((s, si) => `<section class="card"><h2>${esc(s.title)}</h2><p class="small muted">מטרה: ${esc(s.goal)}</p>
      <div class="stack">${s.tasks.map((t, ti) => { const k = si + "-" + ti; return `<label class="check"><input type="checkbox" data-k="${k}" ${cm.done[k] ? "checked" : ""}><span>${esc(t)}</span></label>`; }).join("")}</div></section>`).join("")}
    <section class="card">
      <h2>מה אני ראיתי במשחק</h2>
      <p class="small muted">${esc(C.notesHint)}</p>
      <textarea id="cmNotes" class="answer" dir="rtl" placeholder="למשל: מעבר בין הכפר למכונה מהיר, אבל…">${esc(cm.notes)}</textarea>
    </section>
    <section class="card">
      <h2>Client מול Server במשחק כזה</h2>
      <ul>${C.clientServer.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h3>"איך היית משפר את המשחק?" – תהליך לענות בו</h3>
      <ol>${C.improveProcess.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
      <a class="btn" href="#practice" id="cmPractice">${icon("mic")} תרגל שאלות Coin Master</a>
    </section>
    <section class="card">
      <h2>שאלות שאתה יכול לשאול את ה-Team Lead</h2>
      <ol>${D.askInterviewer.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    </section>`;
    main.querySelectorAll("[data-k]").forEach(c => c.onchange = () => { cm.done[c.dataset.k] = c.checked; E.save(); viewCoin(main); });
    let tmo; $("#cmNotes").addEventListener("input", e => { clearTimeout(tmo); tmo = setTimeout(() => { cm.notes = e.target.value; E.save(); }, 400); });
    $("#cmPractice").onclick = () => { practiceState.stage = "tl"; practiceState.cat = "cm"; };
  }

  /* ───────── Settings ───────── */
  function viewSettings(main) {
    const s = E.state.settings;
    const inClaude = !!(window.claude && window.claude.use);
    main.innerHTML = `
    <section class="stack"><h1>הגדרות</h1></section>
    <section class="card">
      <h2>הערכת תשובות</h2>
      <label class="field" for="prov">מקור המשוב
        <select id="prov">
          <option value="auto" ${s.provider === "auto" ? "selected" : ""}>אוטומטי (Claude אם זמין, אחרת בסיסי)</option>
          <option value="claude" ${s.provider === "claude" ? "selected" : ""}>Claude דרך claude.ai (כשהאפליקציה פתוחה שם)</option>
          <option value="api" ${s.provider === "api" ? "selected" : ""}>Claude API עם מפתח משלי</option>
          <option value="offline" ${s.provider === "offline" ? "selected" : ""}>בסיסי בלבד (בלי AI)</option>
        </select></label>
      <p class="small muted">${inClaude ? "האפליקציה פתוחה בתוך claude.ai, ולכן אפשר לקבל משוב מ-Claude בלי מפתח. בפעם הראשונה תתבקש לאשר." : "האפליקציה פתוחה מחוץ ל-claude.ai. למשוב AI כאן צריך מפתח Claude API. המפתח נשמר רק בדפדפן הזה ונשלח רק ל-api.anthropic.com. שימוש ב-API מחויב בנפרד בחשבון ה-Console שלך."}</p>
      <label class="field" for="key">Claude API key
        <input id="key" type="password" dir="ltr" autocomplete="off" placeholder="sk-ant-..." value="${esc(s.apiKey)}"></label>
      <label class="field" for="model">מודל
        <select id="model" dir="ltr">
          ${[["claude-opus-5-5", "Claude Opus 5.5 (מומלץ)"], ["claude-sonnet-5-5", "Claude Sonnet 5.5"], ["claude-haiku-5-5", "Claude Haiku 5.5"]].map(([v, l]) => `<option value="${v}" ${s.model === v ? "selected" : ""}>${l}</option>`).join("")}
        </select></label>
      <button class="btn primary" id="saveAi">שמור</button>
    </section>
    <section class="card">
      <h2>תמלול דיבור מדויק (Whisper)</h2>
      <p class="small">התמלול המובנה בטלפון מפספס מילים ומתקשה עם מונחים באנגלית. עם מפתח Groq חינמי, ההקלטה המלאה נשלחת ל-Whisper large-v3 ומתומללת אחרי שעוצרים – מדויק יותר, בלי חורים, וגם אפשר לשמוע את עצמך.</p>
      <ol class="small">
        <li>להיכנס ל-<span class="ltr kbd">console.groq.com/keys</span> ולהירשם (חינם).</li>
        <li>ללחוץ Create API Key ולהעתיק את המפתח (מתחיל ב-<span class="ltr kbd">gsk_</span>).</li>
        <li>להדביק כאן ולשמור.</li>
      </ol>
      <label class="field" for="groqKey">Groq API key
        <input id="groqKey" type="password" dir="ltr" autocomplete="off" placeholder="gsk_..." value="${esc(s.groqKey || "")}"></label>
      <label class="field" for="stt">מנוע תמלול
        <select id="stt"><option value="auto" ${s.sttEngine !== "browser" ? "selected" : ""}>Whisper כשיש מפתח (מומלץ)</option><option value="browser" ${s.sttEngine === "browser" ? "selected" : ""}>התמלול המובנה בטלפון (חי, פחות מדויק)</option></select></label>
      <p class="small muted">ההקלטה נשלחת דרך שרת האפליקציה ל-Groq לתמלול בלבד, ולא נשמרת. המפתח נשמר רק במכשיר הזה. התוכנית החינמית של Groq מוגבלת בכמות בקשות – בשימוש רגיל לתרגול זה לא אמור להפריע.</p>
      <button class="btn primary" id="saveGroq">שמור</button>
    </section>
    <section class="card">
      <h2>בדיקת מיקרופון והקראה</h2>
      <div id="diag" class="small muted">בודק…</div>
      <div class="row"><button class="btn sm" id="testSpeak">${icon("spk")} נסה הקראה</button><button class="btn sm ghost" id="permOpen" hidden>פתח הרשאות של העמוד</button></div>
    </section>
    <section class="card">
      <h2>הקלטה ותצוגה</h2>
      <label class="check"><input type="checkbox" id="keepAudio" ${s.keepAudio ? "checked" : ""}><span>שמור הקלטת קול לשמיעה חוזרת (בחלק מהמכשירים זה מתנגש עם התמלול, ואז ההקלטה תכובה אוטומטית)</span></label>
      <label class="field" for="qsec">יעד זמן לתשובה בעל פה (שניות)<input id="qsec" type="number" min="30" max="600" step="10" value="${s.qSeconds}"></label>
      <label class="field" for="theme">ערכת צבעים
        <select id="theme"><option value="system" ${s.theme === "system" ? "selected" : ""}>לפי המכשיר</option><option value="light" ${s.theme === "light" ? "selected" : ""}>בהיר</option><option value="dark" ${s.theme === "dark" ? "selected" : ""}>כהה</option></select></label>
    </section>
    <section class="card">
      <h2>גיבוי התקדמות</h2>
      <p class="small muted">ההתקדמות נשמרת בדפדפן הזה בלבד. כדי להעביר למכשיר אחר: העתק כאן, והדבק במכשיר השני. המפתח לא נכלל בגיבוי.</p>
      <div class="row"><button class="btn" id="exp">העתק גיבוי</button></div>
      <textarea id="impTxt" class="answer" dir="ltr" placeholder="הדבק כאן גיבוי כדי לשחזר" style="min-height:80px"></textarea>
      <div class="row"><button class="btn" id="imp">שחזר מגיבוי</button><button class="btn ghost" id="resetAns">איפוס תשובות וציונים בלבד</button><button class="btn ghost" id="resetBtn">איפוס כל ההתקדמות</button></div>
      <div id="resetBox"></div>
    </section>
    <section class="card">
      <h2>התקנה בטלפון</h2>
      <p class="small">iPhone: לפתוח את הכתובת ב-Safari ← כפתור השיתוף ← "הוסף למסך הבית". Android (Chrome): תפריט ⋮ ← "הוספה למסך הבית".</p>
      <p class="small">חשוב ב-iPhone: האפליקציה שבמסך הבית שומרת נתונים בנפרד מ-Safari. את מפתח ה-API צריך להזין שוב בתוך האפליקציה המותקנת, ואת ההתקדמות אפשר להעביר עם "העתק גיבוי".</p>
      <p class="small">אחרי ההתקנה האפליקציה נפתחת גם בלי רשת. הערכת AI ותמלול צריכים רשת.</p>
    </section>`;
    E.diag().then(d => {
      const box = $("#diag"); if (!box) return;
      const yes = v => v ? "✓ זמין" : "✗ לא זמין";
      const lines = d.inClaude
        ? [`האפליקציה פתוחה בתוך claude.ai.`, `הכתבה של claude.ai: ${yes(d.dictation)}${d.dictationState ? " (" + ({ granted: "מאושר", prompt: "תתבקש לאשר בלחיצה הראשונה", denied: "נדחה – אפשר להפעיל בהרשאות", unavailable: "לא זמין" }[d.dictationState] || d.dictationState) + ")" : ""}`, `הקראה של claude.ai: ${yes(d.tts)}`,
           d.dictation ? "" : "במכשיר הזה claude.ai לא מאפשר מיקרופון לעמוד. הדרך לענות בעל פה: מיקרופון המקלדת בתוך תיבת התשובה, או גרסת האתר העצמאית."]
        : [`תמלול Whisper: ${E.whisperReady() ? "✓ פעיל" : "✗ לא פעיל (צריך מפתח Groq)"}`, `תמלול דיבור בדפדפן: ${yes(d.speechAPI)}`, `הקראה בדפדפן: ${yes(d.synth)}`, E.isIOS ? (E.standalone ? "פתוח כאפליקציה ממסך הבית." : "פתוח ב-Safari. להתקנה: שיתוף ← \"הוסף למסך הבית\".") : "",
           E.isIOS && !E.whisperReady() ? "ב-iPhone ההקלטה לשמיעה חוזרת זמינה רק עם Whisper." : ""];
      box.innerHTML = lines.filter(Boolean).map(l => `<p>${esc(l)}</p>`).join("");
      if (d.inClaude && d.dictationState === "denied") { const b = $("#permOpen"); b.hidden = false; b.onclick = () => E.openPermissions().then(() => viewSettings(main)).catch(() => toast("פתח את תפריט ההרשאות של העמוד ב-claude.ai")); }
    });
    $("#testSpeak").onclick = () => { if (!E.speak("שלום, זו בדיקת הקראה של השאלות.")) toast("הקראה לא זמינה כאן"); };
    $("#saveGroq").onclick = () => {
      const k = $("#groqKey").value.trim();
      if (k && !k.startsWith("gsk_")) { toast("מפתח Groq מתחיל ב-gsk_"); return; }
      s.groqKey = k; s.sttEngine = $("#stt").value; E.save(); toast("נשמר"); viewSettings(main);
    };
    $("#saveAi").onclick = () => { s.provider = $("#prov").value; s.apiKey = $("#key").value.trim(); s.model = $("#model").value; E.save(); toast("נשמר"); };
    $("#keepAudio").onchange = e => { s.keepAudio = e.target.checked; E.save(); };
    $("#qsec").onchange = e => { s.qSeconds = Math.max(30, Math.min(600, +e.target.value || 120)); E.save(); };
    $("#theme").onchange = e => { s.theme = e.target.value; E.save(); applyTheme(); };
    $("#exp").onclick = () => {
      const data = E.exportJSON();
      navigator.clipboard.writeText(data).then(() => toast("הגיבוי הועתק"), () => { const t = $("#impTxt"); t.value = data; t.select(); toast("סמן והעתק את הטקסט בתיבה"); });
    };
    $("#imp").onclick = () => { try { E.importJSON($("#impTxt").value); applyTheme(); toast("ההתקדמות שוחזרה"); route(); } catch (e) { toast("הטקסט לא נראה כמו גיבוי תקין"); } };
    $("#resetAns").onclick = () => {
      $("#resetBox").innerHTML = `<div class="confirm"><b>למחוק את כל התשובות והציונים?</b><p class="small">השלבים, ההערות על Coin Master והמפתחות נשארים. אי אפשר לבטל.</p><div class="row"><button class="btn gold" id="yesAns">מחק תשובות</button><button class="btn ghost" id="noAns">ביטול</button></div></div>`;
      $("#noAns").onclick = () => $("#resetBox").innerHTML = "";
      $("#yesAns").onclick = () => { E.resetAnswers(); toast("התשובות והציונים אופסו"); route(); };
    };
    $("#resetBtn").onclick = () => {
      $("#resetBox").innerHTML = `<div class="confirm"><b>למחוק את כל ההתקדמות?</b><p class="small">כל התשובות, הציונים והשלבים יימחקו. אי אפשר לבטל.</p><div class="row"><button class="btn gold" id="yesReset">מחק</button><button class="btn ghost" id="noReset">ביטול</button></div></div>`;
      $("#noReset").onclick = () => $("#resetBox").innerHTML = "";
      $("#yesReset").onclick = () => { E.reset(); toast("ההתקדמות אופסה"); route(); };
    };
  }

  /* ───────── Boot ───────── */
  function boot() {
    E.load(); applyTheme();
    if (E.state.justMigrated) { delete E.state.justMigrated; E.save(); setTimeout(() => toast("השאלות והציפיות עודכנו לסגנון ריאיון שיחה. התשובות והציונים הקודמים אופסו – מתחילים מחדש."), 600); }
    $("#nav").innerHTML = `<div class="row">
      <a href="#home" data-k="home">${icon("home")}<span>בית</span></a>
      <a href="#practice" data-k="practice">${icon("list")}<span>תרגול</span></a>
      <a href="#terms" data-k="terms">${icon("book")}<span>מונחים</span></a>
      <a href="#coin" data-k="coin">${icon("coin")}<span>Coin Master</span></a>
      <a href="#settings" data-k="settings">${icon("gear")}<span>הגדרות</span></a></div>`;
    window.addEventListener("hashchange", route);
    route();
    Promise.all([E.initSample(), E.initDictation()]).then(() => { if ((location.hash || "#home") === "#home") route(); });
    if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.claude) {
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
