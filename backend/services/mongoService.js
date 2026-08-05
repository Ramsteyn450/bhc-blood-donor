const mongoose = require('mongoose');
const BloodRequest = require('../models/BloodRequest');
const Hospital = require('../models/Hospital');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');

let isConnected = false;

async function connectMongoDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) return false;

  if (isConnected) return true;

  try {
    console.log('\n======================================================');
    console.log('🍃 [MONGODB ATLAS CONFIGURATION]');
    console.log('   Connecting to MongoDB Atlas Cloud Instance...');
    console.log('======================================================\n');

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000
    });

    isConnected = true;
    console.log('✔ [MONGODB ATLAS] Connected successfully to Cloud Database!');

    await seedMongoDefaults();
    return true;
  } catch (err) {
    console.error('❌ [MONGODB ATLAS ERROR] Failed to connect to MongoDB Atlas:', err.message);
    return false;
  }
}

async function seedMongoDefaults() {
  try {
    // 1. Seed Default Admin
    const adminEmail = 'cs255214307@bhc.edu.in';
    const adminExists = await Admin.findOne({ admin_email: adminEmail });
    if (!adminExists) {
      await Admin.create({
        admin_id: 1,
        admin_name: 'BHC College Administrator',
        admin_email: adminEmail,
        password: 'password123'
      });
      console.log(`✔ [MONGODB SEED] Created default Admin: ${adminEmail}`);
    }

    // 2. Seed 12 Default Tiruchirappalli Hospitals
    const trichyHospitals = [
      ['K.A.P. Viswanatham Government Medical College Hospital', 'mgmgh.trichy@tn.gov.in', '+91 431 241 4011', 'Collector Office Road, Puthur, Tiruchirappalli 620017', 'Dr. M. Soundararajan', '+91 9876543212'],
      ['Apollo Speciality Hospital', 'apollo.trichy@apollo.org', '+91 431 330 7777', 'K.K. Nagar, Tiruchirappalli, Tamil Nadu 620021', 'Dr. S. Ranganathan', '+91 9876543210'],
      ['Kauvery Hospital (KMC)', 'info@kauveryhospital.com', '+91 431 407 7777', 'No. 6, Royal Road, Cantonment, Tiruchirappalli 620001', 'Dr. K. Vijay', '+91 9876543211'],
      ['ABC Hospital', 'contact@abchospital.in', '+91 431 270 3344', 'No. 12, Annamalai Nagar, Tiruchirappalli 620018', 'Dr. A. B. Chander', '+91 9876543217'],
      ['Maruthi Hospital', 'info@maruthihospital.com', '+91 431 276 1122', 'Babu Road, Singarathope, Tiruchirappalli 620008', 'Dr. R. Maruthan', '+91 9876543218'],
      ['Child Jesus Hospital', 'childjesus.trichy@gmail.com', '+91 431 270 0541', 'Prome Road, Cantonment, Tiruchirappalli 620001', 'Dr. Sr. Elizabeth', '+91 9876543219'],
      ['Deepam Hospital', 'support@deepamhospital.com', '+91 431 241 8899', 'No. 45, West Boulevard Road, Tiruchirappalli 620002', 'Dr. D. Deepan', '+91 9876543220'],
      ['Royal Pearl Hospital', 'info@royalpearl.in', '+91 431 274 0000', 'EVR Road, Puthur, Tiruchirappalli 620017', 'Dr. P. Royal', '+91 9876543221'],
      ['Frontline Hospital', 'contact@frontlinehospital.com', '+91 431 240 1000', 'EVR Road, Puthur, Tiruchirappalli 620017', 'Dr. P. Arunkumar', '+91 9876543213'],
      ['Srinivasa Hospital', 'srinivasa.trichy@gmail.com', '+91 431 276 9988', 'Thillai Nagar Main Road, Tiruchirappalli 620018', 'Dr. S. Srinivasan', '+91 9876543222'],
      ['GVN Hospital', 'contact@gvnhospital.com', '+91 431 270 4455', 'Babu Road, Tiruchirappalli 620002', 'Dr. G. V. N. Raj', '+91 9876543223'],
      ['BHC Medical Unit & Health Center', 'healthcenter@bhc.edu.in', '+91 431 277 0136', 'Bishop Heber College Campus, Vayalur Road, Tiruchirappalli 620017', 'Dr. S. Heber', '+91 9876543216']
    ];

    for (let i = 0; i < trichyHospitals.length; i++) {
      const [name, email, phone, addr, adminName, adminContact] = trichyHospitals[i];
      const hExists = await Hospital.findOne({ hospital_name: name });
      if (!hExists) {
        await Hospital.create({
          hospital_id: i + 1,
          hospital_name: name,
          hospital_email: email,
          hospital_phone: phone,
          hospital_address: addr,
          registration_id: `REG-TRICHY-HOSP-${101 + i}`,
          admin_name: adminName,
          admin_contact: adminContact,
          status: 'VERIFIED'
        });
      }
    }
    console.log('✔ [MONGODB SEED] Verified Trichy Hospitals present in Cloud Database.');

  } catch (err) {
    console.error('MongoDB default seeding error:', err.message);
  }
}

async function getNextRequestId() {
  const last = await BloodRequest.findOne().sort({ request_id: -1 });
  return last ? last.request_id + 1 : 1;
}

module.exports = {
  connectMongoDB,
  getNextRequestId,
  BloodRequest,
  Hospital,
  Admin,
  AuditLog
};
