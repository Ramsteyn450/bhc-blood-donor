/**
 * BHC Blood Donor – Email Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Transport: Resend HTTPS REST API (works on Render Free — port 443)
 *
 * Environment Variables (set in Render Dashboard):
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx      ← required
 *   RESEND_FROM_EMAIL=onboarding@resend.dev     ← default (test mode)
 *
 * Test-mode restriction (NO domain verified):
 *   FROM must be onboarding@resend.dev
 *   TO  must be your Resend account email only
 *
 * After domain verification:
 *   Set RESEND_FROM_EMAIL="BHC Blood Donor <noreply@your-verified-domain.com>"
 *   Then emails can be sent to ANY recipient.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

// ──────────────────────────────────────────────────────────
// Resolve FROM address from env (no hard-coding)
// ──────────────────────────────────────────────────────────
function getFromAddress() {
  // Prefer RESEND_FROM_EMAIL, fallback to EMAIL_FROM, fallback to test default
  const raw = (
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    'onboarding@resend.dev'
  ).trim();
  return raw.includes('@') ? raw : 'onboarding@resend.dev';
}

// ──────────────────────────────────────────────────────────
// Core Send Function
// ──────────────────────────────────────────────────────────

/**
 * Send an email via Resend HTTPS REST API.
 *
 * @param {object} opts
 * @param {string}  opts.to          Recipient email address
 * @param {string}  opts.subject     Email subject
 * @param {string}  opts.htmlText    HTML body
 * @param {string} [opts.plainText]  Plain text fallback
 * @param {string} [opts.eventName]  Log label (e.g. 'TEST_EMAIL', 'REQUEST_RECEIVED')
 *
 * @returns {{ success: true, messageId: string, provider: string }}
 * @throws  {Error} with descriptive message on failure
 */
async function sendEmail({ to, subject, htmlText, plainText, eventName = 'EMAIL' }) {
  const recipient = (to || '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error(`Invalid recipient email address: "${recipient}"`);
  }

  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured in Render Environment Variables.');
  }

  const fromAddr = getFromAddress();

  // Mask recipient for safe log (e.g. ra*****@gmail.com)
  const masked = recipient.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) =>
    a + '*'.repeat(Math.min(b.length, 6)) + c
  );

  let response, resData;

  try {
    response = await fetch(RESEND_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from:    fromAddr,
        to:      [recipient],
        subject,
        html:    htmlText || '<p>No content</p>',
        ...(plainText ? { text: plainText } : {})
      })
    });

    resData = await response.json();
  } catch (fetchErr) {
    console.error(`\n[EMAIL] Provider: Resend | Event: ${eventName} | Status: FETCH_ERROR | Error: ${fetchErr.message}\n`);
    throw new Error(`Resend API network error: ${fetchErr.message}`);
  }

  if (response.ok && resData.id) {
    console.log(
      `\n[EMAIL]\n  Provider:   Resend\n  Event:      ${eventName}\n  From:       ${fromAddr}\n  Recipient:  ${masked}\n  Status:     SENT\n  Message ID: ${resData.id}\n`
    );
    return { success: true, messageId: resData.id, provider: 'Resend' };
  }

  // ── Interpret Resend error codes ──────────────────────────
  const errMsg  = resData.message || resData.error || resData.name || JSON.stringify(resData);
  const errName = (resData.name || '').toLowerCase();
  const httpStatus = response.status;

  console.error(
    `\n[EMAIL]\n  Provider:   Resend\n  Event:      ${eventName}\n  From:       ${fromAddr}\n  Recipient:  ${masked}\n  Status:     FAILED\n  HTTP:       ${httpStatus}\n  Error:      ${errMsg}\n`
  );

  // 403 → domain not verified OR test-mode recipient restriction
  if (httpStatus === 403) {
    const isDomainError = errMsg.toLowerCase().includes('domain') && errMsg.toLowerCase().includes('not verified');
    const isTestMode   = errMsg.toLowerCase().includes('testing emails');

    const userMessage = isDomainError
      ? `The sender domain in RESEND_FROM_EMAIL is not verified on Resend. Either set RESEND_FROM_EMAIL=onboarding@resend.dev, or verify your domain at resend.com/domains.`
      : isTestMode
        ? `Resend test-mode restriction: You can only send to your own Resend account email until a domain is verified at resend.com/domains.`
        : `Resend access denied (403): ${errMsg}`;

    throw Object.assign(
      new Error(userMessage),
      { code: 'RESEND_DOMAIN_ERROR', httpStatus: 403, resendError: errMsg, isDomainError, isTestMode }
    );
  }

  throw Object.assign(
    new Error(`Resend API error (${httpStatus}): ${errMsg}`),
    { code: 'RESEND_API_ERROR', httpStatus, resendError: errMsg }
  );
}

// ──────────────────────────────────────────────────────────
// Startup Diagnostics
// ──────────────────────────────────────────────────────────

async function verifyEmailService() {
  const apiKey  = (process.env.RESEND_API_KEY || '').trim();
  const fromEnv = getFromAddress();
  const testMode = fromEnv === 'onboarding@resend.dev' || fromEnv.includes('onboarding@resend');

  console.log('\n======================================================');
  console.log('📧 [EMAIL SERVICE — RESEND HTTPS API]');
  console.log(`   RESEND_API_KEY:     ${apiKey   ? 'SET ✔'  : 'NOT SET ✗'}`);
  console.log(`   FROM Address:       ${fromEnv}`);
  console.log(`   Mode:               ${testMode ? 'TEST (verify domain to unlock all recipients)' : 'PRODUCTION'}`);
  console.log(`   Transport:          HTTPS port 443 (Render Free compatible)`);
  console.log('======================================================\n');

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  return { success: true, provider: 'Resend HTTPS API', fromAddress: fromEnv, testMode };
}

// Kept for backwards compat only
async function verifySMTP() {
  return verifyEmailService();
}

// ──────────────────────────────────────────────────────────
// Email Templates
// ──────────────────────────────────────────────────────────

function buildHeader(accentColor = '#d4af37') {
  return `
    <div style="background:#0a1428;padding:20px;text-align:center;border-bottom:3px solid ${accentColor};">
      <h1 style="color:#fff;font-size:18px;margin:0;font-family:Georgia,serif;">BISHOP HEBER COLLEGE</h1>
      <p style="color:${accentColor};font-size:10px;margin:4px 0 0;text-transform:uppercase;letter-spacing:2px;">Autonomous · Tiruchirappalli</p>
    </div>`;
}

function buildFooter() {
  return `
    <div style="background:#f1f5f9;padding:12px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
      © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
    </div>`;
}

function buildRequestReceivedEmail({ relativeName, requestId }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
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
        <p style="font-size:14px;color:#334155;margin-top:24px;">Regards,<br><strong>BHC Blood Donor</strong><br>Bishop Heber College (Autonomous)<br>Tiruchirappalli</p>
      </div>
      ${buildFooter()}
    </div>`;
}

function buildRequestApprovedEmail({ relativeName, requestId }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
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
        <p style="font-size:14px;color:#334155;margin-top:24px;">Regards,<br><strong>BHC Blood Donor</strong><br>Bishop Heber College (Autonomous)<br>Tiruchirappalli</p>
      </div>
      ${buildFooter()}
    </div>`;
}

function buildOtpEmail({ email, otp }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${buildHeader('#d4af37')}
      <div style="padding:32px;background:#fff;">
        <h2 style="margin-top:0;color:#0f172a;font-size:18px;">Admin Password Reset</h2>
        <p style="font-size:14px;line-height:1.6;color:#475569;">We received a request to reset the password for your account (<strong>${email}</strong>).</p>
        <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:bold;display:block;margin-bottom:8px;">Your 6-Digit Verification Code</span>
          <span style="font-family:monospace;font-size:36px;font-weight:bold;color:#0a1428;letter-spacing:10px;">${otp}</span>
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.5;"><strong>Note:</strong> This code expires in <strong>10 minutes</strong>. If you did not request a password reset, ignore this message.</p>
      </div>
      ${buildFooter()}
    </div>`;
}

function buildTestEmail() {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${buildHeader('#d4af37')}
      <div style="padding:28px;background:#fff;">
        <h2 style="color:#16a34a;font-size:16px;margin-top:0;">✔ Email Delivery Test</h2>
        <p style="font-size:14px;color:#334155;line-height:1.7;">This is a test email from the BHC Blood Donor system.</p>
        <p style="font-size:14px;color:#334155;line-height:1.7;">If you received this email, the email configuration is working correctly.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#166534;font-weight:bold;">✔ Email Delivery: SUCCESS</p>
          <p style="margin:4px 0 0;font-size:12px;color:#166534;">Timestamp: ${new Date().toISOString()}</p>
        </div>
        <p style="font-size:14px;color:#334155;margin-top:24px;">Bishop Heber College<br><strong>BHC Blood Donor</strong></p>
      </div>
      ${buildFooter()}
    </div>`;
}

module.exports = {
  sendEmail,
  verifyEmailService,
  verifySMTP,
  getFromAddress,
  buildRequestReceivedEmail,
  buildRequestApprovedEmail,
  buildOtpEmail,
  buildTestEmail
};
