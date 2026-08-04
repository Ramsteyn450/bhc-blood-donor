import React, { useState, useEffect, useCallback } from 'react';
import {
  Check, X, Megaphone, Eye, Clock, RefreshCw, ChevronDown, ChevronUp,
  ShieldCheck, AlertTriangle, Loader, FileText, Building, User,
  Droplets, ArrowRight, CheckCircle, Calendar
} from 'lucide-react';
import AuditTimeline from './AuditTimeline';

const STATUS_CONFIG = {
  PENDING:          { label: 'Pending Review',      color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  APPROVED:         { label: 'Approved',             color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  FORWARDED_TO_NSS: { label: 'Forwarded to NSS',    color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  ANNOUNCED:        { label: 'Announced',            color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  IN_PROGRESS:      { label: 'In Progress',          color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  COMPLETED:        { label: 'Completed',            color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

export default function NssDashboard({ user, token, triggerNotification }) {
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('incoming');
  const [expanded, setExpanded]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals
  const [rejectModal, setRejectModal]   = useState(null); // requestId
  const [rejectReason, setRejectReason] = useState('');
  const [scheduleModal, setScheduleModal] = useState(null); // { verificationId }
  const [scheduleData, setScheduleData] = useState({ date: '', location: 'Hospital Blood Bank' });

  // Filters
  const [filterBlood,   setFilterBlood]   = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests', { headers: authHeaders });
      if (res.ok) setRequests(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const loadDetail = async (reqId) => {
    if (expanded === reqId) { setExpanded(null); setDetail(null); return; }
    setExpanded(reqId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/requests/${reqId}`, { headers: authHeaders });
      if (res.ok) setDetail(await res.json());
    } catch { /* silent */ }
    finally { setLoadingDetail(false); }
  };

  const updateStatus = async (requestId, status, extra = {}) => {
    try {
      const res = await fetch(`/api/requests/${requestId}/status`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ status, ...extra })
      });
      const data = await res.json();
      if (res.ok) {
        await loadRequests();
        setExpanded(null);
        setDetail(null);
        triggerNotification('bell', `Request ${requestId}: ${status}`, user.name);
        return true;
      } else {
        alert(data.message);
        return false;
      }
    } catch {
      alert('Network error');
      return false;
    }
  };

  const handleApprove = (reqId) => updateStatus(reqId, 'APPROVED');

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert('Please enter a rejection reason'); return; }
    const ok = await updateStatus(rejectModal, 'REJECTED', { rejectionReason: rejectReason });
    if (ok) { setRejectModal(null); setRejectReason(''); }
  };

  const handleForwardToNss = (reqId) => {
    if (window.confirm('Forward this request to the NSS Coordinator? The NSS Coordinator will receive it and announce to students.')) {
      updateStatus(reqId, 'FORWARDED_TO_NSS');
    }
  };

  const handleAnnounce = (reqId) => {
    if (window.confirm('Announce this request to students? Students will be notified through the college announcement system.')) {
      updateStatus(reqId, 'ANNOUNCED');
    }
  };

  const handleApproveVerification = async (verificationId) => {
    if (!scheduleData.date) { alert('Please enter the donation date'); return; }
    try {
      const res = await fetch(`/api/verifications/${verificationId}/review`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ status: 'APPROVED', donationDate: scheduleData.date, location: scheduleData.location })
      });
      const data = await res.json();
      if (res.ok) {
        setScheduleModal(null);
        setScheduleData({ date: '', location: 'Hospital Blood Bank' });
        await loadRequests();
        triggerNotification('bell', 'Student verification approved — donation scheduled', user.name);
      } else alert(data.message);
    } catch { alert('Network error'); }
  };

  const handleRejectVerification = async (verificationId) => {
    try {
      const res = await fetch(`/api/verifications/${verificationId}/review`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ status: 'REJECTED', notes: 'Rejected by NSS Coordinator' })
      });
      if (res.ok) { await loadRequests(); triggerNotification('bell', 'Verification rejected', user.name); }
    } catch { /* silent */ }
  };

  const handleCollect = async (donationId) => {
    try {
      const res = await fetch(`/api/donations/${donationId}/collect`, { method: 'PUT', headers: authHeaders });
      if (res.ok) { await loadRequests(); loadDetail(expanded); }
    } catch { /* silent */ }
  };

  const handleComplete = async (reqId) => {
    if (window.confirm('Mark this request as COMPLETED? This confirms blood has been delivered to the hospital.')) {
      await fetch(`/api/requests/${reqId}/deliver`, { method: 'PUT', headers: authHeaders });
      await loadRequests();
      setExpanded(null);
      setDetail(null);
    }
  };

  // Tab categories
  const tabs = {
    incoming:  { label: 'Incoming Requests',   filter: r => r.status === 'PENDING' },
    approved:  { label: 'Approved',             filter: r => r.status === 'APPROVED' },
    forwarded: { label: 'Forwarded to NSS',     filter: r => r.status === 'FORWARDED_TO_NSS' },
    tracking:  { label: 'Active',               filter: r => ['ANNOUNCED','IN_PROGRESS'].includes(r.status) },
    completed: { label: 'Completed',            filter: r => r.status === 'COMPLETED' }
  };

  const applyFilters = (list) => list.filter(r =>
    (!filterBlood   || r.blood_type === filterBlood) &&
    (!filterUrgency || r.urgency    === filterUrgency)
  );

  const tabRequests = applyFilters(requests.filter(tabs[activeTab]?.filter || (() => true)));

  const stats = {
    incoming:  requests.filter(tabs.incoming.filter).length,
    approved:  requests.filter(tabs.approved.filter).length,
    forwarded: requests.filter(tabs.forwarded.filter).length,
    active:    requests.filter(tabs.tracking.filter).length,
    completed: requests.filter(tabs.completed.filter).length
  };

  const getCfg = (status) => {
    const key = (status || '').split(' - ')[0];
    return STATUS_CONFIG[key] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  };

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px' }}>Reject Request</h3>
            <div className="form-group">
              <label className="form-label">Reason for Rejection <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea className="form-input" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Specify why this request is being rejected..." style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn btn-outline" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancel</button>
              <button className="btn" style={{ background: '#ef4444', color: '#fff' }} onClick={handleReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Verification Modal */}
      {scheduleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '6px' }}>Schedule Donation</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>Approve student verification and schedule blood collection.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Donation Date & Time <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-input" type="datetime-local" value={scheduleData.date} onChange={e => setScheduleData(d => ({ ...d, date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={scheduleData.location} onChange={e => setScheduleData(d => ({ ...d, location: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn btn-outline" onClick={() => setScheduleModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleApproveVerification(scheduleModal)}>
                <Calendar size={14} /> Schedule Donation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={22} style={{ color: 'var(--accent-red)' }} />
          College Administration — NSS Blood Network
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          {user.collegeName || user.name} · Review incoming requests and forward to NSS Coordinator
        </p>
      </div>

      {/* Flow Diagram */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Building size={13} style={{ color: 'var(--accent-red)' }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Hospital</span>
        </div>
        <ArrowRight size={14} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={13} style={{ color: '#a78bfa' }} />
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>College Admin Reviews</span>
        </div>
        <ArrowRight size={14} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Megaphone size={13} style={{ color: '#60a5fa' }} />
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>NSS Coordinator Announces</span>
        </div>
        <ArrowRight size={14} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <User size={13} style={{ color: '#22c55e' }} />
          <span style={{ color: '#22c55e', fontWeight: 600 }}>Students Volunteer</span>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { key: 'incoming',  label: 'Incoming',  color: '#f97316', badge: stats.incoming > 0 },
          { key: 'approved',  label: 'Approved',  color: '#22c55e' },
          { key: 'forwarded', label: 'To NSS',    color: '#a78bfa', badge: stats.forwarded > 0 },
          { key: 'active',    label: 'Active',    color: '#fbbf24' },
          { key: 'completed', label: 'Completed', color: '#60a5fa' }
        ].map(s => (
          <div key={s.key} onClick={() => setActiveTab(s.key)} style={{
            background: activeTab === s.key ? `${s.color}14` : 'var(--bg-secondary)',
            border: `1px solid ${activeTab === s.key ? s.color : 'var(--border-color)'}`,
            borderRadius: '10px', padding: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: s.color, position: 'relative', display: 'inline-block' }}>
              {stats[s.key]}
              {s.badge && stats[s.key] > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-10px', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" value={filterBlood} onChange={e => setFilterBlood(e.target.value)} style={{ width: 'auto', minWidth: '110px', fontSize: '12px', padding: '6px 10px' }}>
          <option value="">All Blood Types</option>
          {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-select" value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)} style={{ width: 'auto', minWidth: '130px', fontSize: '12px', padding: '6px 10px' }}>
          <option value="">All Urgency</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
        </select>
        <button className="btn btn-outline" onClick={loadRequests} style={{ fontSize: '12px', padding: '6px 12px', marginLeft: 'auto' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Request List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: 'var(--text-muted)' }}>
          <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading requests...
        </div>
      ) : tabRequests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Droplets size={36} style={{ marginBottom: '10px', opacity: 0.3 }} />
          <p style={{ fontSize: '14px' }}>No {tabs[activeTab]?.label.toLowerCase()} at the moment.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tabRequests.map(req => {
            const cfg = getCfg(req.status);
            const isOpen = expanded === req.request_id;
            return (
              <div key={req.request_id} style={{ background: 'var(--bg-secondary)', border: `1px solid ${isOpen ? 'var(--accent-red)' : 'var(--border-color)'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                {/* Card header */}
                <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => loadDetail(req.request_id)}>
                  <div style={{ background: cfg.bg, borderRadius: '8px', padding: '8px 10px', minWidth: '52px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: cfg.color }}>{req.blood_type}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>×{req.quantity}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{req.hospital_name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                      {req.urgency === 'CRITICAL' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 700 }}>⚠ CRITICAL</span>}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>
                      Patient: {req.patient_name} · Doctor: {req.doctor_name || '—'} · {new Date(req.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px 18px' }}>
                    {loadingDetail ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', justifyContent: 'center', padding: '20px' }}>
                        <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading details...
                      </div>
                    ) : detail ? (
                      <>
                        {/* Info grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                          {[
                            ['Department', detail.request.doctor_department],
                            ['Ward / Room', detail.request.ward_number],
                            ['Patient Age', detail.request.patient_age],
                            ['Reason', detail.request.reason],
                            ['Relative', detail.request.relative_name],
                            ['Rel. Contact', detail.request.relative_contact],
                            ['Urgency', detail.request.urgency],
                            ['Request ID', detail.request.request_uuid?.slice(0, 12) + '…']
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>{k}</div>
                              <div style={{ fontSize: '13px', fontWeight: 500 }}>{v || '—'}</div>
                            </div>
                          ))}
                        </div>

                        {/* Proof documents */}
                        {(detail.request.proof_prescription || detail.request.proof_case_sheet) && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Proof Documents (Uploaded by Hospital)</div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {[
                                ['Prescription', detail.request.proof_prescription],
                                ['Case Sheet',   detail.request.proof_case_sheet],
                                ['Signature',    detail.request.proof_signature],
                                ['Seal',         detail.request.proof_seal]
                              ].map(([label, url]) => url && (
                                <a key={label} href={url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', padding: '5px 12px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderRadius: '6px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(96,165,250,0.2)' }}>
                                  <Eye size={11} /> {label}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons based on status */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                          {/* Stage 1: College Admin — Pending requests */}
                          {req.status === 'PENDING' && (
                            <>
                              <div style={{ width: '100%', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                                Stage 1 — College Administrator Review
                              </div>
                              <button className="btn btn-primary" onClick={() => handleApprove(req.request_id)}>
                                <Check size={14} /> Approve Request
                              </button>
                              <button className="btn" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => setRejectModal(req.request_id)}>
                                <X size={14} /> Reject
                              </button>
                            </>
                          )}

                          {/* Stage 2: Forward to NSS Coordinator */}
                          {req.status === 'APPROVED' && (
                            <>
                              <div style={{ width: '100%', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                                Stage 2 — Forward to NSS Coordinator
                              </div>
                              <button className="btn btn-primary" onClick={() => handleForwardToNss(req.request_id)}>
                                <ArrowRight size={14} /> Forward to NSS Coordinator
                              </button>
                              <button className="btn" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => setRejectModal(req.request_id)}>
                                <X size={14} /> Reject
                              </button>
                            </>
                          )}

                          {/* Stage 3: NSS announces to students */}
                          {req.status === 'FORWARDED_TO_NSS' && (
                            <>
                              <div style={{ width: '100%', fontSize: '11px', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                                Stage 3 — NSS Coordinator: Announce to Students
                              </div>
                              <button className="btn btn-primary" onClick={() => handleAnnounce(req.request_id)} style={{ background: '#7c3aed' }}>
                                <Megaphone size={14} /> Announce to Students
                              </button>
                            </>
                          )}

                          {/* Stage 4: Manage announced request */}
                          {req.status === 'IN_PROGRESS' && (
                            <button className="btn btn-primary" onClick={() => handleComplete(req.request_id)} style={{ background: '#22c55e' }}>
                              <CheckCircle size={14} /> Mark as Completed
                            </button>
                          )}
                        </div>

                        {/* Student verifications (for ANNOUNCED / IN_PROGRESS) */}
                        {detail.verifications?.length > 0 && (
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
                              Student Verifications ({detail.verifications.length})
                            </div>
                            {detail.verifications.map(v => (
                              <div key={v.verification_id} style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '12px', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '160px' }}>
                                  <span style={{ fontWeight: 600 }}>{v.student_name}</span>
                                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{v.student_phone}</span>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{v.college_name}</div>
                                  <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {[
                                      ['In Hospital', v.patient_in_hospital],
                                      ['Blood Needed', v.blood_still_needed],
                                      ['Type OK', v.blood_type_confirmed],
                                      ['Qty OK', v.quantity_confirmed],
                                      ['Relative OK', v.relative_confirmed]
                                    ].map(([label, val]) => (
                                      <span key={label} style={{ padding: '2px 6px', borderRadius: '4px', background: val ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: val ? '#22c55e' : '#ef4444' }}>
                                        {val ? '✓' : '✗'} {label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {v.verification_status === 'PENDING' && (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-primary" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => setScheduleModal(v.verification_id)}>
                                      <Calendar size={12} /> Schedule
                                    </button>
                                    <button className="btn" style={{ fontSize: '11px', padding: '5px 10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => handleRejectVerification(v.verification_id)}>
                                      <X size={12} /> Reject
                                    </button>
                                  </div>
                                )}
                                {v.verification_status === 'APPROVED' && (
                                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }}>✓ Approved</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Audit Timeline */}
                        {detail.auditLogs?.length > 0 && (
                          <AuditTimeline logs={detail.auditLogs} />
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
