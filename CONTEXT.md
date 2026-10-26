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
- Admin login: code `ADMIN-AARON` entered at the login screen (no Supabase auth, just a localStorage flag `adminLoggedIn`, restored on every load)
- Admin AI preview login is remembered too: a refresh token for the admin's own student account in localStorage `adminPreviewSession` (never the password),
  restored by `practiceAdminRestore()` and renewed once automatically if the AI proxy answers 401. It is cleared by "Sign out of preview" and Logout.
- Admin "View as student" (`enterStudentView`/`exitStudentView`/`renderStudentViewBar` in script.js): header dropdown, "View as" in the Students panel, and a
  bar with ‹ › arrows, a picker, "Edit profile" (opens the Students panel on that card) and "Back to admin". It swaps `currentUser` for a `isPreview` copy
  of the student in the same tab (the admin is kept in `adminReturnUser`); the student's AI tab is hidden in this view. The Students panel lists students as
  collapsed `<details>` rows (notes link / missing-email warnings at a glance) that expand to the edit form.
- Admin secret for RPC calls: `AARON-ADMIN-2025`

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
- **No activity menu** (changed 2026-10-26): opening the Speaking & Writing Practice tab goes straight into the chat (`initAiCompanion` → `startAiChat`): the
  student's personalised practice plan if they have one (mode `plan`), otherwise free conversation (mode `free`). A chat that is already open is left alone
  when the student switches tabs and comes back. Roleplay / picture description / grammar drills are no longer separate screens: the AI switches activity
  when asked (`PRACTICE_ACTIVITIES_RULE` in practice.js) and the chip row under the chat (🎯 My plan [only with a plan] · 🎭 Roleplay · 🖼️ Describe a
  picture · 📚 Grammar drill · 💬 Free chat) just sends a message (`sendAiActivity`, recorded like a help request: not graded). "End session" → recap (or a
  short "Session ended" card) → "Practice again" starts a fresh chat. Admin: the preview sign-in bar comes first; the chat starts after sign-in, and
  choosing "Practise as <student>" restarts it with that student's plan. While the chat is open the admin's floating tools button (bottom-left, it sat on
  the mic) is hidden and a Tools button appears in the chat header instead (`body.ai-chat-live`).
- Calls Anthropic API via a Supabase Edge Function `ai-companion` (key stored server-side as the
  `ANTHROPIC_API_KEY` secret, never sent to the browser). The function verifies the caller's Supabase
  JWT via `/auth/v1/user` before proxying to Anthropic — see `supabase/functions/ai-companion/index.ts`.
  Chat turns and the end-of-session report (`task: "report"`) use `claude-sonnet-5` with reasoning switched
  off, falling back to Haiku 4.5 if it errors or returns nothing. Chat replies are capped at 300 tokens, reports
  at 3500. (A live comparison showed Haiku praising "Me gustan correr y nadar"; Sonnet corrects it.)
  Per-student rate limit (best-effort, in the function instance's memory): chat 30/min + 600/day, reports 10/hour; over the limit
  the function answers 429 with a Spanish "Vas muy rápido…" message.
- **Voice conversation** (script.js "VOICE CONVERSATION" section, uses the browser's `SpeechRecognition`; free, client-side): the student taps the
  mic once and just talks — speech is transcribed live into the box, **sent automatically** ~1.9 s after they stop (`CONVO_SILENCE_MS`), the reply is
  read aloud, and the mic opens again, like a voice call. Tap the mic while the AI is talking = cut it off and answer; tap while listening = end.
  State machine in `convo` (`listening`/`thinking`/`speaking`/`paused`); `speakText()` returns a promise that resolves when playback ends, which is
  what reopens the mic (with a length-based timeout so a browser that never reports the end can't hang it). Turns arrive via `submitAiMessage(text, {voice:true})`;
  those turns get `PRACTICE_VOICE_RULE` (practice.js: speech-to-text may lack accents/punctuation — never correct those; ask "¿Quisiste decir…?";
  1–2 short sentences) and are flagged `voice` in the saved transcript. It pauses itself after ~25 s of silence, on any error, when the page is hidden,
  on tab switch or when leaving the chat. On iPhone the browser may refuse the automatic re-open (needs a tap) → it pauses with "Tap the mic to keep
  talking". Browsers without `SpeechRecognition` (Firefox) get the mic disabled with a tooltip — typing always works.
- Phone layout (`@media (max-width: 640px)` at the end of styles.css): while the chat is open the page header and tab stack are hidden, the topbar
  wraps (mode + End session / voice controls), the message box height follows the screen (`100dvh`), the quick replies scroll sideways and the input is 16px
  (stops iPhone zoom-on-focus).
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

## Deployment
- **Current:** drag-and-drop zip into Cloudflare Pages dashboard
- **Goal:** GitHub repo connected to Cloudflare Pages for auto-deploy on `git push`
- **Repo:** to be created at `github.com/aaronsiebertsio/aaron-student-portal` (or similar)

## Calendly
- Floating "Book Your Next Lesson" button links to `https://calendly.com/aaronsiebertsio/lesson`

## Important constants in script.js
| Constant | Value | Purpose |
|---|---|---|
| `ADMIN_CODE` | `ADMIN-AARON` | Admin login code |
| `ADMIN_SECRET` | `AARON-ADMIN-2025` | RPC auth secret |
| `SESSION_STORE` | `aaron_portal_session` | localStorage key for session |

## Working with this codebase
- All three files must be deployed together — no build step needed
- Changes to courses via admin panel are saved to Supabase automatically
- Changes to resources are saved to localStorage (per-browser) — use the Resources Editor in admin to update, then the changes need to be pushed to Supabase or baked into `sharedResources` in JS for all users to see them
- To add a new student type: add a branch in `showMainApp()`, `populateResources()`, and `sharedResources`
