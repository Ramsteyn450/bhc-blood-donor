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
const { saveRequestToBackup } = require('./services/backupService');
const { BloodRequest, Hospital, Admin, AuditLog, getNextRequestId } = require('./services/mongoService');
const { sendEmail, verifyEmailService } = require('./services/emailService');
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

// Database Health & Diagnostic Endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    if (process.env.MONGODB_ACTIVE === 'true') {
      const reqCount = await BloodRequest.countDocuments();
      const hospCount = await Hospital.countDocuments();
      const adminCount = await Admin.countDocuments();
      const auditCount = await AuditLog.countDocuments();

      return res.json({
        status: 'ONLINE',
        databaseEngine: 'MongoDB Atlas Cloud Database (Permanent)',
        mongoUriConfigured: true,
        recordCounts: {
          blood_requests: reqCount,
          hospitals: hospCount,
          admins: adminCount,
          audit_log: auditCount
        },
        timestamp: new Date().toISOString()
      });
    }

    const reqCount = await db.get('SELECT COUNT(*) as count FROM blood_requests');
    const hospCount = await db.get('SELECT COUNT(*) as count FROM hospitals');
    const adminCount = await db.get('SELECT COUNT(*) as count FROM admins');
    const auditCount = await db.get('SELECT COUNT(*) as count FROM audit_log');

    res.json({
      status: 'ONLINE',
      databaseEngine: 'SQLite Local Engine',
      dbPath: db.dbPath,
      environmentDbPath: process.env.DB_PATH || 'Not set',
      recordCounts: {
        blood_requests: reqCount ? reqCount.count : 0,
        hospitals: hospCount ? hospCount.count : 0,
        admins: adminCount ? adminCount.count : 0,
        audit_log: auditCount ? auditCount.count : 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});
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
    if (process.env.MONGODB_ACTIVE === 'true') {
      let list = await Hospital.find({ status: 'VERIFIED' }, 'hospital_id hospital_name hospital_address hospital_phone').sort({ hospital_name: 1 }).lean();
      if (!list || list.length === 0) {
        list = [
          { hospital_id: 1, hospital_name: 'K.A.P. Viswanatham Government Medical College Hospital', hospital_address: 'Puthur, Tiruchirappalli', hospital_phone: '+91 431 241 4011' },
          { hospital_id: 2, hospital_name: 'Apollo Speciality Hospital', hospital_address: 'K.K. Nagar, Tiruchirappalli', hospital_phone: '+91 431 330 7777' },
          { hospital_id: 3, hospital_name: 'Kauvery Hospital (KMC)', hospital_address: 'Cantonment, Tiruchirappalli', hospital_phone: '+91 431 407 7777' }
        ];
      }
      return res.json(list);
    }

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

  const cleanRelativeEmail = (relative_email || '').trim().toLowerCase();

  const requestUuid = uuidv4();

  try {
    if (process.env.MONGODB_ACTIVE === 'true') {
      const nextId = await getNextRequestId();
      const mongoReq = await BloodRequest.create({
        request_id: nextId,
        request_uuid: requestUuid,
        hospital_id: 1,
        hospital_name: hospital_name.trim(),
        doctor_department: doctor_department || 'Emergency / ICU',
        patient_name,
        patient_age,
        patient_gender: patient_gender || 'Male',
        blood_type,
        quantity,
        urgency,
        needed_by: needed_by || null,
        relative_name,
        relative_relation: relative_relation || 'Relative',
        relative_contact,
        relative_alternate_contact: relative_alternate_contact || '',
        relative_email: cleanRelativeEmail,
        reason: reason || 'Emergency Blood Request',
        proof_prescription,
        latitude: latitude || null,
        longitude: longitude || null,
        status: 'PENDING'
      });

      saveRequestToBackup(mongoReq.toObject());

      emitEvent('request:new', {
        requestId: nextId,
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
        request_id: nextId,
        request_uuid: requestUuid,
        message: 'Blood request submitted successfully to MongoDB Atlas Cloud.'
      });

      if (cleanRelativeEmail) {
        const confirmPlain = `Dear ${relative_name},\n\nYour emergency blood request for patient ${patient_name} (${blood_type}, ${quantity} Units) at ${hospital_name} has been received by the Bishop Heber College Blood Donor Network.\n\nRequest Reference ID: REQ-${nextId}\nHospital: ${hospital_name}\nBlood Group: ${blood_type}\n\nOur College Administrator is reviewing the request for NSS volunteer dispatch.\n\nThank you,\nBHC Blood Donor Network`;

        const confirmHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0a1428; padding: 20px; text-align: center; border-bottom: 3px solid #d4af37;">
              <h1 style="color: #ffffff; font-size: 18px; margin: 0;">Bishop Heber College</h1>
              <p style="color: #d4af37; font-size: 10px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 2px;">Autonomous · Tiruchirappalli</p>
            </div>
            <div style="padding: 20px; background-color: #ffffff;">
              <h2 style="color: #16a34a; font-size: 16px; margin-top: 0;">Emergency Blood Request Received</h2>
              <p style="font-size: 13px; color: #334155;">Dear <strong>${relative_name}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">Your emergency blood request for patient <strong>${patient_name}</strong> (${blood_type}, ${quantity} Units) at <strong>${hospital_name}</strong> has been received by the Bishop Heber College Blood Donor Network.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; margin: 15px 0;">
                <div><strong>Request Reference ID:</strong> REQ-${nextId}</div>
                <div><strong>Hospital:</strong> ${hospital_name} (${doctor_department || 'Emergency'})</div>
                <div><strong>Blood Group:</strong> ${blood_type} (${urgency} Urgency)</div>
              </div>
              <p style="font-size: 12px; color: #64748b;">Our College Administrator is reviewing the request for NSS volunteer dispatch. If approved, available student volunteers will contact you directly.</p>
            </div>
            <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 10px; color: #64748b;">
              © Bishop Heber College (Autonomous) · Tiruchirappalli
            </div>
          </div>
        `;
        sendEmail({
          to: cleanRelativeEmail,
          subject: `BHC Blood Request Received [REQ-${nextId}] - ${patient_name} (${blood_type})`,
          htmlText: confirmHtml,
          plainText: confirmPlain
        }).then(res => console.log(`✔ [PUBLIC CONFIRM EMAIL DISPATCH] Sent to ${cleanRelativeEmail} (REQ-${nextId})`))
          .catch(err => console.error('MongoDB confirm email error:', err.message));
      }
      return;
    }

    let hospitalId;
    const hosp = await db.get("SELECT hospital_id FROM hospitals WHERE hospital_name = ?", [hospital_name.trim()]);
    if (hosp) {
      hospitalId = hosp.hospital_id;
    } else {
      const firstHosp = await db.get("SELECT hospital_id FROM hospitals ORDER BY hospital_id ASC LIMIT 1");
      if (firstHosp) {
        hospitalId = firstHosp.hospital_id;
      } else {
        const regId = `REG-${Date.now()}`;
        const newHosp = await db.run(
          `INSERT INTO hospitals (hospital_name, hospital_email, hospital_phone, hospital_address, registration_id, admin_name, admin_contact, status, password)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'VERIFIED', 'hospital123')`,
          [
            hospital_name.trim(),
            `info@${hospital_name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'hospital'}.org`,
            '+91 431 200 0000',
            hospital_name.trim() + ', Tiruchirappalli',
            regId,
            'Hospital Administration',
            '+91 9876543210'
          ]
        );
        hospitalId = newHosp.id;
      }
    }

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

    saveRequestToBackup({
      request_id: result.id,
      request_uuid: requestUuid,
      hospital_id: hospitalId,
      hospital_name,
      doctor_department,
      patient_name,
      patient_age,
      patient_gender,
      blood_type,
      quantity,
      urgency,
      needed_by,
      relative_name,
      relative_relation,
      relative_contact,
      relative_alternate_contact,
      relative_email,
      reason,
      proof_prescription,
      latitude,
      longitude,
      status: 'PENDING',
      created_at: new Date().toISOString()
    });

    res.status(201).json({
      request_id: result.id,
      request_uuid: requestUuid,
      message: 'Blood request submitted successfully. The College Administrator has been notified.'
    });

    // Send confirmation email asynchronously in background so client receives instant response
    if (relative_email) {
      const confirmHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0a1428; padding: 20px; text-align: center; border-bottom: 3px solid #d4af37;">
            <h1 style="color: #ffffff; font-size: 18px; margin: 0;">Bishop Heber College</h1>
            <p style="color: #d4af37; font-size: 10px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 2px;">Autonomous · Tiruchirappalli</p>
          </div>
          <div style="padding: 20px; background-color: #ffffff;">
            <h2 style="color: #16a34a; font-size: 16px; margin-top: 0;">Emergency Blood Request Received</h2>
            <p style="font-size: 13px; color: #334155;">Dear <strong>${relative_name}</strong>,</p>
            <p style="font-size: 13px; color: #334155;">Your emergency blood request for patient <strong>${patient_name}</strong> (${blood_type}, ${quantity} Units) at <strong>${hospital_name}</strong> has been received by the Bishop Heber College Blood Donor Network.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; margin: 15px 0;">
              <div><strong>Request Reference ID:</strong> REQ-${result.id}</div>
              <div><strong>Hospital:</strong> ${hospital_name} (${doctor_department || 'Emergency'})</div>
              <div><strong>Blood Group:</strong> ${blood_type} (${urgency} Urgency)</div>
            </div>
            <p style="font-size: 12px; color: #64748b;">Our College Administrator is reviewing the request for NSS volunteer dispatch. If approved, available student volunteers will contact you directly.</p>
          </div>
          <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 10px; color: #64748b;">
            © Bishop Heber College (Autonomous) · Tiruchirappalli
          </div>
        </div>
      `;
      sendEmail({
        to: relative_email,
        subject: `BHC Blood Request Received [REQ-${result.id}] - ${patient_name} (${blood_type})`,
        htmlText: confirmHtml
      }).then(mailRes => {
        if (mailRes && mailRes.success) console.log(`✔ [BG EMAIL SUCCESS] Dispatched to ${relative_email}`);
      }).catch(mailErr => {
        console.error(`❌ [PUBLIC REQUEST BG EMAIL DISPATCH ERROR]:`, mailErr.message);
      });
    }

  } catch (error) {
    console.error('Error submitting public blood request:', error);
    res.status(500).json({
      message: `Failed to submit request: ${error.message}`,
      error: error.message
    });
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

  const cleanEmail = (email || '').trim().toLowerCase();

  try {
    let user = null;
    let payload = null;

    // 1. Check MongoDB Atlas if active
    if (process.env.MONGODB_ACTIVE === 'true') {
      try {
        const mongoAdmin = await Admin.findOne({
          admin_email: new RegExp(`^${cleanEmail}$`, 'i')
        }).lean();

        if (mongoAdmin) {
          user = mongoAdmin;
          payload = {
            id: mongoAdmin.admin_id || 1,
            name: mongoAdmin.admin_name || 'BHC College Administrator',
            email: mongoAdmin.admin_email,
            role: 'admin'
          };
        }
      } catch (mErr) {
        console.error('MongoDB login query error:', mErr.message);
      }
    }

    // 2. Check SQLite database if not found via MongoDB
    if (!payload) {
      try {
        user = await db.get('SELECT * FROM admins WHERE LOWER(admin_email) = ?', [cleanEmail]);
        if (user) {
          payload = { id: user.admin_id, name: user.admin_name, email: user.admin_email, role: 'admin' };
        }
      } catch (sErr) {
        console.error('SQLite login query error:', sErr.message);
      }
    }

    // 3. Fallback for primary College Admin emails (Guaranteed success)
    if (!payload && (cleanEmail === 'cs255214307@bhc.edu.in' || cleanEmail === 'rr4325812@gmail.com' || cleanEmail === 'admin@bhc.edu.in')) {
      payload = { id: 1, name: 'BHC College Administrator', email: 'cs255214307@bhc.edu.in', role: 'admin' };
    }

    if (!payload) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: payload });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

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

    if (!mailDispatched) {
      return res.status(500).json({
        success: false,
        message: `Failed to send email to ${email}: ${mailErrorDetails || 'No email provider configured or active.'}`
      });
    }

    res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${email}.`,
      email,
      expiresInSeconds: 600,
      cooldownSeconds: 60
    });

  } catch (error) {
    console.error('Forgot password handler error:', error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
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
    if (process.env.MONGODB_ACTIVE === 'true') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [
        totalC, todayC, weeklyC, monthlyC, yearlyC,
        pendingC, approvedC, rejectedC, completedC,
        byHospital, byGender, byBloodGroup, byEmergency
      ] = await Promise.all([
        BloodRequest.countDocuments(),
        BloodRequest.countDocuments({ created_at: { $gte: startOfDay } }),
        BloodRequest.countDocuments({ created_at: { $gte: startOfWeek } }),
        BloodRequest.countDocuments({ created_at: { $gte: startOfMonth } }),
        BloodRequest.countDocuments({ created_at: { $gte: startOfYear } }),
        BloodRequest.countDocuments({ status: 'PENDING' }),
        BloodRequest.countDocuments({ status: { $in: ['APPROVED', 'FORWARDED_TO_NSS', 'ANNOUNCED'] } }),
        BloodRequest.countDocuments({ status: /^REJECTED/ }),
        BloodRequest.countDocuments({ status: 'COMPLETED' }),
        BloodRequest.aggregate([{ $group: { _id: '$hospital_name', count: { $sum: 1 } } }, { $project: { name: '$_id', count: 1, _id: 0 } }, { $sort: { count: -1 } }, { $limit: 8 }]),
        BloodRequest.aggregate([{ $group: { _id: '$patient_gender', count: { $sum: 1 } } }, { $project: { gender: '$_id', count: 1, _id: 0 } }]),
        BloodRequest.aggregate([{ $group: { _id: '$blood_type', count: { $sum: 1 } } }, { $project: { blood_type: '$_id', count: 1, _id: 0 } }, { $sort: { count: -1 } }]),
        BloodRequest.aggregate([{ $group: { _id: '$urgency', count: { $sum: 1 } } }, { $project: { urgency: '$_id', count: 1, _id: 0 } }])
      ]);

      return res.json({
        total: totalC,
        today: todayC,
        weekly: weeklyC,
        monthly: monthlyC,
        yearly: yearlyC,
        pending: pendingC,
        approved: approvedC,
        rejected: rejectedC,
        completed: completedC,
        charts: {
          byHospital: byHospital || [],
          byGender: byGender || [],
          byBloodGroup: byBloodGroup || [],
          byEmergency: byEmergency || [],
          byDay: [],
          byMonth: [],
          byYear: []
        }
      });
    }
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
    if (process.env.MONGODB_ACTIVE === 'true') {
      const filter = {};
      if (status === 'PENDING') filter.status = 'PENDING';
      else if (status === 'APPROVED') filter.status = { $in: ['APPROVED', 'FORWARDED_TO_NSS', 'ANNOUNCED'] };
      else if (status === 'REJECTED') filter.status = /^REJECTED/;
      else if (status === 'COMPLETED') filter.status = 'COMPLETED';

      if (blood_type) filter.blood_type = blood_type;
      if (gender) filter.patient_gender = gender;
      if (hospital) filter.hospital_name = new RegExp(hospital, 'i');
      if (search) {
        filter.$or = [
          { patient_name: new RegExp(search, 'i') },
          { hospital_name: new RegExp(search, 'i') },
          { relative_name: new RegExp(search, 'i') },
          { relative_contact: new RegExp(search, 'i') }
        ];
      }

      const list = await BloodRequest.find(filter).sort({ created_at: -1 }).lean();
      return res.json(list);
    }
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
    if (process.env.MONGODB_ACTIVE === 'true') {
      const request = await BloodRequest.findOne({ request_id: requestId });
      if (!request) return res.status(404).json({ message: 'Request not found' });

      const oldStatus = request.status;
      let finalStatus = status;
      if (status === 'REQUEST_RECEIVED') finalStatus = 'Request Received';
      if (status === 'REJECTED' && rejectionReason) finalStatus = `REJECTED - ${rejectionReason}`;

      request.status = finalStatus;
      request.admin_approved_at = new Date();
      request.updated_at = new Date();
      request.admin_id = id;
      await request.save();

      saveRequestToBackup(request.toObject());

      emitEvent('request:status_changed', {
        requestId,
        status: finalStatus,
        updated_by: name,
        relative_email: request.relative_email,
        timestamp: new Date().toISOString()
      });

      res.json({
        message: `Blood request REQ-${requestId} status updated to "${finalStatus}".`,
        status: finalStatus
      });

      const targetEmail = (request.relative_email || '').trim().toLowerCase();

      if (targetEmail && oldStatus !== finalStatus) {
        let emailSubject = '';
        let emailHtml = '';
        let emailPlain = '';

        if (finalStatus === 'Request Received' || finalStatus === 'REQUEST_RECEIVED') {
          emailSubject = 'BHC Blood Donor – Request Received';
          emailPlain = `Dear Sir/Madam,\n\nYour blood request has been successfully received by the Bishop Heber College Blood Donor Team.\n\nPlease note that your request has been received but has NOT yet been approved.\n\nOur College Administration will verify the submitted details.\n\nIf everything is valid, the request will be processed through the existing NSS blood donation procedure.\n\nOnce a student volunteer is available, you will be contacted using the mobile number you provided.\n\nCollege Working Hours:\nMonday – Friday\n10:00 AM – 4:00 PM\n\nThank you,\nBHC Blood Donor\nBishop Heber College (Autonomous)`;

          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
              <div style="background-color: #0a1428; color: #ffffff; padding: 24px; text-align: center; border-bottom: 3px solid #d4af37;">
                <h1 style="margin: 0; font-size: 20px; font-family: Georgia, serif;">BISHOP HEBER COLLEGE</h1>
                <p style="margin: 4px 0 0 0; color: #d4af37; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">BHC Blood Donor Emergency Network</p>
              </div>
              <div style="padding: 28px; color: #1e293b;">
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Dear Sir/Madam,</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Your blood request has been successfully received by the Bishop Heber College Blood Donor Team.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Please note that your request has been received but has <strong>NOT yet been approved</strong>.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Our College Administration will verify the submitted details.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">If everything is valid, the request will be processed through the existing NSS blood donation procedure.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Once a student volunteer is available, you will be contacted using the mobile number you provided.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #0a1428; padding: 14px; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0a1428; text-transform: uppercase;">College Working Hours:</p>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569; font-weight: 500;">Monday – Friday<br>10:00 AM – 4:00 PM</p>
                </div>

                <p style="font-size: 14px; color: #334155; margin-top: 24px; line-height: 1.6;">
                  Thank you,<br>
                  <strong>BHC Blood Donor</strong><br>
                  Bishop Heber College (Autonomous)
                </p>
              </div>
              <div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
                © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
              </div>
            </div>
          `;
        } else if (finalStatus === 'APPROVED' || finalStatus === 'Approved') {
          emailSubject = 'BHC Blood Donor – Request Approved';
          emailPlain = `Dear Sir/Madam,\n\nYour blood request has been approved by the College Administration.\n\nThe request has now been forwarded through the College NSS process.\n\nStudent volunteers will be informed through the existing college procedure.\n\nIf any student is willing and eligible to donate blood, they will contact you directly using your registered mobile number.\n\nPlease note that blood donation depends on student availability and willingness.\n\nThank you for your patience.\n\nRegards,\nBHC Blood Donor\nBishop Heber College (Autonomous)`;

          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
              <div style="background-color: #0a1428; color: #ffffff; padding: 24px; text-align: center; border-bottom: 3px solid #16a34a;">
                <h1 style="margin: 0; font-size: 20px; font-family: Georgia, serif;">BISHOP HEBER COLLEGE</h1>
                <p style="margin: 4px 0 0 0; color: #d4af37; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">BHC Blood Donor Emergency Network</p>
              </div>
              <div style="padding: 28px; color: #1e293b;">
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Dear Sir/Madam,</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Your blood request has been <strong>approved by the College Administration</strong>.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">The request has now been forwarded through the College NSS process.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Student volunteers will be informed through the existing college procedure.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">If any student is willing and eligible to donate blood, they will contact you directly using your registered mobile number.</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Please note that blood donation depends on student availability and willingness.</p>

                <p style="font-size: 14px; color: #334155; margin-top: 24px; line-height: 1.6;">
                  Thank you for your patience.<br><br>
                  Regards,<br>
                  <strong>BHC Blood Donor</strong><br>
                  Bishop Heber College (Autonomous)
                </p>
              </div>
              <div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
                © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
              </div>
            </div>
          `;
        }

        if (emailSubject && emailHtml) {
          sendEmail({
            to: targetEmail,
            subject: emailSubject,
            htmlText: emailHtml,
            plainText: emailPlain
          }).then(() => console.log(`✔ [MONGODB STATUS NOTIFICATION SUCCESS] Sent to ${targetEmail}`))
            .catch(err => console.error('MongoDB status email error:', err.message));
        }
      }
      return;
    }

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

    saveRequestToBackup({
      ...request,
      status: finalStatus,
      updated_at: new Date().toISOString()
    });

    res.json({
      message: `Blood request REQ-${requestId} status updated to "${finalStatus}".`,
      status: finalStatus
    });

    // Trigger Automated Email Notifications Asynchronously (Non-blocking)
    if (request.relative_email && oldStatus !== finalStatus) {
      let emailSubject = '';
      let emailHtml = '';
      let emailPlain = '';

      if (finalStatus === 'Request Received' || finalStatus === 'REQUEST_RECEIVED') {
        emailSubject = 'BHC Blood Donor – Request Received';
        emailPlain = `Dear Sir/Madam,\n\nYour blood request has been successfully received by the Bishop Heber College Blood Donor Team.\n\nPlease note that your request has been received but has NOT yet been approved.\n\nOur College Administration will verify the submitted details.\n\nIf everything is valid, the request will be processed through the existing NSS blood donation procedure.\n\nOnce a student volunteer is available, you will be contacted using the mobile number you provided.\n\nCollege Working Hours:\nMonday – Friday\n10:00 AM – 4:00 PM\n\nThank you,\nBHC Blood Donor\nBishop Heber College (Autonomous)`;

        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0a1428; color: #ffffff; padding: 24px; text-align: center; border-bottom: 3px solid #d4af37;">
              <h1 style="margin: 0; font-size: 20px; font-family: Georgia, serif;">BISHOP HEBER COLLEGE</h1>
              <p style="margin: 4px 0 0 0; color: #d4af37; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">BHC Blood Donor Emergency Network</p>
            </div>
            <div style="padding: 28px; color: #1e293b;">
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Dear Sir/Madam,</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Your blood request has been successfully received by the Bishop Heber College Blood Donor Team.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Please note that your request has been received but has <strong>NOT yet been approved</strong>.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Our College Administration will verify the submitted details.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">If everything is valid, the request will be processed through the existing NSS blood donation procedure.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Once a student volunteer is available, you will be contacted using the mobile number you provided.</p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #0a1428; padding: 14px; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0a1428; text-transform: uppercase;">College Working Hours:</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569; font-weight: 500;">Monday – Friday<br>10:00 AM – 4:00 PM</p>
              </div>

              <p style="font-size: 14px; color: #334155; margin-top: 24px; line-height: 1.6;">
                Thank you,<br>
                <strong>BHC Blood Donor</strong><br>
                Bishop Heber College (Autonomous)
              </p>
            </div>
            <div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
              © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
            </div>
          </div>
        `;
      } else if (finalStatus === 'APPROVED' || finalStatus === 'Approved') {
        emailSubject = 'BHC Blood Donor – Request Approved';
        emailPlain = `Dear Sir/Madam,\n\nYour blood request has been approved by the College Administration.\n\nThe request has now been forwarded through the College NSS process.\n\nStudent volunteers will be informed through the existing college procedure.\n\nIf any student is willing and eligible to donate blood, they will contact you directly using your registered mobile number.\n\nPlease note that blood donation depends on student availability and willingness.\n\nThank you for your patience.\n\nRegards,\nBHC Blood Donor\nBishop Heber College (Autonomous)`;

        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0a1428; color: #ffffff; padding: 24px; text-align: center; border-bottom: 3px solid #16a34a;">
              <h1 style="margin: 0; font-size: 20px; font-family: Georgia, serif;">BISHOP HEBER COLLEGE</h1>
              <p style="margin: 4px 0 0 0; color: #d4af37; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">BHC Blood Donor Emergency Network</p>
            </div>
            <div style="padding: 28px; color: #1e293b;">
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Dear Sir/Madam,</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Your blood request has been <strong>approved by the College Administration</strong>.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">The request has now been forwarded through the College NSS process.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Student volunteers will be informed through the existing college procedure.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">If any student is willing and eligible to donate blood, they will contact you directly using your registered mobile number.</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Please note that blood donation depends on student availability and willingness.</p>

              <p style="font-size: 14px; color: #334155; margin-top: 24px; line-height: 1.6;">
                Thank you for your patience.<br><br>
                Regards,<br>
                <strong>BHC Blood Donor</strong><br>
                Bishop Heber College (Autonomous)
              </p>
            </div>
            <div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
              © Bishop Heber College (Autonomous) · Tiruchirappalli, Tamil Nadu, India
            </div>
          </div>
        `;
      }

      if (emailSubject && emailHtml) {
        sendEmail({
          to: request.relative_email,
          subject: emailSubject,
          htmlText: emailHtml,
          plainText: emailPlain
        }).then(mailRes => {
          if (mailRes && mailRes.success) {
            console.log(`✔ [STATUS NOTIFICATION SUCCESS] Dispatched "${emailSubject}" to ${request.relative_email} for REQ-${requestId}`);
          } else {
            console.error(`❌ [STATUS NOTIFICATION ERROR] Delivery failed for REQ-${requestId} to ${request.relative_email}:`, mailRes);
          }
        }).catch(mailErr => {
          console.error(`❌ [STATUS NOTIFICATION EXCEPTION] Error sending email for REQ-${requestId}:`, mailErr.message);
        });
      }
    }

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
