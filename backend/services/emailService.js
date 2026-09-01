/**
 * BHC Blood Donor – Email Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Production Transport: Resend HTTPS REST API
 *   - Works on Render Free (HTTPS port 443 — NOT blocked)
 *   - Gmail SMTP (port 465/587) is BLOCKED on Render Free — do NOT use
 *
 * Required Environment Variables (set in Render Dashboard):
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
 *   EMAIL_FROM=onboarding@resend.dev
 *     ↑ Free plan: must use onboarding@resend.dev
 *       Paid/verified domain: "BHC Blood Donor" <noreply@yourdomain.com>
 * ─────────────────────────────────────────────────────────────────────────────
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

// ──────────────────────────────────────────────────────────
// Core Send Function
// ──────────────────────────────────────────────────────────

/**
 * Send an email via Resend HTTPS REST API.
 *
 * @param {object} opts
 * @param {string} opts.to          - Recipient email address
 * @param {string} opts.subject     - Email subject
 * @param {string} opts.htmlText    - HTML body
 * @param {string} [opts.plainText] - Plain text fallback
 * @param {string} [opts.eventName] - Log label (e.g. 'TEST_EMAIL', 'REQUEST_RECEIVED')
 *
 * @returns {{ success: true, messageId: string, provider: string }
 *          |{ success: false, error: string }}
 */
async function sendEmail({ to, subject, htmlText, plainText, eventName = 'EMAIL' }) {
  const recipient = (to || '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error(`Invalid recipient email address: "${recipient}"`);
  }

  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set. Add it to Render Environment Variables.');
  }

  // Determine FROM address
  // Free Resend plan → must send FROM onboarding@resend.dev
  // Custom verified domain → use EMAIL_FROM env var
  const rawFrom  = (process.env.EMAIL_FROM || 'onboarding@resend.dev').trim();
  const fromAddr = rawFrom.includes('@') ? rawFrom : 'onboarding@resend.dev';

  // Mask recipient for safe logging (e.g. ra*****@gmail.com)
  const maskedRecipient = recipient.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 6)) + c);

  const payload = {
    from: fromAddr,
    to:   [recipient],
    subject,
    html: htmlText || '<p>No content</p>',
    ...(plainText ? { text: plainText } : {})
  };

  let response, resData;

  try {
    response = await fetch(RESEND_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    resData = await response.json();
  } catch (fetchErr) {
    console.error(`\n[EMAIL] Provider: Resend | Event: ${eventName} | Status: FETCH_ERROR | Error: ${fetchErr.message}\n`);
    throw new Error(`Resend API network error: ${fetchErr.message}`);
  }

  if (response.ok && resData.id) {
    console.log(`\n[EMAIL]`);
    console.log(`  Provider:   Resend`);
    console.log(`  Event:      ${eventName}`);
    console.log(`  Recipient:  ${maskedRecipient}`);
    console.log(`  Status:     SENT`);
    console.log(`  Message ID: ${resData.id}\n`);
    return { success: true, messageId: resData.id, provider: 'Resend' };
  }

  // API returned an error
  const errMsg = resData.message || resData.error || resData.name || JSON.stringify(resData);
  console.error(`\n[EMAIL]`);
  console.error(`  Provider:   Resend`);
  console.error(`  Event:      ${eventName}`);
  console.error(`  Recipient:  ${maskedRecipient}`);
  console.error(`  Status:     FAILED`);
  console.error(`  HTTP:       ${response.status}`);
  console.error(`  Error:      ${errMsg}\n`);

  throw new Error(`Resend API error (${response.status}): ${errMsg}`);
}

// ──────────────────────────────────────────────────────────
// Startup Diagnostics
// ──────────────────────────────────────────────────────────

async function verifyEmailService() {
  const apiKey  = (process.env.RESEND_API_KEY || '').trim();
  const fromEnv = (process.env.EMAIL_FROM     || '').trim();

  console.log('\n======================================================');
  console.log('📧 [EMAIL SERVICE — RESEND HTTPS API]');
  console.log(`   RESEND_API_KEY:  ${apiKey  ? 'SET ✔'  : 'NOT SET ✗'}`);
  console.log(`   EMAIL_FROM:      ${fromEnv ? fromEnv  : 'onboarding@resend.dev (default)'}`);
  console.log(`   Transport:       HTTPS (Render Free compatible)`);
  console.log('======================================================\n');

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured in environment variables.' };
  }

  return { success: true, provider: 'Resend HTTPS API' };
}

// Kept for backwards compat — no longer verifies SMTP
async function verifySMTP() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set. Add it to Render Environment Variables.');
  }
  return { success: true, provider: 'Resend HTTPS API' };
}

// ──────────────────────────────────────────────────────────
// Email Templates
// ──────────────────────────────────────────────────────────

function buildEmailHeader(accentColor = '#d4af37') {
  return `
    <div style="background-color:#0a1428;padding:20px;text-align:center;border-bottom:3px solid ${accentColor};">
      <h1 style="color:#ffffff;font-size:18px;margin:0;font-family:Georgia,serif;">BISHOP HEBER COLLEGE</h1>
      <p style="color:${accentColor};font-size:10px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;">Autonomous · Tiruchirappalli</p>
    </div>`;
}

function buildEmailFooter() {
  return `
    <div style="background-color:#f1f5f9;padding:12px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
      © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
    </div>`;
}

/**
 * Build "Request Received" email HTML
 */
function buildRequestReceivedEmail({ relativeName, requestId }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${buildEmailHeader('#d4af37')}
      <div style="padding:28px;background:#ffffff;">
        <h2 style="color:#16a34a;font-size:16px;margin-top:0;">Blood Request Received</h2>
        <p style="font-size:14px;color:#334155;line-height:1.7;">Dear <strong>${relativeName || 'Sir/Madam'}</strong>,</p>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          Your blood request has been received by Bishop Heber College.
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          Please note that this does <strong>NOT</strong> mean the request has been approved yet.
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          Once a suitable student donor is available and the request is approved, the student/college coordinator will contact you.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#166534;font-weight:bold;">Response Time: 10:00 AM – 4:00 PM</p>
          <p style="margin:6px 0 0;font-size:12px;color:#166534;">Student donors participate voluntarily based on their availability.</p>
        </div>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          Thank you for contacting Bishop Heber College Blood Donor Network.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-top:16px;font-size:12px;color:#475569;">
          <strong>Request ID:</strong> REQ-${requestId}
        </div>
        <p style="font-size:14px;color:#334155;margin-top:24px;">
          Regards,<br>
          <strong>BHC Blood Donor</strong><br>
          Bishop Heber College (Autonomous)<br>
          Tiruchirappalli
        </p>
      </div>
      ${buildEmailFooter()}
    </div>`;
}

/**
 * Build "Request Approved" email HTML
 */
function buildRequestApprovedEmail({ relativeName, requestId }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${buildEmailHeader('#16a34a')}
      <div style="padding:28px;background:#ffffff;">
        <h2 style="color:#16a34a;font-size:16px;margin-top:0;">✔ Blood Request Approved</h2>
        <p style="font-size:14px;color:#334155;line-height:1.7;">Dear <strong>${relativeName || 'Sir/Madam'}</strong>,</p>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          We are pleased to inform you that your blood request has been <strong>approved</strong> by the BHC Blood Donor Coordinator.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#166534;font-weight:bold;">A student donor or college coordinator will contact you shortly.</p>
        </div>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          Please keep your phone reachable so our team can coordinate with you.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-top:16px;font-size:12px;color:#475569;">
          <strong>Request ID:</strong> REQ-${requestId}
        </div>
        <p style="font-size:14px;color:#334155;margin-top:24px;">
          Regards,<br>
          <strong>BHC Blood Donor</strong><br>
          Bishop Heber College (Autonomous)<br>
          Tiruchirappalli
        </p>
      </div>
      ${buildEmailFooter()}
    </div>`;
}

/**
 * Build OTP / Forgot Password email HTML
 */
function buildOtpEmail({ email, otp }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${buildEmailHeader('#d4af37')}
      <div style="padding:32px;background:#ffffff;">
        <h2 style="margin-top:0;color:#0f172a;font-size:18px;">Admin Password Reset</h2>
        <p style="font-size:14px;line-height:1.6;color:#475569;">
          We received a request to reset the password for your account (<strong>${email}</strong>).
        </p>
        <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:bold;display:block;margin-bottom:8px;">Your 6-Digit Verification Code</span>
          <span style="font-family:monospace;font-size:36px;font-weight:bold;color:#0a1428;letter-spacing:10px;">${otp}</span>
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.5;">
          <strong>Note:</strong> This code expires in <strong>10 minutes</strong>. If you did not request a password reset, ignore this message.
        </p>
      </div>
      ${buildEmailFooter()}
    </div>`;
}

/**
 * Build test email HTML
 */
function buildTestEmail() {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${buildEmailHeader('#d4af37')}
      <div style="padding:28px;background:#ffffff;">
        <h2 style="color:#16a34a;font-size:16px;margin-top:0;">✔ Email Service Test</h2>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          This is a test email from the BHC Blood Donor system.
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.7;">
          If you received this email, the email configuration is working correctly.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#166534;font-weight:bold;">✔ Email Delivery: SUCCESS</p>
          <p style="margin:4px 0 0;font-size:12px;color:#166534;">Timestamp: ${new Date().toISOString()}</p>
        </div>
        <p style="font-size:14px;color:#334155;margin-top:24px;">
          Bishop Heber College<br>
          <strong>BHC Blood Donor</strong>
        </p>
      </div>
      ${buildEmailFooter()}
    </div>`;
}

module.exports = {
  sendEmail,
  verifyEmailService,
  verifySMTP,
  buildRequestReceivedEmail,
  buildRequestApprovedEmail,
  buildOtpEmail,
  buildTestEmail
};
