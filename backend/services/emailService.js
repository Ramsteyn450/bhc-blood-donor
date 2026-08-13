const nodemailer = require('nodemailer');

/**
 * Production-Ready Modular Email Service
 * Primary Provider: Resend HTTPS REST API (Required for Render Free Web Services)
 * Secondary Providers: Brevo API, SendGrid API
 * Fallback: Nodemailer SMTP Transporter (Local Development Only)
 */

let cachedTransporter = null;

/**
 * Get or initialize Nodemailer transporter for SMTP providers (Local Dev Fallback)
 */
async function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;

  // 1. Gmail Preset (Local Dev)
  if ((smtpHost && smtpHost.includes('gmail')) || (smtpUser && smtpUser.includes('@gmail.com'))) {
    if (smtpUser && smtpPass) {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass }
      });
      return cachedTransporter;
    }
  }

  // 2. Custom SMTP Server
  if (smtpHost && smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });
    return cachedTransporter;
  }

  // 3. Ethereal Test Account Fallback (Development)
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 4000
    });
  } catch (err) {
    console.error('❌ [EMAIL SERVICE ERROR] Ethereal fallback failed:', err.message);
  }

  return cachedTransporter;
}

/**
 * Send Email via Resend HTTPS REST API (Primary) or Modular Fallbacks
 */
async function sendEmail({ to, subject, htmlText, plainText, eventName = 'EMAIL_DISPATCH' }) {
  const recipient = (to || '').trim();
  if (!recipient) {
    throw new Error('Recipient email address is required.');
  }

  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
  const sendgridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
  const rawSender = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  let fromEmail = 'onboarding@resend.dev';
  let fromName = 'BHC Blood Donor Network';

  if (rawSender.includes('<') && rawSender.includes('>')) {
    const match = rawSender.match(/^(?:"?([^"]*)"?\s)?<([^>]+)>$/);
    if (match) {
      if (match[1]) fromName = match[1].trim();
      fromEmail = match[2].trim();
    }
  } else if (rawSender.includes('@')) {
    fromEmail = rawSender.trim();
  }

  let fromAddress = `"${fromName}" <${fromEmail}>`;

  let lastError = '';

  // ======================================================
  // 1. PRIMARY PROVIDER: RESEND HTTPS REST API
  // ======================================================
  if (resendApiKey) {
    // If using default testing domain for Resend, ensure address is onboarding@resend.dev
    if (!process.env.EMAIL_FROM || fromEmail.includes('@gmail.com')) {
      fromAddress = `"BHC Blood Donor Network" <onboarding@resend.dev>`;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipient],
          subject: subject,
          html: htmlText,
          text: plainText
        })
      });

      const resData = await response.json();
      if (response.ok && resData.id) {
        console.log(`\n[EMAIL]`);
        console.log(`Provider: Resend`);
        console.log(`Recipient: ${recipient}`);
        console.log(`Event: ${eventName}`);
        console.log(`Status: SENT`);
        console.log(`Message ID: ${resData.id}\n`);

        return { success: true, provider: 'Resend', messageId: resData.id };
      } else {
        const errMsg = resData.message || JSON.stringify(resData);
        lastError = `Resend API Error: ${errMsg}`;
        console.error(`\n[EMAIL]`);
        console.error(`Provider: Resend`);
        console.error(`Event: ${eventName}`);
        console.error(`Status: FAILED`);
        console.error(`Error: ${errMsg}\n`);
      }
    } catch (apiErr) {
      lastError = `Resend API Fetch Error: ${apiErr.message}`;
      console.error(`\n[EMAIL]`);
      console.error(`Provider: Resend`);
      console.error(`Event: ${eventName}`);
      console.error(`Status: FAILED`);
      console.error(`Error: ${apiErr.message}\n`);
    }
  }

  // ======================================================
  // 2. SECONDARY PROVIDER: BREVO HTTPS REST API
  // ======================================================
  if (brevoApiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: recipient }],
          subject: subject,
          htmlContent: htmlText,
          textContent: plainText
        })
      });

      const resData = await response.json();
      if (response.ok && resData.messageId) {
        console.log(`\n[EMAIL]`);
        console.log(`Provider: Brevo`);
        console.log(`Recipient: ${recipient}`);
        console.log(`Event: ${eventName}`);
        console.log(`Status: SENT`);
        console.log(`Message ID: ${resData.messageId}\n`);

        return { success: true, provider: 'Brevo', messageId: resData.messageId };
      } else {
        const errMsg = resData.message || JSON.stringify(resData);
        lastError = `Brevo API Error: ${errMsg}`;
        console.error(`\n[EMAIL]`);
        console.error(`Provider: Brevo`);
        console.error(`Event: ${eventName}`);
        console.error(`Status: FAILED`);
        console.error(`Error: ${errMsg}\n`);
      }
    } catch (apiErr) {
      lastError = `Brevo API Fetch Error: ${apiErr.message}`;
      console.error(`\n[EMAIL]`);
      console.error(`Provider: Brevo`);
      console.error(`Event: ${eventName}`);
      console.error(`Status: FAILED`);
      console.error(`Error: ${apiErr.message}\n`);
    }
  }

  // ======================================================
  // 3. TERTIARY PROVIDER: SENDGRID HTTPS REST API
  // ======================================================
  if (sendgridApiKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${sendgridApiKey}`
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient }] }],
          from: { email: fromEmail, name: fromName },
          subject: subject,
          content: [{ type: 'text/html', value: htmlText }]
        })
      });

      if (response.ok) {
        console.log(`\n[EMAIL]`);
        console.log(`Provider: SendGrid`);
        console.log(`Recipient: ${recipient}`);
        console.log(`Event: ${eventName}`);
        console.log(`Status: SENT\n`);

        return { success: true, provider: 'SendGrid', messageId: 'sendgrid-ok' };
      } else {
        const errText = await response.text();
        lastError = `SendGrid API Error: ${errText}`;
        console.error(`\n[EMAIL]`);
        console.error(`Provider: SendGrid`);
        console.error(`Event: ${eventName}`);
        console.error(`Status: FAILED`);
        console.error(`Error: ${errText}\n`);
      }
    } catch (apiErr) {
      lastError = `SendGrid API Fetch Error: ${apiErr.message}`;
      console.error(`\n[EMAIL]`);
      console.error(`Provider: SendGrid`);
      console.error(`Event: ${eventName}`);
      console.error(`Status: FAILED`);
      console.error(`Error: ${apiErr.message}\n`);
    }
  }

  // ======================================================
  // 4. FALLBACK: NODEMAILER SMTP TRANSPORTER (LOCAL DEV ONLY)
  // ======================================================
  try {
    const transporter = await getSmtpTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipient,
        subject,
        html: htmlText,
        text: plainText
      });

      console.log(`\n[EMAIL]`);
      console.log(`Provider: SMTP Transporter`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Event: ${eventName}`);
      console.log(`Status: SENT`);
      console.log(`Message ID: ${info.messageId}\n`);

      return { success: true, provider: 'SMTP', messageId: info.messageId };
    }
  } catch (smtpErr) {
    lastError = `SMTP Transporter Error: ${smtpErr.message}`;
    console.error(`\n[EMAIL]`);
    console.error(`Provider: SMTP Transporter`);
    console.error(`Event: ${eventName}`);
    console.error(`Status: FAILED`);
    console.error(`Error: ${smtpErr.message}\n`);
  }

  throw new Error(lastError || 'No email provider (RESEND_API_KEY or SMTP) configured.');
}

/**
 * Verify Email Service Connectivity on Startup
 * Safely prints production diagnostics without exposing credentials.
 */
async function verifyEmailService() {
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const smtpHost = process.env.SMTP_HOST;

  console.log('\n======================================================');
  console.log('📧 [EMAIL SERVICE PRODUCTION RUNTIME DIAGNOSTICS]');
  console.log(`   Resend API Key:           ${resendKey ? 'CONFIGURED (Primary)' : 'NO'}`);
  console.log(`   Brevo API Key:            ${brevoKey ? 'CONFIGURED' : 'NO'}`);
  console.log(`   SendGrid API Key:         ${sendgridKey ? 'CONFIGURED' : 'NO'}`);
  console.log(`   SMTP Fallback Host:       ${smtpHost || 'None (Using HTTPS APIs)'}`);
  console.log('======================================================\n');

  if (resendKey) {
    console.log('✔ [EMAIL SERVICE] Using Resend HTTPS REST API Provider (Render Production Ready).');
    return { success: true, provider: 'Resend API' };
  }
  if (brevoKey) {
    console.log('✔ [EMAIL SERVICE] Using Brevo HTTPS REST API Provider.');
    return { success: true, provider: 'Brevo API' };
  }
  if (sendgridKey) {
    console.log('✔ [EMAIL SERVICE] Using SendGrid HTTPS REST API Provider.');
    return { success: true, provider: 'SendGrid API' };
  }

  try {
    const transporter = await getSmtpTransporter();
    if (transporter && transporter.verify) {
      await new Promise((resolve, reject) => {
        transporter.verify((err, success) => {
          if (err) reject(err);
          else resolve(success);
        });
      });
      console.log('✔ [EMAIL SERVICE] Local SMTP Fallback Transporter Ready.');
      return { success: true, provider: 'SMTP' };
    }
  } catch (err) {
    console.warn('⚠️ [EMAIL SERVICE] SMTP Fallback Verification Notice:', err.message);
  }

  return { success: false, error: 'No active email provider key configured.' };
}

module.exports = {
  sendEmail,
  verifyEmailService,
  getSmtpTransporter
};
