const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Support process.env.DB_PATH (e.g., Render Persistent Disk /data/blood_bank.db)
const defaultDbDir = __dirname;
const dbPath = process.env.DB_PATH || path.join(defaultDbDir, 'blood_bank.db');

// Ensure target database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`\n======================================================`);
console.log(`🗄️  [SQLITE DATABASE CONFIGURATION]`);
console.log(`   Runtime Database File Path: ${dbPath}`);
console.log(`   Environment DB_PATH:       ${process.env.DB_PATH || 'Not set (using local directory)'}`);
console.log(`======================================================\n`);

const db = new sqlite3.Database(dbPath);

// Promised database query helpers with detailed operation logging
function run(sql, params = [], silent = false) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    db.run(sql, params, function (err) {
      const duration = Date.now() - startTime;
      if (err) {
        if (!silent) console.error(`❌ [SQL RUN ERROR] (${duration}ms):`, err.message, '\n   Query:', sql);
        reject(err);
      } else {
        const opType = sql.trim().split(' ')[0].toUpperCase();
        if (!silent && (opType === 'INSERT' || opType === 'UPDATE' || opType === 'DELETE')) {
          console.log(`✔ [SQL ${opType}] (${duration}ms) LastID: ${this.lastID}, Changes: ${this.changes}`);
        }
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    db.get(sql, params, (err, row) => {
      const duration = Date.now() - startTime;
      if (err) {
        console.error(`❌ [SQL GET ERROR] (${duration}ms):`, err.message, '\n   Query:', sql);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    db.all(sql, params, (err, rows) => {
      const duration = Date.now() - startTime;
      if (err) {
        console.error(`❌ [SQL ALL ERROR] (${duration}ms):`, err.message, '\n   Query:', sql);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Helper to log changes to the audit log table
async function logAction({ action, requestId = null, actorRole, actorId, oldValue = null, newValue = null, ipAddress = '127.0.0.1' }) {
  const sql = `
    INSERT INTO audit_log (action, request_id, actor_role, actor_id, old_value, new_value, timestamp, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `;
  try {
    await run(sql, [action, requestId, actorRole, actorId, oldValue, newValue, ipAddress]);
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
}

// Safe helper to add a column if it doesn't exist yet
async function addColumnIfNotExists(table, column, definition) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], true);
    console.log(`  ✔ Added column: ${table}.${column}`);
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error(`  ✗ Error adding ${table}.${column}:`, err.message);
    }
    // duplicate column = already exists, silently skip
  }
}

// Initialize base tables + run migrations
async function initDb() {
  // Check if MongoDB Atlas is configured
  if (process.env.MONGODB_URI) {
    try {
      const { connectMongoDB } = require('./services/mongoService');
      const mongoSuccess = await connectMongoDB();
      if (mongoSuccess) {
        process.env.MONGODB_ACTIVE = 'true';
        console.log('✔ [DATABASE INITIALIZER] MongoDB Atlas Cloud Database initialized successfully.');
        return;
      }
    } catch (mongoErr) {
      console.error('MongoDB Atlas initialization failed, falling back to SQLite:', mongoErr.message);
    }
  }

  await run('PRAGMA foreign_keys = ON;');
  await run('PRAGMA journal_mode = WAL;'); // Better concurrent read performance

  // ── TABLE: hospitals ──────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS hospitals (
      hospital_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_name VARCHAR(255) NOT NULL,
      hospital_email VARCHAR(255) UNIQUE NOT NULL,
      hospital_phone VARCHAR(15) NOT NULL,
      hospital_address TEXT NOT NULL,
      registration_id VARCHAR(255) NOT NULL,
      admin_name    VARCHAR(255) NOT NULL,
      admin_contact VARCHAR(15) NOT NULL,
      status        VARCHAR(20) DEFAULT 'PENDING',
      password      VARCHAR(255) NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      verified_at   TIMESTAMP,
      verified_by   INTEGER
    )
  `);
  // Migrations: new QR columns
  await addColumnIfNotExists('hospitals', 'qr_token', 'VARCHAR(255)');
  await addColumnIfNotExists('hospitals', 'qr_code',  'TEXT');

  // ── TABLE: colleges ───────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS colleges (
      college_id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_name VARCHAR(255) NOT NULL,
      college_email VARCHAR(255) UNIQUE NOT NULL,
      college_phone VARCHAR(15) NOT NULL,
      college_address TEXT NOT NULL,
      nss_coordinator_name VARCHAR(255) NOT NULL,
      nss_coordinator_contact VARCHAR(15) NOT NULL,
      nss_coordinator_email VARCHAR(255) UNIQUE NOT NULL,
      status   VARCHAR(20) DEFAULT 'ACTIVE',
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── TABLE: students ───────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS students (
      student_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_name  VARCHAR(255) NOT NULL,
      student_email VARCHAR(255) UNIQUE NOT NULL,
      student_phone VARCHAR(15) NOT NULL,
      college_id INTEGER,
      blood_type VARCHAR(5) NOT NULL,
      age INTEGER NOT NULL,
      medical_conditions TEXT,
      last_donation_date DATE,
      donation_count INTEGER DEFAULT 0,
      status   VARCHAR(20) DEFAULT 'ACTIVE',
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE SET NULL
    )
  `);

  // ── TABLE: blood_requests ─────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS blood_requests (
      request_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id    INTEGER NOT NULL,
      blood_type     VARCHAR(5) NOT NULL,
      quantity       INTEGER NOT NULL,
      urgency        VARCHAR(20) NOT NULL,
      patient_name   VARCHAR(255) NOT NULL,
      patient_age    INTEGER NOT NULL,
      reason         VARCHAR(255) NOT NULL,
      doctor_name    VARCHAR(255) NOT NULL,
      doctor_phone   VARCHAR(15) NOT NULL,
      delivery_address TEXT NOT NULL,
      relative_name  VARCHAR(255) NOT NULL,
      relative_contact VARCHAR(15) NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING',
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      admin_approved_at TIMESTAMP,
      admin_id       INTEGER,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE CASCADE
    )
  `);
  // Migrations: new request fields
  await addColumnIfNotExists('blood_requests', 'request_uuid',       'VARCHAR(36)');
  await addColumnIfNotExists('blood_requests', 'doctor_department',  'VARCHAR(255)');
  await addColumnIfNotExists('blood_requests', 'ward_number',        'VARCHAR(50)');
  await addColumnIfNotExists('blood_requests', 'patient_gender',     'VARCHAR(20)');
  await addColumnIfNotExists('blood_requests', 'proof_prescription', 'TEXT');
  await addColumnIfNotExists('blood_requests', 'proof_case_sheet',   'TEXT');
  await addColumnIfNotExists('blood_requests', 'proof_signature',    'TEXT');
  await addColumnIfNotExists('blood_requests', 'proof_seal',         'TEXT');
  await addColumnIfNotExists('blood_requests', 'forwarded_to_nss_at', 'TIMESTAMP');
  await addColumnIfNotExists('blood_requests', 'college_admin_id',   'INTEGER');
  await addColumnIfNotExists('blood_requests', 'needed_by',          'TIMESTAMP');
  await addColumnIfNotExists('blood_requests', 'relative_relation',  'VARCHAR(100)');
  await addColumnIfNotExists('blood_requests', 'relative_alternate_contact', 'VARCHAR(15)');
  await addColumnIfNotExists('blood_requests', 'latitude',              'REAL');
  await addColumnIfNotExists('blood_requests', 'longitude',             'REAL');
  await addColumnIfNotExists('blood_requests', 'request_location_name', 'VARCHAR(255)');
  await addColumnIfNotExists('blood_requests', 'relative_email', 'VARCHAR(255)');
  await addColumnIfNotExists('blood_requests', 'email_status',                 "VARCHAR(50) DEFAULT 'PENDING'");
  await addColumnIfNotExists('blood_requests', 'email_sent_at',               'TIMESTAMP');
  await addColumnIfNotExists('blood_requests', 'email_message_id',            'TEXT');
  await addColumnIfNotExists('blood_requests', 'email_error_reason',          'TEXT');
  await addColumnIfNotExists('blood_requests', 'request_received_email_sent', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('blood_requests', 'approved_email_sent',         'INTEGER DEFAULT 0');
  await addColumnIfNotExists('blood_requests', 'rejected_email_sent',         'INTEGER DEFAULT 0');

  // ── Seed Trichy Hospitals (Expanded Default Tiruchirappalli Hospitals) ──
  const trichyHospitals = [
    ['K.A.P. Viswanatham Government Medical College Hospital', 'mgmgh.trichy@tn.gov.in', '+91 431 241 4011', 'Collector Office Road, Puthur, Tiruchirappalli 620017', 'Dr. M. Soundararajan', '+91 9876543212', 'VERIFIED', '10.8158', '78.6802'],
    ['Apollo Speciality Hospital', 'apollo.trichy@apollo.org', '+91 431 330 7777', 'K.K. Nagar, Tiruchirappalli, Tamil Nadu 620021', 'Dr. S. Ranganathan', '+91 9876543210', 'VERIFIED', '10.7905', '78.6989'],
    ['Kauvery Hospital (KMC)', 'info@kauveryhospital.com', '+91 431 407 7777', 'No. 6, Royal Road, Cantonment, Tiruchirappalli 620001', 'Dr. K. Vijay', '+91 9876543211', 'VERIFIED', '10.8164', '78.6881'],
    ['ABC Hospital', 'contact@abchospital.in', '+91 431 270 3344', 'No. 12, Annamalai Nagar, Tiruchirappalli 620018', 'Dr. A. B. Chander', '+91 9876543217', 'VERIFIED', '10.8210', '78.6805'],
    ['Maruthi Hospital', 'info@maruthihospital.com', '+91 431 276 1122', 'Babu Road, Singarathope, Tiruchirappalli 620008', 'Dr. R. Maruthan', '+91 9876543218', 'VERIFIED', '10.8285', '78.6920'],
    ['Child Jesus Hospital', 'childjesus.trichy@gmail.com', '+91 431 270 0541', 'Prome Road, Cantonment, Tiruchirappalli 620001', 'Dr. Sr. Elizabeth', '+91 9876543219', 'VERIFIED', '10.8090', '78.6840'],
    ['Deepam Hospital', 'support@deepamhospital.com', '+91 431 241 8899', 'No. 45, West Boulevard Road, Tiruchirappalli 620002', 'Dr. D. Deepan', '+91 9876543220', 'VERIFIED', '10.8260', '78.6970'],
    ['Royal Pearl Hospital', 'info@royalpearl.in', '+91 431 274 0000', 'EVR Road, Puthur, Tiruchirappalli 620017', 'Dr. P. Royal', '+91 9876543221', 'VERIFIED', '10.8140', '78.6820'],
    ['Frontline Hospital', 'contact@frontlinehospital.com', '+91 431 240 1000', 'EVR Road, Puthur, Tiruchirappalli 620017', 'Dr. P. Arunkumar', '+91 9876543213', 'VERIFIED', '10.8036', '78.6853'],
    ['Srinivasa Hospital', 'srinivasa.trichy@gmail.com', '+91 431 276 9988', 'Thillai Nagar Main Road, Tiruchirappalli 620018', 'Dr. S. Srinivasan', '+91 9876543222', 'VERIFIED', '10.8255', '78.6860'],
    ['GVN Hospital', 'contact@gvnhospital.com', '+91 431 270 4455', 'Babu Road, Tiruchirappalli 620002', 'Dr. G. V. N. Raj', '+91 9876543223', 'VERIFIED', '10.8290', '78.6940'],
    ['BHC Medical Unit & Health Center', 'healthcenter@bhc.edu.in', '+91 431 277 0136', 'Bishop Heber College Campus, Vayalur Road, Tiruchirappalli 620017', 'Dr. S. Heber', '+91 9876543216', 'VERIFIED', '10.8242', '78.6822']
  ];

  for (let idx = 0; idx < trichyHospitals.length; idx++) {
    const h = trichyHospitals[idx];
    try {
      const existing = await get('SELECT hospital_id FROM hospitals WHERE hospital_name = ?', [h[0]]);
      if (!existing) {
        await run(
          `INSERT INTO hospitals (hospital_name, hospital_email, hospital_phone, hospital_address, registration_id, admin_name, admin_contact, status, password)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [h[0], h[1], h[2], h[3], `REG-TRICHY-HOSP-${idx + 101}`, h[4], h[5], h[6], 'hospital123'],
          true
        );
      }
    } catch (err) {
      console.error(`Failed to seed hospital ${h[0]}:`, err.message);
    }
  }

  // ── TABLE: student_verifications ──────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS student_verifications (
      verification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id   INTEGER NOT NULL,
      student_id   INTEGER NOT NULL,
      verification_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      patient_in_hospital BOOLEAN NOT NULL,
      blood_still_needed  BOOLEAN NOT NULL,
      blood_type_confirmed BOOLEAN NOT NULL,
      quantity_confirmed  BOOLEAN NOT NULL,
      patient_condition   TEXT NOT NULL,
      relative_confirmed  BOOLEAN NOT NULL,
      address_confirmed   BOOLEAN NOT NULL,
      verification_status VARCHAR(20) DEFAULT 'PENDING',
      verification_notes  TEXT,
      submitted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES blood_requests(request_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    )
  `);

  // ── TABLE: donations ──────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS donations (
      donation_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      verification_id INTEGER NOT NULL,
      student_id     INTEGER NOT NULL,
      blood_units    INTEGER DEFAULT 1,
      donation_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
      location       VARCHAR(255) NOT NULL,
      status         VARCHAR(20) DEFAULT 'COLLECTED',
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (verification_id) REFERENCES student_verifications(verification_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id)      REFERENCES students(student_id) ON DELETE CASCADE
    )
  `);

  // ── TABLE: audit_log ──────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      log_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      action     VARCHAR(255) NOT NULL,
      request_id INTEGER,
      actor_role VARCHAR(50) NOT NULL,
      actor_id   INTEGER NOT NULL,
      old_value  TEXT,
      new_value  TEXT,
      timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(15) DEFAULT '127.0.0.1'
    )
  `);

  // ── TABLE: admins ─────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS admins (
      admin_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_name  VARCHAR(255) NOT NULL,
      admin_email VARCHAR(255) UNIQUE NOT NULL,
      password    VARCHAR(255) NOT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Performance Indexes ───────────────────────────────────────────────────
  await run(`CREATE INDEX IF NOT EXISTS idx_requests_hospital   ON blood_requests(hospital_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_requests_status     ON blood_requests(status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_requests_blood_type ON blood_requests(blood_type)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_requests_created    ON blood_requests(created_at DESC)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_hospitals_status    ON hospitals(status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_audit_request       ON audit_log(request_id)`);
  // Guard qr_token index — column may not exist on first run with old DB
  try {
    await run(`CREATE INDEX IF NOT EXISTS idx_hospitals_qr_token ON hospitals(qr_token)`);
  } catch (e) { /* column may still be added on next restart */ }

  // ── Seed / Update Default BHC College Admin (cs255214307@bhc.edu.in) ────────
  try {
    const targetEmail = 'cs255214307@bhc.edu.in';
    const existingAdmin = await get('SELECT admin_id FROM admins WHERE admin_email = ?', [targetEmail]);
    if (!existingAdmin) {
      await run(`INSERT OR REPLACE INTO admins (admin_id, admin_name, admin_email, password) VALUES (1, ?, ?, ?)`,
        ['BHC College Administrator', targetEmail, 'password123'], true);
    }
  } catch (adminErr) { /* skip if exists */ }

  console.log('Database initialized with migrations, Trichy hospital seeds and indexes.');

  // Auto-restore backup requests from JSON file if ephemeral disk was reset
  try {
    const { restoreRequestsToDatabase } = require('./services/backupService');
    await restoreRequestsToDatabase({ get, run, all });
  } catch (backupErr) {
    console.error('Failed to run backup restoration:', backupErr.message);
  }
}

module.exports = { db, dbPath, run, get, all, logAction, initDb };
