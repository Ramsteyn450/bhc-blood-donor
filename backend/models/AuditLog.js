const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  log_id: { type: Number },
  action: { type: String, required: true },
  request_id: { type: Number },
  actor_role: { type: String, required: true },
  actor_id: { type: Number, required: true },
  old_value: { type: String },
  new_value: { type: String },
  timestamp: { type: Date, default: Date.now },
  ip_address: { type: String, default: '127.0.0.1' }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
