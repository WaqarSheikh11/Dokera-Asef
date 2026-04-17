import express from 'express';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// ─── Database ────────────────────────────────────────────────────────────────
const adapter = new JSONFile(join(__dirname, 'jobs.json'));
const defaultData = { jobs: [], nextId: 1 };
const db = new Low(adapter, defaultData);
await db.read();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ─── Constants ───────────────────────────────────────────────────────────────
const VALID_STATUSES  = ['Draft', 'Open', 'Closed'];
const VALID_SCHEDULES = ['Full-time', 'Part-time', 'Locum', 'Contract', 'Per Diem'];

const FIELD_LIMITS = {
  title:        { min: 3, max: 120 },
  location:     { min: 2, max: 100 },
  compensation: { max: 80  },
  description:  { max: 2000 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const now  = () => new Date().toISOString();
const trim = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Full payload validation.
 * Returns array of { field, message } objects.
 * If `existingId` is provided, skips duplicate check against that record.
 */
function validatePayload(body, existingId = null, existingJobs = []) {
  const errors = [];

  const title        = trim(body.title);
  const specialty    = trim(body.specialty);
  const location     = trim(body.location);
  const compensation = trim(body.compensation);
  const description  = trim(body.description);
  const status       = body.status;
  const schedule     = body.schedule;

  // ── Required fields ──────────────────────────────────────────────────────
  if (!title) {
    errors.push({ field: 'title', message: 'Job title is required.' });
  } else if (title.length < FIELD_LIMITS.title.min) {
    errors.push({ field: 'title', message: `Job title must be at least ${FIELD_LIMITS.title.min} characters.` });
  } else if (title.length > FIELD_LIMITS.title.max) {
    errors.push({ field: 'title', message: `Job title cannot exceed ${FIELD_LIMITS.title.max} characters.` });
  }

  if (!specialty) {
    errors.push({ field: 'specialty', message: 'Specialty / Department is required.' });
  }

  if (!location) {
    errors.push({ field: 'location', message: 'Location is required.' });
  } else if (location.length < FIELD_LIMITS.location.min) {
    errors.push({ field: 'location', message: `Location must be at least ${FIELD_LIMITS.location.min} characters.` });
  } else if (location.length > FIELD_LIMITS.location.max) {
    errors.push({ field: 'location', message: `Location cannot exceed ${FIELD_LIMITS.location.max} characters.` });
  }

  // ── Optional field limits ─────────────────────────────────────────────────
  if (compensation && compensation.length > FIELD_LIMITS.compensation.max) {
    errors.push({ field: 'compensation', message: `Compensation field cannot exceed ${FIELD_LIMITS.compensation.max} characters.` });
  }

  if (description && description.length > FIELD_LIMITS.description.max) {
    errors.push({ field: 'description', message: `Description cannot exceed ${FIELD_LIMITS.description.max} characters.` });
  }

  // ── Enum checks ───────────────────────────────────────────────────────────
  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` });
  }

  if (schedule && schedule !== '' && !VALID_SCHEDULES.includes(schedule)) {
    errors.push({ field: 'schedule', message: `Invalid schedule type.` });
  }

  // ── Start date ────────────────────────────────────────────────────────────
  if (body.start_date) {
    const d = new Date(body.start_date);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'start_date', message: 'Start date is not a valid date.' });
    }
  }

  // ── Business rule: Open requires complete required fields ─────────────────
  if (status === 'Open' && errors.length === 0) {
    if (!title || !specialty || !location) {
      errors.push({
        field: 'status',
        message: 'A post cannot be set to Open while required fields (Title, Specialty, Location) are missing.',
      });
    }
  }

  // ── Duplicate detection (same title + specialty, different id) ────────────
  if (title && specialty && errors.length === 0) {
    const titleLower     = title.toLowerCase();
    const specialtyLower = specialty.toLowerCase();
    const duplicate = existingJobs.find(j => {
      if (existingId && j.id === existingId) return false; // same record on PUT
      return j.title.toLowerCase() === titleLower &&
             j.specialty.toLowerCase() === specialtyLower;
    });
    if (duplicate) {
      errors.push({
        field: 'title',
        message: `A job post with this title already exists in "${specialty}". Please use a distinct title.`,
      });
    }
  }

  return errors;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET all — newest first
app.get('/api/jobs', async (_req, res) => {
  await db.read();
  const sorted = [...db.data.jobs].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  res.json(sorted);
});

// GET single
app.get('/api/jobs/:id', async (req, res) => {
  await db.read();
  const job = db.data.jobs.find(j => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job post not found.' });
  res.json(job);
});

// POST create
app.post('/api/jobs', async (req, res) => {
  await db.read();
  const errors = validatePayload(req.body, null, db.data.jobs);
  if (errors.length) return res.status(422).json({ errors });

  const {
    title, specialty, location,
    schedule = null, compensation = null,
    start_date = null, description = null,
    status = 'Draft',
  } = req.body;

  const job = {
    id:           db.data.nextId++,
    title:        trim(title),
    specialty:    trim(specialty),
    location:     trim(location),
    schedule:     schedule || null,
    compensation: trim(compensation) || null,
    start_date:   start_date || null,
    description:  trim(description) || null,
    status,
    created_at:   now(),
    updated_at:   now(),
  };

  db.data.jobs.push(job);
  await db.write();
  res.status(201).json(job);
});

// PATCH status only
app.patch('/api/jobs/:id/status', async (req, res) => {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(422).json({
      errors: [{ field: 'status', message: 'Invalid status. Must be Draft, Open, or Closed.' }],
    });
  }

  await db.read();
  const job = db.data.jobs.find(j => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job post not found.' });

  if (status === 'Open') {
    const missing = [];
    if (!job.title)    missing.push('Title');
    if (!job.specialty) missing.push('Specialty');
    if (!job.location)  missing.push('Location');
    if (missing.length) {
      return res.status(422).json({
        errors: [{
          field: 'status',
          message: `Cannot mark as Open — the following required fields are missing: ${missing.join(', ')}.`,
        }],
      });
    }
  }

  job.status     = status;
  job.updated_at = now();
  await db.write();
  res.json(job);
});

// PUT full update
app.put('/api/jobs/:id', async (req, res) => {
  await db.read();
  const job = db.data.jobs.find(j => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job post not found.' });

  const errors = validatePayload(req.body, job.id, db.data.jobs);
  if (errors.length) return res.status(422).json({ errors });

  const {
    title, specialty, location,
    schedule, compensation, start_date, description,
    status = job.status,
  } = req.body;

  job.title        = trim(title);
  job.specialty    = trim(specialty);
  job.location     = trim(location);
  job.schedule     = schedule || null;
  job.compensation = trim(compensation) || null;
  job.start_date   = start_date || null;
  job.description  = trim(description) || null;
  job.status       = status;
  job.updated_at   = now();

  await db.write();
  res.json(job);
});

// POST duplicate (clone) a job
app.post('/api/jobs/:id/duplicate', async (req, res) => {
  await db.read();
  const source = db.data.jobs.find(j => j.id === Number(req.params.id));
  if (!source) return res.status(404).json({ error: 'Job post not found.' });

  const copy = {
    ...source,
    id:          db.data.nextId++,
    title:       `${source.title} (Copy)`,
    status:      'Draft',          // always start duplicate as Draft
    created_at:  now(),
    updated_at:  now(),
  };

  db.data.jobs.push(copy);
  await db.write();
  res.status(201).json(copy);
});

// DELETE
app.delete('/api/jobs/:id', async (req, res) => {
  await db.read();
  const idx = db.data.jobs.findIndex(j => j.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Job post not found.' });
  const [deleted] = db.data.jobs.splice(idx, 1);
  await db.write();
  res.json({ message: 'Job post deleted.', id: deleted.id });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Dokera Error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Dokera Job Posts running → http://localhost:${PORT}`);
});
