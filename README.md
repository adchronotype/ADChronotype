# ADChronotype Wave 2 site

Files:
- `index.html`, `style.css`: the page
- `config.js`: settings (backend URL, ages, contact names). **The only file you normally edit.**
- `content.js`: consent text, questionnaire, MEQ and PSQI scoring, the three new word sets
- `tests.js`: the four cognitive tests (same timings and scoring as Wave 1)
- `app.js`: the flow (sign-up, login codes, questionnaire, My answers and editing, weekly sessions)
- `Code.gs`: the Google Sheet backend

Without a backend URL the site runs in **demo mode**: everything stays in your browser, so you can click through it safely.

## 1. Set up the Google Sheet (about 5 minutes)

1. Sign in to **adchronotype@gmail.com** and make a new Google Sheet there. Login codes are emailed from whichever account owns the script, so using the study account keeps your personal email private. Name it "ADC Wave 2 Data".
2. Extensions → Apps Script. Delete what's there, paste all of `Code.gs`, and save.
3. Deploy → New deployment → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, then approve the permissions (it needs Sheets and Gmail).
4. Copy the web app URL (ends in `/exec`) and paste it into `API_URL` in `config.js`.
5. Optional but recommended: make a tab called `Wave1IDs`, put `id` in cell A1, and paste every Wave 1 participant ID below it. Then returning participants must enter a real Wave 1 ID. If you skip this, any number is accepted.

The other tabs (`Responses`, `MEQ`, `PSQI`, `MCTQ`, `Tests`, `Edits`, `Log`) are created automatically the first time they're needed. New columns are added automatically too.

If you change `Code.gs` later: Deploy → Manage deployments → edit → Version: New version. (A brand-new deployment gives a new URL.)

## 2. Fill in `config.js`

- `API_URL`: from step 1
- `SPONSOR_NAME`, `SPONSOR_EMAIL`: your Adult Sponsor (shown on the consent page)

## 3. Put it online (GitHub Pages)

1. New public GitHub repo, upload all the files except `Code.gs` and `README.md`.
2. Settings → Pages → Branch: `main`, folder `/ (root)` → Save.
3. The site appears at `https://<your-username>.github.io/<repo-name>/` after a minute.

## How it works for participants

- **New**: age check (40 to 61) → consent → email → gets a 6-digit login code (shown on screen and emailed) → questionnaire (5 parts, works on a phone) → weekly sleep questions → 4 tests.
- **Took part last year**: enters their old participant ID → consent → email → code. Same flow after that.
- **Log in**: with the 6-digit code, on any device. "Forgot your code?" emails it to them (typing an email never logs anyone in).
- **My answers**: side panel on a computer, a button in the header on a phone. They can edit answers until week 1's tests are done; every change is logged.
- **Phones**: the questionnaire works; the tests show a "switch to a computer" screen with their code.
- **Weeks 2 and 3** open 6 days after the previous week is finished.

## What's in the Sheet

- `Responses`: one row per person. returning Y/N, old ID, email, code, registration number (5001, 5002, ...), consent time, the simple answers, then **MEQ**, **PSQI** and **MCTQ (MSFsc)** results. Click one of those three to jump to that person's full answers in its own tab. Then each week's sleep answers, test scores and completion time.
- `MEQ`, `PSQI`, `MCTQ`: every answer, one row per person (matched by registration number).
- `Tests`: one row per finished test with every detail (rounds, misses, keyboard vs click, device, local time and timezone).
- `Edits`: registration number, time, section, question, original answer, new answer.
- `Log`: raw copy of everything received. Don't edit it; it's the backup.
- No SJV, CSS, ICV or other analysis numbers here. Those go in your separate analysis sheet.
- When the study closes, delete the `email` column.

## Check before launch

- The MEQ items and scoring key in `content.js` follow the standard Horne and Östberg version; check them against your published copy.
- The PSQI is copyrighted by the University of Pittsburgh but free for non-commercial research; cite Buysse et al. (1989).
- The ethnicity options: match them to what Wave 1 used so the two waves line up.
