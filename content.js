// ===== Study content: word sets, consent, questionnaire items =====

// Three new memory word sets, one per week. None of these words appear in the Wave 1 sets
// or in each other. Simple, common, one- or two-syllable concrete nouns in unrelated pairs.
const WORDSETS = [
  [["horse","cloud"],["lake","belt"],["boat","desk"],["hill","egg"],["map","bone"],["bag","moon"],
   ["bus","shell"],["cake","wall"],["hat","corn"],["flag","fox"],["door","grass"],["coat","pen"]],
  [["apple","brick"],["beach","nail"],["bear","plate"],["bench","tooth"],["bike","sheep"],["duck","train"],
   ["fence","gift"],["horn","pan"],["log","rat"],["nest","truck"],["pot","tiger"],["river","meat"]],
  [["ball","lemon"],["brush","ocean"],["chain","nose"],["coin","deer"],["cow","shirt"],["crown","soap"],
   ["dish","wolf"],["fruit","pipe"],["hair","drum"],["dress","pig"],["knife","plant"],["mouse","net"]],
];

function consentHTML() {
  const c = CONFIG;
  return `
  <p><b>What this study is about.</b> This is a high school science research project on how sleep timing relates to thinking skills such as memory and attention in adults aged ${c.MIN_AGE} to ${c.MAX_AGE}.</p>
  <p><b>What you will do.</b> In week 1 you answer a questionnaire about your background and your sleep (about 15 to 20 minutes) and complete four short computer tasks on memory, attention and reaction time (about 10 to 15 minutes). In weeks 2 and 3 you answer two questions about your sleep and repeat the four tasks (about 10 to 15 minutes each time). The tasks need a computer with a keyboard; the questionnaire works on a phone.</p>
  <p><b>Risks.</b> The risk is minimal. The tasks are hard on purpose, so it is normal to find them frustrating. One question asks whether you have ever been diagnosed with depression; you can answer "Prefer not to say."</p>
  <p><b>What we collect and how it is protected.</b> We do not collect your name, date of birth, address or any medical record. We ask for your email address only to send you your login code (and to resend it if you forget it). It is kept with your answers in the study's password-protected file, never shared, and deleted once data collection closes. Your answers are otherwise identified only by a study number. Data is kept on password-protected storage, and results are only ever reported for the group, never for an individual.</p>
  <p><b>Your results.</b> After each task you will see your score on it, such as how many word pairs you remembered. These are task scores, not a health measure. You will not receive any Alzheimer's-related score, and nothing in this study is a diagnosis.</p>
  <p><b>Benefits.</b> There is no direct benefit to you. The study helps test whether sleep timing carries early information about Alzheimer's risk.</p>
  <p><b>Taking part is voluntary.</b> You can skip any question and stop at any time, for any reason, without any penalty.</p>
  <p><b>Questions?</b> Email the study team at ${c.CONTACT_EMAIL}, or contact the Adult Sponsor, ${c.SPONSOR_NAME} (${c.SPONSOR_EMAIL}).</p>`;
}

// ---- Option helpers ----
const FREQ = ["Not during the past month", "Less than once a week", "Once or twice a week", "Three or more times a week"];
const opts = (labels, scores) => labels.map((l, i) => ({ label: l, value: scores ? scores[i] : l }));

// ---- Questionnaire sections ----
// type: number | select | radio | time | text | height | weight | yesno
const QUESTIONNAIRE = [
  {
    key: "about", title: "About you",
    intro: "A few questions about you. You can skip any question.",
    items: [
      { id: "age", q: "How old are you?", type: "number", min: 18, max: 110, unit: "years" },
      { id: "sex", q: "What is your sex?", type: "radio", options: opts(["Female", "Male", "Prefer not to say"]) },
      { id: "ethnicity", q: "Which best describes your ethnicity?", type: "select",
        options: opts(["Asian", "Black or African", "Hispanic or Latino", "Middle Eastern or North African", "Native American or Alaska Native", "Native Hawaiian or Pacific Islander", "White", "Mixed or multiple", "Other", "Prefer not to say"]) },
      { id: "height", q: "What is your height?", type: "height" },
      { id: "weight", q: "What is your weight?", type: "weight" },
      { id: "family_history", q: "Has a parent, brother or sister of yours been diagnosed with Alzheimer's disease?", type: "radio", options: opts(["Yes", "No", "Not sure"]) },
      { id: "education_years", q: "How many years of education have you completed in total? (For example, finishing high school is about 12, a four-year college degree about 16.)", type: "number", min: 0, max: 30, unit: "years" },
      { id: "depression_history", q: "Have you ever been diagnosed with depression?", type: "radio", options: opts(["Yes", "No", "Prefer not to say"]) },
    ],
  },
  {
    key: "sleep", title: "Your sleep schedule",
    intro: "Questions about when you sleep. Use your usual times over the past month.",
    items: [
      { id: "habitual_sleep", q: "On a typical night, what time do you usually fall asleep?", type: "time" },
      { id: "habitual_wake", q: "On a typical morning, what time do you usually wake up?", type: "time" },
      { id: "preferred_sleep", q: "If you were completely free to plan your day, what time would you go to sleep?", type: "time" },
      { id: "preferred_wake", q: "If you were completely free to plan your day, what time would you wake up?", type: "time" },
      { id: "mctq_workdays", q: "How many days a week do you have a regular work schedule (including school or caregiving schedules)?", type: "number", min: 0, max: 7, unit: "days" },
      { heading: "On workdays" },
      { id: "mctq_w_bed", q: "On workdays, what time do you go to bed?", type: "time" },
      { id: "mctq_w_latency", q: "On workdays, how many minutes does it usually take you to fall asleep?", type: "number", min: 0, max: 300, unit: "minutes" },
      { id: "mctq_w_wake", q: "On workdays, what time do you wake up?", type: "time" },
      { heading: "On free days (days with no work schedule)" },
      { id: "mctq_f_bed", q: "On free days, what time do you go to bed?", type: "time" },
      { id: "mctq_f_latency", q: "On free days, how many minutes does it usually take you to fall asleep?", type: "number", min: 0, max: 300, unit: "minutes" },
      { id: "mctq_f_wake", q: "On free days, what time do you wake up?", type: "time" },
      { id: "mctq_f_alarm", q: "Do you use an alarm clock on free days?", type: "radio", options: opts(["Yes", "No"]) },
    ],
  },
  {
    key: "meq", title: "Morning or evening person?",
    intro: "For each question, choose the answer that best describes you, based on how you have felt in recent weeks.",
    items: [
      { id: "meq1", q: "Approximately what time would you get up if you were entirely free to plan your day?", type: "radio", options: opts(["5:00 to 6:30 AM", "6:30 to 7:45 AM", "7:45 to 9:45 AM", "9:45 to 11:00 AM", "11:00 AM to 12:00 noon"], [5, 4, 3, 2, 1]) },
      { id: "meq2", q: "Approximately what time would you go to bed if you were entirely free to plan your evening?", type: "radio", options: opts(["8:00 to 9:00 PM", "9:00 to 10:15 PM", "10:15 PM to 12:30 AM", "12:30 to 1:45 AM", "1:45 to 3:00 AM"], [5, 4, 3, 2, 1]) },
      { id: "meq3", q: "If you have to get up at a specific time in the morning, how much do you depend on an alarm clock?", type: "radio", options: opts(["Not at all", "Slightly", "Somewhat", "Very much"], [4, 3, 2, 1]) },
      { id: "meq4", q: "How easy do you find it to get up in the morning (when you are not woken up unexpectedly)?", type: "radio", options: opts(["Very difficult", "Somewhat difficult", "Fairly easy", "Very easy"], [1, 2, 3, 4]) },
      { id: "meq5", q: "How alert do you feel during the first half hour after you wake up in the morning?", type: "radio", options: opts(["Not at all alert", "Slightly alert", "Fairly alert", "Very alert"], [1, 2, 3, 4]) },
      { id: "meq6", q: "How hungry do you feel during the first half hour after you wake up?", type: "radio", options: opts(["Not at all hungry", "Slightly hungry", "Fairly hungry", "Very hungry"], [1, 2, 3, 4]) },
      { id: "meq7", q: "During the first half hour after you wake up in the morning, how do you feel?", type: "radio", options: opts(["Very tired", "Fairly tired", "Fairly refreshed", "Very refreshed"], [1, 2, 3, 4]) },
      { id: "meq8", q: "If you had no commitments the next day, what time would you go to bed compared to your usual bedtime?", type: "radio", options: opts(["Seldom or never later", "Less than 1 hour later", "1 to 2 hours later", "More than 2 hours later"], [4, 3, 2, 1]) },
      { id: "meq9", q: "You have decided to do physical exercise. A friend suggests one hour twice a week, and the best time for them is 7:00 to 8:00 AM. Considering only your own internal clock, how do you think you would perform?", type: "radio", options: opts(["Would be in good form", "Would be in reasonable form", "Would find it difficult", "Would find it very difficult"], [4, 3, 2, 1]) },
      { id: "meq10", q: "At approximately what time in the evening do you feel tired, and as a result in need of sleep?", type: "radio", options: opts(["8:00 to 9:00 PM", "9:00 to 10:15 PM", "10:15 PM to 12:45 AM", "12:45 to 2:00 AM", "2:00 to 3:00 AM"], [5, 4, 3, 2, 1]) },
      { id: "meq11", q: "You want to be at your peak for a test that will be mentally exhausting and last two hours. You are entirely free to plan your day. Considering only your internal clock, which testing time would you choose?", type: "radio", options: opts(["8:00 to 10:00 AM", "11:00 AM to 1:00 PM", "3:00 to 5:00 PM", "7:00 to 9:00 PM"], [6, 4, 2, 0]) },
      { id: "meq12", q: "If you went to bed at 11:00 PM, how tired would you be?", type: "radio", options: opts(["Not at all tired", "A little tired", "Fairly tired", "Very tired"], [0, 2, 3, 5]) },
      { id: "meq13", q: "For some reason you have gone to bed several hours later than usual, but there is no need to get up at any particular time the next morning. Which are you most likely to do?", type: "radio", options: opts(["Wake up at the usual time, but not fall back asleep", "Wake up at the usual time and doze after that", "Wake up at the usual time, but fall asleep again", "Not wake up until later than usual"], [4, 3, 2, 1]) },
      { id: "meq14", q: "One night you have to stay awake between 4:00 and 6:00 AM for a night watch. You have no commitments the next day. Which would suit you best?", type: "radio", options: opts(["Not go to bed until the watch is over", "Take a nap before and sleep after", "Take a good sleep before and a nap after", "Sleep only before the watch"], [1, 2, 3, 4]) },
      { id: "meq15", q: "You have two hours of hard physical work. You are entirely free to plan your day. Considering only your internal clock, which time would you choose?", type: "radio", options: opts(["8:00 to 10:00 AM", "11:00 AM to 1:00 PM", "3:00 to 5:00 PM", "7:00 to 9:00 PM"], [4, 3, 2, 1]) },
      { id: "meq16", q: "You have decided to do physical exercise. A friend suggests one hour twice a week, and the best time for them is 10:00 to 11:00 PM. Considering only your internal clock, how well do you think you would perform?", type: "radio", options: opts(["Would be in good form", "Would be in reasonable form", "Would find it difficult", "Would find it very difficult"], [1, 2, 3, 4]) },
      { id: "meq17", q: "Suppose you can choose your own work hours. You work a five-hour day (including breaks), the job is interesting, and you are paid by results. At approximately what time would you choose to begin?", type: "radio", options: opts(["Between 4:00 and 8:00 AM", "Between 8:00 and 9:00 AM", "Between 9:00 AM and 2:00 PM", "Between 2:00 and 5:00 PM", "Between 5:00 PM and 4:00 AM"], [5, 4, 3, 2, 1]) },
      { id: "meq18", q: "At approximately what time of day do you usually feel your best?", type: "radio", options: opts(["5:00 to 8:00 AM", "8:00 to 10:00 AM", "10:00 AM to 5:00 PM", "5:00 to 10:00 PM", "10:00 PM to 5:00 AM"], [5, 4, 3, 2, 1]) },
      { id: "meq19", q: "One hears about \"morning types\" and \"evening types.\" Which do you consider yourself to be?", type: "radio", options: opts(["Definitely a morning type", "More a morning type than an evening type", "More an evening type than a morning type", "Definitely an evening type"], [6, 4, 2, 0]) },
    ],
  },
  {
    key: "psqi", title: "Sleep quality over the past month",
    intro: "These questions are about your usual sleep habits during the past month only. Answer for the majority of days and nights in the past month.",
    items: [
      { id: "psqi1", q: "During the past month, what time have you usually gone to bed at night?", type: "time" },
      { id: "psqi2", q: "During the past month, how long (in minutes) has it usually taken you to fall asleep each night?", type: "number", min: 0, max: 600, unit: "minutes" },
      { id: "psqi3", q: "During the past month, what time have you usually gotten up in the morning?", type: "time" },
      { id: "psqi4", q: "During the past month, how many hours of actual sleep did you get at night? (This may be different from the time you spend in bed.)", type: "number", min: 0, max: 24, step: 0.25, unit: "hours" },
      { heading: "During the past month, how often have you had trouble sleeping because you..." },
      { id: "psqi5a", q: "Cannot get to sleep within 30 minutes", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5b", q: "Wake up in the middle of the night or early morning", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5c", q: "Have to get up to use the bathroom", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5d", q: "Cannot breathe comfortably", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5e", q: "Cough or snore loudly", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5f", q: "Feel too cold", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5g", q: "Feel too hot", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5h", q: "Had bad dreams", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5i", q: "Have pain", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi5j_text", q: "Any other reason? Please describe (optional)", type: "text" },
      { id: "psqi5j", q: "How often have you had trouble sleeping because of this other reason?", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { heading: "During the past month..." },
      { id: "psqi6", q: "How would you rate your sleep quality overall?", type: "radio", options: opts(["Very good", "Fairly good", "Fairly bad", "Very bad"], [0, 1, 2, 3]) },
      { id: "psqi7", q: "How often have you taken medicine to help you sleep (prescribed or over the counter)?", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi8", q: "How often have you had trouble staying awake while driving, eating meals, or engaging in social activity?", type: "radio", options: opts(FREQ, [0, 1, 2, 3]) },
      { id: "psqi9", q: "How much of a problem has it been for you to keep up enough enthusiasm to get things done?", type: "radio", options: opts(["No problem at all", "Only a very slight problem", "Somewhat of a problem", "A very big problem"], [0, 1, 2, 3]) },
    ],
  },
  {
    key: "history", title: "Work schedule history",
    intro: "Last section. These questions are about the schedules you have had to keep over your adult life.",
    items: [
      { id: "shift_years", q: "In total, how many years have you worked night shifts or rotating shifts? (Enter 0 if never.)", type: "number", min: 0, max: 60, unit: "years" },
      { heading: "In each decade of your adult life, what time did you usually have to wake up on weekdays?", note: "Leave blank any decade you have not reached yet." },
      { id: "wake_20s", q: "In your 20s", type: "time" },
      { id: "wake_30s", q: "In your 30s", type: "time" },
      { id: "wake_40s", q: "In your 40s", type: "time" },
      { id: "wake_50s", q: "In your 50s", type: "time" },
      { id: "wake_60s", q: "In your 60s", type: "time" },
      { id: "years_before_7", q: "In total, about how many years of your adult life have you had to be up before 7:00 AM on weekdays?", type: "number", min: 0, max: 70, unit: "years" },
      { id: "wake_change_12mo", q: "In the past 12 months, has the time you have to wake up on weekdays changed (for example a new job, retirement, or working from home)?", type: "radio", options: opts(["Yes", "No"]) },
      { id: "wake_change_detail", q: "If yes, what changed, and roughly when? (optional)", type: "text" },
    ],
  },
];

// ===== Scoring =====
function scoreMEQ(a) {
  let total = 0;
  for (let i = 1; i <= 19; i++) {
    const v = a["meq" + i];
    if (v === undefined || v === "") return { meq_total: "", meq_category: "" };
    total += Number(v);
  }
  let cat = "Neither type";
  if (total >= 70) cat = "Definite morning";
  else if (total >= 59) cat = "Moderate morning";
  else if (total <= 30) cat = "Definite evening";
  else if (total <= 41) cat = "Moderate evening";
  return { meq_total: total, meq_category: cat };
}

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function scorePSQI(a) {
  const n = (k) => (a[k] === undefined || a[k] === "" ? null : Number(a[k]));
  const out = {};
  // C1 subjective quality
  out.psqi_c1 = n("psqi6");
  // C2 latency
  const lat = n("psqi2"), q5a = n("psqi5a");
  if (lat !== null && q5a !== null) {
    const l = lat <= 15 ? 0 : lat <= 30 ? 1 : lat <= 60 ? 2 : 3;
    const s = l + q5a;
    out.psqi_c2 = s === 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : 3;
  } else out.psqi_c2 = null;
  // C3 duration
  const hrs = n("psqi4");
  out.psqi_c3 = hrs === null ? null : hrs >= 7 ? 0 : hrs >= 6 ? 1 : hrs >= 5 ? 2 : 3;
  // C4 efficiency
  const bed = toMinutes(a.psqi1), up = toMinutes(a.psqi3);
  if (hrs !== null && bed !== null && up !== null) {
    let inBed = up - bed; if (inBed <= 0) inBed += 1440;
    const eff = (hrs * 60 / inBed) * 100;
    out.psqi_efficiency_pct = Math.round(eff * 10) / 10;
    out.psqi_c4 = eff >= 85 ? 0 : eff >= 75 ? 1 : eff >= 65 ? 2 : 3;
  } else { out.psqi_c4 = null; out.psqi_efficiency_pct = ""; }
  // C5 disturbances (5b to 5j; 5j counts 0 if not answered, as in the standard scoring)
  const dist = ["psqi5b","psqi5c","psqi5d","psqi5e","psqi5f","psqi5g","psqi5h","psqi5i"].map(n);
  if (dist.some((v) => v === null)) out.psqi_c5 = null;
  else {
    const s = dist.reduce((x, y) => x + y, 0) + (n("psqi5j") || 0);
    out.psqi_c5 = s === 0 ? 0 : s <= 9 ? 1 : s <= 18 ? 2 : 3;
  }
  // C6 medication
  out.psqi_c6 = n("psqi7");
  // C7 daytime dysfunction
  const q8 = n("psqi8"), q9 = n("psqi9");
  if (q8 !== null && q9 !== null) { const s = q8 + q9; out.psqi_c7 = s === 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : 3; }
  else out.psqi_c7 = null;
  const comps = [1,2,3,4,5,6,7].map((i) => out["psqi_c" + i]);
  out.psqi_global = comps.some((c) => c === null) ? "" : comps.reduce((x, y) => x + y, 0);
  for (const k in out) if (out[k] === null) out[k] = "";
  return out;
}

// MCTQ: sleep-corrected mid-sleep on free days (MSFsc), as a clock time "HH:MM".
// Blank when it can't be computed (alarm on free days, no free days, or missing answers).
function computeMSFsc(a) {
  const t = (k) => toMinutes(a[k]);
  const num = (k) => (a[k] === "" || a[k] === undefined ? null : Number(a[k]));
  const wd = num("mctq_workdays");
  const need = [t("mctq_f_bed"), t("mctq_f_wake"), num("mctq_f_latency"), wd];
  if (need.some((v) => v === null) || a.mctq_f_alarm === "Yes" || wd >= 7) return { msfsc: "" };
  const mod = (x) => ((x % 1440) + 1440) % 1440;
  const soF = mod(t("mctq_f_bed") + num("mctq_f_latency"));
  const sdF = mod(t("mctq_f_wake") - soF);
  let msf = soF + sdF / 2;
  if (wd > 0) {
    if ([t("mctq_w_bed"), t("mctq_w_wake"), num("mctq_w_latency")].some((v) => v === null)) return { msfsc: "" };
    const soW = mod(t("mctq_w_bed") + num("mctq_w_latency"));
    const sdW = mod(t("mctq_w_wake") - soW);
    const sdWeek = (sdW * wd + sdF * (7 - wd)) / 7;
    if (sdF > sdW) msf -= (sdF - sdWeek) / 2;
  }
  const m = Math.round(mod(msf));
  return { msfsc: `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` };
}
