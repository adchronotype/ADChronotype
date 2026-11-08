/**
 * ADChronotype Wave 2 backend (Google Apps Script, attached to a Google Sheet).
 * Paste this whole file into Extensions > Apps Script. Setup steps are in README.md.
 *
 * Tabs it creates and fills:
 *   Responses  one row per person: identity, simple answers, MEQ / PSQI / MCTQ results (click to jump
 *              to the full answers), and each week's sleep and test scores
 *   MEQ, PSQI, MCTQ   every answer, one row per person
 *   Tests      one row per finished test, with every detail
 *   Edits      every change a participant makes to an earlier answer
 *   Log        a raw copy of everything received (safety net, never edited)
 *   Wave1IDs   (you make this) column A header "id", then every Wave 1 ID
 */

const FIRST_REG_NO = 5001;
const TZ = "America/Los_Angeles";
const EMAIL_SUBJECT = "Your ADChronotype Study login code";

const IDENTITY = ["returning", "old_id", "email", "code", "reg_no", "registered_at", "consent_at"];
const ABOUT = ["age", "sex", "ethnicity", "ethnicity_other", "height_cm", "height_unit_entered", "weight_kg", "weight_unit_entered", "family_history", "education_years", "depression_history", "about_at"];
const SLEEP = ["habitual_sleep", "habitual_wake", "preferred_sleep", "preferred_wake", "sleep_at"];
const SUMMARY = ["MEQ", "PSQI", "MCTQ (MSFsc)"];
const HISTORY = ["shift_years", "wake_20s", "wake_30s", "wake_40s", "wake_50s", "wake_60s", "years_before_7", "wake_change_12mo", "wake_change_detail", "history_at", "meq_at", "psqi_at"];
const WEEK = w => ["sleep_time", "wake_time", "normal", "sleep_at", "memory", "stroop_cong", "stroop_incong", "digit_span", "rt_ms", "completed_at"].map(k => `w${w}_${k}`);
const RESPONSES_COLS = [].concat(IDENTITY, ABOUT, SLEEP, SUMMARY, HISTORY, WEEK(1), WEEK(2), WEEK(3));
const DETAIL_LEAD = { MEQ: ["reg_no", "meq_result"], PSQI: ["reg_no", "psqi_global", "psqi_c1", "psqi_c2", "psqi_c3", "psqi_c4", "psqi_c5", "psqi_c6", "psqi_c7", "psqi_efficiency_pct"], MCTQ: ["reg_no", "msfsc"] };
const TEST_KEYS = ["memory", "stroop", "digitspan", "rt"];

// ---------------- entry points ----------------
function doPost(e) {
  let out;
  try {
    const p = JSON.parse(e.postData.contents);
    out = withLock(() => handle(p));
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: "ADChronotype Wave 2 backend is running" })).setMimeType(ContentService.MimeType.JSON);
}

function handle(p) {
  switch (p.action) {
    case "register": return register(p);
    case "login": return login(String(p.code || ""));
    case "forgot": return forgot(String(p.email || ""));
    case "save": return saveData(p);
    default: return { ok: false, error: "unknown action" };
  }
}

// ---------------- sheet helpers ----------------
function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
function headers(sh, wanted) {
  let h = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  while (h.length && h[h.length - 1] === "") h.pop();
  const missing = (wanted || []).filter((k, i, arr) => h.indexOf(k) < 0 && arr.indexOf(k) === i);
  if (missing.length) {
    h = h.concat(missing);
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return h;
}
function findRow(sh, col, value) {
  if (sh.getLastRow() < 2) return -1;
  const h = headers(sh);
  const c = h.indexOf(col);
  if (c < 0) return -1;
  const vals = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).trim().toLowerCase() === String(value).trim().toLowerCase()) return i + 2;
  return -1;
}
function readRow(sh, row) {
  const h = headers(sh);
  const v = sh.getRange(row, 1, 1, h.length).getValues()[0];
  const o = {};
  h.forEach((k, i) => (o[k] = v[i] instanceof Date ? v[i].toISOString() : v[i]));
  return o;
}
function writeFields(sh, row, obj, baseCols) {
  const keys = Object.keys(obj);
  const h = headers(sh, (baseCols || []).concat(keys));
  const range = sh.getRange(row, 1, 1, h.length);
  const vals = range.getValues()[0];
  const formulas = range.getFormulas()[0];
  const out = h.map((k, i) => (k in obj ? cellValue(obj[k]) : (formulas[i] || vals[i])));
  range.setValues([out]);
}
function appendObject(name, obj, baseCols) {
  const sh = sheet(name);
  const h = headers(sh, (baseCols || []).concat(Object.keys(obj)));
  sh.appendRow(h.map(k => cellValue(obj[k])));
  return sh.getLastRow();
}
// Sheets would turn "07:30" into a date and "55" into text; store times as text and plain numbers as numbers
function cellValue(v) {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return v;
  if (/^\d{1,2}:\d{2}$/.test(v)) return "'" + v;
  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 10) return Number(v);
  return v;
}
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function now() { return new Date().toISOString(); }
function columnValues(name, header) {
  const sh = sheet(name);
  if (sh.getLastRow() < 2) return [];
  const h = headers(sh);
  const c = h.indexOf(header);
  if (c < 0) return [];
  return sh.getRange(2, c + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]).trim());
}
function log(reg, action, data) {
  appendObject("Log", { at: now(), reg_no: reg || "", action: action, data: JSON.stringify(data).slice(0, 45000) }, ["at", "reg_no", "action", "data"]);
}

// ---------------- rate limits ----------------
function tooMany(key, limit, seconds) {
  const c = CacheService.getScriptCache();
  const n = Number(c.get(key) || 0);
  if (n >= limit) return true;
  c.put(key, String(n + 1), seconds);
  return false;
}

// ---------------- actions ----------------
function register(p) {
  const email = String(p.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "bad_email" };
  const resp = sheet("Responses");
  headers(resp, RESPONSES_COLS);
  if (findRow(resp, "email", email) > 0) return { ok: false, error: "email_taken" };
  const returning = !!p.returning;
  const oldId = returning ? String(p.oldId || "").trim() : "";
  if (returning) {
    if (!/^\d+$/.test(oldId)) return { ok: false, error: "oldid_format" };
    const wave1 = columnValues("Wave1IDs", "id");
    if (wave1.length && wave1.indexOf(oldId) < 0) return { ok: false, error: "oldid_unknown" };
    if (findRow(resp, "old_id", oldId) > 0) return { ok: false, error: "oldid_taken" };
  }
  const codes = new Set(columnValues("Responses", "code"));
  let code;
  do { code = String(Math.floor(100000 + Math.random() * 900000)); } while (codes.has(code));
  const regs = columnValues("Responses", "reg_no").map(Number).filter(n => n > 0);
  const regNo = regs.length ? Math.max.apply(null, regs) + 1 : FIRST_REG_NO;
  const t = now();
  appendObject("Responses", { returning: returning ? "Y" : "N", old_id: oldId, email: email, code: code, reg_no: regNo, registered_at: t, consent_at: t }, RESPONSES_COLS);
  // Keep the code as text so leading digits and formatting stay exact
  const r = findRow(resp, "reg_no", regNo);
  const ci = headers(resp).indexOf("code") + 1;
  resp.getRange(r, ci).setNumberFormat("@").setValue(code);
  log(regNo, "register", { returning: returning, old_id: oldId });
  sendCode(email, code);
  return { ok: true, code: code, profile: profile(r) };
}

function login(code) {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "not_found" };
  if (tooMany("fails", 40, 600)) return { ok: false, error: "busy" };
  const r = findRow(sheet("Responses"), "code", code);
  if (r < 0) return { ok: false, error: "not_found" };
  CacheService.getScriptCache().remove("fails");
  return { ok: true, profile: profile(r) };
}

function forgot(email) {
  email = email.trim().toLowerCase();
  if (tooMany("forgot_" + email, 3, 3600)) return { ok: true };
  const sh = sheet("Responses");
  const r = findRow(sh, "email", email);
  if (r > 0) sendCode(email, String(readRow(sh, r).code));
  return { ok: true };   // same answer either way, so nobody can test which emails are registered
}

function sendCode(email, code) {
  MailApp.sendEmail({
    to: email,
    name: "ADChronotype Study",
    subject: EMAIL_SUBJECT,
    body:
      "Thank you for taking part in the ADChronotype Study.\n\nYour login code is: " + code + "\n\n" +
      "Use it to log in on the study page any time: to continue on another device, to view or edit your answers, " +
      "and to come back for weeks 2 and 3 (each opens about a week after you finish the previous one).\n\n" +
      "The tests must be done on a computer with a keyboard (not a phone or tablet).\n\nQuestions? Just reply to this email.",
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c2333">' +
      "<p>Thank you for taking part in the ADChronotype Study.</p>" +
      '<p>Your login code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:4px 0 16px">' + code + "</p>" +
      "<p>Use it to log in on the study page any time: to continue on another device, to view or edit your answers, " +
      "and to come back for <b>weeks 2 and 3</b> (each opens about a week after you finish the previous one).</p>" +
      "<p><b>The tests must be done on a computer with a keyboard</b> (not a phone or tablet).</p>" +
      "<p>Questions? Just reply to this email.</p></div>",
  });
}

function saveData(p) {
  const sh = sheet("Responses");
  headers(sh, RESPONSES_COLS);
  const r = findRow(sh, "code", String(p.code || ""));
  if (r < 0) return { ok: false, error: "not_found" };
  const person = readRow(sh, r);
  const reg = person.reg_no;
  log(reg, "save_" + p.kind, p);
  const t = now();

  if (p.kind === "section") {
    const s = p.section, a = p.answers || {};
    if (p.edit) {
      if (person.w1_completed_at) return { ok: false, error: "locked" };
      const before = profile(r).sections[s];
      const old = before ? before.answers : {};
      const same = (x, y) => (x === "" || x === undefined ? "" : String(x)) === (y === "" || y === undefined ? "" : String(y)) || (x !== "" && y !== "" && !isNaN(x) && !isNaN(y) && Number(x) === Number(y));
      Object.keys(a).forEach(k => {
        if (/_answer$|_unit_entered$|^(meq_total|meq_category|psqi_c\d|psqi_global|psqi_efficiency_pct|msfsc)$/.test(k)) return;
        if (same(old[k], a[k])) return;
        const show = (src, key) => (src[key + "_answer"] !== undefined && src[key + "_answer"] !== "" ? src[key + "_answer"] : (src[key] === undefined ? "" : src[key]));
        appendObject("Edits", { reg_no: reg, at: t, section: s, question: (p.questions && p.questions[k]) || k, original: show(old, k), new: show(a, k) }, ["reg_no", "at", "section", "question", "original", "new"]);
      });
    }
    if (s === "about" || s === "history") {
      const o = {}; Object.keys(a).forEach(k => { if (!/_answer$/.test(k)) o[k] = a[k]; });
      if (!p.edit || !person[s + "_at"]) o[s + "_at"] = t;
      writeFields(sh, r, o, RESPONSES_COLS);
    } else if (s === "sleep") {
      const resp = {}, mctq = {};
      Object.keys(a).forEach(k => { if (/^(mctq_|msfsc)/.test(k)) mctq[k] = a[k]; else if (!/_answer$/.test(k)) resp[k] = a[k]; });
      if (!p.edit || !person.sleep_at) resp.sleep_at = t;
      const dr = upsertDetail("MCTQ", reg, mctq);
      resp["MCTQ (MSFsc)"] = link("MCTQ", dr, mctq.msfsc ? mctq.msfsc : "view");
      writeFields(sh, r, resp, RESPONSES_COLS);
    } else if (s === "meq" || s === "psqi") {
      const tab = s.toUpperCase();
      const dr = upsertDetail(tab, reg, combine(a));
      const o = {};
      if (s === "meq") o.MEQ = link("MEQ", dr, a.meq_total !== "" && a.meq_total !== undefined ? `${a.meq_category} (${a.meq_total})` : "view");
      else o.PSQI = link("PSQI", dr, a.psqi_global !== "" && a.psqi_global !== undefined ? String(a.psqi_global) : "view");
      if (!p.edit || !person[s + "_at"]) o[s + "_at"] = t;
      writeFields(sh, r, o, RESPONSES_COLS);
    }
  } else if (p.kind === "weeksleep") {
    const w = Number(p.week), a = p.answers || {};
    writeFields(sh, r, { [`w${w}_sleep_time`]: a.week_sleep_time || "", [`w${w}_wake_time`]: a.week_wake_time || "", [`w${w}_normal`]: a.week_normal || "", [`w${w}_sleep_at`]: t }, RESPONSES_COLS);
  } else if (p.kind === "test") {
    const w = Number(p.week), res = p.result || {};
    const already = testsDone(reg, w);
    if (already[p.test]) return { ok: true, profile: profile(r) };   // never double-count a test
    appendObject("Tests", Object.assign({ reg_no: reg, week: w, test: p.test, at: t }, res), ["reg_no", "week", "test", "at"]);
    const o = {};
    if (p.test === "memory") o[`w${w}_memory`] = res.memory_total;
    if (p.test === "stroop") { o[`w${w}_stroop_cong`] = res.stroop_congruent; o[`w${w}_stroop_incong`] = res.stroop_incongruent; }
    if (p.test === "digitspan") o[`w${w}_digit_span`] = res.digit_span;
    if (p.test === "rt") o[`w${w}_rt_ms`] = res.reaction_time_ms;
    const done = testsDone(reg, w);
    if (TEST_KEYS.every(k => done[k]) && readRow(sh, r)[`w${w}_sleep_at`]) o[`w${w}_completed_at`] = t;
    writeFields(sh, r, o, RESPONSES_COLS);
  } else {
    return { ok: false, error: "bad kind" };
  }
  return { ok: true, profile: profile(r) };
}

// For the MEQ and PSQI tabs: one readable cell per question, "answer (points)"
function combine(a) {
  const o = {};
  Object.keys(a).forEach(k => {
    if (/_answer$/.test(k) || k === "meq_category" || k === "meq_total") return;
    o[k] = a[k + "_answer"] !== undefined && a[k] !== "" ? `${a[k + "_answer"]} (${a[k]})` : a[k];
  });
  if ("meq_total" in a) o.meq_result = a.meq_total === "" ? "" : `${a.meq_category} (${a.meq_total})`;
  return o;
}
// The reverse, so the site can show and edit the answers
function split(row) {
  const o = {};
  Object.keys(row).forEach(k => {
    const m = /^(meq\d+|psqi\d+[a-j]?)$/.test(k) && String(row[k]).match(/^(.*) \((\d+)\)$/);
    if (m) { o[k] = Number(m[2]); o[k + "_answer"] = m[1]; } else o[k] = row[k];
  });
  if (row.meq_result) { const m = String(row.meq_result).match(/^(.*) \((\d+)\)$/); if (m) { o.meq_category = m[1]; o.meq_total = Number(m[2]); } }
  return o;
}
function upsertDetail(tab, reg, data) {
  const sh = sheet(tab);
  headers(sh, DETAIL_LEAD[tab]);
  let row = findRow(sh, "reg_no", reg);
  const obj = Object.assign({ reg_no: reg }, data, { [tab.toLowerCase() + "_saved"]: now() });
  if (row < 0) row = appendObject(tab, obj, DETAIL_LEAD[tab]);
  else writeFields(sh, row, obj, DETAIL_LEAD[tab]);
  return row;
}
function link(tab, row, label) {
  const gid = sheet(tab).getSheetId();
  return `=HYPERLINK("#gid=${gid}&range=A${row}","${String(label).replace(/"/g, "'")}")`;
}
function testsDone(reg, week) {
  const sh = sheet("Tests");
  const done = {};
  if (sh.getLastRow() < 2) return done;
  const h = headers(sh);
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues();
  data.forEach(v => {
    if (String(v[h.indexOf("reg_no")]) === String(reg) && Number(v[h.indexOf("week")]) === week) {
      const o = {}; h.forEach((k, i) => (o[k] = v[i] instanceof Date ? v[i].toISOString() : v[i]));
      done[o.test] = o;
    }
  });
  return done;
}

// Everything the site needs to know about one person
function profile(r) {
  const p = readRow(sheet("Responses"), r);
  const reg = p.reg_no;
  const pick = (keys) => { const o = {}; keys.forEach(k => { if (!/_at$/.test(k) && p[k] !== "" && p[k] !== undefined) o[k] = p[k]; }); return o; };
  const detail = (tab) => { const sh = sheet(tab); const row = findRow(sh, "reg_no", reg); return row > 0 ? split(readRow(sh, row)) : {}; };
  const sections = {};
  if (p.about_at) sections.about = { saved_at: p.about_at, answers: pick(ABOUT) };
  if (p.sleep_at) sections.sleep = { saved_at: p.sleep_at, answers: Object.assign(pick(SLEEP), detail("MCTQ")) };
  if (p.meq_at) sections.meq = { saved_at: p.meq_at, answers: detail("MEQ") };
  if (p.psqi_at) sections.psqi = { saved_at: p.psqi_at, answers: detail("PSQI") };
  if (p.history_at) sections.history = { saved_at: p.history_at, answers: pick(HISTORY.filter(k => k !== "meq_at" && k !== "psqi_at")) };
  const weeks = {};
  for (let w = 1; w <= 3; w++) {
    weeks[w] = {
      sleep: p[`w${w}_sleep_at`] ? { saved_at: p[`w${w}_sleep_at`], answers: { week_sleep_time: p[`w${w}_sleep_time`], week_wake_time: p[`w${w}_wake_time`], week_normal: p[`w${w}_normal`] } } : null,
      tests: testsDone(reg, w),
      completed_at: p[`w${w}_completed_at`] || "",
    };
  }
  return { reg_no: reg, code: String(p.code), returning: p.returning, consent_at: p.consent_at, sections: sections, weeks: weeks };
}
