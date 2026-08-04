const bcrypt = require('bcryptjs');
const database = require('./database');

async function seed() {
  console.log('Initializing database schema...');
  await database.initDb();

  console.log('Seeding initial data...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Seed System Admins
  const adminSql = `INSERT OR IGNORE INTO admins (admin_name, admin_email, password) VALUES (?, ?, ?)`;
  await database.run(adminSql, ['Super Admin', 'admin@blood.org', passwordHash]);
  console.log('✔ Seeded system admin (admin@blood.org / password123)');

  // 2. Seed Colleges
  const collegeSql = `
    INSERT OR IGNORE INTO colleges (college_id, college_name, college_email, college_phone, college_address, nss_coordinator_name, nss_coordinator_contact, nss_coordinator_email, status, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await database.run(collegeSql, [
    1,
    'City College of Engineering',
    'info@citycollege.edu',
    '022-2555-1234',
    '123 Educational Blvd, Zone 4',
    'Prof. K. R. Sharma',
    '9876543201',
    'nss.sharma@citycollege.edu',
    'ACTIVE',
    passwordHash
  ]);
  await database.run(collegeSql, [
    2,
    'National Science Academy',
    'contact@nsa.edu',
    '022-2555-5678',
    '456 Science Park Road',
    'Dr. Sunita Sen',
    '9876543202',
    'nss.sen@nsa.edu',
    'ACTIVE',
    passwordHash
  ]);
  await database.run(collegeSql, [
    3,
    'Metro Arts & Commerce College',
    'admin@metroarts.edu',
    '022-2555-9012',
    '789 Commercial Street',
    'Prof. Alok Mehta',
    '9876543203',
    'nss.mehta@metroarts.edu',
    'ACTIVE',
    passwordHash
  ]);
  console.log('✔ Seeded 3 Colleges with NSS Coordinators');

  // 3. Seed Hospitals
  const hospitalSql = `
    INSERT OR IGNORE INTO hospitals (hospital_id, hospital_name, hospital_email, hospital_phone, hospital_address, registration_id, admin_name, admin_contact, status, password, verified_at, verified_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  // Verified Hospitals
  await database.run(hospitalSql, [
    1,
    'XYZ Medical Center',
    'admin@xyzmed.org',
    '9876543100',
    'Metro Health Road, Sector 5',
    'REG-XYZ-2024',
    'Dr. Arun Kumar',
    '9876543210',
    'VERIFIED',
    passwordHash,
    '2026-07-20 10:00:00',
    1
  ]);
  await database.run(hospitalSql, [
    2,
    'Red Cross Clinic',
    'contact@redcrossclinic.org',
    '9876543200',
    'Red Cross Bhavan, Central Zone',
    'REG-RC-2021',
    'Dr. Sarah Joy',
    '9876543220',
    'VERIFIED',
    passwordHash,
    '2026-07-21 09:00:00',
    1
  ]);
  await database.run(hospitalSql, [
    3,
    'City Care Hospital',
    'requests@citycare.com',
    '9876543300',
    'City Care Tower, Sector 3',
    'REG-CC-2025',
    'Dr. Paul Mathews',
    '9876543230',
    'VERIFIED',
    passwordHash,
    '2026-07-21 15:00:00',
    1
  ]);
  // Pending Hospitals
  await database.run(hospitalSql, [
    4,
    'Medicare Plus',
    'admin@medicareplus.com',
    '9876543400',
    '44 Wellness Highway',
    'REG-MP-2026',
    'Dr. David Vance',
    '9876543240',
    'PENDING',
    passwordHash,
    null,
    null
  ]);
  await database.run(hospitalSql, [
    5,
    'Elite Health Clinic',
    'contact@elitehealth.com',
    '9876543500',
    '88 Posh Avenue',
    'REG-EHC-2026',
    'Dr. Clara Oswald',
    '9876543250',
    'PENDING',
    passwordHash,
    null,
    null
  ]);
  console.log('✔ Seeded 5 Hospitals (3 Verified, 2 Pending)');

  // 4. Seed Students
  const studentSql = `
    INSERT OR IGNORE INTO students (student_id, student_name, student_email, student_phone, college_id, blood_type, age, medical_conditions, last_donation_date, donation_count, status, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await database.run(studentSql, [
    1,
    'Rahul Kumar',
    'rahul@student.edu',
    '9988776601',
    1,
    'O+',
    21,
    'None',
    '2026-01-15',
    3,
    'ACTIVE',
    passwordHash
  ]);
  await database.run(studentSql, [
    2,
    'Priya Sharma',
    'priya@student.edu',
    '9988776602',
    1,
    'A+',
    20,
    'None',
    '2025-11-20',
    2,
    'ACTIVE',
    passwordHash
  ]);
  await database.run(studentSql, [
    3,
    'Amit Patel',
    'amit@student.edu',
    '9988776603',
    2,
    'B+',
    22,
    'Asthma (Mild)',
    null,
    0,
    'ACTIVE',
    passwordHash
  ]);
  await database.run(studentSql, [
    4,
    'Sneha Reddy',
    'sneha@student.edu',
    '9988776604',
    2,
    'AB+',
    21,
    'None',
    '2026-04-10',
    1,
    'ACTIVE',
    passwordHash
  ]);
  await database.run(studentSql, [
    5,
    'Rohan Das',
    'rohan@student.edu',
    '9988776605',
    3,
    'O-',
    20,
    'None',
    null,
    0,
    'ACTIVE',
    passwordHash
  ]);
  console.log('✔ Seeded 5 Students with varying blood types (password: password123)');

  // 5. Seed Blood Requests and corresponding verifications/donations/audit logs
  // Clear any existing requests to make seeding clean
  await database.run('DELETE FROM blood_requests');
  await database.run('DELETE FROM student_verifications');
  await database.run('DELETE FROM donations');
  await database.run('DELETE FROM audit_log');

  const requestSql = `
    INSERT INTO blood_requests (request_id, hospital_id, blood_type, quantity, urgency, patient_name, patient_age, reason, doctor_name, doctor_phone, delivery_address, relative_name, relative_contact, status, created_at, updated_at, admin_approved_at, admin_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Request 1: PENDING
  await database.run(requestSql, [
    1,
    3, // City Care
    'A+',
    1,
    'NORMAL',
    'Aman Gupta',
    34,
    'Anemia',
    'Dr. Paul Mathews',
    '9876543230',
    'City Care Tower, Sector 3, Room 402',
    'Meera Gupta',
    '9988776655',
    'PENDING',
    '2026-07-22 12:00:00',
    '2026-07-22 12:00:00',
    null,
    null
  ]);

  // Request 2: APPROVED (Admin approved, awaiting NSS announcement)
  await database.run(requestSql, [
    2,
    2, // Red Cross
    'B+',
    3,
    'HIGH',
    'Sunil Verma',
    52,
    'Heart Surgery',
    'Dr. Sarah Joy',
    '9876543220',
    'Red Cross Bhavan, Central Zone, ICU Ward 2',
    'Rita Verma',
    '9988776611',
    'APPROVED',
    '2026-07-22 10:00:00',
    '2026-07-22 10:15:00',
    '2026-07-22 10:15:00',
    1
  ]);

  // Request 3: ANNOUNCED (NSS coordinator has announced, awaiting student volunteer)
  await database.run(requestSql, [
    3,
    1, // XYZ Medical Center
    'O+',
    2,
    'CRITICAL',
    'Rajesh Kumar',
    45,
    'Accident Trauma',
    'Dr. Arun Kumar',
    '9876543210',
    'XYZ Medical Center, Emergency Ward Bed 3',
    'Ramesh Kumar',
    '9988776622',
    'ANNOUNCED',
    '2026-07-22 09:00:00',
    '2026-07-22 09:30:00',
    '2026-07-22 09:10:00',
    1
  ]);

  // Request 4: IN_PROGRESS (Student volunteered, verified, approved, and donated 1 unit so far)
  await database.run(requestSql, [
    4,
    1, // XYZ Medical
    'O-',
    2,
    'CRITICAL',
    'Mary Dsouza',
    60,
    'Major Surgery',
    'Dr. Arun Kumar',
    '9876543210',
    'XYZ Medical Center, OT Room 1',
    'John Dsouza',
    '9988776633',
    'IN_PROGRESS',
    '2026-07-21 14:00:00',
    '2026-07-22 11:00:00',
    '2026-07-21 14:15:00',
    1
  ]);

  // Request 5: COMPLETED
  await database.run(requestSql, [
    5,
    3, // City Care
    'AB+',
    1,
    'NORMAL',
    'Suresh Mehta',
    67,
    'Routine Dialysis',
    'Dr. Paul Mathews',
    '9876543230',
    'City Care Tower, Sector 3, Ward 5A',
    'Nitin Mehta',
    '9988776644',
    'COMPLETED',
    '2026-07-21 09:00:00',
    '2026-07-21 17:00:00',
    '2026-07-21 09:30:00',
    1
  ]);

  // Request 6: REJECTED
  await database.run(requestSql, [
    6,
    2, // Red Cross
    'A-',
    5,
    'CRITICAL',
    'Unknown Patient',
    30,
    'Unknown',
    'Dr. Sarah Joy',
    '9876543220',
    'Red Cross Clinic',
    'Relative Fake',
    '9988776699',
    'REJECTED',
    '2026-07-20 11:00:00',
    '2026-07-20 11:30:00',
    null,
    null
  ]);

  console.log('✔ Seeded 6 Blood Requests representing various statuses');

  // 6. Seed Student Verifications
  const verificationSql = `
    INSERT INTO student_verifications (verification_id, request_id, student_id, verification_date, patient_in_hospital, blood_still_needed, blood_type_confirmed, quantity_confirmed, patient_condition, relative_confirmed, address_confirmed, verification_status, verification_notes, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Verification for Request 4 (Approved verification)
  await database.run(verificationSql, [
    1,
    4, // Request 4
    5, // Rohan Das (O-)
    '2026-07-21 15:30:00',
    1, // YES
    1, // YES
    1, // YES
    1, // YES
    'Stable but critical surgery scheduled for tomorrow morning.',
    1, // YES
    1, // YES
    'APPROVED',
    'Relative confirmed patient John Dsouza is in hospital and needs 2 units of O- blood.',
    '2026-07-21 15:30:00'
  ]);

  // Verification for Request 5 (Approved and completed verification)
  await database.run(verificationSql, [
    2,
    5, // Request 5
    4, // Sneha Reddy (AB+)
    '2026-07-21 10:30:00',
    1, // YES
    1, // YES
    1, // YES
    1, // YES
    'Patient undergoes regular dialysis. Stable condition.',
    1, // YES
    1, // YES
    'APPROVED',
    'Called son Nitin Mehta. Confirmed details and blood requirement.',
    '2026-07-21 10:30:00'
  ]);

  console.log('✔ Seeded Student Verifications');

  // 7. Seed Donations
  const donationSql = `
    INSERT INTO donations (donation_id, verification_id, student_id, blood_units, donation_date, location, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Donation for Request 4 (Collected but not fully completed request since 2 units needed)
  await database.run(donationSql, [
    1,
    1, // Verification 1
    5, // Rohan Das
    1,
    '2026-07-22 10:00:00',
    'XYZ Medical Center Blood Bank',
    'COLLECTED',
    '2026-07-22 10:00:00'
  ]);

  // Donation for Request 5 (Delivered & Completed)
  await database.run(donationSql, [
    2,
    2, // Verification 2
    4, // Sneha Reddy
    1,
    '2026-07-21 14:00:00',
    'City Care Hospital Blood Bank',
    'COMPLETED',
    '2026-07-21 14:00:00'
  ]);

  console.log('✔ Seeded Donations');

  // 8. Seed Audit Logs
  const auditLogs = [
    // Request 1
    { action: 'Blood request posted', requestId: 1, actorRole: 'Hospital', actorId: 3, oldValue: null, newValue: 'Blood Type: A+, Qty: 1, Patient: Aman Gupta', timestamp: '2026-07-22 12:00:00' },

    // Request 2
    { action: 'Blood request posted', requestId: 2, actorRole: 'Hospital', actorId: 2, oldValue: null, newValue: 'Blood Type: B+, Qty: 3, Patient: Sunil Verma', timestamp: '2026-07-22 10:00:00' },
    { action: 'Hospital request approved', requestId: 2, actorRole: 'Admin', actorId: 1, oldValue: 'PENDING', newValue: 'APPROVED', timestamp: '2026-07-22 10:15:00' },

    // Request 3
    { action: 'Blood request posted', requestId: 3, actorRole: 'Hospital', actorId: 1, oldValue: null, newValue: 'Blood Type: O+, Qty: 2, Patient: Rajesh Kumar', timestamp: '2026-07-22 09:00:00' },
    { action: 'Hospital request approved', requestId: 3, actorRole: 'Admin', actorId: 1, oldValue: 'PENDING', newValue: 'APPROVED', timestamp: '2026-07-22 09:10:00' },
    { action: 'NSS coordinator announced request', requestId: 3, actorRole: 'NSS Coordinator', actorId: 1, oldValue: 'APPROVED', newValue: 'ANNOUNCED', timestamp: '2026-07-22 09:30:00' },

    // Request 4
    { action: 'Blood request posted', requestId: 4, actorRole: 'Hospital', actorId: 1, oldValue: null, newValue: 'Blood Type: O-, Qty: 2, Patient: Mary Dsouza', timestamp: '2026-07-21 14:00:00' },
    { action: 'Hospital request approved', requestId: 4, actorRole: 'Admin', actorId: 1, oldValue: 'PENDING', newValue: 'APPROVED', timestamp: '2026-07-21 14:15:00' },
    { action: 'NSS coordinator announced request', requestId: 4, actorRole: 'NSS Coordinator', actorId: 1, oldValue: 'APPROVED', newValue: 'ANNOUNCED', timestamp: '2026-07-21 15:00:00' },
    { action: 'Student submitted verification details', requestId: 4, actorRole: 'Student', actorId: 5, oldValue: 'ANNOUNCED', newValue: 'VERIFIED', timestamp: '2026-07-21 15:30:00' },
    { action: 'NSS coordinator approved student verification', requestId: 4, actorRole: 'NSS Coordinator', actorId: 1, oldValue: 'VERIFIED', newValue: 'IN_PROGRESS', timestamp: '2026-07-21 16:00:00' },
    { action: 'Blood donation collected from student', requestId: 4, actorRole: 'NSS Coordinator', actorId: 1, oldValue: 'IN_PROGRESS', newValue: 'Collected 1 Unit', timestamp: '2026-07-22 10:00:00' },

    // Request 5
    { action: 'Blood request posted', requestId: 5, actorRole: 'Hospital', actorId: 3, oldValue: null, newValue: 'Blood Type: AB+, Qty: 1, Patient: Suresh Mehta', timestamp: '2026-07-21 09:00:00' },
    { action: 'Hospital request approved', requestId: 5, actorRole: 'Admin', actorId: 1, oldValue: 'PENDING', newValue: 'APPROVED', timestamp: '2026-07-21 09:30:00' },
    { action: 'NSS coordinator announced request', requestId: 5, actorRole: 'NSS Coordinator', actorId: 3, oldValue: 'APPROVED', newValue: 'ANNOUNCED', timestamp: '2026-07-21 09:45:00' },
    { action: 'Student submitted verification details', requestId: 5, actorRole: 'Student', actorId: 4, oldValue: 'ANNOUNCED', newValue: 'VERIFIED', timestamp: '2026-07-21 10:30:00' },
    { action: 'NSS coordinator approved student verification', requestId: 5, actorRole: 'NSS Coordinator', actorId: 3, oldValue: 'VERIFIED', newValue: 'IN_PROGRESS', timestamp: '2026-07-21 11:00:00' },
    { action: 'Blood donation collected from student', requestId: 5, actorRole: 'NSS Coordinator', actorId: 3, oldValue: 'IN_PROGRESS', newValue: 'Collected 1 Unit', timestamp: '2026-07-21 14:00:00' },
    { action: 'Blood delivered to hospital', requestId: 5, actorRole: 'NSS Coordinator', actorId: 3, oldValue: 'IN_PROGRESS', newValue: 'COMPLETED', timestamp: '2026-07-21 17:00:00' },

    // Request 6
    { action: 'Blood request posted', requestId: 6, actorRole: 'Hospital', actorId: 2, oldValue: null, newValue: 'Blood Type: A-, Qty: 5, Patient: Unknown Patient', timestamp: '2026-07-20 11:00:00' },
    { action: 'Hospital request rejected', requestId: 6, actorRole: 'Admin', actorId: 1, oldValue: 'PENDING', newValue: 'REJECTED - Request details inconsistent, relative name suspicious.', timestamp: '2026-07-20 11:30:00' }
  ];

  const logSql = `
    INSERT INTO audit_log (action, request_id, actor_role, actor_id, old_value, new_value, timestamp, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const log of auditLogs) {
    await database.run(logSql, [
      log.action,
      log.requestId,
      log.actorRole,
      log.actorId,
      log.oldValue,
      log.newValue,
      log.timestamp,
      '192.168.1.50'
    ]);
  }

  console.log('✔ Seeded Audit Logs');
  console.log('Database seeding successfully finished!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
