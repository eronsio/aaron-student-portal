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
- Session stored in localStorage (remember me) or sessionStorage
- Token refresh handled on page load via `sbRefreshSession`
- Admin login: code `ADMIN-AARON` entered at the login screen (no Supabase auth, just localStorage flag)
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
- Modes: **My Practice Plan** (personalised, see below), Free Conversation, Roleplay Scenario, Picture Description, Grammar Focus
- Calls Anthropic API via a Supabase Edge Function `ai-companion` (key stored server-side as the
  `ANTHROPIC_API_KEY` secret, never sent to the browser). The function verifies the caller's Supabase
  JWT via `/auth/v1/user` before proxying to Anthropic — see `supabase/functions/ai-companion/index.ts`.
  Chat turns and the end-of-session report (`task: "report"`) use `claude-sonnet-5` with reasoning switched
  off, falling back to Haiku 4.5 if it errors or returns nothing. Chat replies are capped at 300 tokens, reports
  at 3500. (A live comparison showed Haiku praising "Me gustan correr y nadar"; Sonnet corrects it.)
  Per-student rate limit (best-effort, in the function instance's memory): chat 30/min + 600/day, reports 10/hour; over the limit
  the function answers 429 with a Spanish "Vas muy rápido…" message.
- Voice input via the browser's `SpeechRecognition` (Web Speech API) — free, client-side, no separate
  transcription service. Streams live into the chat text box while the mic button is held; the student
  can edit before sending. Browsers without support (Firefox, some older WebViews) get the mic button
  disabled with a tooltip — typing always works.
- TTS via browser Web Speech API (`speechSynthesis`) — bot replies are read aloud in Spanish
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
- **Admin → Speaking Practice**: digest of unreviewed sessions per student, focus-area editor, level/instructions/on-off,
  session transcripts, "+ Add to focus" for AI-spotted issues, "Analyze now" (uses the API key in Settings) for sessions
  never analysed. Everything rendered from the database is escaped.
- Degrades to the old behaviour when the tables don't exist yet (tab stays hidden, no errors).
- Setup: run `supabase/speaking_practice.sql` once in the Supabase SQL editor, deploy the `ai-companion` function with the
  `ANTHROPIC_API_KEY` secret, then enable students in Admin → Speaking Practice.

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
