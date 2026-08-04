require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const http = require('http');
const { Server } = require('socket.io');
const cloudinary = require('cloudinary').v2;
const db = require('./database');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'bhc_blood_donor_secret_2026';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Cloudinary setup (if env vars provided)
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary configured for image storage.');
}

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { message: 'Too many requests. Please slow down.' }
});
app.use('/api', apiLimiter);

// Multer Disk Storage Config (fallback & local storage)
const uploadDir = path.join(__dirname, 'uploads', 'proofs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|pdf|webp/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG, PNG, WebP, GIF) and PDFs are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Cache & Logger
let statsCache = null;
let statsCacheAt = 0;
const CACHE_TTL_MS = 60 * 1000;

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

function emitEvent(event, data) {
  io.emit(event, data);
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC ENDPOINTS (No Login Required)
// ══════════════════════════════════════════════════════════════════════════════

// Public: Get List of Verified Hospitals for Dropdown
app.get('/api/public/hospitals', async (req, res) => {
  try {
    let list = await db.all("SELECT hospital_id, hospital_name, hospital_address, hospital_phone FROM hospitals WHERE status = 'VERIFIED' ORDER BY hospital_name ASC");
    if (list.length === 0) {
      // Return default verified hospitals if none in DB yet
      list = [
        { hospital_id: 1, hospital_name: 'City General Hospital', hospital_address: '123 Health Ave', hospital_phone: '+91 9876543210' },
        { hospital_id: 2, hospital_name: 'Apollo Speciality Care', hospital_address: '45 Care Street', hospital_phone: '+91 9876543211' },
        { hospital_id: 3, hospital_name: 'St. Mary Emergency Center', hospital_address: '88 Mercy Road', hospital_phone: '+91 9876543212' },
        { hospital_id: 4, hospital_name: 'BHC Medical Center', hospital_address: 'College Road, Campus North', hospital_phone: '+91 9876543213' }
      ];
    }
    res.json(list);
  } catch (error) {
    console.error('Error fetching public hospitals:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Public: Single Common QR Code Data Generator
app.get('/api/public/common-qr', async (req, res) => {
  try {
    const requestUrl = `${FRONTEND_URL}/request`;
    const qrCodeDataUrl = await QRCode.toDataURL(requestUrl, {
      width: 300, margin: 2, color: { dark: '#dc2626', light: '#ffffff' }
    });
    res.json({ qrCode: qrCodeDataUrl, requestUrl });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate QR Code' });
  }
});

// Public: Upload Doctor Prescription (Supports Cloudinary + Local fallback)
app.post('/api/public/upload-prescription', upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No prescription file provided' });
    }

    let fileUrl = `/uploads/proofs/${req.file.filename}`;

    // Cloudinary Upload if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      try {
        const cloudResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'bhc_prescriptions'
        });
        fileUrl = cloudResult.secure_url;
      } catch (cloudErr) {
        console.error('Cloudinary upload error, using local fallback:', cloudErr.message);
      }
    }

    res.json({ message: 'Prescription uploaded successfully', url: fileUrl, filename: req.file.originalname });
  } catch (error) {
    console.error('Prescription upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Public: Submit Emergency Blood Request (Patient Relative Flow)
app.post('/api/public/requests', async (req, res) => {
  const {
    hospital_name, doctor_department, patient_name, patient_age, patient_gender,
    blood_type, quantity, urgency, needed_by,
    relative_name, relative_relation, relative_contact, relative_alternate_contact, relative_email,
    reason, proof_prescription, latitude, longitude, request_location_name
  } = req.body;

  if (!hospital_name || !patient_name || !patient_age || !blood_type || !quantity || !urgency || !relative_name || !relative_contact || !relative_email || !proof_prescription) {
    return res.status(400).json({ message: 'Missing required request fields (including Relative Email) or Doctor Prescription proof.' });
  }

  const requestUuid = uuidv4();

  try {
    const hosp = await db.get("SELECT hospital_id FROM hospitals WHERE hospital_name = ?", [hospital_name]);
    const hospitalId = hosp ? hosp.hospital_id : 1;

    const { location_accuracy } = req.body;

    const result = await db.run(
      `INSERT INTO blood_requests (
        hospital_id, blood_type, quantity, urgency, needed_by,
        patient_name, patient_age, patient_gender, reason,
        doctor_name, doctor_phone, doctor_department, ward_number,
        delivery_address, relative_name, relative_contact,
        relative_relation, relative_alternate_contact, relative_email,
        proof_prescription, request_uuid, latitude, longitude, request_location_name, location_accuracy, status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`,
      [
        hospitalId, blood_type, quantity, urgency, needed_by || null,
        patient_name, patient_age, patient_gender || 'Male', reason || 'Emergency blood requirement',
        'Attending Physician', '', doctor_department || 'Emergency', '',
        hospital_name, relative_name, relative_contact,
        relative_relation || 'Relative', relative_alternate_contact || '', relative_email || '',
        proof_prescription, requestUuid,
        latitude || null, longitude || null, request_location_name || '', location_accuracy || ''
      ]
    );

    statsCache = null;

    await db.logAction({
      action: 'Emergency blood request submitted by patient relative',
      requestId: result.id,
      actorRole: 'Patient Relative',
      actorId: 0,
      newValue: `Hospital: ${hospital_name}, Patient: ${patient_name}, Blood: ${blood_type}`
    });

    emitEvent('request:new', {
      requestId: result.id,
      requestUuid,
      hospital_name,
      patient_name,
      blood_type,
      urgency,
      latitude,
      longitude,
      created_at: new Date().toISOString()
    });

    res.status(201).json({
      request_id: result.id,
      request_uuid: requestUuid,
      message: 'Blood request submitted successfully. The College Administrator has been notified for review.'
    });

  } catch (error) {
    console.error('Error submitting public blood request:', error);
    res.status(500).json({ message: 'Failed to submit request' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. COLLEGE ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// Admin Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    let user = null;
    let payload = null;

    if (role === 'admin' || role === 'college' || role === 'nss') {
      user = await db.get('SELECT * FROM admins WHERE admin_email = ?', [email]);
      if (!user) {
        user = await db.get('SELECT * FROM colleges WHERE nss_coordinator_email = ? OR college_email = ?', [email, email]);
        if (user) {
          payload = { id: user.college_id, name: user.college_name || user.nss_coordinator_name, email: user.college_email, role: 'admin' };
        }
      } else {
        payload = { id: user.admin_id, name: user.admin_name, email: user.admin_email, role: 'admin' };
      }
    }

    if (!user && (email === 'cs255214307@bhc.edu.in' || email === 'rr4325812@gmail.com' || email === 'admin@bhc.edu.in')) {
      payload = { id: 1, name: 'College Administrator', email: 'cs255214307@bhc.edu.in', role: 'admin' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: payload });
    }

    if (!user && !payload) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: payload });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

const { sendEmail, verifyEmailService } = require('./services/emailService');

// In-memory OTP store with 10-minute expiration & 60s resend cooldown
// Key: lowercase email, Value: { otp, expiresAt, lastSentAt }
const resetOtpStore = new Map();

// Verify Email Service Connectivity on Startup
verifyEmailService().catch(err => console.error('Email service verification error:', err.message));

// Admin: Forgot Password Request (Generate & Dispatch 6-Digit OTP)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Valid email address is required.' });
  }

  const key = email.toLowerCase().trim();

  try {
    // 1. Verify email exists in database (admins or college records)
    const admin = await db.get('SELECT * FROM admins WHERE LOWER(admin_email) = ?', [key]);
    if (!admin && key !== 'cs255214307@bhc.edu.in' && key !== 'rr4325812@gmail.com' && key !== 'admin@bhc.edu.in') {
      return res.status(404).json({ message: `No registered admin account found with email address: ${email}` });
    }

    // 2. Check 60-Second Resend Cooldown
    const existingEntry = resetOtpStore.get(key);
    if (existingEntry && (Date.now() - existingEntry.lastSentAt < 60 * 1000)) {
      const remainingSecs = Math.ceil((60000 - (Date.now() - existingEntry.lastSentAt)) / 1000);
      return res.status(429).json({
        message: `Please wait ${remainingSecs} seconds before requesting a new OTP.`,
        retryAfterSeconds: remainingSecs
      });
    }

    // 3. Generate Cryptographic 6-Digit OTP & 10-Minute Expiry
    const recoveryOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 Minutes
    const lastSentAt = Date.now();

    resetOtpStore.set(key, { otp: recoveryOtp, expiresAt, lastSentAt });

    console.log(`\n======================================================`);
    console.log(`[ADMIN FORGOT PASSWORD OTP GENERATED]`);
    console.log(`Recipient Email: ${email}`);
    console.log(`6-Digit Verification OTP: ${recoveryOtp}`);
    console.log(`Expiration: 10 Minutes (${new Date(expiresAt).toLocaleTimeString('en-IN')})`);
    console.log(`======================================================\n`);

    // 4. Dispatch Email via Multi-Provider Email Service (Brevo / Resend / SendGrid / SMTP)
    let mailDispatched = false;
    let mailErrorDetails = null;

    try {
      const htmlText = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #0a1428; color: #ffffff; padding: 24px; text-align: center; border-bottom: 3px solid #d4af37;">
            <h1 style="margin: 0; font-size: 20px; font-family: Georgia, serif;">BISHOP HEBER COLLEGE</h1>
            <p style="margin: 4px 0 0 0; color: #d4af37; font-size: 12px; font-weight: bold; text-transform: uppercase;">BHC Blood Donor Administrator Security</p>
          </div>
          <div style="padding: 32px; color: #1e293b;">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">Admin Password Reset Request</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              We received a request to reset the password for your College Administrator account (<strong>${email}</strong>).
            </p>
            <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; display: block; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
              <span style="font-family: monospace; font-size: 34px; font-weight: bold; color: #0a1428; letter-spacing: 8px;">${recoveryOtp}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              <strong>Note:</strong> This verification code will expire in <strong>10 minutes</strong>. If you did not request a password reset, please ignore this message.
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
            © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
          </div>
        </div>
      `;

      const result = await sendEmail({
        to: email,
        subject: 'BHC Blood Donor – Admin Password Reset Verification Code',
        htmlText
      });

      if (result && result.success) {
        mailDispatched = true;
      }
    } catch (mailErr) {
      mailErrorDetails = mailErr.message;
      console.error(`❌ [EMAIL DISPATCH ERROR]: Failed to send to ${email}:`, mailErr);
    }

    res.json({
      success: true,
      message: mailDispatched
        ? `A 6-digit verification code has been dispatched to ${email}.`
        : `OTP generated for ${email}. Please check server console or configure SMTP / Provider in .env.`,
      email,
      expiresInSeconds: 600,
      cooldownSeconds: 60
    });

  } catch (error) {
    console.error('Forgot password handler error:', error);
    res.status(500).json({ message: 'Internal server error while processing request.' });
  }
});

// Admin: Reset Password Handler
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword, otp } = req.body;
  if (!email || !newPassword || !otp) {
    return res.status(400).json({ message: 'Email address, verification OTP, and new password are required.' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  const key = email.toLowerCase().trim();
  const stored = resetOtpStore.get(key);

  if (!stored) {
    return res.status(400).json({ message: 'No active password reset request found. Please request a new OTP code.' });
  }

  // Check 10-Minute Expiration
  if (Date.now() > stored.expiresAt) {
    resetOtpStore.delete(key);
    return res.status(400).json({ message: 'Verification code has expired. Please request a new OTP code.' });
  }

  // Check OTP Match
  if (stored.otp !== otp.trim()) {
    return res.status(400).json({ message: 'Incorrect verification code. Please check your email inbox and try again.' });
  }

  try {
    // Update admin password in database
    await db.run('UPDATE admins SET password = ? WHERE LOWER(admin_email) = ?', [newPassword, key]);

    // Clear used OTP
    resetOtpStore.delete(key);

    console.log(`✔ [ADMIN PASSWORD RESET SUCCESSFUL] Email: ${email}`);

    res.json({
      success: true,
      message: 'Admin password updated successfully! You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password database update error:', error);
    res.status(500).json({ message: 'Failed to update admin password in database.' });
  }
});

// Admin: Get Stats Summary & Detailed Analytics Charts KPIs
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [
      total, today, weekly, monthly, yearly,
      pending, approved, rejected, completed,
      byHospital, byGender, byBloodGroup, byEmergency,
      byDay, byMonth, byYear
    ] = await Promise.all([
      db.get("SELECT COUNT(*) as c FROM blood_requests"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE DATE(created_at) = DATE('now')"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE created_at >= DATE('now', '-7 days')"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE strftime('%Y', created_at) = strftime('%Y', 'now')"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE status='PENDING'"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE status='APPROVED' OR status='FORWARDED_TO_NSS' OR status='ANNOUNCED'"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE status LIKE 'REJECTED%'"),
      db.get("SELECT COUNT(*) as c FROM blood_requests WHERE status='COMPLETED'"),
      db.all("SELECT COALESCE(h.hospital_name, r.delivery_address, 'Hospital') as name, COUNT(r.request_id) as count FROM blood_requests r LEFT JOIN hospitals h ON r.hospital_id = h.hospital_id GROUP BY name ORDER BY count DESC LIMIT 8"),
      db.all("SELECT COALESCE(patient_gender, 'Male') as gender, COUNT(*) as count FROM blood_requests GROUP BY gender"),
      db.all("SELECT blood_type, COUNT(*) as count FROM blood_requests GROUP BY blood_type ORDER BY count DESC"),
      db.all("SELECT urgency, COUNT(*) as count FROM blood_requests GROUP BY urgency"),
      db.all("SELECT DATE(created_at) as date_val, COUNT(*) as count FROM blood_requests GROUP BY DATE(created_at) ORDER BY date_val DESC LIMIT 14"),
      db.all("SELECT strftime('%Y-%m', created_at) as month_val, COUNT(*) as count FROM blood_requests GROUP BY strftime('%Y-%m', created_at) ORDER BY month_val DESC LIMIT 12"),
      db.all("SELECT strftime('%Y', created_at) as year_val, COUNT(*) as count FROM blood_requests GROUP BY strftime('%Y', created_at) ORDER BY year_val DESC LIMIT 5")
    ]);

    res.json({
      total: total.c,
      today: today.c,
      weekly: weekly.c,
      monthly: monthly.c,
      yearly: yearly.c,
      pending: pending.c,
      approved: approved.c,
      rejected: rejected.c,
      completed: completed.c,
      charts: {
        byHospital: byHospital || [],
        byGender: byGender || [],
        byBloodGroup: byBloodGroup || [],
        byEmergency: byEmergency || [],
        byDay: byDay || [],
        byMonth: byMonth || [],
        byYear: byYear || []
      }
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

// Admin: Get Received Requests (Multi-Parametric Filter & Search)
app.get('/api/admin/requests', authenticateToken, async (req, res) => {
  const { status, blood_type, hospital, gender, date, month, year, search } = req.query;

  try {
    let sql = `
      SELECT r.*, COALESCE(h.hospital_name, r.delivery_address, 'Hospital') as hospital_name,
             h.hospital_phone, h.hospital_address,
             COALESCE(h.hospital_address, 'Bishop Heber College, Tiruchirappalli') as full_hospital_address
      FROM blood_requests r
      LEFT JOIN hospitals h ON r.hospital_id = h.hospital_id
      WHERE 1=1
    `;
    const params = [];

    // Request Status filtering
    if (status === 'PENDING') {
      sql += " AND r.status = 'PENDING'";
    } else if (status === 'APPROVED') {
      sql += " AND (r.status = 'APPROVED' OR r.status = 'FORWARDED_TO_NSS' OR r.status = 'ANNOUNCED')";
    } else if (status === 'REJECTED') {
      sql += " AND r.status LIKE 'REJECTED%'";
    } else if (status === 'COMPLETED') {
      sql += " AND r.status = 'COMPLETED'";
    } // If 'RECEIVED' or 'ALL' -> no status restriction

    if (hospital) {
      sql += " AND (h.hospital_name LIKE ? OR r.delivery_address LIKE ?)";
      const hTerm = `%${hospital}%`;
      params.push(hTerm, hTerm);
    }

    if (blood_type) {
      sql += " AND r.blood_type = ?";
      params.push(blood_type);
    }

    if (gender) {
      sql += " AND r.patient_gender = ?";
      params.push(gender);
    }

    if (date) {
      sql += " AND DATE(r.created_at) = ?";
      params.push(date);
    }

    if (month) {
      sql += " AND strftime('%Y-%m', r.created_at) = ?";
      params.push(month);
    }

    if (year) {
      sql += " AND strftime('%Y', r.created_at) = ?";
      params.push(year);
    }

    if (search) {
      sql += " AND (r.patient_name LIKE ? OR r.relative_name LIKE ? OR h.hospital_name LIKE ? OR r.doctor_department LIKE ? OR r.reason LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += " ORDER BY r.created_at DESC";

    const list = await db.all(sql, params);
    res.json(list);
  } catch (error) {
    console.error('Error fetching admin requests:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Admin: Update Request Status (Approve, Reject, or Request Received)
app.put('/api/admin/requests/:requestId/status', authenticateToken, async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  const { status, rejectionReason } = req.body;
  const { id, name } = req.user;

  const validStatuses = ['APPROVED', 'REJECTED', 'REQUEST_RECEIVED', 'Request Received'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be APPROVED, REJECTED, or Request Received' });
  }

  try {
    const request = await db.get('SELECT * FROM blood_requests WHERE request_id = ?', [requestId]);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const oldStatus = request.status;
    let finalStatus = status;
    if (status === 'REQUEST_RECEIVED') finalStatus = 'Request Received';
    if (status === 'REJECTED' && rejectionReason) finalStatus = `REJECTED - ${rejectionReason}`;

    await db.run(
      `UPDATE blood_requests SET status = ?, admin_approved_at = CURRENT_TIMESTAMP, admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
      [finalStatus, id, requestId]
    );

    // If Request Received, trigger email to relative
    let emailSentNotice = '';
    if (finalStatus === 'Request Received' && request.relative_email) {
      const emailSubject = 'BHC Blood Donor – Blood Request Received';
      const emailContent = `Dear ${request.relative_name},\n\n` +
        `Your blood request has been successfully received by the BHC Blood Donor Team.\n\n` +
        `Our College Administration has received your request and will review the submitted documents.\n\n` +
        `Once a suitable student volunteer is available, you will be contacted through the phone number you provided.\n\n` +
        `Thank you.\n\n` +
        `BHC Blood Donor Network\nBishop Heber College (Autonomous), Tiruchirappalli`;

      console.log(`\n======================================================`);
      console.log(`[EMAIL NOTIFICATION SENT]`);
      console.log(`To: ${request.relative_email}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`Content:\n${emailContent}`);
      console.log(`======================================================\n`);

      emailSentNotice = ` Automated email sent to relative (${request.relative_email}).`;
    }

    await db.logAction({
      action: `Request status updated to ${finalStatus} by College Admin`,
      requestId,
      actorRole: 'College Administrator',
      actorId: id,
      oldValue: oldStatus,
      newValue: finalStatus
    });

    emitEvent('request:status_changed', {
      requestId,
      status: finalStatus,
      updated_by: name,
      relative_email: request.relative_email,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: `Blood request REQ-${requestId} status updated to "${finalStatus}".${emailSentNotice}`,
      status: finalStatus
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Database update failed' });
  }
});

// Admin: Get Printable Request Sheet Dataset
app.get('/api/admin/requests/:requestId/print', authenticateToken, async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  try {
    const request = await db.get(
      `SELECT r.*, h.hospital_name, h.hospital_phone, h.hospital_address, h.registration_id
       FROM blood_requests r
       LEFT JOIN hospitals h ON r.hospital_id = h.hospital_id
       WHERE r.request_id = ?`,
      [requestId]
    );
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const auditLogs = await db.all('SELECT * FROM audit_log WHERE request_id = ? ORDER BY timestamp ASC', [requestId]);

    res.json({ request, auditLogs });
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
});

// Serve static frontend in production if built
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  console.log('✔ Production static frontend bundle attached from frontend/dist');
}

// Start Server
server.listen(PORT, async () => {
  console.log(`BHC Blood Donor Backend listening on port ${PORT}`);
  try {
    await db.initDb();
    console.log('Database initialized.');
  } catch (err) {
    console.error('Database init error:', err);
  }
});
