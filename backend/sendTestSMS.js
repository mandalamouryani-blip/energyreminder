// sendTestSMS.js
require('dotenv').config();
const twilio = require('twilio');

// Load Twilio credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

client.messages
  .create({
    body: '🔔 Hello! This is your Energy Reminder test message!',
    from: process.env.TWILIO_PHONE,   // Twilio number
    to: '+919390189423'               // <-- your personal phone number here
  })
  .then(message => console.log('✅ Message sent successfully! SID:', message.sid))
  .catch(error => console.error('❌ Error sending SMS:', error));
