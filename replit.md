# Apex — Project Management Platform

## Stack
- **Frontend**: Vanilla HTML/CSS/JS (single `index.html`)
- **Backend**: Node.js + Express (`index.js`)
- **Database**: PostgreSQL (Replit built-in, connection via `db.js`)
- **Auth**: Passport.js + Google OAuth 2.0 (`auth.js`)
- **AI**: Anthropic Claude via server-side proxy (`/chat` endpoint)

## Key Files
- `index.html` — full frontend app (portfolio, projects, tasks, resources views + AI panel)
- `index.js` — Express server: serves static files, mounts API routes, proxies Anthropic API
- `auth.js` — Google OAuth Passport strategy, session setup, auth guard middleware
- `routes/api.js` — REST API: profile, projects, tasks CRUD
- `db.js` — PostgreSQL connection pool (uses `DATABASE_URL` env var)
- `login.html` — Apex-styled sign-in page (Google + Apple "Soon")

## Environment Variables / Secrets
- `ANTHROPIC_API_KEY` — Claude API key (Replit Secret)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth credentials (Replit Secrets)
- `SESSION_SECRET` — Session signing key (Replit Secret)
- `DATABASE_URL`, `PGHOST`, etc. — auto-set by Replit DB

## API Routes (all require auth)
- `GET /api/me` — current user profile
- `PUT /api/profile` — update name, job_title, bio, settings (accent color, density)
- `GET /api/projects` — all projects + tasks for current user's portfolio
- `POST /api/projects` — create project
- `PUT /api/projects/:id` — update project (name, status, stage, etc.)
- `DELETE /api/projects/:id` — delete project + tasks
- `POST /api/projects/:id/tasks` — create task
- `PUT /api/tasks/:id` — update task
- `DELETE /api/tasks/:id` — delete task
- `GET /api/dashboards?section=<section>` — list saved dashboards for a section
- `POST /api/dashboards` — create dashboard `{ section, name, widget_ids[], filters{} }`
- `PUT /api/dashboards/:id` — update dashboard
- `DELETE /api/dashboards/:id` — delete dashboard

## Database Schema

### users
`id, email, name, avatar_url, provider, provider_id, job_title, bio, is_profile_complete, settings (jsonb), created_at, updated_at`

### portfolios
Top-level grouping owned by a user. Auto-created on first Google login.
`id, owner_id → users, name, description, created_at, updated_at`

### projects
Belong to a portfolio.
`id, portfolio_id → portfolios, owner_id → users, name, description, initiative, region, status, stage, color, due_date, owner_name, created_at, updated_at`

### tasks
Belong to a project. Supports subtasks via self-referencing `parent_id`.
`id, project_id → projects, assignee_id → users, assignee_name, name, status, priority, due_date, progress, notes, parent_id → tasks, sort_order, created_at, updated_at`

### memberships
`id, user_id → users, resource_type (portfolio|project), resource_id, role, created_at`

### invitations
`id, invited_by → users, email, resource_type, resource_id, role, token, accepted_at, expires_at, created_at`

### dashboards
User-saved custom dashboards, per section. Auto-created via `CREATE TABLE IF NOT EXISTS` in `routes/api.js`.
`id, user_id → users, section (portfolio|projects|tasks|resources), name, widget_ids (jsonb array), filters (jsonb), created_at`

## Dashboard System
Each main view (Portfolio, Projects, Tasks, Resources) has a left sub-panel (`db-panel`) showing:
- "Overview" — the default list/table view for that section
- Saved dashboards (user-created, persisted to DB)
- "+ New Dashboard" button — opens widget picker modal

Dashboards render a widget grid using real data from `D.projects` / tasks. Widgets per section:
- **Portfolio**: Health Summary, By Initiative, Progress Overview, Stage Distribution
- **Projects**: Status Breakdown, Project Progress, By Initiative, Owner Workload
- **Tasks**: Task Status, Priority Breakdown, Assignee Load, Completion Rate
- **Resources**: Team Utilization, Priority Mix, Workload Summary, Project Health Mix

Charts are pure CSS horizontal bar charts (no external libraries). Color-coded by value.

## Architecture Roadmap
1. ✅ Database schema (PostgreSQL)
2. ✅ Auth layer (Google OAuth, sessions in PostgreSQL)
3. ✅ Backend API routes (CRUD for projects/tasks/profile)
4. ✅ Connect frontend to real data (live API, no seed data)
5. ✅ User profile setup on first login
6. ✅ Settings modal (profile edit + accent color / density)
7. ⬜ Collaboration / invite system
8. ⬜ AI personalization per user

## AI Action System
Claude receives full portfolio/project/task context on every message and can execute actions via `<APEX_ACTION>{...}</APEX_ACTION>` tags:
- `navigate` — switch views
- `filter_tasks` — filter task list
- `filter_projects` — filter projects view
- `show_report` — open a formatted report modal (exportable to CSV)
- `add_task` — create a new task (in-memory; user saves to DB via sheet Save)
- `update_task` — update task status/progress

## Auth Notes
- Google OAuth callback URL: `https://<REPLIT_DEV_DOMAIN>/auth/google/callback`
- Must open app in a direct browser tab (not embedded Replit preview) for Google OAuth to work
- Sessions stored in PostgreSQL `sessions` table via `connect-pg-simple`
- New users get a default portfolio auto-created on first login
