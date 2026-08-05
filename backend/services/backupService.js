const fs = require('fs');
const path = require('path');

const backupFilePath = path.join(__dirname, '..', 'requests_backup.json');

// Ensure backup file exists
function initBackupFile() {
  if (!fs.existsSync(backupFilePath)) {
    fs.writeFileSync(backupFilePath, JSON.stringify([], null, 2), 'utf8');
  }
}

// Save or update a request entry in the backup JSON file
function saveRequestToBackup(requestData) {
  try {
    initBackupFile();
    const raw = fs.readFileSync(backupFilePath, 'utf8');
    let requests = [];
    try {
      requests = JSON.parse(raw);
    } catch {
      requests = [];
    }

    const existingIndex = requests.findIndex(
      r => r.request_id === requestData.request_id || (r.request_uuid && r.request_uuid === requestData.request_uuid)
    );

    if (existingIndex >= 0) {
      requests[existingIndex] = { ...requests[existingIndex], ...requestData, updated_at: new Date().toISOString() };
    } else {
      requests.push({ ...requestData, saved_at: new Date().toISOString() });
    }

    fs.writeFileSync(backupFilePath, JSON.stringify(requests, null, 2), 'utf8');
    console.log(`💾 [BACKUP SERVICE] Saved request REQ-${requestData.request_id || requestData.request_uuid} to JSON backup store.`);
  } catch (err) {
    console.error('❌ [BACKUP SERVICE ERROR]: Failed to save request to JSON backup:', err.message);
  }
}

// Get all backed up requests
function getBackupRequests() {
  try {
    initBackupFile();
    const raw = fs.readFileSync(backupFilePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Automatically restore missing requests into SQLite on startup
async function restoreRequestsToDatabase(db) {
  try {
    const backupList = getBackupRequests();
    if (!backupList || backupList.length === 0) {
      console.log('ℹ️  [BACKUP SERVICE] No JSON backup requests to restore.');
      return;
    }

    console.log(`🔄 [BACKUP SERVICE] Checking ${backupList.length} JSON backup requests for SQLite restoration...`);
    let restoredCount = 0;

    for (const r of backupList) {
      if (!r.patient_name || !r.blood_type) continue;

      // Check if request already exists in SQLite
      let existing = null;
      if (r.request_id) {
        existing = await db.get('SELECT request_id FROM blood_requests WHERE request_id = ?', [r.request_id]);
      }
      if (!existing && r.request_uuid) {
        existing = await db.get('SELECT request_id FROM blood_requests WHERE request_uuid = ?', [r.request_uuid]);
      }

      if (!existing) {
        // Resolve hospital ID
        let hospId = r.hospital_id || 1;
        const hosp = await db.get('SELECT hospital_id FROM hospitals ORDER BY hospital_id ASC LIMIT 1');
        if (hosp) hospId = hosp.hospital_id;

        await db.run(
          `INSERT INTO blood_requests (
            hospital_id, blood_type, quantity, urgency, patient_name, patient_age, patient_gender,
            reason, doctor_name, doctor_phone, doctor_department, ward_number, delivery_address,
            relative_name, relative_relation, relative_contact, relative_email, proof_prescription,
            latitude, longitude, status, created_at, request_uuid
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            hospId,
            r.blood_type || 'O+',
            r.quantity || 1,
            r.urgency || 'HIGH',
            r.patient_name,
            r.patient_age || 30,
            r.patient_gender || 'Male',
            r.reason || 'Emergency Blood Request',
            r.doctor_name || 'Dr. Duty Officer',
            r.doctor_phone || '+91 9876543210',
            r.doctor_department || 'Emergency / ICU',
            r.ward_number || 'A-1',
            r.delivery_address || r.hospital_name || 'Hospital',
            r.relative_name || 'Relative',
            r.relative_relation || 'Relative',
            r.relative_contact || '+91 9876543210',
            r.relative_email || '',
            r.proof_prescription || '',
            r.latitude || null,
            r.longitude || null,
            r.status || 'PENDING',
            r.created_at || new Date().toISOString(),
            r.request_uuid || `UUID-${Date.now()}`
          ],
          true
        );
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.log(`✔ [BACKUP SERVICE] Restored ${restoredCount} blood requests into SQLite database!`);
    } else {
      console.log('✔ [BACKUP SERVICE] All JSON backup requests already exist in SQLite.');
    }
  } catch (err) {
    console.error('❌ [BACKUP SERVICE ERROR]: Failed to restore requests from JSON backup:', err.message);
  }
}

module.exports = {
  saveRequestToBackup,
  getBackupRequests,
  restoreRequestsToDatabase
};
