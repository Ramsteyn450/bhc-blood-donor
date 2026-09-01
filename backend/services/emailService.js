/**
 * BHC Blood Donor – Email Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Provider Priority:
 *   1. Brevo HTTPS API  (BREVO_API_KEY)  — FREE, 300/day, any recipient ✅
 *   2. Resend HTTPS API (RESEND_API_KEY) — Fallback (needs verified domain)
 *
 * Both use HTTPS port 443 — works on Render Free (SMTP ports are blocked).
 *
 * Environment Variables (set in Render Dashboard):
 *   BREVO_API_KEY   = your_brevo_api_key        ← already set ✅
 *   EMAIL_FROM      = your_verified_sender@gmail.com
 *   RESEND_API_KEY  = re_xxx (optional fallback)
 *   RESEND_FROM_EMAIL = onboarding@resend.dev   (optional fallback)
 *
 * IMPORTANT — Brevo Sender Verification:
 *   Before sending, verify your sender email in Brevo:
 *   Brevo Dashboard → Senders & IP → Add a Sender → verify via email link
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BREVO_API_URL  = 'https://api.brevo.com/v3/smtp/email';
const RESEND_API_URL = 'https://api.resend.com/emails';

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function getBrevoApiKey() {
  return (
    process.env.BREVO_API_KEY ||
    process.env.Brewo_Api_Key ||
    process.env.BREWO_API_KEY ||
    process.env.Brevo_Api_Key ||
    ''
  ).trim();
}

function getFromAddress() {
  const raw = (
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    ''
  ).trim();
  return raw.includes('@') ? raw : null;
}

function maskEmail(email) {
  return email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) =>
    a + '*'.repeat(Math.min(b.length, 6)) + c
  );
}

// ──────────────────────────────────────────────────────────
// Brevo HTTPS API
// ──────────────────────────────────────────────────────────

async function sendViaBrevo({ to, subject, htmlText, plainText, fromAddress, eventName }) {
  const apiKey = getBrevoApiKey();
  if (!apiKey) throw new Error('BREVO_API_KEY is not set.');

  const senderEmail = fromAddress || 'ramachandranramachandran5944@gmail.com';
  const senderName  = 'BHC Blood Donor';

  // Parse "Name <email>" format if present
  const emailMatch = senderEmail.match(/<(.+)>/);
  const nameMatch  = senderEmail.match(/^([^<]+)</);
  const parsedEmail = emailMatch ? emailMatch[1].trim() : senderEmail;
  const parsedName  = nameMatch  ? nameMatch[1].trim()  : senderName;

  const payload = {
    sender:      { name: parsedName, email: parsedEmail },
    to:          [{ email: to }],
    subject,
    htmlContent: htmlText || '<p>No content</p>',
    ...(plainText ? { textContent: plainText } : {})
  };

  let response, resData;
  try {
    response = await fetch(BREVO_API_URL, {
      method:  'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    resData = await response.json().catch(() => ({}));
  } catch (fetchErr) {
    throw new Error(`Brevo network error: ${fetchErr.message}`);
  }

  // Brevo returns 201 on success with { messageId: "..." }
  if (response.status === 201 || (response.ok && resData.messageId)) {
    const msgId = resData.messageId || `brevo-${Date.now()}`;
    console.log(`\n[EMAIL]\n  Provider:   Brevo\n  Event:      ${eventName}\n  From:       ${parsedEmail}\n  Recipient:  ${maskEmail(to)}\n  Status:     SENT\n  Message ID: ${msgId}\n`);
    return { success: true, messageId: msgId, provider: 'Brevo' };
  }

  const errMsg = resData.message || resData.error || JSON.stringify(resData);
  console.error(`\n[EMAIL]\n  Provider:   Brevo\n  Event:      ${eventName}\n  Status:     FAILED\n  HTTP:       ${response.status}\n  Error:      ${errMsg}\n`);

  // Sender not verified
  if (response.status === 401 || response.status === 403 ||
      errMsg.toLowerCase().includes('sender') ||
      errMsg.toLowerCase().includes('not authorized') ||
      errMsg.toLowerCase().includes('not verified')) {
    throw Object.assign(
      new Error(`Brevo sender not verified. Go to Brevo Dashboard → Senders & IP → verify ${parsedEmail}`),
      { code: 'BREVO_SENDER_NOT_VERIFIED', httpStatus: response.status }
    );
  }

  throw Object.assign(
    new Error(`Brevo error (${response.status}): ${errMsg}`),
    { code: 'BREVO_API_ERROR', httpStatus: response.status }
  );
}

// ──────────────────────────────────────────────────────────
// Resend HTTPS API (fallback)
// ──────────────────────────────────────────────────────────

async function sendViaResend({ to, subject, htmlText, plainText, fromAddress, eventName }) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not set.');

  const from = fromAddress || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  let response, resData;
  try {
    response = await fetch(RESEND_API_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from, to: [to], subject, html: htmlText || '<p>No content</p>', ...(plainText ? { text: plainText } : {}) })
    });
    resData = await response.json().catch(() => ({}));
  } catch (fetchErr) {
    throw new Error(`Resend network error: ${fetchErr.message}`);
  }

  if (response.ok && resData.id) {
    console.log(`\n[EMAIL]\n  Provider:   Resend\n  Event:      ${eventName}\n  From:       ${from}\n  Recipient:  ${maskEmail(to)}\n  Status:     SENT\n  Message ID: ${resData.id}\n`);
    return { success: true, messageId: resData.id, provider: 'Resend' };
  }

  const errMsg = resData.message || resData.error || JSON.stringify(resData);
  if (response.status === 403) {
    const isDomainError = errMsg.toLowerCase().includes('domain') && errMsg.toLowerCase().includes('not verified');
    const msg = isDomainError
      ? `Resend: sender domain not verified. Set EMAIL_FROM=onboarding@resend.dev or verify domain at resend.com/domains.`
      : `Resend: ${errMsg}`;
    throw Object.assign(new Error(msg), { code: 'RESEND_DOMAIN_ERROR', httpStatus: 403 });
  }

  throw Object.assign(new Error(`Resend error (${response.status}): ${errMsg}`), { code: 'RESEND_API_ERROR' });
}

// ──────────────────────────────────────────────────────────
// Main sendEmail — Brevo first, Resend fallback
// ──────────────────────────────────────────────────────────

/**
 * Send email via Brevo (primary) or Resend (fallback).
 *
 * @param {object}  opts
 * @param {string}  opts.to
 * @param {string}  opts.subject
 * @param {string}  opts.htmlText
 * @param {string} [opts.plainText]
 * @param {string} [opts.eventName]
 */
async function sendEmail({ to, subject, htmlText, plainText, eventName = 'EMAIL' }) {
  const recipient = (to || '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error(`Invalid recipient email address: "${recipient}"`);
  }

  const fromAddress    = getFromAddress();
  const brevoConfigured = !!getBrevoApiKey();
  const resendConfigured = !!(process.env.RESEND_API_KEY || '').trim();

  const opts = { to: recipient, subject, htmlText, plainText, fromAddress, eventName };

  // Try Brevo first
  if (brevoConfigured) {
    try {
      return await sendViaBrevo(opts);
    } catch (brevoErr) {
      console.warn(`⚠️ [EMAIL] Brevo failed (${brevoErr.code || brevoErr.message}). ${resendConfigured ? 'Trying Resend...' : 'No fallback configured.'}`);
      // If sender not verified — don't try fallback, surface the real fix
      if (brevoErr.code === 'BREVO_SENDER_NOT_VERIFIED') throw brevoErr;
      if (!resendConfigured) throw brevoErr;
    }
  }

  // Fallback to Resend
  if (resendConfigured) {
    return await sendViaResend(opts);
  }

  throw new Error('No email provider configured. Set BREVO_API_KEY or RESEND_API_KEY in Render Environment Variables.');
}

// ──────────────────────────────────────────────────────────
// Startup Diagnostics
// ──────────────────────────────────────────────────────────

async function verifyEmailService() {
  const brevoKey  = getBrevoApiKey();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const fromAddr  = getFromAddress();

  console.log('\n======================================================');
  console.log('📧 [EMAIL SERVICE]');
  console.log(`   Primary:        Brevo HTTPS API ${brevoKey  ? '✔ CONFIGURED' : '✗ NOT SET'}`);
  console.log(`   Fallback:       Resend HTTPS API ${resendKey ? '✔ CONFIGURED' : '✗ NOT SET'}`);
  console.log(`   EMAIL_FROM:     ${fromAddr || 'NOT SET (using Brevo sender default)'}`);
  console.log(`   Transport:      HTTPS port 443 (Render Free compatible ✔)`);
  console.log('======================================================\n');

  if (!brevoKey && !resendKey) {
    return { success: false, error: 'No email provider configured.' };
  }
  return { success: true, provider: brevoKey ? 'Brevo' : 'Resend', fromAddress: fromAddr };
}

async function verifySMTP() { return verifyEmailService(); }

// ──────────────────────────────────────────────────────────
// Email Templates
// ──────────────────────────────────────────────────────────

function buildHeader(accentColor = '#d4af37') {
  return `<div style="background:#0a1428;padding:20px;text-align:center;border-bottom:3px solid ${accentColor};">
    <h1 style="color:#fff;font-size:18px;margin:0;font-family:Georgia,serif;">BISHOP HEBER COLLEGE</h1>
    <p style="color:${accentColor};font-size:10px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;">Autonomous · Tiruchirappalli</p>
  </div>`;
}

function buildFooter() {
  return `<div style="background:#f1f5f9;padding:12px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
    © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
  </div>`;
}

function buildRequestReceivedEmail({ relativeName, requestId }) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    ${buildHeader('#d4af37')}
    <div style="padding:28px;background:#fff;">
      <h2 style="color:#16a34a;font-size:16px;margin-top:0;">Blood Request Received</h2>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Dear <strong>${relativeName || 'Sir/Madam'}</strong>,</p>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Your blood request has been received by Bishop Heber College.</p>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Please note that this does <strong>NOT</strong> mean the request has been approved yet.</p>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Once a suitable student donor is available and the request is approved, the student/college coordinator will contact you.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:bold;">Response Time: 10:00 AM – 4:00 PM</p>
        <p style="margin:6px 0 0;font-size:12px;color:#166534;">Student donors participate voluntarily based on their availability.</p>
      </div>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Thank you for contacting Bishop Heber College Blood Donor Network.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-top:16px;font-size:12px;color:#475569;">
        <strong>Request ID:</strong> REQ-${requestId}
      </div>
      <p style="font-size:14px;color:#334155;margin-top:24px;">Regards,<br><strong>BHC Blood Donor</strong><br>Bishop Heber College (Autonomous)</p>
    </div>
    ${buildFooter()}
  </div>`;
}

function buildRequestApprovedEmail({ relativeName, requestId }) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    ${buildHeader('#16a34a')}
    <div style="padding:28px;background:#fff;">
      <h2 style="color:#16a34a;font-size:16px;margin-top:0;">✔ Blood Request Approved</h2>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Dear <strong>${relativeName || 'Sir/Madam'}</strong>,</p>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Your blood request has been <strong>approved</strong> by the BHC Blood Donor Coordinator.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:bold;">A student donor or college coordinator will contact you shortly.</p>
      </div>
      <p style="font-size:14px;color:#334155;line-height:1.7;">Please keep your phone reachable so our team can coordinate with you.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-top:16px;font-size:12px;color:#475569;">
        <strong>Request ID:</strong> REQ-${requestId}
      </div>
      <p style="font-size:14px;color:#334155;margin-top:24px;">Regards,<br><strong>BHC Blood Donor</strong><br>Bishop Heber College (Autonomous)</p>
    </div>
    ${buildFooter()}
  </div>`;
}

function buildOtpEmail({ email, otp }) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    ${buildHeader('#d4af37')}
    <div style="padding:32px;background:#fff;">
      <h2 style="margin-top:0;color:#0f172a;font-size:18px;">Admin Password Reset</h2>
      <p style="font-size:14px;line-height:1.6;color:#475569;">We received a request to reset the password for your account (<strong>${email}</strong>).</p>
      <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
        <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:bold;display:block;margin-bottom:8px;">Your 6-Digit Verification Code</span>
        <span style="font-family:monospace;font-size:36px;font-weight:bold;color:#0a1428;letter-spacing:10px;">${otp}</span>
      </div>
      <p style="font-size:13px;color:#64748b;line-height:1.5;"><strong>Note:</strong> This code expires in <strong>10 minutes</strong>. If you did not request a reset, ignore this message.</p>
    </div>
    ${buildFooter()}
  </div>`;
}

function buildTestEmail() {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    ${buildHeader('#d4af37')}
    <div style="padding:28px;background:#fff;">
      <h2 style="color:#16a34a;font-size:16px;margin-top:0;">✔ Email Delivery Test</h2>
      <p style="font-size:14px;color:#334155;line-height:1.7;">This is a test email from the BHC Blood Donor system.</p>
      <p style="font-size:14px;color:#334155;line-height:1.7;">If you received this email, email delivery is working correctly.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px;border-radius:8px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:bold;">✔ Email Delivery: SUCCESS</p>
        <p style="margin:4px 0 0;font-size:12px;color:#166534;">Timestamp: ${new Date().toISOString()}</p>
      </div>
      <p style="font-size:14px;color:#334155;margin-top:24px;">BHC Blood Donor<br>Bishop Heber College</p>
    </div>
    ${buildFooter()}
  </div>`;
}

module.exports = {
  sendEmail,
  verifyEmailService,
  verifySMTP,
  getFromAddress,
  getBrevoApiKey,
  buildRequestReceivedEmail,
  buildRequestApprovedEmail,
  buildOtpEmail,
  buildTestEmail
};
