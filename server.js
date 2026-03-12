// ═══════════════════════════════════════════════════════════
//  Qubitedge Internship 2026 — Node.js / Express API
//  Stack: Express + pg (PostgreSQL) + multer (file uploads)
//         + nodemailer (Gmail OTP)
// ═══════════════════════════════════════════════════════════

require('dotenv').config();
const express      = require('express');
const { Pool }     = require('pg');
const multer       = require('multer');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const nodemailer   = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── POSTGRESQL CONNECTION ────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'qubitedge_internship',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ DB connection error:', err.message));

// ── GMAIL TRANSPORTER ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ── OTP STORE (in-memory, expires in 10 minutes) ─────────────
const otpStore = new Map(); // email → { otp, expiresAt }

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── FILE UPLOAD (MULTER) ─────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads', 'receipts');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `receipt_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only JPG, PNG, PDF allowed'));
  },
});

// ── HELPERS ──────────────────────────────────────────────────
function generateRefId() {
  return 'QLT-2026-' + Math.floor(1000 + Math.random() * 9000);
}

function validateRequired(body) {
  const required = ['student_name', 'mobile', 'email', 'college_name', 'department', 'transaction_id', 'amount_paid', 'payment_date'];
  return required.filter(f => !body[f] || String(body[f]).trim() === '');
}

// ════════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════════

// ── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SEND OTP ─────────────────────────────────────────────────
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }

  const otp       = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(email.toLowerCase(), { otp, expiresAt });

  try {
    await transporter.sendMail({
      from:    `"Qubitedge Internship 2026" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: 'Your OTP — Qubitedge Summer Internship 2026',
      html: `
        <div style="font-family:'DM Sans',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f0f4ff;border-radius:16px">
          <div style="text-align:center;margin-bottom:28px">
            <div style="display:inline-block;background:linear-gradient(135deg,#4361ee,#7b2ff7);padding:10px 24px;border-radius:10px">
              <span style="font-family:Arial,sans-serif;font-weight:800;font-size:20px;color:#fff;letter-spacing:.04em">Qubitedge</span>
            </div>
          </div>
          <div style="background:#fff;border-radius:14px;padding:32px 28px;box-shadow:0 4px 24px rgba(67,97,238,.1)">
            <h2 style="font-family:Arial,sans-serif;font-weight:800;font-size:1.4rem;color:#1a1d3a;margin:0 0 8px">Verify Your Email</h2>
            <p style="color:#6b72a8;font-size:14px;line-height:1.6;margin:0 0 28px">Use the OTP below to verify your email for the <strong style="color:#4361ee">Qubitedge Summer Internship 2026</strong> registration.</p>
            <div style="background:linear-gradient(135deg,#eef1ff,#f0f4ff);border:2px solid #d6dcf5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
              <div style="font-family:Arial,sans-serif;font-size:2.8rem;font-weight:800;letter-spacing:0.3em;color:#4361ee">${otp}</div>
              <div style="font-size:12px;color:#6b72a8;margin-top:8px">Valid for 10 minutes</div>
            </div>
            <p style="color:#b0b8d8;font-size:12px;line-height:1.6;margin:0">If you didn't request this, please ignore this email. Do not share this OTP with anyone.</p>
          </div>
          <p style="text-align:center;color:#b0b8d8;font-size:11px;margin-top:20px">© 2026 Qubitedge Global Services (OPC) Pvt. Ltd.</p>
        </div>
      `,
    });

    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Check Gmail credentials in .env' });
  }
});

// ── VERIFY OTP ───────────────────────────────────────────────
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
  }

  const record = otpStore.get(email.toLowerCase());

  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp.toString()) {
    return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
  }

  otpStore.delete(email.toLowerCase());
  res.json({ success: true, message: 'Email verified successfully.' });
});

// ── SUBMIT REGISTRATION ──────────────────────────────────────
app.post('/api/register', upload.single('receipt'), async (req, res) => {
  try {
    const body = req.body;

    const missing = validateRequired(body);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields', fields: missing });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    if (!/^\d{10}$/.test(body.mobile)) {
      return res.status(400).json({ success: false, message: 'Mobile must be 10 digits' });
    }

    const domains = body.interested_domains
      ? (Array.isArray(body.interested_domains) ? body.interested_domains : body.interested_domains.split(',').map(s => s.trim()))
      : [];
    const courses = body.courses_selected
      ? (Array.isArray(body.courses_selected) ? body.courses_selected : body.courses_selected.split(',').map(s => s.trim()))
      : [];

    if (courses.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one course must be selected' });
    }

    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    if (!receiptUrl) {
      return res.status(400).json({ success: false, message: 'Payment receipt is required' });
    }

    const refId = generateRefId();

    const result = await pool.query(`
      INSERT INTO registrations (
        ref_id, student_name, mobile, email, city,
        college_name, college_id, department, semester,
        interested_domains, courses_selected,
        transaction_id, amount_paid, payment_date, receipt_url,
        email_verified, status
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,
        $12,$13,$14,$15,
        $16,'Pending'
      ) RETURNING id, ref_id, submitted_at
    `, [
      refId,
      body.student_name.trim(),
      body.mobile.trim(),
      body.email.trim().toLowerCase(),
      body.city?.trim() || null,
      body.college_name.trim(),
      body.college_id?.trim() || null,
      body.department,
      body.semester || null,
      domains,
      courses,
      body.transaction_id.trim(),
      parseFloat(body.amount_paid),
      body.payment_date,
      receiptUrl,
      body.email_verified === 'true',
    ]);

    const row = result.rows[0];
    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      ref_id: row.ref_id,
      id: row.id,
      submitted_at: row.submitted_at,
    });

  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint?.includes('email')) {
        return res.status(409).json({ success: false, message: 'This email is already registered.' });
      }
      if (err.constraint?.includes('transaction_id')) {
        return res.status(409).json({ success: false, message: 'This transaction ID has already been used.' });
      }
    }
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ── GET ALL REGISTRATIONS (Admin) ────────────────────────────
app.get('/api/admin/registrations', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let idx = 1;

    if (status && status !== 'All') {
      where.push(`status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      where.push(`(student_name ILIKE $${idx} OR email ILIKE $${idx} OR mobile ILIKE $${idx} OR ref_id ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM registrations ${whereStr}`, params);
    const total    = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT id, ref_id, student_name, mobile, email, city,
              college_name, college_id, department, semester,
              interested_domains, courses_selected,
              transaction_id, amount_paid, payment_date, receipt_url,
              status, admin_notes, email_verified, submitted_at
       FROM registrations ${whereStr}
       ORDER BY submitted_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: dataRes.rows });
  } catch (err) {
    console.error('Admin list error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET SINGLE REGISTRATION ──────────────────────────────────
app.get('/api/admin/registrations/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM registrations WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── UPDATE STATUS (Admin) ────────────────────────────────────
app.patch('/api/admin/registrations/:id/status', async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const allowed = ['Pending', 'Approved', 'Rejected', 'On Hold'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const result = await pool.query(
      `UPDATE registrations SET status=$1, admin_notes=$2 WHERE id=$3 RETURNING id, ref_id, status`,
      [status, admin_notes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DASHBOARD SUMMARY (Admin) ────────────────────────────────
app.get('/api/admin/summary', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM registration_summary');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ── START SERVER ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Qubitedge API running at http://localhost:${PORT}`);
});
