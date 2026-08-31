const nodemailer = require('nodemailer');

/**
 * BHC Blood Donor – Email Service
 * Primary: Gmail SMTP via App Password (Nodemailer)
 * Fallback: Resend HTTPS REST API → Brevo HTTPS REST API → SendGrid HTTPS REST API
 *
 * Environment Variables Required:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=bhcblooddonor@gmail.com
 *   SMTP_PASS=<Gmail App Password (16 chars, no spaces)>
 *   EMAIL_FROM=bhcblooddonor@gmail.com
 */

let cachedTransporter = null;

// ============================================================
// GMAIL SMTP TRANSPORTER (App Password via Nodemailer)
// ============================================================
function getGmailTransporter() {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpSecure = String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false';

  if (!smtpUser || !smtpPass) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,         // true = TLS on port 465
    auth: {
      user: smtpUser,
      pass: smtpPass            // Gmail App Password (16 chars)
    },
    tls: {
      rejectUnauthorized: false  // Allow self-signed certs
    }
  });
}

// ============================================================
// VERIFY SMTP CONNECTIVITY (Safe – never logs passwords)
// ============================================================
async function verifySMTP() {
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();

  console.log('\n======================================================');
  console.log('📧 [GMAIL SMTP DIAGNOSTICS]');
  console.log(`   SMTP Host:               ${smtpHost}`);
  console.log(`   SMTP Port:               ${smtpPort}`);
  console.log(`   SMTP User Configured:    ${smtpUser ? 'YES' : 'NO'}`);
  console.log(`   SMTP Password Configured: ${smtpPass ? 'YES' : 'NO'}`);
  console.log('======================================================\n');

  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP_USER or SMTP_PASS environment variable is not set.');
  }

  const transporter = getGmailTransporter();
  if (!transporter) {
    throw new Error('Failed to create Gmail SMTP transporter. Check SMTP_USER and SMTP_PASS.');
  }

  await new Promise((resolve, reject) => {
    transporter.verify((err, success) => {
      if (err) {
        console.error('❌ [GMAIL SMTP] Connection FAILED:', err.message);
        reject(new Error(`Gmail SMTP connection failed: ${err.message}`));
      } else {
        console.log('✔ [GMAIL SMTP] Connection SUCCESS — Ready to send messages.');
        resolve(success);
      }
    });
  });

  return { success: true, provider: 'Gmail SMTP' };
}

// ============================================================
// SEND EMAIL (Gmail SMTP primary, HTTPS APIs as fallback)
// ============================================================
async function sendEmail({ to, subject, htmlText, plainText, eventName = 'EMAIL_DISPATCH' }) {
  const recipient = (to || '').trim();
  if (!recipient) throw new Error('Recipient email address is required.');

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const brevoKey  = (process.env.BREVO_API_KEY || '').trim();
  const sendgridKey = (process.env.SENDGRID_API_KEY || '').trim();

  const rawSender = (process.env.EMAIL_FROM || smtpUser || 'bhcblooddonor@gmail.com').trim();
  let fromName  = 'BHC Blood Donor Network';
  let fromEmail = rawSender;

  // Parse "Name <email>" format if present
  const nameMatch = rawSender.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
  if (nameMatch) {
    fromName  = nameMatch[1].trim();
    fromEmail = nameMatch[2].trim();
  }
  const fromAddress = `"${fromName}" <${fromEmail}>`;

  let lastError = '';

  // ── 1. GMAIL SMTP (Primary) ──────────────────────────────
  if (smtpUser && smtpPass) {
    try {
      const transporter = getGmailTransporter();
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipient,
        subject,
        html: htmlText,
        text: plainText
      });

      console.log(`\n[EMAIL]`);
      console.log(`Provider: Gmail SMTP`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Event: ${eventName}`);
      console.log(`Status: SENT`);
      console.log(`Message ID: ${info.messageId}\n`);

      return { success: true, provider: 'Gmail SMTP', messageId: info.messageId };
    } catch (smtpErr) {
      lastError = smtpErr.message;
      console.error(`\n[EMAIL]`);
      console.error(`Provider: Gmail SMTP`);
      console.error(`Recipient: ${recipient}`);
      console.error(`Event: ${eventName}`);
      console.error(`Status: FAILED`);
      console.error(`Error: ${smtpErr.message}\n`);
      // Fall through to HTTPS API providers
    }
  }

  // ── 2. RESEND HTTPS API (Fallback) ───────────────────────
  if (resendKey) {
    try {
      const fromAddr = fromEmail.includes('@gmail.com')
        ? '"BHC Blood Donor Network" <onboarding@resend.dev>'
        : fromAddress;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [recipient],
          subject,
          html: htmlText,
          text: plainText
        })
      });

      const resData = await response.json();
      if (response.ok && resData.id) {
        console.log(`\n[EMAIL]\nProvider: Resend\nRecipient: ${recipient}\nEvent: ${eventName}\nStatus: SENT\nMessage ID: ${resData.id}\n`);
        return { success: true, provider: 'Resend', messageId: resData.id };
      }
      lastError = `Resend API Error: ${resData.message || JSON.stringify(resData)}`;
    } catch (apiErr) {
      lastError = `Resend API Fetch Error: ${apiErr.message}`;
    }
  }

  // ── 3. BREVO HTTPS API (Fallback) ────────────────────────
  if (brevoKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': brevoKey
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: recipient }],
          subject,
          htmlContent: htmlText,
          textContent: plainText
        })
      });
      const resData = await response.json();
      if (response.ok && resData.messageId) {
        console.log(`\n[EMAIL]\nProvider: Brevo\nRecipient: ${recipient}\nEvent: ${eventName}\nStatus: SENT\nMessage ID: ${resData.messageId}\n`);
        return { success: true, provider: 'Brevo', messageId: resData.messageId };
      }
      lastError = `Brevo API Error: ${resData.message || JSON.stringify(resData)}`;
    } catch (apiErr) {
      lastError = `Brevo API Fetch Error: ${apiErr.message}`;
    }
  }

  // ── 4. SENDGRID HTTPS API (Fallback) ─────────────────────
  if (sendgridKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${sendgridKey}`
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [{ type: 'text/html', value: htmlText }]
        })
      });
      if (response.ok) {
        console.log(`\n[EMAIL]\nProvider: SendGrid\nRecipient: ${recipient}\nEvent: ${eventName}\nStatus: SENT\n`);
        return { success: true, provider: 'SendGrid', messageId: 'sendgrid-accepted' };
      }
      lastError = `SendGrid API Error: ${await response.text()}`;
    } catch (apiErr) {
      lastError = `SendGrid API Fetch Error: ${apiErr.message}`;
    }
  }

  throw new Error(lastError || 'No email provider configured. Set SMTP_USER + SMTP_PASS in environment variables.');
}

// ============================================================
// VERIFY EMAIL SERVICE ON STARTUP
// ============================================================
async function verifyEmailService() {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey  = process.env.BREVO_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  console.log('\n======================================================');
  console.log('📧 [EMAIL SERVICE PRODUCTION RUNTIME DIAGNOSTICS]');
  console.log(`   SMTP Host:               ${smtpHost}`);
  console.log(`   SMTP Port:               ${smtpPort}`);
  console.log(`   SMTP User Configured:    ${smtpUser ? 'YES' : 'NO'}`);
  console.log(`   SMTP Password Configured: ${smtpPass ? 'YES' : 'NO'}`);
  console.log(`   Resend API Key:          ${resendKey ? 'YES' : 'NO'}`);
  console.log(`   Brevo API Key:           ${brevoKey ? 'YES' : 'NO'}`);
  console.log(`   SendGrid API Key:        ${sendgridKey ? 'YES' : 'NO'}`);
  console.log('======================================================\n');

  if (smtpUser && smtpPass) {
    return { success: true, provider: 'Gmail SMTP' };
  }
  if (resendKey) return { success: true, provider: 'Resend API' };
  if (brevoKey)  return { success: true, provider: 'Brevo API' };
  if (sendgridKey) return { success: true, provider: 'SendGrid API' };

  return { success: false, error: 'No email provider configured. Set SMTP_USER + SMTP_PASS.' };
}

module.exports = { sendEmail, verifyEmailService, verifySMTP };
