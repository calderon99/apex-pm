const express = require('express');
const router = express.Router();
const { query } = require('../db');

const auth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// ── Profile ───────────────────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  const { id, name, email, avatar_url, job_title, bio, is_profile_complete, settings } = req.user;
  res.json({ id, name, email, avatar_url, job_title, bio, is_profile_complete, settings: settings || {} });
});

router.put('/profile', auth, async (req, res) => {
  const { name, job_title, bio, settings } = req.body;
  try {
    const result = await query(
      `UPDATE users SET name=$1, job_title=$2, bio=$3, settings=$4,
       is_profile_complete=true, updated_at=NOW() WHERE id=$5 RETURNING *`,
      [name || req.user.name, job_title || null, bio || null,
       JSON.stringify(settings || {}), req.user.id]
    );
    const u = result.rows[0];
    req.session.passport = req.session.passport || {};
    const { id, name: n, email, avatar_url, job_title: jt, bio: b, is_profile_complete, settings: s } = u;
    res.json({ id, name: n, email, avatar_url, job_title: jt, bio: b, is_profile_complete, settings: s || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Portfolios ────────────────────────────────────────────────────
router.get('/portfolios', auth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM portfolios WHERE owner_id=$1 ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json({ portfolios: result.rows.map(p => ({ id: String(p.id), name: p.name, description: p.description || '' })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/portfolios', auth, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await query(
      `INSERT INTO portfolios (owner_id, name, description) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, name, description || '']
    );
    const p = result.rows[0];
    await query(
      `INSERT INTO memberships (user_id, resource_type, resource_id, role) VALUES ($1,'portfolio',$2,'owner')`,
      [req.user.id, p.id]
    );
    res.json({ id: String(p.id), name: p.name, description: p.description || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Projects ──────────────────────────────────────────────────────
router.get('/projects', auth, async (req, res) => {
  try {
    const portfolios = await query(
      'SELECT * FROM portfolios WHERE owner_id=$1 ORDER BY created_at ASC',
      [req.user.id]
    );
    if (!portfolios.rows.length) return res.json({ projects: [], portfolios: [] });

    const portfolioIds = portfolios.rows.map(p => p.id);
    const projects = await query(
      'SELECT * FROM projects WHERE portfolio_id = ANY($1) ORDER BY created_at ASC',
      [portfolioIds]
    );

    const portMap = {};
    portfolios.rows.forEach(p => { portMap[p.id] = p; });

    if (!projects.rows.length) {
      return res.json({
        projects: [],
        portfolios: portfolios.rows.map(p => ({ id: String(p.id), name: p.name, description: p.description || '' }))
      });
    }

    const projectIds = projects.rows.map(p => p.id);
    const tasks = await query(
      `SELECT * FROM tasks WHERE project_id = ANY($1) AND parent_id IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      [projectIds]
    );

    const tasksByProject = {};
    tasks.rows.forEach(t => {
      if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
      tasksByProject[t.project_id].push(dbTaskToFE(t));
    });

    const result = projects.rows.map(p => ({
      ...dbProjectToFE(p, tasksByProject[p.id] || []),
      portfolio_id: String(p.portfolio_id),
      portfolio: portMap[p.portfolio_id]?.name || '',
    }));

    res.json({
      projects: result,
      portfolios: portfolios.rows.map(p => ({ id: String(p.id), name: p.name, description: p.description || '' }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects', auth, async (req, res) => {
  const { name, initiative, region, status, owner, due_date, color, description, portfolio_id, portfolio_name } = req.body;
  try {
    let portId = portfolio_id;
    if (!portId && portfolio_name) {
      const found = await query(
        'SELECT id FROM portfolios WHERE owner_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1',
        [req.user.id, portfolio_name]
      );
      if (found.rows.length) portId = found.rows[0].id;
    }
    if (!portId) {
      const first = await query('SELECT id FROM portfolios WHERE owner_id=$1 ORDER BY created_at ASC LIMIT 1', [req.user.id]);
      if (!first.rows.length) return res.status(400).json({ error: 'No portfolio found' });
      portId = first.rows[0].id;
    }

    const portRow = await query('SELECT name FROM portfolios WHERE id=$1', [portId]);

    const result = await query(
      `INSERT INTO projects (portfolio_id, owner_id, name, initiative, region, status,
       stage, color, due_date, description, owner_name)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10) RETURNING *`,
      [portId, req.user.id, name, initiative || '', region || 'na',
       status || 'On Track', color || '#4C8EE8', due_date || '', description || '',
       owner || req.user.name]
    );
    const p = result.rows[0];
    res.json({
      ...dbProjectToFE(p, []),
      portfolio_id: String(p.portfolio_id),
      portfolio: portRow.rows[0]?.name || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/projects/:id', auth, async (req, res) => {
  try {
    const cur = await query('SELECT * FROM projects WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Project not found' });
    const c = cur.rows[0];
    const b = req.body;
    const name        = b.name        ?? c.name;
    const initiative  = b.initiative  ?? c.initiative;
    const region      = b.region      ?? c.region;
    const status      = b.status      ?? c.status;
    const stage       = b.stage       ?? c.stage;
    const owner       = b.owner       ?? c.owner_name;
    const due_date    = b.due_date    ?? c.due_date;
    const color       = b.color       ?? c.color;
    const description = b.description ?? c.description;
    const settings    = b.settings != null ? JSON.stringify(b.settings) : JSON.stringify(c.settings || {});
    const result = await query(
      `UPDATE projects SET name=$1, initiative=$2, region=$3, status=$4, stage=$5,
       owner_name=$6, due_date=$7, color=$8, description=$9, settings=$10, updated_at=NOW()
       WHERE id=$11 AND owner_id=$12 RETURNING *`,
      [name, initiative, region, status, stage, owner, due_date || '', color, description,
       settings, req.params.id, req.user.id]
    );
    res.json(dbProjectToFE(result.rows[0], null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/portfolios/:id', auth, async (req, res) => {
  try {
    const cur = await query('SELECT * FROM portfolios WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Portfolio not found' });
    const c = cur.rows[0];
    const name        = req.body.name        ?? c.name;
    const description = req.body.description ?? c.description;
    const settings    = req.body.settings != null ? JSON.stringify(req.body.settings) : JSON.stringify(c.settings || {});
    const result = await query(
      `UPDATE portfolios SET name=$1, description=$2, settings=$3, updated_at=NOW()
       WHERE id=$4 AND owner_id=$5 RETURNING *`,
      [name, description || '', settings, req.params.id, req.user.id]
    );
    const p = result.rows[0];
    res.json({ id: String(p.id), name: p.name, description: p.description || '', settings: p.settings || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id', auth, async (req, res) => {
  try {
    await query('DELETE FROM tasks WHERE project_id=$1', [req.params.id]);
    await query('DELETE FROM projects WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Tasks ─────────────────────────────────────────────────────────
router.post('/projects/:id/tasks', auth, async (req, res) => {
  const { name, status, assignee_name, priority, due_date, progress } = req.body;
  try {
    const result = await query(
      `INSERT INTO tasks (project_id, name, status, assignee_name, priority, due_date, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, name, status || 'Not Started', assignee_name || '',
       priority || 'Medium', due_date || '', progress || 0]
    );
    res.json(dbTaskToFE(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tasks/:id', auth, async (req, res) => {
  try {
    const cur = await query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Task not found' });
    const c = cur.rows[0];
    const b = req.body;
    const name          = b.name          ?? c.name;
    const status        = b.status        ?? c.status;
    const assignee_name = b.assignee_name ?? c.assignee_name;
    const priority      = b.priority      ?? c.priority;
    const due_date      = b.due_date      ?? c.due_date;
    const progress      = b.progress      ?? c.progress;
    const notes         = b.notes         ?? c.notes;
    const custom_fields = b.custom_fields != null
      ? JSON.stringify(b.custom_fields)
      : JSON.stringify(c.custom_fields || {});
    const result = await query(
      `UPDATE tasks SET name=$1, status=$2, assignee_name=$3, priority=$4,
       due_date=$5, progress=$6, notes=$7, custom_fields=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, status, assignee_name || '', priority, due_date || '',
       progress ?? 0, notes || '', custom_fields, req.params.id]
    );
    res.json(dbTaskToFE(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id', auth, async (req, res) => {
  try {
    await query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────
function dbProjectToFE(p, tasks) {
  return {
    id: String(p.id),
    name: p.name,
    ini: p.initiative || '',
    rgn: p.region || 'na',
    st: p.status || 'On Track',
    sg: p.stage || 0,
    owner: p.owner_name || '',
    due: p.due_date || '',
    color: p.color || '#4C8EE8',
    desc: p.description || '',
    settings: p.settings || {},
    tasks: tasks !== null ? (tasks || []) : undefined,
  };
}

function dbTaskToFE(t) {
  return {
    id: String(t.id),
    n: t.name,
    s: t.status,
    a: t.assignee_name || '',
    p: t.priority,
    d: t.due_date || '',
    pct: t.progress || 0,
    notes: t.notes || '',
    cf: t.custom_fields || {},
  };
}

module.exports = router;
