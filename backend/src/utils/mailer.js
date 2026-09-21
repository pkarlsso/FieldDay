import nodemailer from 'nodemailer';

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

async function sendCodeEmail({ toEmail, code, subject, text, purpose }) {
  const transporter = getTransporter();
  if (!transporter) {
    // No SMTP configured — fall back to logging so the flow is still
    // testable locally without real email credentials.
    console.log(`[dev] ${purpose} code for ${toEmail}: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    text
  });
}

function sendTwoFactorEmail(toEmail, code) {
  return sendCodeEmail({
    toEmail,
    code,
    purpose: '2FA',
    subject: 'Your FieldDay verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes.`
  });
}

function sendPasswordResetEmail(toEmail, code) {
  return sendCodeEmail({
    toEmail,
    code,
    purpose: 'Password reset',
    subject: 'Reset your FieldDay password',
    text:
      `Your FieldDay password reset code is ${code}. It expires in 15 minutes.\n\n` +
      'Enter it in the app along with your new password. ' +
      'If you did not request this, you can ignore this email — your password has not changed.'
  });
}

const mailer = { sendTwoFactorEmail, sendPasswordResetEmail };

export { sendTwoFactorEmail, sendPasswordResetEmail };
export default mailer;
