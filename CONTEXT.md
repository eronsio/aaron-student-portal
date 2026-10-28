# Aaron's Student Portal — Project Context

## What this is
A student-facing web portal at **aaron-learning.com**, hosted on **Cloudflare Pages**. Students log in to access Spanish/music lesson resources, a personal Google Drive folder, a course player, and (for Spanish students) an AI speaking companion. Aaron logs in via admin code to manage courses, students, and resources.

## Stack
- **Frontend:** Pure static HTML/CSS/JS — `index.html`, `styles.css`, `script.js`, plus `practice.js` (Speaking Practice; loaded after `script.js` and uses its globals)
- **Backend:** Supabase (no SDK — raw `fetch` calls against the REST/Auth APIs)
- **Hosting:** Cloudflare Pages (drag-and-drop or GitHub-connected auto-deploy)
- **Rich text editor:** Quill.js (CDN) used in the admin lesson editor
- **Icons:** Font Awesome 6 (CDN)

## Supabase
- **Project URL:** `https://leqbcbtlltvinizbkiya.supabase.co`
- **Anon key:** stored in `script.js` as `SUPABASE_KEY` (public/safe to commit)
- **Tables:**
  - `profiles` — id, name, type (spanish|music), drive_folder, this_week, email, phone, created_at
  - `courses_catalog` — stores course JSON blob (id=`catalog`, column=`data`)
  - `progress` — user_id, course_id, lesson_id (lesson completion tracking)
  - `conversations` — AI chat history per student
  - `student_insights` — AI-generated insight summaries per student
  - `student_focus`, `student_practice_profile`, `practice_sessions` — Speaking Practice (see below). Created by `supabase/speaking_practice.sql`

## Auth flow
- Students sign up with email/password (Supabase Auth) → email confirmation → profile created in `profiles`
- Session stored in localStorage (remember me, **ticked by default** since 2026-10-26) or sessionStorage; `navigator.storage.persist()` is requested at login
- Token refresh: on page load via `sbRefreshSession`, then every ~40 min while open and when the tab/phone wakes (`ensureFreshSession`). `sbRefreshSession`
  returns the new session, `{rejected:true}` (server says the login is over → sign out) or `{offline:true}` (no connection → KEEP the saved session and show
  "can't reach the server"; a network failure must never log anyone out). `loadUserFromSession` likewise keeps the session on a `TypeError` (network) failure.
- The sign-in and admin-code boxes are real `<form>`s (username/current-password autocomplete, a visually hidden username on the admin one) so browsers and
  password managers can save and fill them; Enter submits the form (no extra keydown handlers).
- Admin login: the admin signs in with their own account on the normal Sign In form (see the admin-access note below); the old shared admin code no longer exists
- Admin AI preview login is remembered too: a refresh token for the admin's own student account in localStorage `adminPreviewSession` (never the password),
  restored by `practiceAdminRestore()` and renewed once automatically if the AI proxy answers 401. It is cleared by "Sign out of preview" and Logout.
- Admin "View as student" (`enterStudentView`/`exitStudentView`/`renderStudentViewBar` in script.js): header dropdown, "View as" in the Students panel, and a
  bar with ‹ › arrows, a picker, "Edit profile" (opens the Students panel on that card) and "Back to admin". It swaps `currentUser` for a `isPreview` copy
  of the student in the same tab (the admin is kept in `adminReturnUser`); the student's AI tab is hidden in this view. The Students panel lists students as
  collapsed `<details>` rows (notes link / missing-email warnings at a glance) that expand to the edit form.
- **Admin access is a real login, not a shared secret** (2026-10-26). `supabase/admin_auth.sql` (APPLIED to the live database) adds `app_admins` (Aaron's account),
  `admin_ok(secret)` (true for a signed-in admin or the automation secret kept in the database — never for null/empty) and `am_i_admin()`, and rewrote all 18
  `admin_*` functions to call `admin_ok()` (this also fixed the old bug where a null secret got through). The portal asks `am_i_admin()` after every login; an admin
  gets the admin UI, and `sbRpc` sends the admin's own token with admin RPCs (an empty `ADMIN_SECRET` is passed because the functions still declare the parameter).
  There is no admin-code login any more (`ADMIN_CODE`, the admin form and the `adminLoggedIn` flag were removed). The only remaining secret is the database-held
  automation secret used by the hourly sync script (`admin_config`; rotate with `supabase/admin_rotate_automation_secret.sql`, then update the local scheduled task —
  never put it in the repo or the website). **Status: the old, leaked automation secret is still the live one until that rotation is run.**

## Key JS architecture
- No build step, no framework — vanilla JS
- `script.js` is ~3700 lines; all logic in one file
- Supabase client is hand-rolled (`_headers`, `sbSignIn`, `sbGetProfile`, etc.)
- Courses stored in Supabase (`courses_catalog`) with localStorage as fallback, then `defaultCourses` hardcoded in JS
- Resources (links, movies/TV) stored in localStorage under `spanishResources`; defaults in `sharedResources` object in JS
- Verb Conjugator (Resources tab, Spanish only): static lookup tool, not admin-editable. Verb data lives in `verbConjugations` (~75 verbs, hand-verified present/preterite/future); UI logic in `renderVerbConjugatorTool`/`onVerbSearchInput`/`selectVerbChip` in script.js
- Admin panel is the same `mainApp` div with a floating toolbar (`adminFloatingBar`) — no separate page

## Student types
- `spanish` — sees Courses tab, Resources tab (Spotify playlist + movie recommendations), Your Space, Community
- `music` — sees Resources (Coming Soon placeholder), Your Space, Community; no Courses tab

## Admin capabilities
- **Portal switch (header, admin only):** "Editing · Spanish portal | Music portal". The admin is a normal portal user with `isAdmin = true`
  and `type` = the portal showing (`activePortal()`, remembered in localStorage `adminPortal`, restored on reload). Branding, Courses grid,
  Resources, Students list and toolbar all follow it (Speaking Practice and Lesson Prep are hidden in Music). **Course data stays ONE shared
  list** (`saveCourses` splits it by subject), so the switch only filters what is shown (`renderCourseList`) — never filter `getCourses()`
  itself or a save would drop the other subject's courses. "Edit Resources" only edits Spanish; in Music it says so (music resources are a
  hardcoded placeholder in `sharedResources.music` until an editor + persistent storage exist). `Preview: Spanish/Music` still opens the exact student view.
- Edit Mode (inline WYSIWYG lesson editing)
- Course/lesson CRUD via modal editors with Quill rich text
- Import/Export course JSON
- Edit Resources tab (sections + movie list)
- Students & Insights overlay (view all students, generate AI insights per student, preview as student)
- Settings (reset courses, save Anthropic API key)

## AI Companion + Speaking Practice (Spanish students)
- **Chat UI v3** (2026-10-28, styles.css "AI PRACTICE CHAT — v3", scoped under `#ai-companion` with CSS variables `--ai-*`; replaced the card-style v2 after Aaron called it "gimmicky"):
  the design rule is quiet/editorial: a plain white page (`body.ai-chat-live`), ONE centred reading column (`--ai-gutter` pads header, messages and footer to 720px), hairlines instead of
  boxes/shadows, one ink colour + one blue accent. `.ai-header` = title (+ "Practising today" chips) and ghost icon buttons (⚙ voice settings popover, speaker mute, End session); `#aiChatMessages` = tutor text is PLAIN TEXT (no bubble, no avatar), student = soft grey bubble, corrections = a quiet inset with a blue "Correction" label, the "listen again"
  speaker is inline at the end of the last line and only shows on hover (always faint on touch), typing dots, "Preparing your session…" while it loads, smooth scroll only when already at the bottom,
  a short fade under the header; `.ai-footer` = help words (Hint · Explain in English · Say it simpler: plain hairline pills, hidden while recording), the voice call panel / record bar and
  the composer (a floating rounded bar: ＋ activity menu, auto-growing `<textarea>` — Enter sends, Shift+Enter = new line, Send disabled until there is text — mic, send). Popovers
  (`.ai-popover`) close on outside click/Escape. Built by `ensureAiExtras()`; static markup in index.html. Don't use `<header>`/`<footer>` tags inside it (global `footer { margin-top: 48px }`
  leaked in). Phones: the portal header is hidden, the shell fills the screen (`100dvh`, or `--vvh` while the iPhone keyboard is open), "End session" shortens to "End". Respects `prefers-reduced-motion`.
  The portal's tab row (`.tab-nav`/`.tab-btn`, top of styles.css) is now a quiet underline row for EVERY tab (the old per-tab pastel tints are gone); on a phone it scrolls sideways and `showTab` scrolls
  the chosen tab into view. On phones the tabs are text-only and the practice tab reads "Practice" (`.tab-long`/`.tab-short`, set up at the top of showTab in script.js) so all four fit without scrolling; the chat messages sit against the composer (`.ai-chat-messages > :first-child { margin-top: auto }`).
- **One shell for every tab + the admin hub** (2026-10-28; Aaron: "the AI chat switches to a different window entirely… I need to see the UI as my students see it"):
  the practice tab is a normal tab. Same header, same tab row, same white card (on phones: no card, content sits on the white page for ALL tabs, tabs are text-only and
  the practice tab reads "Practice", header is one slim row: title + Logout). `body.on-ai-tab` (set in `syncAiChatClass`) turns `#mainApp` into a full-height flex column
  (`position: fixed; top: var(--vvtop); height: var(--vvh)`) so the app is PINNED to the visual viewport: when the iPhone keyboard opens (or iOS pans the viewport to reveal the focused field) the message box stays right above the keyboard. Nothing scrolls the page (an earlier `window.scrollTo(0,0)` fought iOS's own scrolling). The card takes whatever is left and the messages scroll inside it — no magic heights. The admin's controls are NOT in the page any more: the header gets one small gear (`#adminGearBtn`, next to Logout; amber dot while viewing as a
  student) that opens `#adminHub` (script.js "Admin hub"): View the portal (Spanish/Music switch + "View as student" select), Practise as (AI chat preview, rendered by practice.js
  `renderAiAdminBar`), Tools (the old `#adminMenuDropdown`, moved into the hub by `ensureAdminHub`), and, while viewing as a student, ‹ student › / Edit profile / Back to admin
  (`renderStudentViewBar`). The old floating tools button is hidden by CSS, the dark "viewing as" bar is gone. Closed by default; ✕ / outside tap / Escape / picking something closes it.
  Signed-out admin (no AI preview login) still gets the inline sign-in bar at the top of the practice tab (`#aiAdminBar`).
- **No activity menu** (changed 2026-10-26): opening the Speaking & Writing Practice tab goes straight into the chat (`initAiCompanion` → `startAiChat`): the
  student's personalised practice plan if they have one (mode `plan`), otherwise free conversation (mode `free`). A chat that is already open is left alone
  when the student switches tabs and comes back. Roleplay / picture description / grammar drills are no longer separate screens: the AI switches activity
  when asked (`PRACTICE_ACTIVITIES_RULE` in practice.js) and the chip row under the chat (🎯 My plan [only with a plan] · 🎭 Roleplay · 🖼️ Describe a
  picture · 📚 Grammar drill · 💬 Free chat) just sends a message (`sendAiActivity`, recorded like a help request: not graded). "End session" → recap (or a
  short "Session ended" card) → "Practice again" starts a fresh chat. Admin: the preview sign-in bar comes first; the chat starts after sign-in, and
  choosing "Practise as <student>" restarts it with that student's plan. The admin reaches everything through the header gear / admin hub (see "One shell for every tab").
- Calls Anthropic API via a Supabase Edge Function `ai-companion` (key stored server-side as the
  `ANTHROPIC_API_KEY` secret, never sent to the browser). The function verifies the caller's Supabase
  JWT via `/auth/v1/user` before proxying to Anthropic — see `supabase/functions/ai-companion/index.ts`.
  Chat turns and the end-of-session report (`task: "report"`) use `claude-sonnet-5` with reasoning switched
  off, falling back to Haiku 4.5 if it errors or returns nothing. Chat replies are capped at 300 tokens, reports
  at 3500. (A live comparison showed Haiku praising "Me gustan correr y nadar"; Sonnet corrects it.)
  Per-student rate limit (best-effort, in the function instance's memory): chat 30/min + 600/day, reports 10/hour; over the limit
  the function answers 429 with a Spanish "Vas muy rápido…" message.
- **Voice notes (the default mic, 2026-10-28)**: tap the mic → the composer is replaced by a recording bar (✕ cancel, red dot + timer + level bars, Send); tap Send (or the
  mic again) and the note is transcribed and sent automatically (`submitAiMessage(text, {voice:true})`, bubble gets a mic tag), the reply is read aloud and the mic does NOT
  start listening again. Code: `note` state object, `micPress`, `noteStart`/`noteSend`/`noteAbort`/`noteOpenMic`/`noteCloseMic` (script.js, just above the hands-free
  section). Notes under `NOTE_MIN_MS` (600 ms) are refused with a toast, notes stop at `NOTE_MAX_MS` (60 s). The mic stays open 45 s after a note so the next one starts
  instantly, then is released (also on backgrounding / leaving the chat). Same two engines as below (server `ai-transcribe` preferred, browser recognizer fallback).
  The **hands-free conversation** described next is now an opt-in beta (⚙ → "Hands-free conversation (beta)", `noteHandsFree()`): with it on, the mic button runs `convoToggle`.
- iPhone keyboard: a `visualViewport` listener sets `--vvh` and `body.kb-open`, so the chat shrinks to the visible area instead of being pushed off-screen.
- **Voice conversation** (script.js "VOICE CONVERSATION" section, hands-free beta): the student taps the mic once and just talks, like a voice call. While it is on, a **call panel**
  (orb that swells with their voice, state text, live caption, Type / End buttons) replaces the text box — nothing is typed into a box. Each finished sentence is
  sent by itself (`submitAiMessage(text, {voice:true})`), the reply is read aloud, and the mic listens again. Tap the circle while the AI talks = cut it off and
  answer; Type = stop and type; End = stop. Two engines with the same behaviour:
  * **server** (preferred, `convoServerOk()`): the microphone is opened ONCE for the whole conversation (`getUserMedia` + a ScriptProcessor), speech start/end is
    found by volume (adaptive noise floor, ~0.4 s pre-roll so the first word isn't clipped, ends after `CONVO_SILENCE_MS` of quiet), each utterance is encoded as a
    16 kHz mono WAV and POSTed to the **`ai-transcribe`** Edge Function (ElevenLabs Scribe, secret `ELEVENLABS_API_KEY` which needs **Speech to Text access**; optional
    `ELEVENLABS_STT_MODEL`, default `scribe_v2`; 30/min + 800/day per student). Works in Firefox and on iPhone (no SpeechRecognition needed) and never has to
    re-open the mic between turns (the old browser recognizer failed with "no microphone found" after the first reply).
  * **browser** (fallback): the browser's `SpeechRecognition`. Used when `ai-transcribe` fails (503 not set up / 502 no permission / network): `convoFallbackToBrowser()`
    switches over for 30 min (`sttServerUntil`). It rebuilds the sentence from all results each time (no doubled text), shows it in the panel, waits ≥0.7 s between
    recognizers and retries `audio-capture` up to 3 times before giving up.
  Hardening (2026-10-26, after "mic still very glitchy"): `convoToggle` opens the mic AND probes `ai-transcribe` with a 0.4 s silent WAV at the same time
  (`convoProbeServer`, cached 20 min): if the transcriber is unusable (e.g. the ElevenLabs key lacks Speech to Text) it starts on the browser recognizer straight away instead
  of losing the first sentence, and the panel says "Basic recognition (your browser)". Speech detection is relative to the room, not fixed volume limits: it tracks the
  quietest recent level (`floor`), starts at ~3.2x that, and ends when the level falls below max(1.9x floor, 18% of the speaker's own loudness) for `CONVO_SILENCE_MS`
  (so a quiet laptop mic and a noisy room both work). Quiet recordings are lifted up to 10x before upload. Tapping the circle while it is hearing you sends immediately.
  The panel has a live level meter and, after 7 s of silence, "I can't hear you…". ⚙ → "Copy diagnostics" copies a text report (engine, mic label, permission state,
  thresholds, last ~80 events from `convoLog`) to paste into a bug report.
  The conversation pauses itself after ~25 s of silence, on errors, when the page is hidden, on tab switch or when leaving the chat. `speakText()` returns a promise that
  resolves when playback ends (that is what reopens the mic; a length-based timeout stops a browser that never reports the end from hanging it). Voice turns get
  `PRACTICE_VOICE_RULE` (practice.js) and are flagged `voice` in the saved transcript. Mic permission refused → alert; no device → "No microphone found".
- Reading replies aloud: **natural voice** from the `ai-speak` Edge Function (ElevenLabs behind the same student-JWT check and a per-student rate
  limit; secrets `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL`; clips are cached client-side per text+pace), with the
  browser's `speechSynthesis` as the automatic fallback whenever the function is missing/unconfigured (503/404 backs off 30 min), errors, times out
  (10 s) or autoplay is blocked. Browser-voice path: `ttsCleanText` (strips emoji/dashes/markup/[notes]), `ttsLooksEnglish` (English help is read by
  an English voice), `ttsPickVoice` ranking (skips macOS novelty voices) and a "Voice" dropdown remembered in localStorage (`aiTtsVoice`).
- Portal-wide safety/polish (2026-10-23): `driveLinkFor()` turns a bare Drive ID into a folder URL for the student "materials" button; names and
  notes are escaped before going into pages; `saveCourses` refuses to save (and says why) if a subject's course list failed to load or the server
  rejects the save, and shows a "Saved" toast on success; the floating Book button hides while the AI chat is open (`syncAiChatClass`).
- Admin-only insight generation (`generateInsightForStudent`/`generateAllInsights`, Students & Insights
  panel) still calls Anthropic directly from the browser using the key saved in Admin → Settings — that's
  fine since only Aaron ever triggers it, in his own browser

### Speaking Practice (practice.js)
Ties the companion to each student's lesson notes and reports back to Aaron.
- **Focus areas** (`student_focus`): a short list per student of what they keep getting wrong (area, detail,
  wrong→right examples, priority 1-3, status active/improving/resolved). Written by Aaron in the admin panel or
  by the lesson-notes automation (upsert by `(user_id, key)` via `admin_upsert_focus`).
- **Per student on/off** (`student_practice_profile`): `enabled`, `level`, `ai_notes` (instructions to the AI;
  the student's browser can read these). The **Speaking & Writing Practice tab only appears for Spanish students
  with `enabled = true`** (`practiceMaybeShowTab`). No row = tab hidden.
- **Each session** picks the 1-2 most overdue focus areas (`practicePickTargets`: priority + staleness) and adds a
  teacher's-plan block to the system prompt (`buildAISystemPrompt` lives in practice.js, not script.js). In other
  modes the targets are woven in lightly.
- **Sessions** (`practice_sessions`): transcript with voice/typed flags is saved each turn. On "End session" (>= 2 student
  turns) the proxy produces a JSON report (per-focus verdict, new issues, vocab gaps, next-lesson suggestions, a
  student-facing recap). Students can insert/update only their own rows and cannot set `reviewed_at`.
- **Chat features (script.js / practice.js):** corrections arrive as `[✓ full corrected sentence — reason]` and render as highlighted
  callouts (`practiceFormatReply` escapes everything, renders **bold**); a replay button on each reply and a Slow switch (TTS); the mic works by
  tap-to-start/tap-to-stop or press-and-hold (`micPress`/`micRelease`); Hint / Explain in English / Say it simpler buttons send help requests
  that are saved with `help: true` and are never graded or counted as attempts; a plan session opens by referring to the last analysed session
  (`practiceLastSessionNote`); one question at a time (`aiBusy`) with a 45 s request timeout. Prompt rules 11-15 in `PRACTICE_BASE_RULES`
  (plain text, check before praising, full corrected sentence + max two corrections, ask when ambiguous, help-message exception).
- **Admin preview of the student tool:** in the admin's Spanish portal the Speaking & Writing Practice tab is shown (hidden in the Music portal).
  The proxy only answers real signed-in users, so the admin signs in once with their own student account (`practiceAdminSignIn`, token kept in
  memory only) and picks "Practise as <student>": that student's focus areas / level / notes / last session are loaded through the admin RPCs
  (`practiceLoadAdminPreviewContext`) and drive the session. The recap and teacher report still run, but NOTHING is written to the database
  (`practiceActive()` stays false for the admin; `saveConversationTurn`/`loadStudentInsight` skip the admin).
- **Admin → Speaking Practice**: digest of unreviewed sessions per student, focus-area editor, level/instructions/on-off,
  session transcripts, "+ Add to focus" for AI-spotted issues, "Analyze now" (uses the API key in Settings) for sessions
  never analysed. Everything rendered from the database is escaped.
- Degrades to the old behaviour when the tables don't exist yet (tab stays hidden, no errors).
- Setup: run `supabase/speaking_practice.sql` once in the Supabase SQL editor, deploy the `ai-companion` function with the
  `ANTHROPIC_API_KEY` secret, then enable students in Admin → Speaking Practice.

## Home-screen app (PWA, no App Store)
- `manifest.webmanifest` + `icons/` (192, 512, maskable 512, `apple-touch-icon` 180 — a white graduation cap on #1a1a1a; regenerate by redrawing, they are plain PNGs) and the iOS meta tags in `index.html`'s `<head>`.
  iPhone students open the site in Safari → Share → Add to Home Screen; it then opens full-screen with its own icon (name "Aaron Learning").
- `maybeShowInstallTip()` (script.js, called from `showMainApp`) shows a one-time dismissible hint to iPhone/iPad students who haven't installed it
  (never for the admin, never inside the installed app; dismissal remembered in localStorage `installTipDismissed`).
- Deliberately NO service worker: iOS doesn't need one to install, and a caching worker would risk serving stale `script.js` after deploys. So no offline mode.
- Not verified on a physical iPhone (no simulator here): check that voice input (Web Speech) works inside the installed app. The installed app has its own storage, so students sign in again there.

## Updates reach open copies (added 2026-10-26)
- A home-screen app (iPhone) or a long-open tab keeps running the JS it loaded, sometimes for days, and a student cannot hard-refresh an installed app. So the page loads `build.js`
  (`window.APP_BUILD`) and every 15 min / on resume fetches `version.json` fresh; if they differ it shows an "A new version of the portal is ready — Update / Later" banner
  (`checkForUpdate` / `showUpdateBanner` in script.js; nothing reloads by itself, so nobody loses a half-written message or an unsaved course edit).
- **Before committing a release of site files run `scripts/stamp-build.sh`** (rewrites `build.js` and `version.json` with a new stamp) and commit those two files with the change.
  Forgetting only means open copies don't get the banner. (A git pre-commit hook for this was refused by the safety checks, so it is a manual step.)
- A copy that predates this mechanism has no banner: it must be closed completely (iPhone: swipe up, flick the app away) and reopened once.

## Deployment
- **Current:** drag-and-drop zip into Cloudflare Pages dashboard
- **Goal:** GitHub repo connected to Cloudflare Pages for auto-deploy on `git push`
- **Repo:** to be created at `github.com/aaronsiebertsio/aaron-student-portal` (or similar)

## Calendly
- Floating "Book Your Next Lesson" button links to `https://calendly.com/aaronsiebertsio/lesson`

## Important constants in script.js
| Constant | Value | Purpose |
|---|---|---|
| `ADMIN_SECRET` | `''` (empty) | Admin RPCs are authorised by the signed-in admin's token; the parameter is only kept because the SQL functions declare it |
| `SESSION_STORE` | `aaron_portal_session` | localStorage key for session |

## Working with this codebase
- All three files must be deployed together — no build step needed
- Changes to courses via admin panel are saved to Supabase automatically
- Changes to resources are saved to localStorage (per-browser) — use the Resources Editor in admin to update, then the changes need to be pushed to Supabase or baked into `sharedResources` in JS for all users to see them
- To add a new student type: add a branch in `showMainApp()`, `populateResources()`, and `sharedResources`
