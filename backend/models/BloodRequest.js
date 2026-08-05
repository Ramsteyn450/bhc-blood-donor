const mongoose = require('mongoose');

const bloodRequestSchema = new mongoose.Schema({
  request_id: { type: Number, required: true, unique: true },
  request_uuid: { type: String, required: true },
  hospital_id: { type: Number, default: 1 },
  hospital_name: { type: String, required: true },
  blood_type: { type: String, required: true },
  quantity: { type: Number, required: true },
  urgency: { type: String, required: true },
  patient_name: { type: String, required: true },
  patient_age: { type: Number, required: true },
  patient_gender: { type: String, default: 'Male' },
  reason: { type: String, default: 'Emergency Blood Request' },
  doctor_name: { type: String, default: 'Dr. Duty Officer' },
  doctor_phone: { type: String, default: '+91 9876543210' },
  doctor_department: { type: String, default: 'Emergency / ICU' },
  ward_number: { type: String, default: 'A-1' },
  delivery_address: { type: String },
  relative_name: { type: String, required: true },
  relative_relation: { type: String, default: 'Relative' },
  relative_contact: { type: String, required: true },
  relative_alternate_contact: { type: String },
  relative_email: { type: String, required: true },
  proof_prescription: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  status: { type: String, default: 'PENDING' },
  admin_approved_at: { type: Date },
  admin_id: { type: Number },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
