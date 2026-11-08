// ===== Cognitive tests =====
// Timings, trial counts and scoring are copied exactly from the Wave 1 test bank so the
// scores stay comparable. Each test calls done(result) when it finishes.

const T = {
  STUDY_MS: 3000, ANSWER_TIME_LIMIT: 8000,             // memory
  STROOP_SECONDS: 45, STROOP_COLORS: ["red", "blue", "green", "yellow"],
  DSS_START_LEN: 3, DSS_MAX_LEN: 9, DSS_TRIALS_PER_LEN: 2, DSS_DISPLAY_MS: 1000, DSS_GAP_MS: 600, DSS_INTER_TRIAL_MS: 1500, DSS_ANSWER_MS: 5000,
  RT_TRIALS: 20,
};

const TEST_INFO = {
  memory: { name: "Memory Test", title: "Memory Test Instructions",
    body: "You will study 12 word pairs, each shown for 3 seconds. Then you will be asked to recall the matching word for each cue. This repeats for 3 rounds. You have 8 seconds per answer." },
  stroop: { name: "Stroop Task", title: "Stroop Task Instructions",
    body: "Words will appear in colored ink. Press the key matching the INK COLOR, not the word itself. Keys: R = Red, B = Blue, G = Green, Y = Yellow. You have 45 seconds per phase (congruent then incongruent)." },
  digitspan: { name: "Digit Span Sequencing", title: "Digit Span Sequencing Instructions",
    body: "A sequence of digits will appear one at a time. After the sequence ends, type the digits back in ascending (smallest to largest) order. Sequences get longer as you succeed. You have 5 seconds to respond." },
  rt: { name: "Reaction Time Test", title: "Reaction Time Instructions",
    body: "A pink ball will appear at random intervals inside a white box. Press SPACE as quickly as possible when you see it. There are 20 trials. Do not press before the ball appears." },
};
const TEST_ORDER = ["memory", "stroop", "digitspan", "rt"];

const Tests = (() => {
  const app = () => document.getElementById("app");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = (s) => (s || "").trim().toLowerCase();
  let cleanup = [];
  const on = (el, ev, fn) => { el.addEventListener(ev, fn); cleanup.push(() => el.removeEventListener(ev, fn)); };
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  function reset() { cleanup.forEach((f) => f()); cleanup = []; timers.forEach(clearTimeout); timers.length = 0; }

  function instructions(key, start) {
    reset();
    const info = TEST_INFO[key];
    app().innerHTML = `<section class="card test-card">
      <h1>${info.title}</h1><p class="lead">${info.body}</p>
      <button class="btn primary" id="begin">Begin Test</button></section>`;
    document.getElementById("begin").onclick = start;
  }

  // ---------- Memory ----------
  function memory(wordset, done) {
    instructions("memory", () => {
      let pairs = wordset.map(([l, r]) => [l, r]);
      const scores = [];
      const studyPhase = (round) => new Promise((resolve) => {
        pairs = shuffle(pairs);
        app().innerHTML = `<section class="card test-card running">
          <h2>Study the pairs — Round ${round} of 3</h2>
          <p class="muted">Each pair appears for 3 seconds. Focus on the associations.</p>
          <div class="study-pair"><div class="pair-word" id="pl"></div><div class="pair-div">—</div><div class="pair-word" id="pr"></div></div>
          <div class="mini-progress"><div id="mp"></div></div></section>`;
        let i = 0;
        const show = () => {
          document.getElementById("pl").textContent = pairs[i][0];
          document.getElementById("pr").textContent = pairs[i][1];
          document.getElementById("mp").style.width = `${(i / pairs.length) * 100}%`;
        };
        show();
        const step = () => { i++; if (i >= pairs.length) return resolve(); show(); later(step, T.STUDY_MS); };
        later(step, T.STUDY_MS);
      });
      const recallPhase = (round) => new Promise((resolve) => {
        const order = shuffle(pairs.map((_, k) => k));
        let idx = 0, correct = 0, timer = null;
        const next = () => {
          if (timer) clearTimeout(timer);
          if (idx >= order.length) return resolve(correct);
          const [cue, target] = pairs[order[idx]];
          app().innerHTML = `<section class="card test-card running">
            <h2>Round ${round} of 3</h2>
            <p class="muted">Type the matching word for each cue. Complete all 12 inputs.</p>
            <div class="round-item"><div class="cue">${cue}</div>
            <input id="ans" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type the matching word" /></div>
            <div class="controls"><button class="btn" id="sub">Submit Answer</button></div>
            <p class="muted small">${idx + 1} / ${order.length}</p></section>`;
          const inp = document.getElementById("ans");
          inp.focus();
          const submit = () => { if (norm(inp.value) === norm(target)) correct++; idx++; next(); };
          inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
          document.getElementById("sub").onclick = submit;
          timer = later(() => { idx++; next(); }, T.ANSWER_TIME_LIMIT);
        };
        next();
      });
      (async () => {
        for (let r = 1; r <= 3; r++) { await studyPhase(r); scores.push(await recallPhase(r)); }
        reset();
        done({ memory_r1: scores[0], memory_r2: scores[1], memory_r3: scores[2], memory_total: scores[0] + scores[1] + scores[2] });
      })();
    });
  }

  // ---------- Stroop ----------
  function stroop(done) {
    const res = { stroop_congruent: 0, stroop_incongruent: 0, stroop_cong_responses: 0, stroop_incong_responses: 0, stroop_key_presses: 0, stroop_clicks: 0 };
    const phase = (type) => new Promise((resolve) => {
      reset();
      app().innerHTML = `<section class="card test-card running">
        <h2>Stroop Task</h2><p class="muted">Press the key that matches the INK COLOR.</p>
        <div class="stroop-stage"><div id="sw" class="stroop-word">READY</div></div>
        <p class="muted small">Keys: R = Red, B = Blue, G = Green, Y = Yellow</p>
        <div class="stroop-buttons">
          <button class="stroop-btn" data-color="red" style="background:red;color:white;">Red</button>
          <button class="stroop-btn" data-color="blue" style="background:blue;color:white;">Blue</button>
          <button class="stroop-btn" data-color="green" style="background:green;color:white;">Green</button>
          <button class="stroop-btn" data-color="yellow" style="background:yellow;color:black;">Yellow</button>
        </div>
        <p class="muted small" id="st">Time left: ${T.STROOP_SECONDS}s</p>
        <p class="muted small" id="sc">Correct: 0</p></section>`;
      const sw = document.getElementById("sw");
      let current = "", left = T.STROOP_SECONDS, correct = 0, responses = 0, finished = false;
      const trial = () => {
        const word = T.STROOP_COLORS[Math.floor(Math.random() * 4)];
        let ink = word;
        if (type === "incongruent") { const others = T.STROOP_COLORS.filter((c) => c !== word); ink = others[Math.floor(Math.random() * others.length)]; }
        sw.textContent = word.toUpperCase(); sw.style.color = ink; current = ink;
      };
      const answer = (chosen, via) => {
        if (finished || !current) return;
        responses++; res[via]++;
        if (chosen === current) { correct++; document.getElementById("sc").textContent = "Correct: " + correct; }
        trial();
      };
      on(document, "keydown", (e) => {
        const k = e.key.toLowerCase(); const map = { r: "red", b: "blue", g: "green", y: "yellow" };
        if (map[k]) answer(map[k], "stroop_key_presses");
      });
      document.querySelectorAll(".stroop-btn").forEach((b) => on(b, "click", () => answer(b.dataset.color, "stroop_clicks")));
      const iv = setInterval(() => {
        left--; document.getElementById("st").textContent = "Time left: " + left + "s";
        if (left <= 0) { clearInterval(iv); finished = true; resolve({ correct, responses }); }
      }, 1000);
      cleanup.push(() => clearInterval(iv));
      trial();
    });
    instructions("stroop", async () => {
      const c = await phase("congruent");
      res.stroop_congruent = c.correct; res.stroop_cong_responses = c.responses;
      reset();
      await new Promise((resolve) => {
        app().innerHTML = `<section class="card test-card running center"><h2>Incongruent Phase Starting</h2>
          <p class="muted">Press continue when you're ready.</p><button class="btn primary" id="cont">Continue</button></section>`;
        document.getElementById("cont").onclick = resolve;
      });
      const i = await phase("incongruent");
      res.stroop_incongruent = i.correct; res.stroop_incong_responses = i.responses;
      reset();
      done(res);
    });
  }

  // ---------- Digit span sequencing ----------
  function digitspan(done) {
    instructions("digitspan", () => {
      let len = T.DSS_START_LEN, trialCount = 0, failsAtLen = 0, best = 0, trials = 0;
      app().innerHTML = `<section class="card test-card running center">
        <h2>Digit Span Sequencing</h2>
        <div id="dd" class="digit-display">READY</div>
        <input id="di" type="text" inputmode="numeric" autocomplete="off" placeholder="Type digits in ascending order" />
        <div class="controls"><button id="ds" class="btn primary">Submit</button></div>
        <div id="dsc" class="muted">Best: 0</div></section>`;
      const dd = document.getElementById("dd"), di = document.getElementById("di"), ds = document.getElementById("ds");
      let seq = [], showing = false, answerTimer = null;
      const finish = () => { reset(); done({ digit_span: best, digit_span_trials: trials }); };
      const runTrial = async () => {
        di.value = ""; di.disabled = true; ds.disabled = true;
        document.getElementById("dsc").textContent = `Best: ${best}`;
        seq = Array.from({ length: len }, () => Math.floor(Math.random() * 9) + 1);
        showing = true; dd.textContent = "";
        for (const d of seq) { dd.textContent = d; await sleep(T.DSS_DISPLAY_MS); dd.textContent = ""; await sleep(T.DSS_GAP_MS); }
        dd.textContent = "NOW"; showing = false;
        di.disabled = false; ds.disabled = false; di.focus();
        answerTimer = later(submit, T.DSS_ANSWER_MS);
      };
      const submit = () => {
        if (answerTimer) clearTimeout(answerTimer);
        if (showing) return;
        trials++;
        const raw = di.value.replace(/\s+/g, "");
        const user = raw ? raw.split("").map(Number).filter((x) => !isNaN(x)) : [];
        const correct = [...seq].sort((a, b) => a - b);
        const ok = user.length > 0 && user.length === correct.length && user.every((x, i) => x === correct[i]);
        if (ok) { best = Math.max(best, len); trialCount++; failsAtLen = 0; if (trialCount >= T.DSS_TRIALS_PER_LEN) { len++; trialCount = 0; failsAtLen = 0; } }
        else { failsAtLen++; trialCount++; if (trialCount >= T.DSS_TRIALS_PER_LEN) { if (failsAtLen >= T.DSS_TRIALS_PER_LEN) return finish(); trialCount = 0; failsAtLen = 0; } }
        if (len > T.DSS_MAX_LEN) return finish();
        di.disabled = true; ds.disabled = true; dd.textContent = "Get ready…";
        later(runTrial, T.DSS_INTER_TRIAL_MS);
      };
      ds.onclick = submit;
      di.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
      runTrial();
    });
  }

  // ---------- Reaction time ----------
  function rt(done) {
    instructions("rt", () => {
      app().innerHTML = `<section class="card test-card running">
        <h2>Reaction Time Test</h2><p class="muted">Press SPACE whenever you see the pink ball.</p>
        <div id="rta"><div id="rtb"></div></div>
        <p class="muted small" id="rtc">Trial: 1 / ${T.RT_TRIALS}</p></section>`;
      const ball = document.getElementById("rtb");
      const times = []; let trial = 0, start = 0, hideT = null, early = 0, keys = 0, clicks = 0, visible = false;
      const finish = () => {
        reset();
        const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        done({ reaction_time_ms: avg, rt_responses: times.length, rt_misses: T.RT_TRIALS - times.length, rt_early_presses: early, rt_key_presses: keys, rt_clicks: clicks });
      };
      const nextTrial = () => {
        visible = false; ball.style.display = "none";
        document.getElementById("rtc").textContent = `Trial: ${trial + 1} / ${T.RT_TRIALS}`;
        later(show, 3000 + Math.random() * 500);
      };
      const show = () => {
        ball.style.display = "block"; visible = true; start = performance.now();
        hideT = later(() => { if (visible) { visible = false; ball.style.display = "none"; trial++; trial < T.RT_TRIALS ? nextTrial() : finish(); } }, 3000 + Math.random() * 500);
      };
      const hit = (via) => {
        if (!visible) { early++; return; }
        times.push(performance.now() - start); via === "key" ? keys++ : clicks++;
        visible = false; ball.style.display = "none"; clearTimeout(hideT);
        trial++; trial < T.RT_TRIALS ? nextTrial() : finish();
      };
      on(document, "keydown", (e) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); hit("key"); } });
      on(ball, "click", () => hit("click"));
      nextTrial();
    });
  }

  return { memory, stroop, digitspan, rt, reset };
})();
