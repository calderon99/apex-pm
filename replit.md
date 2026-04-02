# Apex — Project Management Platform

## Stack
- **Frontend**: Vanilla HTML/CSS/JS (single `index.html`)
- **Backend**: Node.js + Express (`index.js`)
- **Database**: PostgreSQL (Replit built-in, connection via `db.js`)
- **AI**: Anthropic Claude via server-side proxy (`/chat` endpoint)

## Key Files
- `index.html` — full frontend app (portfolio, projects, tasks, resources views + AI panel)
- `index.js` — Express server: serves static files + proxies Anthropic API
- `db.js` — PostgreSQL connection pool (uses `DATABASE_URL` env var)

## Environment Variables / Secrets
- `ANTHROPIC_API_KEY` — Claude API key (Replit Secret)
- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — auto-set by Replit DB

## Database Schema

### users
Profile data linked to OAuth provider (Google / Apple).
`id, email, name, avatar_url, provider, provider_id, created_at, updated_at`

### portfolios
Top-level grouping owned by a user.
`id, owner_id → users, name, description, created_at, updated_at`

### projects
Belong to a portfolio. Core fields mirror the UI.
`id, portfolio_id → portfolios, owner_id → users, name, description, initiative, region, status, stage, color, due_date, created_at, updated_at`

### tasks
Belong to a project. Supports subtasks via self-referencing `parent_id`.
`id, project_id → projects, assignee_id → users, name, status, priority, due_date, progress, notes, parent_id → tasks, sort_order, created_at, updated_at`

### memberships
Connects users to portfolios or projects with a role (owner / editor / viewer).
`id, user_id → users, resource_type (portfolio|project), resource_id, role, created_at`

### invitations
Pending email invites. Expire after 7 days.
`id, invited_by → users, email, resource_type, resource_id, role, token (uuid), accepted_at, expires_at, created_at`

## Architecture Roadmap
1. ✅ Database schema (PostgreSQL)
2. ⬜ Auth layer (Google + Apple OAuth)
3. ⬜ Backend API routes (CRUD for projects/tasks/portfolios)
4. ⬜ Connect frontend to real data (replace seed data)
5. ⬜ Collaboration / invite system
6. ⬜ AI personalization per user

## AI Action System
Claude receives full portfolio/project/task context on every message and can execute actions embedded in its response using `<APEX_ACTION>{...}</APEX_ACTION>` tags:
- `navigate` — switch views
- `filter_tasks` — filter task list by assignee/status/priority/project
- `filter_projects` — filter projects view
- `show_report` — open a formatted report modal (exportable to CSV)
- `add_task` — create a new task
- `update_task` — update task status/progress
