const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  admin_id: { type: Number, required: true, unique: true },
  admin_name: { type: String, required: true },
  admin_email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Admin', adminSchema);
