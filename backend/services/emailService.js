const nodemailer = require('nodemailer');

/**
 * Production-Ready Multi-Provider Email Service
 * Supports Brevo, Resend, SendGrid, Custom SMTP, Gmail, and Ethereal Test Mail
 */

let cachedTransporter = null;

/**
 * Get or initialize Nodemailer transporter for SMTP providers
 */
async function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;

  // 1. Check Brevo SMTP (smtp-relay.brevo.com)
  if (process.env.BREVO_SMTP_KEY || (smtpHost && smtpHost.includes('brevo'))) {
    const host = smtpHost || 'smtp-relay.brevo.com';
    const user = smtpUser || process.env.BREVO_USER;
    const pass = process.env.BREVO_SMTP_KEY || smtpPass;
    if (user && pass) {
      cachedTransporter = nodemailer.createTransport({
        host,
        port: smtpPort || 587,
        secure: false,
        auth: { user, pass }
      });
      console.log(`✔ [EMAIL SERVICE] Configured Brevo SMTP Provider (${host}:587)`);
      return cachedTransporter;
    }
  }

  // 2. Check Resend SMTP (smtp.resend.com)
  if (process.env.RESEND_API_KEY || (smtpHost && smtpHost.includes('resend'))) {
    const host = smtpHost || 'smtp.resend.com';
    const user = 'resend';
    const pass = process.env.RESEND_API_KEY || smtpPass;
    if (pass) {
      cachedTransporter = nodemailer.createTransport({
        host,
        port: 465,
        secure: true,
        auth: { user, pass }
      });
      console.log(`✔ [EMAIL SERVICE] Configured Resend SMTP Provider (${host}:465)`);
      return cachedTransporter;
    }
  }

  // 3. Check SendGrid SMTP (smtp.sendgrid.net)
  if (process.env.SENDGRID_API_KEY || (smtpHost && smtpHost.includes('sendgrid'))) {
    const host = smtpHost || 'smtp.sendgrid.net';
    const user = 'apikey';
    const pass = process.env.SENDGRID_API_KEY || smtpPass;
    if (pass) {
      cachedTransporter = nodemailer.createTransport({
        host,
        port: 587,
        secure: false,
        auth: { user, pass }
      });
      console.log(`✔ [EMAIL SERVICE] Configured SendGrid SMTP Provider (${host}:587)`);
      return cachedTransporter;
    }
  }

  // 4. Custom SMTP Server
  if (smtpHost && smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });
    console.log(`✔ [EMAIL SERVICE] Configured Custom SMTP Provider (${smtpHost}:${smtpPort})`);
    return cachedTransporter;
  }

  // 5. Gmail Preset
  if (smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass }
    });
    console.log(`✔ [EMAIL SERVICE] Configured Gmail SMTP Provider (${smtpUser})`);
    return cachedTransporter;
  }

  // 6. Ethereal Test Account Fallback (Development)
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    console.log(`⚠️ [EMAIL SERVICE NOTICE] No production SMTP/API key found in .env.`);
    console.log(`   Initialized Ethereal Test Transporter: ${testAccount.user}`);
    console.log(`   OTPs will be logged directly to the server console.`);
  } catch (err) {
    console.error('❌ [EMAIL SERVICE ERROR] Ethereal fallback failed:', err.message);
  }

  return cachedTransporter;
}

/**
 * Send Email via HTTP API (Brevo REST API / Resend API / SendGrid API) or SMTP Transporter
 */
async function sendEmail({ to, subject, htmlText, plainText }) {
  // Use the verified Brevo sender email
  const fromEmail = process.env.EMAIL_FROM || 'ramachandranramachandran5944@gmail.com';
  const fromName = 'BHC Blood Donor Network';

  // --- OPTION A: Brevo HTTP REST API ---
  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { name: 'BHC Blood Donor', email: fromEmail },
          to: [{ email: to }],
          subject: subject,
          htmlContent: htmlText
        })
      });

      const resData = await response.json();
      if (response.ok) {
        console.log(`✔ [BREVO API SUCCESS] Email dispatched to ${to} | MessageID: ${resData.messageId}`);
        return { success: true, provider: 'Brevo API', messageId: resData.messageId };
      } else {
        console.error(`❌ [BREVO API ERROR]:`, resData);
      }
    } catch (apiErr) {
      console.error(`❌ [BREVO API FETCH ERROR]:`, apiErr.message);
    }
  }

  // --- OPTION B: Resend HTTP REST API ---
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${process.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject: subject,
          html: htmlText
        })
      });

      const resData = await response.json();
      if (response.ok) {
        console.log(`✔ [RESEND API SUCCESS] Email dispatched to ${to} | ID: ${resData.id}`);
        return { success: true, provider: 'Resend API', messageId: resData.id };
      } else {
        console.error(`❌ [RESEND API ERROR]:`, resData);
      }
    } catch (apiErr) {
      console.error(`❌ [RESEND API FETCH ERROR]:`, apiErr.message);
    }
  }

  // --- OPTION C: SendGrid HTTP REST API ---
  if (process.env.SENDGRID_API_KEY) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${process.env.SENDGRID_API_KEY}`
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: 'BHC Blood Donor' },
          subject: subject,
          content: [{ type: 'text/html', value: htmlText }]
        })
      });

      if (response.ok) {
        console.log(`✔ [SENDGRID API SUCCESS] Email dispatched to ${to}`);
        return { success: true, provider: 'SendGrid API' };
      } else {
        const errText = await response.text();
        console.error(`❌ [SENDGRID API ERROR]:`, errText);
      }
    } catch (apiErr) {
      console.error(`❌ [SENDGRID API FETCH ERROR]:`, apiErr.message);
    }
  }

  // --- OPTION D: Nodemailer SMTP Transporter ---
  const transporter = await getSmtpTransporter();
  if (transporter) {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html: htmlText,
      text: plainText
    });

    console.log(`✔ [SMTP DISPATCH SUCCESS] Email sent to: ${to} | MessageID: ${info.messageId}`);
    if (nodemailer.getTestMessageUrl && info) {
      console.log('   Ethereal Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    return { success: true, provider: 'SMTP', messageId: info.messageId };
  }

  throw new Error('No email provider or SMTP transporter available.');
}

/**
 * Verify Email Service Connectivity on Startup
 */
async function verifyEmailService() {
  if (process.env.BREVO_API_KEY) {
    console.log('✔ [EMAIL SERVICE] Brevo HTTP API Key configured.');
    return true;
  }
  if (process.env.RESEND_API_KEY) {
    console.log('✔ [EMAIL SERVICE] Resend HTTP API Key configured.');
    return true;
  }
  if (process.env.SENDGRID_API_KEY) {
    console.log('✔ [EMAIL SERVICE] SendGrid HTTP API Key configured.');
    return true;
  }

  const transporter = await getSmtpTransporter();
  if (transporter && transporter.verify) {
    transporter.verify((err) => {
      if (err) {
        console.error('❌ [SMTP VERIFICATION FAILED]:', err.message);
      } else {
        console.log('✔ [SMTP CONNECTION VERIFIED SUCCESSFUL]');
      }
    });
  }
}

module.exports = {
  sendEmail,
  verifyEmailService,
  getSmtpTransporter
};
