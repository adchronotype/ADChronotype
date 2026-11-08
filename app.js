// ===== App: sign-up, login, questionnaire, weekly sessions, "My answers" =====

// ---------- Device and time info saved with tests ----------
function deviceInfo() {
  const fine = matchMedia("(pointer: fine)").matches;
  const hover = matchMedia("(hover: hover)").matches;
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const touch = navigator.maxTouchPoints > 0;
  const isComputer = fine && hover && !mobileUA && window.innerWidth >= 700;
  return {
    device: isComputer ? "computer" : (mobileUA || touch ? "phone_or_tablet" : "other"),
    is_computer: isComputer,
    screen: `${screen.width}x${screen.height}`,
    user_agent: navigator.userAgent.slice(0, 250),
  };
}
function localTime() {
  const d = new Date();
  return {
    local_time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    local_date: d.toLocaleDateString("en-CA"),
    tz_offset_min: -d.getTimezoneOffset(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };
}
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

// ---------- API: the Google Apps Script backend, or a DEMO copy of it kept in this browser ----------
const API = (() => {
  const demo = !CONFIG.API_URL;

  // Demo backend: same actions and answers as Code.gs, stored in localStorage.
  const DB = "adc_wave2_demo_db";
  const load = () => { try { return JSON.parse(localStorage.getItem(DB)) || { people: [] }; } catch { return { people: [] }; } };
  const keep = (db) => store.set(DB, JSON.stringify(db));
  const blankWeeks = () => ({ 1: { sleep: null, tests: {}, completed_at: "" }, 2: { sleep: null, tests: {}, completed_at: "" }, 3: { sleep: null, tests: {}, completed_at: "" } });
  const profileOf = (p) => ({ reg_no: p.reg_no, code: p.code, returning: p.returning, consent_at: p.consent_at, sections: p.sections, weeks: p.weeks });
  function demoCall(q) {
    const db = load();
    const now = new Date().toISOString();
    const byCode = db.people.find((p) => p.code === String(q.code || ""));
    switch (q.action) {
      case "register": {
        const email = String(q.email || "").trim().toLowerCase();
        if (db.people.some((p) => p.email === email)) return { ok: false, error: "email_taken" };
        if (q.returning && db.people.some((p) => p.old_id === q.oldId)) return { ok: false, error: "oldid_taken" };
        let code; do { code = String(Math.floor(100000 + Math.random() * 900000)); } while (db.people.some((p) => p.code === code));
        const reg = 5001 + db.people.length;
        const p = { reg_no: reg, code, email, returning: q.returning ? "Y" : "N", old_id: q.oldId || "", consent_at: now, sections: {}, weeks: blankWeeks(), edits: [] };
        db.people.push(p); keep(db);
        console.log(`[demo] login code ${code} would be emailed to ${email}`);
        return { ok: true, code, profile: profileOf(p) };
      }
      case "login": return byCode ? { ok: true, profile: profileOf(byCode) } : { ok: false, error: "not_found" };
      case "forgot": {
        const p = db.people.find((x) => x.email === String(q.email || "").trim().toLowerCase());
        if (p) console.log(`[demo] code ${p.code} would be emailed to ${p.email}`);
        return { ok: true };
      }
      case "save": {
        const p = byCode;
        if (!p) return { ok: false, error: "not_found" };
        if (q.kind === "section") {
          if (q.edit && p.weeks[1].completed_at) return { ok: false, error: "locked" };
          const old = p.sections[q.section];
          if (q.edit && old) Object.keys(q.answers).forEach((k) => {
            if (/_answer$/.test(k)) return;
            if (String(old.answers[k] ?? "") !== String(q.answers[k] ?? "")) p.edits.push({ at: now, section: q.section, question: (q.questions || {})[k] || k, original: old.answers[k], new: q.answers[k] });
          });
          p.sections[q.section] = { saved_at: old && q.edit ? old.saved_at : now, answers: q.answers };
        } else if (q.kind === "weeksleep") {
          p.weeks[q.week].sleep = { saved_at: now, answers: q.answers };
        } else if (q.kind === "test") {
          const wk = p.weeks[q.week];
          if (!wk.tests[q.test]) wk.tests[q.test] = { test: q.test, week: q.week, at: now, ...q.result };
          if (wk.sleep && TEST_ORDER.every((t) => wk.tests[t])) wk.completed_at = wk.completed_at || now;
        }
        keep(db);
        return { ok: true, profile: profileOf(p) };
      }
    }
    return { ok: false, error: "unknown action" };
  }

  async function call(payload) {
    if (demo) { await new Promise((r) => setTimeout(r, 120)); return demoCall(JSON.parse(JSON.stringify(payload))); }
    // text/plain avoids a CORS preflight with Apps Script
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(CONFIG.API_URL, { method: "POST", body: JSON.stringify(payload) });
        return await r.json();
      } catch (e) { await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); }
    }
    return { ok: false, error: "network" };
  }
  return { call, demo };
})();

// ---------- State and small helpers ----------
const S = { code: null, profile: null, answers: {}, pending: null, view: null };
const $ = (id) => document.getElementById(id);
const app = () => $("app");
const setProgress = (pct) => { $("progress-fill").style.width = `${pct}%`; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CONTACT = () => `<a href="mailto:${CONFIG.CONTACT_EMAIL}">${CONFIG.CONTACT_EMAIL}</a>`;
const errorBox = (msg) => `<div class="alert">${msg}</div>`;
const NET_ERR = "We couldn't connect. Check your internet and try again.";
const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const editable = () => !!S.profile && !S.profile.weeks[1].completed_at;

// Times are picked from a list in 30-minute steps
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 ? 30 : 0;
  return { value: `${String(h).padStart(2, "0")}:${m ? "30" : "00"}`, label: `${h % 12 === 0 ? 12 : h % 12}:${m ? "30" : "00"} ${h < 12 ? "AM" : "PM"}` };
});
const timeLabel = (v) => (TIME_SLOTS.find((t) => t.value === String(v)) || {}).label || v;
function timeSelect(id, v = "") {
  return `<select class="time-select" data-id="${id}"><option value="">Select a time…</option>${TIME_SLOTS.map((t) => `<option value="${t.value}" ${t.value === String(v) ? "selected" : ""}>${t.label}</option>`).join("")}</select>`;
}
function fmtWhen(ts) {
  const d = new Date(ts);
  return isNaN(d) ? "" : d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ---------- Header, side panel ----------
function renderChrome() {
  const who = $("who");
  if (!S.profile) { who.innerHTML = ""; $("side").classList.add("hidden"); document.body.classList.remove("has-side"); return; }
  const hasAnswers = Object.keys(S.profile.sections).length > 0;
  who.innerHTML = `${hasAnswers ? `<button class="btn small-btn" id="hdr-answers">My answers</button>` : ""}<button class="link" id="logout">Log out</button>`;
  $("logout").onclick = logout;
  if ($("hdr-answers")) $("hdr-answers").onclick = screenMyAnswers;
  const showSide = hasAnswers && S.view !== "test" && S.view !== "answers";
  $("side").classList.toggle("hidden", !showSide);
  document.body.classList.toggle("has-side", showSide);
  if (showSide) $("side").innerHTML = answersHTML(true);
  bindAnswerButtons($("side"));
}

function logout() {
  store.del("adc_code");
  S.code = null; S.profile = null; S.answers = {}; S.pending = null;
  route();
}

// ---------- Saving ----------
async function save(payload) {
  const res = await API.call({ action: "save", code: S.code, ...payload });
  if (res.ok && res.profile) S.profile = res.profile;
  return res;
}

// ---------- Where is this person up to? ----------
function status() {
  const p = S.profile;
  const nextSection = QUESTIONNAIRE.find((s) => !p.sections[s.key]);
  let nextWeek = null;
  for (let w = 1; w <= 3; w++) if (!p.weeks[w].completed_at) { nextWeek = w; break; }
  let opensAt = null;
  if (nextWeek && nextWeek > 1) {
    const wk = p.weeks[nextWeek];
    const started = wk.sleep || Object.keys(wk.tests).length > 0;
    const opens = new Date(new Date(p.weeks[nextWeek - 1].completed_at).getTime() + CONFIG.DAYS_BETWEEN_SESSIONS * 864e5);
    if (!started && opens > new Date()) opensAt = opens;
  }
  return { nextSection, nextWeek, opensAt };
}

function route() {
  Tests.reset();
  window.scrollTo(0, 0);
  S.view = null;
  if (!S.profile) { renderChrome(); return screenStart(); }
  const st = status();
  if (st.nextSection) screenSection(st.nextSection);
  else if (!st.nextWeek) screenAllDone();
  else if (st.opensAt) screenWait(st.nextWeek, st.opensAt);
  else if (!deviceInfo().is_computer) screenNeedComputer(st.nextWeek);
  else if (!S.profile.weeks[st.nextWeek].sleep) screenWeeklySleep(st.nextWeek);
  else screenHub(st.nextWeek);
  renderChrome();
}

// ---------- Start, sign-up, login ----------
function screenStart() {
  setProgress(0);
  app().innerHTML = `<section class="card">
    <h1>Welcome</h1>
    <p class="lead">Thank you for your interest in the ADChronotype Study, a research project on sleep timing and thinking skills in adults aged ${CONFIG.MIN_AGE} to ${CONFIG.MAX_AGE}.</p>
    ${API.demo ? `<div class="alert info">Demo mode: nothing is sent anywhere. Answers stay in this browser.</div>` : ""}
    <div class="choice-col">
      <button class="btn primary big" id="new">I'm new to the study</button>
      <button class="btn big" id="ret">I took part last year and have a participant ID</button>
      <button class="btn big" id="login">I've already signed up: log in with my code</button>
    </div></section>`;
  $("new").onclick = screenEligibility;
  $("ret").onclick = () => screenOldId();
  $("login").onclick = () => screenLogin();
}

function screenEligibility() {
  app().innerHTML = `<section class="card">
    <h1>Before we start</h1>
    <h2>Are you between ${CONFIG.MIN_AGE} and ${CONFIG.MAX_AGE} years old?</h2>
    <div class="choice-col">
      <button class="btn primary big" id="yes">Yes</button>
      <button class="btn big" id="no">No</button>
    </div>
    <button class="link" id="back">Back</button></section>`;
  $("yes").onclick = () => { S.pending = { returning: false }; screenConsent(); };
  $("no").onclick = () => {
    app().innerHTML = `<section class="card"><h1>Thank you</h1>
      <p class="lead">This study is for adults aged ${CONFIG.MIN_AGE} to ${CONFIG.MAX_AGE}, so we can't include you this time. Thank you for your interest.</p></section>`;
  };
  $("back").onclick = screenStart;
}

function screenOldId(msg) {
  app().innerHTML = `<section class="card">
    <h1>Welcome back</h1>
    <p class="lead">Enter the participant ID you used last year.</p>
    ${msg ? errorBox(msg) : ""}
    <label class="field"><span>Last year's participant ID</span>
      <input id="oid" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 123" value="${esc(S.pending?.oldId || "")}" /></label>
    <div class="row-btns"><button class="link" id="back">Back</button><button class="btn primary" id="go">Continue</button></div>
    <p class="muted small">Don't remember it? Email ${CONTACT()}.<br>Already signed up this year? <button class="link inline-link" id="tologin">Log in with your code</button>.</p></section>`;
  const go = () => {
    const id = $("oid").value.trim();
    if (!/^\d+$/.test(id)) return screenOldId("Your participant ID is numbers only.");
    S.pending = { returning: true, oldId: id };
    screenConsent();
  };
  $("go").onclick = go;
  $("oid").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $("back").onclick = screenStart;
  $("tologin").onclick = () => screenLogin();
}

function screenConsent() {
  setProgress(3);
  app().innerHTML = `<section class="card">
    <h1>Information and consent</h1>
    <div class="consent">${consentHTML()}</div>
    <label class="check"><input type="checkbox" id="agree" /> <span>I am ${CONFIG.MIN_AGE} or older, I have read the information above, and I agree to take part.</span></label>
    <div class="row-btns"><button class="link" id="decline">I do not want to take part</button><button class="btn primary" id="go" disabled>Continue</button></div></section>`;
  const agree = $("agree"), go = $("go");
  agree.onchange = () => (go.disabled = !agree.checked);
  $("decline").onclick = () => {
    S.pending = null;
    app().innerHTML = `<section class="card"><h1>No problem</h1><p class="lead">You have not been entered into the study, and nothing has been saved. You can close this page.</p></section>`;
  };
  go.onclick = () => screenEmail();
}

function screenEmail(msg) {
  setProgress(4);
  app().innerHTML = `<section class="card">
    <h1>Your email address</h1>
    <p class="lead">We'll email you a 6-digit login code. You'll use it to come back for weeks 2 and 3, to continue on another device, and to see your answers.</p>
    ${msg ? errorBox(msg) : ""}
    <label class="field"><span>Email address</span>
      <input id="em" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(S.pending?.email || "")}" /></label>
    <p class="muted small">Used only to send your code. Never shared, and deleted when the study closes.</p>
    <div class="row-btns"><span></span><button class="btn primary" id="go">Get my code</button></div></section>`;
  const go = async () => {
    const email = $("em").value.trim();
    if (!validEmail(email)) return screenEmail("That email address doesn't look right. Please check it.");
    S.pending.email = email;
    $("go").disabled = true;
    const r = await API.call({ action: "register", returning: S.pending.returning, oldId: S.pending.oldId || "", email });
    if (!r.ok) {
      if (r.error === "email_taken") { screenEmail(`That email is already signed up. <button class="link inline-link" id="err-login">Log in with your code</button>, or use "Forgot your code?" on the login page.`); return bindErrLogin(); }
      if (r.error === "oldid_taken") return screenOldId("That participant ID is already signed up for this year. Log in with your code instead, or email us if that wasn't you.");
      if (r.error === "oldid_unknown") return screenOldId("We couldn't find that participant ID. Please check it, or email us for help.");
      if (r.error === "oldid_format") return screenOldId("Your participant ID is numbers only.");
      return screenEmail(NET_ERR);
    }
    S.code = r.code; S.profile = r.profile; S.pending = null;
    store.set("adc_code", S.code);
    screenCode();
  };
  $("go").onclick = go;
  $("em").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}
function bindErrLogin() { const b = $("err-login"); if (b) b.onclick = () => screenLogin(); }

function screenCode() {
  renderChrome();
  app().innerHTML = `<section class="card">
    <h1>Your login code</h1>
    <div class="big-id" id="code-box">${esc(S.code)}</div>
    <p class="lead">We've also emailed it to you. Please write it down. You'll need it to come back for weeks 2 and 3, or to continue on another device.</p>
    <p class="muted small">Can't find the email? Check your spam folder. If you lose the code, use "Forgot your code?" on the login page.</p>
    <div class="row-btns"><span></span><button class="btn primary" id="go">Start the questionnaire</button></div></section>`;
  $("go").onclick = route;
}

function screenLogin(msg) {
  app().innerHTML = `<section class="card">
    <h1>Log in</h1>
    ${msg ? errorBox(msg) : ""}
    <label class="field"><span>Your 6-digit login code</span>
      <input id="code" type="text" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="e.g. 482915" /></label>
    <div class="row-btns"><button class="link" id="back">Back</button><button class="btn primary" id="go">Log in</button></div>
    <p class="small"><button class="link inline-link" id="forgot">Forgot your code?</button></p></section>`;
  const go = async () => {
    const code = $("code").value.replace(/\D/g, "");
    if (code.length !== 6) return screenLogin("Your login code is 6 digits.");
    $("go").disabled = true;
    const r = await API.call({ action: "login", code });
    if (!r.ok) return screenLogin(r.error === "network" ? NET_ERR : r.error === "busy" ? "Too many tries. Please wait a few minutes and try again." : "That code didn't match. Please check it, or use \"Forgot your code?\".");
    S.code = code; S.profile = r.profile;
    store.set("adc_code", code);
    route();
  };
  $("go").onclick = go;
  $("code").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $("back").onclick = screenStart;
  $("forgot").onclick = () => screenForgot();
}

function screenForgot(msg) {
  app().innerHTML = `<section class="card">
    <h1>Forgot your code?</h1>
    <p class="lead">Enter the email you signed up with and we'll send your code to it.</p>
    ${msg || ""}
    <label class="field"><span>Email address</span><input id="em" type="email" autocomplete="email" placeholder="you@example.com" /></label>
    <div class="row-btns"><button class="link" id="back">Back to log in</button><button class="btn primary" id="go">Email my code</button></div></section>`;
  const go = async () => {
    const email = $("em").value.trim();
    if (!validEmail(email)) return screenForgot(errorBox("That email address doesn't look right."));
    $("go").disabled = true;
    const r = await API.call({ action: "forgot", email });
    if (!r.ok) return screenForgot(errorBox(NET_ERR));
    screenForgot(`<div class="alert info">If that email is signed up, your code is on its way. Check your inbox (and spam folder), then log in.</div>`);
  };
  $("go").onclick = go;
  $("back").onclick = () => screenLogin();
}

// ---------- Questionnaire ----------
function fieldHTML(it) {
  if (it.heading) return `<div class="q-heading"><div class="q-heading-text">${it.heading}</div>${it.note ? `<div class="q-note">${it.note}</div>` : ""}</div>`;
  const v = S.answers[it.id] ?? "";
  const label = `<div class="q">${it.q}</div>`;
  switch (it.type) {
    case "number":
      return `<div class="item">${label}<div class="inline"><input type="number" data-id="${it.id}" min="${it.min ?? ""}" max="${it.max ?? ""}" step="${it.step ?? 1}" inputmode="decimal" value="${esc(v)}" />${it.unit ? `<span class="unit">${it.unit}</span>` : ""}</div></div>`;
    case "time":
      return `<div class="item">${label}${timeSelect(it.id, v)}</div>`;
    case "text":
      return `<div class="item">${label}<input type="text" data-id="${it.id}" value="${esc(v)}" /></div>`;
    case "select":
      return `<div class="item">${label}<select data-id="${it.id}"><option value="">Select…</option>${it.options.map((o) => `<option ${String(o.value) === String(v) ? "selected" : ""} value="${esc(o.value)}">${o.label}</option>`).join("")}</select></div>`;
    case "radio":
      return `<div class="item">${label}<div class="radios">${it.options.map((o) => `<label class="radio"><input type="radio" name="${it.id}" data-id="${it.id}" value="${esc(o.value)}" data-label="${esc(o.label)}" ${v !== "" && String(o.value) === String(v) ? "checked" : ""}/><span>${o.label}</span></label>`).join("")}</div></div>`;
    case "height":
      return `<div class="item">${label}<div class="inline"><select data-unit="height"><option value="cm">cm</option><option value="ftin">feet and inches</option></select>
        <span class="h-cm"><input type="number" data-id="height_cm" min="100" max="230" inputmode="decimal" placeholder="cm" value="${esc(S.answers.height_cm ?? "")}" /></span>
        <span class="h-ft hidden"><input type="number" data-id="height_ft" min="3" max="7" inputmode="numeric" placeholder="ft" /> <input type="number" data-id="height_in" min="0" max="11" inputmode="numeric" placeholder="in" /></span></div></div>`;
    case "weight":
      return `<div class="item">${label}<div class="inline"><select data-unit="weight"><option value="kg">kg</option><option value="lb">lb</option></select>
        <input type="number" data-id="weight_value" min="25" max="500" step="0.1" inputmode="decimal" placeholder="weight" value="${esc(S.answers.weight_kg ?? "")}" /></div></div>`;
  }
  return "";
}

function collect(container) {
  const a = {};
  container.querySelectorAll("[data-id]").forEach((el) => {
    const id = el.dataset.id;
    if (el.type === "radio") { if (el.checked) { a[id] = el.value; a[id + "_answer"] = el.dataset.label; } else if (!(id in a)) a[id] = ""; }
    else a[id] = el.value.trim();
  });
  const hu = container.querySelector('[data-unit="height"]');
  if (hu) {
    let cm = "";
    if (hu.value === "cm") cm = a.height_cm;
    else if (a.height_ft !== "") cm = ((Number(a.height_ft) * 12 + Number(a.height_in || 0)) * 2.54).toFixed(1);
    a.height_unit_entered = hu.value; a.height_cm = cm; delete a.height_ft; delete a.height_in;
  }
  const wu = container.querySelector('[data-unit="weight"]');
  if (wu) {
    a.weight_unit_entered = wu.value;
    a.weight_kg = a.weight_value === "" ? "" : wu.value === "kg" ? a.weight_value : (Number(a.weight_value) * 0.453592).toFixed(1);
    delete a.weight_value;
  }
  return a;
}

function screenSection(section, editing = false) {
  const idx = QUESTIONNAIRE.indexOf(section);
  S.view = editing ? "edit" : null;
  S.answers = editing ? { ...(S.profile.sections[section.key]?.answers || {}) } : {};
  if (!editing) setProgress(5 + (idx / QUESTIONNAIRE.length) * 45);
  app().innerHTML = `<section class="card">
    <p class="step">${editing ? "Editing your answers" : `Questionnaire · part ${idx + 1} of ${QUESTIONNAIRE.length}`}</p>
    <h1>${section.title}</h1><p class="lead">${section.intro}</p>
    <form id="qf" novalidate>${section.items.map(fieldHTML).join("")}</form>
    <div id="msg"></div>
    <div class="row-btns">${editing ? `<button class="link" id="cancel">Cancel</button>` : `<span class="muted small">Your answers save when you press Next.</span>`}<button class="btn primary" id="next">${editing ? "Save changes" : "Next"}</button></div></section>`;
  const form = $("qf");
  form.querySelectorAll('[data-unit="height"]').forEach((sel) => sel.onchange = () => {
    form.querySelector(".h-cm").classList.toggle("hidden", sel.value !== "cm");
    form.querySelector(".h-ft").classList.toggle("hidden", sel.value === "cm");
  });
  if (editing) $("cancel").onclick = screenMyAnswers;
  let warned = false;
  $("next").onclick = async () => {
    const a = collect(form);
    const bad = [];
    form.querySelectorAll('input[type="number"]').forEach((el) => {
      if (el.value === "") return;
      const x = Number(el.value);
      if ((el.min !== "" && x < Number(el.min)) || (el.max !== "" && x > Number(el.max))) bad.push(el);
    });
    form.querySelectorAll(".invalid").forEach((e) => e.classList.remove("invalid"));
    if (bad.length) { bad.forEach((e) => e.classList.add("invalid")); $("msg").innerHTML = errorBox("Some numbers are outside the expected range. Please check the highlighted boxes."); bad[0].scrollIntoView({ block: "center" }); return; }
    const missing = section.items.filter((it) => it.required && !a[it.id]);
    if (missing.length) { $("msg").innerHTML = errorBox(`Please answer: ${missing.map((it) => it.q).join(" ")}`); return; }
    const needOther = section.items.find((it) => it.showIf && Object.entries(it.showIf).every(([k, v]) => a[k] === v) && !a[it.id]);
    if (needOther) { $("msg").innerHTML = errorBox("You chose Other. Please describe it in the box."); return; }
    const blanks = section.items.filter((it) => it.id && !it.required && it.type !== "text" && !["height", "weight"].includes(it.type) && (a[it.id] === "" || a[it.id] === undefined)).length;
    if (blanks && !warned) {
      warned = true;
      $("msg").innerHTML = errorBox(`You left ${blanks} question${blanks > 1 ? "s" : ""} blank. That's okay if you'd rather skip ${blanks > 1 ? "them" : "it"}. Press ${editing ? "Save changes" : "Next"} again to continue, or go back and answer.`);
      return;
    }
    if (section.key === "about" && a.age !== "" && (Number(a.age) < CONFIG.MIN_AGE || Number(a.age) > CONFIG.MAX_AGE)) {
      if (!confirm(`You entered an age of ${a.age}. This study is for adults aged ${CONFIG.MIN_AGE} to ${CONFIG.MAX_AGE}. Is your age correct?`)) return;
    }
    let extra = {};
    if (section.key === "meq") extra = scoreMEQ(a);
    if (section.key === "psqi") extra = scorePSQI(a);
    if (section.key === "sleep") extra = computeMSFsc(a);
    const questions = {};
    section.items.forEach((it) => { if (it.id) questions[it.id] = it.q; });
    questions.height_cm = "Height (cm)"; questions.weight_kg = "Weight (kg)";
    $("next").disabled = true;
    const r = await save({ kind: "section", section: section.key, answers: { ...a, ...extra }, edit: editing, questions: editing ? questions : undefined });
    if (!r.ok) {
      $("next").disabled = false;
      $("msg").innerHTML = errorBox(r.error === "locked" ? "Answers can no longer be changed once week 1 is finished." : "We couldn't save your answers. Check your internet and try again.");
      return;
    }
    if (editing) screenMyAnswers("Your changes are saved.");
    else route();
  };
}

// ---------- My answers ----------
// Long questionnaires are summarised with a "View all" button; short sections are shown in full.
const LONG = { meq: "19 questions", psqi: "18 questions", sleep: null };
const MCTQ_IDS = (QUESTIONNAIRE.find((s) => s.key === "sleep").items).filter((it) => it.id && it.id.startsWith("mctq_")).map((it) => it.id);

function answerText(it, ans) {
  if (it.type === "height") return ans.height_cm ? `${ans.height_cm} cm` : "";
  if (it.type === "weight") return ans.weight_kg ? `${ans.weight_kg} kg` : "";
  const v = ans[it.id];
  if (v === undefined || v === "") return "";
  if (it.type === "time") return timeLabel(v);
  if (it.type === "radio" || it.type === "select") return ans[it.id + "_answer"] || (it.options.find((o) => String(o.value) === String(v)) || {}).label || v;
  return it.unit ? `${v} ${it.unit}` : String(v);
}
function qaList(items, ans) {
  return `<dl class="qa">${items.filter((it) => it.id || it.type).map((it) => {
    const t = answerText(it, ans);
    return `<div><dt>${it.q}</dt><dd>${t ? esc(t) : `<span class="muted">Skipped</span>`}</dd></div>`;
  }).join("")}</dl>`;
}
function answersHTML(compact) {
  const p = S.profile;
  const canEdit = editable();
  const parts = QUESTIONNAIRE.filter((s) => p.sections[s.key]).map((s) => {
    const ans = p.sections[s.key].answers;
    let body;
    if (s.key === "meq" || s.key === "psqi") body = `<p class="muted small">${LONG[s.key]} answered.</p>`;
    else if (s.key === "sleep") body = qaList(s.items.filter((it) => it.id && !MCTQ_IDS.includes(it.id)), ans) + `<p class="muted small">Plus ${MCTQ_IDS.length} questions on workdays and free days.</p>`;
    else body = qaList(s.items.filter((it) => it.id && !(compact && it.type === "text" && !ans[it.id])), ans);
    const viewAll = (s.key === "meq" || s.key === "psqi" || s.key === "sleep") ? `<button class="btn small-btn" data-view="${s.key}">View all</button>` : "";
    return `<div class="ans-sec"><div class="ans-head"><h3>${s.title}</h3><div class="ans-btns">${viewAll}${canEdit ? `<button class="btn small-btn" data-edit="${s.key}">Edit</button>` : ""}</div></div>${body}</div>`;
  }).join("");
  const note = canEdit
    ? `<p class="muted small">You can change these answers until you finish week 1's tests.</p>`
    : `<p class="muted small">Week 1 is finished, so these answers are now locked.</p>`;
  return `<div class="answers ${compact ? "compact" : ""}"><h2>My answers</h2>${note}${parts}</div>`;
}
function bindAnswerButtons(root) {
  root.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => { renderChromeFor("edit"); screenSection(QUESTIONNAIRE.find((s) => s.key === b.dataset.edit), true); window.scrollTo(0, 0); });
  root.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => screenViewAll(b.dataset.view));
}
function renderChromeFor(view) { S.view = view; renderChrome(); }

function screenMyAnswers(msg) {
  Tests.reset();
  window.scrollTo(0, 0);
  renderChromeFor("answers");
  app().innerHTML = `<section class="card">
    ${typeof msg === "string" ? `<div class="alert info">${msg}</div>` : ""}
    ${answersHTML(false)}
    <div class="row-btns"><span></span><button class="btn primary" id="back">Back</button></div></section>`;
  bindAnswerButtons(app());
  $("back").onclick = route;
}
function screenViewAll(key) {
  window.scrollTo(0, 0);
  renderChromeFor("answers");
  const s = QUESTIONNAIRE.find((x) => x.key === key);
  const ans = S.profile.sections[key].answers;
  let html = "", group = [];
  const flush = () => { if (group.length) html += qaList(group, ans); group = []; };
  s.items.forEach((it) => { if (it.heading) { flush(); html += `<h3 class="qa-heading">${it.heading}</h3>`; } else group.push(it); });
  flush();
  app().innerHTML = `<section class="card">
    <p class="step">My answers</p><h1>${s.title}</h1>${html}
    <div class="row-btns"><button class="link" id="back">Back to my answers</button>${editable() ? `<button class="btn primary" data-edit="${key}">Edit these answers</button>` : ""}</div></section>`;
  bindAnswerButtons(app());
  $("back").onclick = () => screenMyAnswers();
}

// ---------- Weekly sessions ----------
function screenWait(week, opensAt) {
  setProgress(55 + (week - 1) * 15);
  app().innerHTML = `<section class="card">
    <h1>See you next week</h1>
    <p class="lead">Your week ${week} session opens on <b>${opensAt.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</b>.</p>
    <p>Come back to this page then and log in with your code: <b>${esc(S.code)}</b>.</p>
    ${progressPanel(week)}</section>`;
}

function screenNeedComputer(week) {
  app().innerHTML = `<section class="card">
    <h1>Please switch to a computer</h1>
    <p class="lead">The week ${week} tasks need a computer with a keyboard (a laptop or desktop), because they measure reaction speed and a phone or tablet would change the results.</p>
    ${week === 1 ? `<p>Your questionnaire answers are saved.</p>` : ""}
    <p>On a computer, open this same page, choose "log in with my code", and enter:</p>
    <div class="big-id">${esc(S.code)}</div></section>`;
}

function screenWeeklySleep(week) {
  setProgress(55 + (week - 1) * 15);
  app().innerHTML = `<section class="card">
    <p class="step">Week ${week} of 3</p>
    <h1>Your sleep this past week</h1>
    <form id="sf" novalidate>
      <div class="item"><div class="q">What was the average time you went to sleep this past week?</div>${timeSelect("week_sleep_time")}</div>
      <div class="item"><div class="q">What was the average time you woke up this past week?</div>${timeSelect("week_wake_time")}</div>
      <div class="item"><div class="q">Would you say this is normal for your schedule?</div><div class="radios">
        <label class="radio"><input type="radio" name="n" data-id="week_normal" value="Yes" data-label="Yes"/><span>Yes</span></label>
        <label class="radio"><input type="radio" name="n" data-id="week_normal" value="No" data-label="No"/><span>No</span></label></div></div>
    </form><div id="msg"></div>
    <div class="row-btns"><span></span><button class="btn primary" id="next">Continue to tests</button></div></section>`;
  $("next").onclick = async () => {
    const a = collect($("sf"));
    delete a.week_normal_answer;
    if (!a.week_sleep_time || !a.week_wake_time || !a.week_normal) { $("msg").innerHTML = errorBox("Please answer all three questions."); return; }
    $("next").disabled = true;
    const r = await save({ kind: "weeksleep", week, answers: a });
    if (!r.ok) { $("next").disabled = false; $("msg").innerHTML = errorBox("We couldn't save. Check your internet and try again."); return; }
    route();
  };
}

function screenHub(week) {
  const done = S.profile.weeks[week].tests;
  const n = Object.keys(done).length;
  setProgress(55 + (week - 1) * 15 + (n / 4) * 15);
  app().innerHTML = `<section class="card">
    <p class="step">Week ${week} of 3</p>
    <h1>Choose a test</h1>
    <p class="lead">Complete all four tests for this week. Find a quiet place, and give each test your full attention.</p>
    <div class="test-list">${TEST_ORDER.filter((t) => !done[t]).map((t) => `<button class="btn primary big" data-t="${t}">${TEST_INFO[t].name}</button>`).join("")}</div>
    ${progressPanel(week)}</section>`;
  app().querySelectorAll("[data-t]").forEach((b) => b.onclick = () => runTest(week, b.dataset.t));
}

function scoreText(r) {
  if (!r) return "";
  const has = (k) => r[k] !== undefined && r[k] !== "";
  switch (r.test) {
    case "memory": return has("memory_total") ? `Remembered ${r.memory_total} of 36 word pairs` : "";
    case "stroop": return has("stroop_congruent") ? `${r.stroop_congruent} correct (matching colors), ${r.stroop_incongruent} correct (mismatched colors)` : "";
    case "digitspan": return has("digit_span") ? `Longest sequence: ${r.digit_span} digits` : "";
    case "rt": return has("reaction_time_ms") ? (Number(r.reaction_time_ms) > 0 ? `Average reaction time: ${r.reaction_time_ms} ms` : "No responses recorded") : "";
  }
  return "";
}

function progressPanel(week) {
  const rows = [], prev = [];
  for (let w = 1; w <= 3; w++) {
    const wk = S.profile.weeks[w];
    if (w === week) {
      TEST_ORDER.forEach((t) => {
        const r = wk.tests[t];
        rows.push(`<li class="${r ? "is-done" : ""}"><span class="tick">${r ? "✓" : "○"}</span><span class="name">${TEST_INFO[t].name}</span><span class="when">${r ? "Completed " + fmtWhen(r.at) : "Not done yet"}</span>${r && scoreText(r) ? `<span class="score">${scoreText(r)}</span>` : ""}</li>`);
      });
    } else if (w < week) {
      prev.push(`<li class="is-done"><span class="tick">✓</span><span class="name">Week ${w}</span><span class="when">All tests completed ${fmtWhen(wk.completed_at)}</span></li>`);
    }
  }
  return `<div class="progress-panel"><h2>Your progress</h2><ul>${prev.concat(rows).join("")}</ul>
    <p class="muted small">These are task scores, not a health measure, and nothing here is a diagnosis.</p></div>`;
}

function runTest(week, key) {
  renderChromeFor("test");
  const finish = async (result) => {
    const payload = { kind: "test", week, test: key, result: { wordset: key === "memory" ? `W2-${week}` : "", ...result, ...deviceInfo(), ...localTime() } };
    app().innerHTML = `<section class="card center"><h2>Saving…</h2></section>`;
    let r = await save(payload);
    while (!r.ok) {
      app().innerHTML = `<section class="card center">${errorBox("We couldn't save this test. Check your internet connection.")}<button class="btn primary" id="retry">Try again</button></section>`;
      await new Promise((res) => $("retry").onclick = res);
      r = await save(payload);
    }
    const txt = scoreText({ test: key, ...result });
    const weekDone = !!S.profile.weeks[week].completed_at;
    app().innerHTML = `<section class="card center"><h2>Test complete</h2><p class="lead">Thank you for completing this test.</p>${txt ? `<p class="score-big">${txt}</p>` : ""}<button class="btn primary" id="back">${weekDone ? "Continue" : "Back to Test Hub"}</button></section>`;
    $("back").onclick = route;
  };
  if (key === "memory") Tests.memory(WORDSETS[week - 1], finish);
  else Tests[key](finish);
}

function screenAllDone() {
  setProgress(100);
  app().innerHTML = `<section class="card">
    <h1>You're finished. Thank you!</h1>
    <p class="lead">Thank you for taking part in the ADChronotype Study. All three weeks are saved.</p>
    ${progressPanel(4)}
    <p class="muted">Questions? Email ${CONTACT()}.</p></section>`;
}

// ---------- Start ----------
$("foot-contact").innerHTML = CONTACT();
window.addEventListener("beforeunload", (e) => {
  if (document.querySelector(".test-card.running")) { e.preventDefault(); e.returnValue = ""; }
});
(async () => {
  const saved = store.get("adc_code");
  if (saved) {
    app().innerHTML = `<section class="card center"><p class="muted">Loading…</p></section>`;
    const r = await API.call({ action: "login", code: saved });
    if (r.ok) { S.code = saved; S.profile = r.profile; }
    else if (r.error !== "network") store.del("adc_code");
  }
  route();
})();
