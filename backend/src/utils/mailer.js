const nodemailer = require('nodemailer');

// Built lazily (not at module load) because index.js requires this module
// before it calls dotenv.config(), so process.env.SMTP_* wouldn't be
// populated yet if this ran at the top level.
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendTwoFactorEmail(toEmail, code) {
  const transporter = getTransporter();
  if (!transporter) {
    // No SMTP configured — fall back to logging so the flow is still
    // testable locally without real email credentials.
    console.log(`[dev] 2FA code for ${toEmail}: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Your FieldDay verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes.`
  });
}

module.exports = { sendTwoFactorEmail };
