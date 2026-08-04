import React, { useState, useEffect } from 'react';
import { Activity, Plus, Shield, ShieldCheck, ShieldAlert, Award, FileSpreadsheet, FileDown, Search, Eye, QrCode, Download, X, CheckCircle } from 'lucide-react';
import AuditTimeline from './AuditTimeline';

export default function AdminDashboard({ user, token, triggerNotification }) {
  const [stats, setStats] = useState({
    totalRequests: 0, completedRequests: 0, successRate: 100, totalUnitsDonated: 0,
    totalHospitals: 0, pendingHospitals: 0, totalColleges: 0, totalStudents: 0
  });
  const [hospitals, setHospitals] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'hospitals', 'colleges', 'requests'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [qrModal, setQrModal] = useState(null); // { hospitalName, qrCode, qrToken }

  // New College Form State
  const [newCollege, setNewCollege] = useState({
    collegeName: '', collegeEmail: '', collegePhone: '', collegeAddress: '',
    nssCoordinatorName: '', nssCoordinatorContact: '', nssCoordinatorEmail: ''
  });

  // Filter states
  const [filterHospital, setFilterHospital] = useState('');
  const [filterBlood, setFilterBlood] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadStats = async () => {
    try {
      const statsRes = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const loadHospitals = async () => {
    try {
      const res = await fetch('/api/hospitals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHospitals(data);
      }
    } catch (err) {
      console.error('Error fetching hospitals:', err);
    }
  };

  const loadColleges = async () => {
    try {
      const res = await fetch('/api/colleges', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setColleges(data);
      }
    } catch (err) {
      console.error('Error fetching colleges:', err);
    }
  };

  const loadAllRequests = async () => {
    try {
      const res = await fetch('/api/requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllRequests(data);
      }
    } catch (err) {
      console.error('Error fetching all requests:', err);
    }
  };

  const initData = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadHospitals(), loadColleges(), loadAllRequests()]);
    setLoading(false);
  };

  useEffect(() => {
    initData();
  }, [token]);

  const handleVerifyHospital = async (hospitalId, status) => {
    if (!window.confirm(`Are you sure you want to update status to ${status}?`)) return;
    try {
      const res = await fetch(`/api/hospitals/${hospitalId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        const data = await res.json();
        loadHospitals();
        loadStats();

        const targetHospital = hospitals.find(h => h.hospital_id === hospitalId);
        if (targetHospital) {
          triggerNotification('email', `Hospital ${status.toLowerCase()}: ${targetHospital.hospital_name}. QR code generated.`, targetHospital.hospital_email);
        }

        if (status === 'VERIFIED' && data.qrCode) {
          setQrModal({
            hospitalName: targetHospital?.hospital_name || 'Hospital',
            qrCode: data.qrCode,
            qrToken: data.qrToken
          });
        } else {
          alert(`Hospital ${status.toLowerCase()} successfully.`);
        }
      } else {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
    } catch (err) {
      alert('Failed to update hospital status');
    }
  };

  const downloadQr = () => {
    if (!qrModal?.qrCode) return;
    const link = document.createElement('a');
    link.href = qrModal.qrCode;
    link.download = `${qrModal.hospitalName}-QR.png`;
    link.click();
  };

  const handleCreateCollegeSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/colleges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCollege)
      });

      if (res.ok) {
        alert('College Coordinator registered successfully! Login password set to password123.');
        setNewCollege({
          collegeName: '', collegeEmail: '', collegePhone: '', collegeAddress: '',
          nssCoordinatorName: '', nssCoordinatorContact: '', nssCoordinatorEmail: ''
        });
        loadColleges();
        loadStats();
      } else {
        const err = await res.json();
        alert(`Registration failed: ${err.message}`);
      }
    } catch (err) {
      alert('Failed to register college');
    }
  };

  const exportMock = (format) => {
    alert(`Generating System Audit Report in ${format.toUpperCase()} format...\n\nSuccessfully downloaded: secure_audit_report_${Date.now()}.${format}`);
  };

  const filteredRequests = allRequests.filter(r => {
    const matchesHospital = filterHospital ? r.hospital_name.toLowerCase().includes(filterHospital.toLowerCase()) : true;
    const matchesBlood = filterBlood ? r.blood_type === filterBlood : true;
    const matchesStatus = filterStatus ? r.status.startsWith(filterStatus) : true;
    return matchesHospital && matchesBlood && matchesStatus;
  });

  return (
    <div>

      {/* QR Code Modal — shown after hospital verification */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-red)', borderRadius: '18px', padding: '32px', width: '100%', maxWidth: '420px', textAlign: 'center', boxShadow: '0 0 40px rgba(230,57,70,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <button onClick={() => setQrModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <CheckCircle size={36} style={{ color: 'var(--success)', marginBottom: '10px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Hospital Verified!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              <strong>{qrModal.hospitalName}</strong> has been verified.<br />
              Their unique QR code has been generated.
            </p>
            {qrModal.qrCode && (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', display: 'inline-block', marginBottom: '16px' }}>
                <img src={qrModal.qrCode} alt="Hospital QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Scan URL: <code style={{ color: 'var(--accent-red)', fontSize: '10px', wordBreak: 'break-all' }}>
                {`${window.location.origin}/qr/${qrModal.qrToken}`}
              </code>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={downloadQr}><Download size={14} /> Download QR</button>
              <button className="btn btn-outline" onClick={() => setQrModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>System Administration Control Panel</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Monitor compliance rate, verify registered hospital credentials, set up college NSS coordinators, and view the global audit database.
          </p>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '30px', gap: '20px' }}>
        {['stats', 'hospitals', 'colleges', 'requests'].map((t) => (
          <span 
            key={t}
            style={{ 
              padding: '12px 6px', fontWeight: 600, fontSize: '15px', 
              color: activeTab === t ? 'var(--accent-red)' : 'var(--text-secondary)', 
              borderBottom: activeTab === t ? '2px solid var(--accent-red)' : 'none', 
              cursor: 'pointer', textTransform: 'capitalize' 
            }}
            onClick={() => { setActiveTab(t); setSelectedRequest(null); }}
          >
            {t === 'stats' ? 'Global Overview' : t === 'requests' ? 'Audit Database' : t}
          </span>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading control panel database...</div>
      ) : selectedRequest ? (
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Deep Audit Trace: REQ-{selectedRequest.request.request_id}</h2>
            <button className="btn btn-secondary btn-small" onClick={() => setSelectedRequest(null)}>Close Trace</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--accent-red)', marginBottom: '14px' }}>Request Parameters</h3>
              <table style={{ width: '100%', fontSize: '13px', borderSpacing: '0 8px', borderCollapse: 'separate' }}>
                <tbody>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Hospital Name:</td><td>{selectedRequest.request.hospital_name}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Address:</td><td>{selectedRequest.request.hospital_address}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Blood Type:</td><td style={{ fontWeight: 600 }}>{selectedRequest.request.blood_type}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Urgency:</td><td><span className={`badge ${selectedRequest.request.urgency.toLowerCase()}`}>{selectedRequest.request.urgency}</span></td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Status:</td><td><span className={`badge ${selectedRequest.request.status.toLowerCase().split(' - ')[0]}`}>{selectedRequest.request.status}</span></td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Patient / Age:</td><td>{selectedRequest.request.patient_name} ({selectedRequest.request.patient_age} yrs)</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Relative:</td><td>{selectedRequest.request.relative_name} ({selectedRequest.request.relative_contact})</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Attending Doctor:</td><td>{selectedRequest.request.doctor_name} ({selectedRequest.request.doctor_phone})</td></tr>
                </tbody>
              </table>

              <h3 style={{ fontSize: '16px', color: 'var(--accent-red)', margin: '24px 0 14px 0' }}>Verified Volunteers</h3>
              {selectedRequest.verifications.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}>
                  No verifications submitted.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedRequest.verifications.map(v => (
                    <div key={v.verification_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}>
                      <div>
                        <strong>{v.student_name}</strong> - {v.college_name} ({v.student_phone})
                      </div>
                      <span className={`badge ${v.verification_status.toLowerCase()}`}>{v.verification_status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <AuditTimeline requestId={selectedRequest.request.request_id} token={token} />
            </div>
          </div>
        </div>
      ) : activeTab === 'stats' ? (
        <div>
          {/* Main Statistics Cards */}
          <div className="dashboard-grid">
            <div className="stat-card danger">
              <div>
                <div className="stat-title">Total Blood Demands</div>
                <div className="stat-num">{stats.totalRequests}</div>
              </div>
              <div className="stat-icon-wrapper"><Activity size={22} /></div>
            </div>
            <div className="stat-card success">
              <div>
                <div className="stat-title">Lives Saved (Transfers Completed)</div>
                <div className="stat-num">{stats.completedRequests}</div>
              </div>
              <div className="stat-icon-wrapper"><ShieldCheck size={22} /></div>
            </div>
            <div className="stat-card info">
              <div>
                <div className="stat-title">NSS Networks Registered</div>
                <div className="stat-num">{stats.totalColleges}</div>
              </div>
              <div className="stat-icon-wrapper"><Award size={22} /></div>
            </div>
            <div className="stat-card warning">
              <div>
                <div className="stat-title">System Compliance Success Rate</div>
                <div className="stat-num">{stats.successRate}%</div>
              </div>
              <div className="stat-icon-wrapper"><Shield size={22} /></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
            {/* Left side: Registered hospitals verification queue */}
            <div className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title"><ShieldAlert size={20} className="logo-icon" /> Hospital Registration Queue</h2>
              </div>

              {hospitals.filter(h => h.status === 'PENDING').length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  All registered hospitals verified. Verification queue is currently clear!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {hospitals.filter(h => h.status === 'PENDING').map((h) => (
                    <div key={h.hospital_id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '15px', color: 'white' }}>{h.hospital_name}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Email: {h.hospital_email} | Reg ID: {h.registration_id}</div>
                        </div>
                        <span className="badge pending">Pending verification</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        <strong>Address:</strong> {h.hospital_address}<br />
                        <strong>Authorized Representative:</strong> {h.admin_name} ({h.admin_contact})
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-danger btn-small" onClick={() => handleVerifyHospital(h.hospital_id, 'REJECTED')}>Reject Registration</button>
                        <button className="btn btn-success btn-small" onClick={() => handleVerifyHospital(h.hospital_id, 'VERIFIED')}>Approve & Verify Account</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: Database counters summary */}
            <div className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">Database Records Counters</h2>
              </div>
              <table style={{ width: '100%', fontSize: '14px', borderSpacing: '0 12px', borderCollapse: 'separate' }}>
                <tbody>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Registered Students Voluntered:</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{stats.totalStudents}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Active Colleges Integrated:</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{stats.totalColleges}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Verified Hospital Portals:</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{stats.totalHospitals - stats.pendingHospitals}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Total Blood Units Transferred:</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{stats.totalUnitsDonated} Units</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'hospitals' ? (
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Registered Hospital Directory</h2>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital Name</th>
                  <th>Reg ID</th>
                  <th>Contact Email</th>
                  <th>Representative</th>
                  <th>Registration Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map((h) => (
                  <tr key={h.hospital_id}>
                    <td style={{ fontWeight: 600, color: 'white' }}>{h.hospital_name}</td>
                    <td>{h.registration_id}</td>
                    <td>{h.hospital_email}</td>
                    <td>{h.admin_name} ({h.admin_contact})</td>
                    <td>
                      <span className={`badge ${h.status.toLowerCase()}`}>{h.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {h.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-success btn-small" onClick={() => handleVerifyHospital(h.hospital_id, 'VERIFIED')}>Verify</button>
                          <button className="btn btn-danger btn-small" onClick={() => handleVerifyHospital(h.hospital_id, 'REJECTED')}>Reject</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verified account</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'colleges' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
          {/* Left: college list */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2 className="section-title">Active Colleges Directory</h2>
            </div>
            
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>College Name</th>
                    <th>NSS Coordinator</th>
                    <th>Email Contact</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {colleges.map((c) => (
                    <tr key={c.college_id}>
                      <td style={{ fontWeight: 600, color: 'white' }}>{c.college_name}</td>
                      <td>{c.nss_coordinator_name}</td>
                      <td>{c.nss_coordinator_email}</td>
                      <td>{c.nss_coordinator_contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: add college form */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2 className="section-title"><Plus size={18} className="logo-icon" /> Register New NSS Coordinator</h2>
            </div>
            
            <form onSubmit={handleCreateCollegeSubmit}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">College Name *</label>
                <input className="form-input" type="text" placeholder="College Name" value={newCollege.collegeName} onChange={(e) => setNewCollege(prev => ({ ...prev, collegeName: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">College Registrar Email *</label>
                <input className="form-input" type="email" placeholder="registrar@college.edu" value={newCollege.collegeEmail} onChange={(e) => setNewCollege(prev => ({ ...prev, collegeEmail: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">College Phone Contact *</label>
                <input className="form-input" type="text" placeholder="022-2555..." value={newCollege.collegePhone} onChange={(e) => setNewCollege(prev => ({ ...prev, collegePhone: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">College Office Address *</label>
                <input className="form-input" type="text" placeholder="Campus Office..." value={newCollege.collegeAddress} onChange={(e) => setNewCollege(prev => ({ ...prev, collegeAddress: e.target.value }))} required />
              </div>
              
              <h3 style={{ fontSize: '13px', color: 'var(--accent-red)', margin: '16px 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NSS Coordinator Details</h3>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Coordinator Name *</label>
                <input className="form-input" type="text" placeholder="Prof. Jane Doe" value={newCollege.nssCoordinatorName} onChange={(e) => setNewCollege(prev => ({ ...prev, nssCoordinatorName: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Coordinator Mobile Phone *</label>
                <input className="form-input" type="text" placeholder="98765..." value={newCollege.nssCoordinatorContact} onChange={(e) => setNewCollege(prev => ({ ...prev, nssCoordinatorContact: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Coordinator Official Email *</label>
                <input className="form-input" type="email" placeholder="nss@college.edu" value={newCollege.nssCoordinatorEmail} onChange={(e) => setNewCollege(prev => ({ ...prev, nssCoordinatorEmail: e.target.value }))} required />
              </div>
              
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Register College Account</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="dashboard-section">
          <div className="section-header" style={{ marginBottom: '16px' }}>
            <h2 className="section-title">Global Request Audit Database</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary btn-small" onClick={() => exportMock('csv')}>
                <FileSpreadsheet size={14} /> Export CSV
              </button>
              <button className="btn btn-secondary btn-small" onClick={() => exportMock('pdf')}>
                <FileDown size={14} /> Export PDF
              </button>
            </div>
          </div>

          {/* Search toolbar */}
          <div className="filter-toolbar" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', flex: '1', gap: '10px', minWidth: '300px' }}>
              <Search style={{ color: 'var(--text-muted)', marginTop: '12px' }} size={18} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search hospital names..." 
                value={filterHospital} 
                style={{ flex: 1 }}
                onChange={(e) => setFilterHospital(e.target.value)}
              />
            </div>
            <select className="form-select filter-input" value={filterBlood} onChange={(e) => setFilterBlood(e.target.value)}>
              <option value="">All Blood Types</option>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="form-select filter-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="ANNOUNCED">ANNOUNCED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
            {(filterHospital || filterBlood || filterStatus) && (
              <button 
                className="btn btn-secondary btn-small"
                onClick={() => { setFilterHospital(''); setFilterBlood(''); setFilterStatus(''); }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Req ID</th>
                  <th>Hospital</th>
                  <th>Blood</th>
                  <th>Urgency</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => (
                  <tr key={r.request_id}>
                    <td style={{ fontWeight: 600, color: 'white' }}>REQ-{r.request_id}</td>
                    <td>{r.hospital_name}</td>
                    <td style={{ fontWeight: 600, color: 'white' }}>{r.blood_type} ({r.quantity} Units)</td>
                    <td>
                      <span className={`badge ${r.urgency.toLowerCase()}`}>{r.urgency}</span>
                    </td>
                    <td>{r.patient_name}</td>
                    <td>
                      <span className={`badge ${r.status.toLowerCase().split(' - ')[0]}`}>{r.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary btn-small"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/requests/${r.request_id}`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                              const details = await res.json();
                              setSelectedRequest(details);
                            }
                          } catch (err) {
                            alert('Error loading details');
                          }
                        }}
                      >
                        <Eye size={12} /> Deep Trace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
