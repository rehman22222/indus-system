import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

dotenv.config();

let resendClient;
let smtpTransporter;

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Send via Brevo's transactional email HTTP API (https://api.brevo.com).
 * Uses HTTPS (port 443), so it works on hosts that block outbound SMTP — e.g.
 * Render free/starter. Only the sender email needs to be a verified Brevo
 * sender; recipients can be anyone.
 */
async function sendViaBrevo({ to, subject, html, fromName, fromEmail }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const recipients = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map((email) => ({ email }));

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: recipients,
      subject,
      htmlContent: html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Brevo send failed (${response.status}): ${data.message || data.code || 'unknown error'}`);
  }
  return { id: data.messageId };
}

function getSmtpTransporter() {
  if (!smtpConfigured()) throw new Error('SMTP credentials are not configured');
  if (!smtpTransporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Fail fast instead of hanging when outbound SMTP is blocked (e.g. Render
      // free/starter blocks ports 25/465/587). Surfaces a clear error in ~10s so
      // the caller can fall back / report, rather than the request stalling.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return smtpTransporter;
}

async function sendEmail({ to, subject, html }) {
  const fromName = process.env.OTP_FROM_NAME || 'INDUS Hospital';
  const fromEmail = process.env.OTP_FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev';
  const provider = String(process.env.EMAIL_PROVIDER || 'auto').toLowerCase();

  // Brevo (HTTPS API) — preferred on hosts that block outbound SMTP (Render).
  if (provider === 'brevo' || (provider === 'auto' && process.env.BREVO_API_KEY)) {
    return sendViaBrevo({ to, subject, html, fromName, fromEmail });
  }

  if (provider === 'smtp' || (provider === 'auto' && smtpConfigured())) {
    return getSmtpTransporter().sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    });
  }

  const { data, error } = await getResendClient().emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
  });
  if (error) throw error;
  return data;
}

export async function sendOTPEmail(to, otp, name = 'User', purpose = 'signup') {
  const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || 10;
  const isPasswordReset = purpose === 'password-reset';
  const data = await sendEmail({
    to,
    subject: isPasswordReset
      ? 'Reset your INDUS Hospital password'
      : 'Your INDUS Hospital verification code',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 10px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #0d6efd; margin-bottom: 8px;">INDUS Hospital</h2>
    <p style="color: #555;">Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color: #555;">${isPasswordReset
      ? 'Use this one-time code to reset your password:'
      : 'Your one-time email verification code is:'}</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #0d6efd; background: #e8f0fe; padding: 12px 24px; border-radius: 8px;">${otp}</span>
    </div>
    <p style="color: #888; font-size: 14px;">This code expires in <strong>${expiryMinutes} minutes</strong>. Do not share it with anyone.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} INDUS Hospital. All rights reserved.</p>
  </div>
</body>
</html>`,
  });
  console.log('OTP email sent successfully:', data?.id || data?.messageId);
  return data;
}

export async function sendAppointmentConfirmation(to, appointmentDetails) {
  const data = await sendEmail({
    to,
    subject: 'Appointment Confirmation - INDUS Hospital',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #0d6efd; margin-bottom: 16px;">Appointment Confirmed</h2>
    <p style="color: #555;">Dear <strong>${escapeHtml(appointmentDetails.patientName)}</strong>,</p>
    <p style="color: #555;">Your appointment has been confirmed:</p>
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Doctor:</strong> ${escapeHtml(appointmentDetails.doctorName)}</p>
      <p><strong>Department:</strong> ${escapeHtml(appointmentDetails.department)}</p>
      <p><strong>Date:</strong> ${escapeHtml(appointmentDetails.date)}</p>
      <p><strong>Time:</strong> ${escapeHtml(appointmentDetails.time)}</p>
      <p><strong>Token Number:</strong> ${escapeHtml(appointmentDetails.token)}</p>
    </div>
    <p style="color: #888; font-size: 14px;">Please arrive 15 minutes early and bring relevant medical records.</p>
  </div>
</body>
</html>`,
  });
  console.log('Appointment confirmation email sent:', data?.id || data?.messageId);
  return data;
}
