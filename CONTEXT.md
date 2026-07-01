# Aaron's Student Portal — Project Context

## What this is
A student-facing web portal at **aaron-learning.com**, hosted on **Cloudflare Pages**. Students log in to access Spanish/music lesson resources, a personal Google Drive folder, a course player, and (for Spanish students) an AI speaking companion. Aaron logs in via admin code to manage courses, students, and resources.

## Stack
- **Frontend:** Pure static HTML/CSS/JS — three files: `index.html`, `styles.css`, `script.js`
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
- Admin panel is the same `mainApp` div with a floating toolbar (`adminFloatingBar`) — no separate page

## Student types
- `spanish` — sees Courses tab, Resources tab (Spotify playlist + movie recommendations), Your Space, Community
- `music` — sees Resources (Coming Soon placeholder), Your Space, Community; no Courses tab

## Admin capabilities
- Edit Mode (inline WYSIWYG lesson editing)
- Course/lesson CRUD via modal editors with Quill rich text
- Import/Export course JSON
- Edit Resources tab (sections + movie list)
- Students & Insights overlay (view all students, generate AI insights per student, preview as student)
- Settings (reset courses, save Anthropic API key)

## AI Companion (Spanish students)
- Modes: Free Conversation, Roleplay Scenario, Picture Description, Grammar Focus
- Calls Anthropic API via a Supabase RPC function `call_claude` (key stored server-side)
- Voice input via MediaRecorder API → Whisper transcription (via Supabase RPC)
- TTS via browser Web Speech API

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
