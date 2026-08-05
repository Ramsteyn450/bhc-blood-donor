const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  hospital_id: { type: Number, required: true, unique: true },
  hospital_name: { type: String, required: true },
  hospital_email: { type: String, required: true },
  hospital_phone: { type: String, required: true },
  hospital_address: { type: String, required: true },
  registration_id: { type: String, required: true },
  admin_name: { type: String, default: 'Hospital Administration' },
  admin_contact: { type: String, default: '+91 9876543210' },
  status: { type: String, default: 'VERIFIED' },
  password: { type: String, default: 'hospital123' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hospital', hospitalSchema);
