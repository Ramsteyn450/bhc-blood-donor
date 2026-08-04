import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart, Plus, QrCode, Download, Upload, Camera, X, CheckCircle,
  Clock, AlertTriangle, FileText, User, Phone, Building, Stethoscope,
  Droplets, RefreshCw, Eye, ChevronDown, ChevronUp, Loader
} from 'lucide-react';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENCY_LEVELS = [
  { value: 'CRITICAL', label: 'Critical — Life Threatening', color: '#ef4444' },
  { value: 'HIGH',     label: 'High — Urgent Need',         color: '#f97316' },
  { value: 'NORMAL',   label: 'Normal — Within 24 hrs',     color: '#22c55e' }
];

const STATUS_CONFIG = {
  PENDING:           { label: 'Pending Review',       color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  APPROVED:          { label: 'Approved',              color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  FORWARDED_TO_NSS:  { label: 'Forwarded to NSS',     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)'},
  ANNOUNCED:         { label: 'Announced to Students', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  IN_PROGRESS:       { label: 'In Progress',           color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  COMPLETED:         { label: 'Completed',             color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  REJECTED:          { label: 'Rejected',              color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  }
};

const PROOF_FIELDS = [
  { key: 'proof_prescription', label: "Doctor's Prescription",  icon: FileText },
  { key: 'proof_case_sheet',   label: 'Hospital Case Sheet',    icon: FileText },
  { key: 'proof_signature',    label: "Doctor's Signature",     icon: User     },
  { key: 'proof_seal',         label: 'Hospital Seal / Stamp',  icon: Building }
];

// ── Camera Capture Modal ──────────────────────────────────────────────────
function CameraModal({ fieldLabel, onCapture, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [ready, setReady]     = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        setError('Camera access denied or not available. Please upload from gallery instead.');
      }
    })();
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const capturePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    // Compress to max 1024px
    const maxDim = 1024;
    const ratio  = Math.min(maxDim / canvas.width, maxDim / canvas.height, 1);
    const outCanvas = document.createElement('canvas');
    outCanvas.width  = Math.round(canvas.width  * ratio);
    outCanvas.height = Math.round(canvas.height * ratio);
    outCanvas.getContext('2d').drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);

    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const useCapture = () => {
    if (captured) {
      // Convert data URL to a File blob
      fetch(captured).then(r => r.blob()).then(blob => {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, captured);
      });
    }
  };

  const retake = () => {
    setCaptured(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; }
      } catch {}
    })();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Capture: {fieldLabel}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Position the document clearly in frame</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {error ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--warning)' }}>
            <AlertTriangle size={32} style={{ marginBottom: '8px' }} />
            <p style={{ fontSize: '13px' }}>{error}</p>
          </div>
        ) : captured ? (
          <div style={{ textAlign: 'center' }}>
            <img src={captured} alt="Captured" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={retake}>Retake</button>
              <button className="btn btn-primary" onClick={useCapture}>Use This Photo</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000', marginBottom: '14px' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: '320px', display: 'block' }} />
              {!ready && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader size={24} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <button className="btn btn-primary" onClick={capturePhoto} disabled={!ready}>
              <Camera size={16} /> Capture Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Proof Upload Slot ─────────────────────────────────────────────────────
function ProofUploadSlot({ fieldKey, label, icon: Icon, value, onChange }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview]       = useState(value?.preview || null);
  const [uploading, setUploading]   = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const processFile = async (file) => {
    if (!file) return;
    setUploading(true);

    // Client-side image compression before upload (max 1024px)
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      try {
        const bmp = await createImageBitmap(file);
        const maxDim = 1024;
        const ratio  = Math.min(maxDim / bmp.width, maxDim / bmp.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(bmp.width  * ratio);
        canvas.height = Math.round(bmp.height * ratio);
        canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
        fileToUpload = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        setPreview(canvas.toDataURL('image/jpeg', 0.85));
      } catch { setPreview(URL.createObjectURL(file)); }
    } else {
      setPreview(null); // PDF — no preview
    }

    const formData = new FormData();
    formData.append(fieldKey, fileToUpload);

    try {
      const token = sessionStorage.getItem('bhc_token');
      const res = await fetch('/api/requests/upload-proof', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        const url  = data.files[fieldKey];
        onChange({ url, preview: preview || null, filename: file.name });
      } else {
        alert('Upload failed. Please try again.');
      }
    } catch {
      alert('Network error during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => { if (e.target.files[0]) processFile(e.target.files[0]); };

  const handleCameraCapture = (file, dataUrl) => {
    setPreview(dataUrl);
    processFile(file);
    setShowCamera(false);
  };

  const clear = () => { setPreview(null); onChange(null); };

  return (
    <>
      {showCamera && <CameraModal fieldLabel={label} onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      <div style={{
        border: `1px solid ${value ? 'var(--accent-red)' : 'var(--border-color)'}`,
        borderRadius: '10px', padding: '14px', background: 'var(--bg-primary)',
        transition: 'border-color 0.2s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Icon size={14} style={{ color: value ? 'var(--accent-red)' : 'var(--text-muted)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>
          {value && <CheckCircle size={13} style={{ color: 'var(--success)', marginLeft: 'auto' }} />}
          {!value && <span style={{ fontSize: '10px', color: '#ef4444', marginLeft: 'auto', fontWeight: 600 }}>REQUIRED</span>}
        </div>

        {preview ? (
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <img src={preview} alt={label} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
            <button onClick={clear} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: '2px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} />
            </button>
          </div>
        ) : value ? (
          <div style={{ marginBottom: '8px', padding: '8px', background: 'rgba(34,197,94,0.05)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--success)' }}>
            <CheckCircle size={12} /> {value.filename || 'File uploaded'}
          </div>
        ) : null}

        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', justifyContent: 'center', padding: '8px' }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileInput} style={{ display: 'none' }} />
            <button className="btn btn-outline" style={{ flex: 1, fontSize: '11px', padding: '6px 8px', gap: '4px' }} onClick={() => fileInputRef.current?.click()}>
              <Upload size={12} /> Gallery
            </button>
            <button className="btn btn-outline" style={{ flex: 1, fontSize: '11px', padding: '6px 8px', gap: '4px' }} onClick={() => setShowCamera(true)}>
              <Camera size={12} /> Camera
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Hospital Dashboard ───────────────────────────────────────────────
export default function HospitalDashboard({ user, token, triggerNotification }) {
  const [view, setView]       = useState('requests'); // requests | new_request | qr
  const [requests, setRequests] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [qrData, setQrData]   = useState(null);
  const [loadingQr, setLoadingQr]   = useState(false);
  const [expandedReq, setExpandedReq] = useState(null);

  // Form state
  const emptyForm = {
    blood_type: '', quantity: 1, urgency: 'HIGH', needed_by: '',
    patient_name: '', patient_age: '', reason: '',
    doctor_name: '', doctor_phone: '', doctor_department: '', ward_number: '',
    delivery_address: user.address || '',
    relative_name: '', relative_contact: '', relative_relation: '', relative_alternate_contact: '',
    proof_prescription: null, proof_case_sheet: null, proof_signature: null, proof_seal: null
  };
  const [form, setForm] = useState(emptyForm);

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchRequests = useCallback(async () => {
    setLoadingReqs(true);
    try {
      const res = await fetch('/api/requests', { headers: authHeaders });
      if (res.ok) setRequests(await res.json());
    } catch { /* silent */ }
    finally { setLoadingReqs(false); }
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const fetchQr = useCallback(async () => {
    setLoadingQr(true);
    try {
      const res = await fetch(`/api/hospitals/${user.id}/qr`, { headers: authHeaders });
      if (res.ok) setQrData(await res.json());
    } catch { /* silent */ }
    finally { setLoadingQr(false); }
  }, [user.id, token]);

  useEffect(() => { if (view === 'qr') fetchQr(); }, [view, fetchQr]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const allProofsUploaded = () =>
    form.proof_prescription && form.proof_case_sheet && form.proof_signature && form.proof_seal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allProofsUploaded()) {
      alert('Please upload all 4 required proof documents before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        proof_prescription: form.proof_prescription?.url,
        proof_case_sheet:   form.proof_case_sheet?.url,
        proof_signature:    form.proof_signature?.url,
        proof_seal:         form.proof_seal?.url
      };

      const res = await fetch('/api/requests', {
        method: 'POST', headers: authHeaders, body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setForm(emptyForm);
        setView('requests');
        await fetchRequests();
        triggerNotification('bell', `Request submitted — ID: ${data.request_id}. Awaiting College Admin review.`, user.name);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadQr = () => {
    if (!qrData?.qrCode) return;
    const link = document.createElement('a');
    link.href     = qrData.qrCode;
    link.download = `${qrData.hospitalName}-QR.png`;
    link.click();
  };

  const getStatusCfg = (status) => {
    const key = status?.split(' - ')[0] || status;
    return STATUS_CONFIG[key] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={22} style={{ color: 'var(--accent-red)' }} /> Hospital Blood Request Portal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            {user.name} · {user.address || 'Address on file'} · Reg: {user.registrationId}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn ${view === 'requests' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('requests')}>
            <FileText size={15} /> My Requests
          </button>
          <button className={`btn ${view === 'new_request' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('new_request')}>
            <Plus size={15} /> New Request
          </button>
          <button className={`btn ${view === 'qr' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('qr')}>
            <QrCode size={15} /> My QR Code
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: requests.length, color: 'var(--text-primary)' },
          { label: 'Pending', value: requests.filter(r => r.status === 'PENDING').length, color: '#f97316' },
          { label: 'In Progress', value: requests.filter(r => ['APPROVED','FORWARDED_TO_NSS','ANNOUNCED','IN_PROGRESS'].includes(r.status)).length, color: '#60a5fa' },
          { label: 'Completed', value: requests.filter(r => r.status === 'COMPLETED').length, color: '#22c55e' }
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── VIEW: My QR Code ─── */}
      {view === 'qr' && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '28px', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
          <QrCode size={28} style={{ color: 'var(--accent-red)', marginBottom: '12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Your Hospital QR Code</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            Share this QR code with patient relatives. Scanning it opens a pre-filled blood request form for your hospital.
          </p>

          {loadingQr ? (
            <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading QR...
            </div>
          ) : qrData?.qrCode ? (
            <>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', display: 'inline-block', marginBottom: '16px' }}>
                <img src={qrData.qrCode} alt="Hospital QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                QR Token: <code style={{ color: 'var(--accent-red)', fontSize: '11px' }}>{qrData.qrToken}</code>
              </div>
              <button className="btn btn-primary" onClick={downloadQr} style={{ width: '100%' }}>
                <Download size={15} /> Download QR Code
              </button>
            </>
          ) : (
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <AlertTriangle size={24} style={{ color: 'var(--warning)', marginBottom: '8px' }} />
              <p>QR code not yet generated. Your hospital must be verified by the System Admin first.</p>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW: New Blood Request Form ─── */}
      {view === 'new_request' && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'rgba(230,57,70,0.03)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Droplets size={18} style={{ color: 'var(--accent-red)' }} /> Blood Request Form
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>All sections must be completed. Proof documents are mandatory.</p>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Section 1 — Hospital Info (auto-filled, read-only) */}
            <FormSection icon={Building} title="Hospital Information" subtitle="Auto-filled from your verified profile">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <ReadonlyField label="Hospital Name"    value={user.name} />
                <ReadonlyField label="Registration ID"  value={user.registrationId} />
                <ReadonlyField label="Admin Name"       value={user.adminName} />
                <ReadonlyField label="Contact"          value={user.adminContact || user.phone} />
                <div style={{ gridColumn: '1/-1' }}>
                  <ReadonlyField label="Address"        value={user.address} />
                </div>
              </div>
            </FormSection>

            {/* Section 2 — Doctor Details */}
            <FormSection icon={Stethoscope} title="Doctor Details" subtitle="Attending physician information">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Doctor Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" placeholder="Dr. Full Name" value={form.doctor_name} onChange={e => setField('doctor_name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Doctor Phone</label>
                  <input className="form-input" placeholder="+91 XXXXX XXXXX" value={form.doctor_phone} onChange={e => setField('doctor_phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department / Specialty</label>
                  <input className="form-input" placeholder="e.g. Orthopaedics, Oncology" value={form.doctor_department} onChange={e => setField('doctor_department', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ward / Room No.</label>
                  <input className="form-input" placeholder="e.g. Ward 4B, ICU 2" value={form.ward_number} onChange={e => setField('ward_number', e.target.value)} />
                </div>
              </div>
            </FormSection>

            {/* Section 3 — Patient Details */}
            <FormSection icon={User} title="Patient Details" subtitle="Information about the patient requiring blood">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Patient Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" placeholder="Full patient name" value={form.patient_name} onChange={e => setField('patient_name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Patient Age <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="number" min="0" max="120" placeholder="Age" value={form.patient_age} onChange={e => setField('patient_age', e.target.value)} required />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Reason for Blood <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" placeholder="e.g. Major surgery, Accident, Thalassemia treatment..." value={form.reason} onChange={e => setField('reason', e.target.value)} required />
                </div>
              </div>
            </FormSection>

            {/* Section 4 — Blood Details */}
            <FormSection icon={Droplets} title="Blood Requirement" subtitle="Specify the blood group and quantity needed">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Blood Group <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-select" value={form.blood_type} onChange={e => setField('blood_type', e.target.value)} required>
                    <option value="">Select</option>
                    {BLOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Units Required <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="number" min="1" max="20" value={form.quantity} onChange={e => setField('quantity', parseInt(e.target.value))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Needed By</label>
                  <input className="form-input" type="datetime-local" value={form.needed_by} onChange={e => setField('needed_by', e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Urgency Level <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {URGENCY_LEVELS.map(u => (
                      <label key={u.value} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                        border: `1px solid ${form.urgency === u.value ? u.color : 'var(--border-color)'}`,
                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                        background: form.urgency === u.value ? `${u.color}12` : 'transparent', fontSize: '12px'
                      }}>
                        <input type="radio" name="urgency" value={u.value} checked={form.urgency === u.value} onChange={e => setField('urgency', e.target.value)} style={{ display: 'none' }} />
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: u.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: form.urgency === u.value ? 700 : 400 }}>{u.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Section 5 — Relative Details */}
            <FormSection icon={Phone} title="Patient's Relative / Contact" subtitle="Primary contact person for coordination">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Relative Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" placeholder="Full name" value={form.relative_name} onChange={e => setField('relative_name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Relation to Patient</label>
                  <input className="form-input" placeholder="e.g. Son, Wife, Brother" value={form.relative_relation} onChange={e => setField('relative_relation', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Contact <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" type="tel" placeholder="+91 XXXXX XXXXX" value={form.relative_contact} onChange={e => setField('relative_contact', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Alternate Contact</label>
                  <input className="form-input" type="tel" placeholder="+91 XXXXX XXXXX" value={form.relative_alternate_contact} onChange={e => setField('relative_alternate_contact', e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Blood Delivery Address</label>
                  <input className="form-input" placeholder="Hospital blood bank / delivery point" value={form.delivery_address} onChange={e => setField('delivery_address', e.target.value)} />
                </div>
              </div>
            </FormSection>

            {/* Section 6 — Proof Upload */}
            <FormSection icon={FileText} title="Mandatory Proof Documents" subtitle="All 4 documents are required. Upload from gallery or capture using camera.">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {PROOF_FIELDS.map(f => (
                  <ProofUploadSlot
                    key={f.key}
                    fieldKey={f.key}
                    label={f.label}
                    icon={f.icon}
                    value={form[f.key]}
                    onChange={v => setField(f.key, v)}
                  />
                ))}
              </div>
              {!allProofsUploaded() && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={13} />
                  Upload all 4 documents to enable form submission.
                </div>
              )}
            </FormSection>

          </div>

          {/* Submit */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={() => { setForm(emptyForm); setView('requests'); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !allProofsUploaded()} style={{ minWidth: '160px' }}>
              {submitting ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : <><Heart size={14} /> Submit Request</>}
            </button>
          </div>
        </form>
      )}

      {/* ── VIEW: Request List ─── */}
      {view === 'requests' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Blood Requests ({requests.length})</h2>
            <button className="btn btn-outline" onClick={fetchRequests} style={{ fontSize: '12px', padding: '6px 12px' }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {loadingReqs ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px', color: 'var(--text-muted)' }}>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
            </div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <Droplets size={36} style={{ marginBottom: '10px', opacity: 0.4 }} />
              <p style={{ fontSize: '14px' }}>No requests yet. Click "New Request" to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {requests.map(req => {
                const cfg = getStatusCfg(req.status);
                const isExpanded = expandedReq === req.request_id;
                return (
                  <div key={req.request_id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div
                      style={{ padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
                      onClick={() => setExpandedReq(isExpanded ? null : req.request_id)}
                    >
                      <div style={{ background: `${cfg.bg}`, borderRadius: '8px', padding: '8px', flexShrink: 0 }}>
                        <Droplets size={18} style={{ color: cfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>{req.blood_type}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>× {req.quantity} units</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                          {req.urgency === 'CRITICAL' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 700 }}>⚠ CRITICAL</span>}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>
                          Patient: {req.patient_name} · {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginTop: '14px' }}>
                          {[
                            ['Doctor', req.doctor_name || '—'],
                            ['Department', req.doctor_department || '—'],
                            ['Ward', req.ward_number || '—'],
                            ['Age', req.patient_age],
                            ['Reason', req.reason],
                            ['Relative', req.relative_name],
                            ['Rel. Contact', req.relative_contact],
                            ['UUID', req.request_uuid?.slice(0, 12) + '…' || '—']
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>{k}</div>
                              <div style={{ fontSize: '13px', fontWeight: 500 }}>{v}</div>
                            </div>
                          ))}
                        </div>

                        {/* Proof documents */}
                        {(req.proof_prescription || req.proof_case_sheet) && (
                          <div style={{ marginTop: '14px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Proof Documents</div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {[['Prescription', req.proof_prescription], ['Case Sheet', req.proof_case_sheet], ['Signature', req.proof_signature], ['Seal', req.proof_seal]].map(([label, url]) =>
                                url && (
                                  <a key={label} href={url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 10px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderRadius: '6px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Eye size={11} /> {label}
                                  </a>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Status trail */}
                        <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--text-muted)' }}>
                            <Clock size={12} />
                            Submitted: {new Date(req.created_at).toLocaleString('en-IN')}
                            {req.admin_approved_at && <> · Approved: {new Date(req.admin_approved_at).toLocaleString('en-IN')}</>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────
function FormSection({ icon: Icon, title, subtitle, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ background: 'rgba(230,57,70,0.1)', borderRadius: '6px', padding: '6px' }}>
          <Icon size={15} style={{ color: 'var(--accent-red)' }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value }) {
  return (
    <div className="form-group">
      <label className="form-label" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input className="form-input" value={value || '—'} readOnly style={{ opacity: 0.7, cursor: 'not-allowed', background: 'var(--bg-primary)' }} />
    </div>
  );
}
