// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// --- MySQL pool ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'energyreminder',
  waitForConnections: true,
  connectionLimit: 10
});

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message || err);
  }
})();

// --- Nodemailer transporter (Gmail) ---
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  // verify transporter (non-blocking)
  transporter.verify().then(() => {
    console.log('✅ Email transporter verified');
  }).catch((err) => {
    console.warn('⚠️ Email transporter verify failed:', err && err.message ? err.message : err);
  });
} else {
  console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set in .env — email will not work');
}

// ----------------- Routes -----------------

// health
app.get('/', (req, res) => res.send('EnergyReminder backend running'));

// Register: POST /api/register   { email, password }
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash]);

    const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, userId: result.insertId, token });
  } catch (err) {
    console.error('Register error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login: POST /api/login   { email, password }
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

    const [rows] = await pool.query('SELECT id, password FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, userId: user.id, token });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send reminder (matches energyAnalyzer.html fetch): POST /send-reminder
// Body: { email, subject, message }
app.post('/send-reminder', async (req, res) => {
  try {
    const { email, subject = 'EnergyBuddy Reminder', message } = req.body;
    if (!email || !message) return res.status(400).json({ error: 'email & message required' });

    if (!transporter) {
      return res.status(500).json({ error: 'Email transporter not configured on server' });
    }

    const mailOptions = {
      from: `"EnergyBuddy" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: message,
      html: message.replace(/\n/g, '<br>')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📩 Reminder sent to ${email} — id: ${info.messageId || '(no-id)'}`);
    res.json({ ok: true, messageId: info.messageId || null });
  } catch (err) {
    console.error('Send reminder error', err && (err.message || err));
    res.status(500).json({ error: 'Failed to send reminder', details: err && (err.message || err) });
  }
});

// ----------------- Export for Vercel -----------------
module.exports = app;
