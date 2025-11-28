// backend/mailer.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// send simple email
async function sendEmail(to, subject, text, html = null) {
  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL || `"EnergyBuddy" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html: html || undefined
  });
  return info;
}

module.exports = { sendEmail };
