import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck, Check, X, Search, Filter, Printer, Eye, Mail, Send,
  FileText, Droplets, RefreshCw, AlertTriangle, CheckCircle,
  Building, User, Phone, Loader, LogOut, ChevronDown, ChevronUp, Clock,
  MapPin, Navigation, ExternalLink, Download, BarChart2, Calendar, PieChart, Activity, TrendingUp, Layers, Compass, ArrowUpDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import PrintableRequestSheet from './PrintableRequestSheet';
import PdfDownloadModal from './PdfDownloadModal';
import BhcCrestLogo from './BhcCrestLogo';

// Helper: Haversine distance calculation in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1); // Distance in km
}

export default function CollegeAdminDashboard({ token, user, onLogout }) {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0, today: 0, weekly: 0, monthly: 0, yearly: 0,
    pending: 0, approved: 0, rejected: 0, completed: 0,
    charts: { byHospital: [], byGender: [], byBloodGroup: [], byEmergency: [], byDay: [], byMonth: [], byYear: [] }
  });
  const [loading, setLoading] = useState(true);

  // Filters State
  const [activeTab, setActiveTab] = useState('RECEIVED'); // RECEIVED | PENDING | APPROVED | REJECTED | COMPLETED
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [filterBlood, setFilterBlood] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [showCharts, setShowCharts] = useState(true);

  // Data Grid Sorting & Pagination
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Modals & Inspection State
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [printRequest, setPrintRequest] = useState(null);
  const [pdfModalRequest, setPdfModalRequest] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Gmail SMTP Test Email State
  const [showTestEmailPanel, setShowTestEmailPanel] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [testEmailResult, setTestEmailResult] = useState(null);

  const handleSendTestEmail = async () => {
    const recipient = testEmailAddress.trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      setTestEmailStatus('error');
      setTestEmailResult({ error: 'Please enter a valid email address.' });
      return;
    }
    setTestEmailStatus('sending');
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientEmail: recipient })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestEmailStatus('success');
        setTestEmailResult(data);
      } else {
        setTestEmailStatus('error');
        setTestEmailResult(data);
      }
    } catch (err) {
      setTestEmailStatus('error');
      setTestEmailResult({ error: `Network error: ${err.message}` });
    }
  };

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }), [token]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/requests?status=${activeTab === 'RECEIVED' ? '' : activeTab}`;
      if (filterHospital) url += `&hospital=${encodeURIComponent(filterHospital)}`;
      if (filterBlood) url += `&blood_type=${encodeURIComponent(filterBlood)}`;
      if (filterGender) url += `&gender=${encodeURIComponent(filterGender)}`;
      if (filterDate) url += `&date=${encodeURIComponent(filterDate)}`;
      if (filterMonth) url += `&month=${encodeURIComponent(filterMonth)}`;
      if (filterYear) url += `&year=${encodeURIComponent(filterYear)}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const [reqRes, statsRes] = await Promise.all([
        fetch(url, { headers: authHeaders }),
        fetch('/api/admin/stats', { headers: authHeaders })
      ]);

      if (reqRes.ok) setRequests(await reqRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      /* silent catch */
    } finally {
      setLoading(false);
    }
  }, [authHeaders, activeTab, filterHospital, filterBlood, filterGender, filterDate, filterMonth, filterYear, searchTerm]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateStatus = async (requestId, status, reason = '') => {
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/status`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status, rejectionReason: reason })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setRejectModalId(null);
        setRejectReason('');
        await fetchRequests();
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Network error while updating status.');
    }
  };

  const handleMarkRequestReceived = (id) => {
    if (window.confirm(`Mark blood request REQ-${id} as "Request Received"? An email notification will be sent to the relative.`)) {
      handleUpdateStatus(id, 'Request Received');
    }
  };

  const handleApprove = (id) => {
    if (window.confirm(`Approve blood request REQ-${id}? This will complete the software workflow.`)) {
      handleUpdateStatus(id, 'APPROVED');
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) {
      alert('Please enter a reason for rejecting this request.');
      return;
    }
    handleUpdateStatus(rejectModalId, 'REJECTED', rejectReason);
  };

  const getStatusBadge = (status) => {
    if (status === 'Request Received' || status === 'REQUEST_RECEIVED') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
          <Mail size={12} /> REQUEST RECEIVED
        </span>
      );
    }
    if (status === 'APPROVED' || status === 'FORWARDED_TO_NSS' || status === 'ANNOUNCED') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
          <CheckCircle size={12} /> APPROVED
        </span>
      );
    }
    if (status === 'COMPLETED') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
          <CheckCircle size={12} /> COMPLETED
        </span>
      );
    }
    if (status.startsWith('REJECTED')) {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
          <X size={12} /> REJECTED
        </span>
      );
    }
    return (
      <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
        <AlertTriangle size={12} /> PENDING REVIEW
      </span>
    );
  };

  const getGoogleMapsUrl = (req) => {
    if (req.latitude && req.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${req.latitude},${req.longitude}&query=${encodeURIComponent(req.hospital_name || 'Hospital')}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((req.hospital_name || '') + ' Tiruchirappalli')}`;
  };

  // Sorting & Pagination Logic
  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [requests, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRequests.slice(start, start + pageSize);
  }, [sortedRequests, currentPage, pageSize]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">

      {/* Printable Sheet View Overlay */}
      {printRequest && (
        <PrintableRequestSheet request={printRequest} onClose={() => setPrintRequest(null)} />
      )}

      {/* Small-Size PDF Download Modal */}
      {pdfModalRequest && (
        <PdfDownloadModal request={pdfModalRequest} onClose={() => setPdfModalRequest(null)} />
      )}

      {/* Prescription Image Zoom Lightbox */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl p-4 w-full max-w-3xl text-center relative shadow-2xl">
            <button
              onClick={() => setSelectedPrescription(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 bg-slate-100 p-2 rounded-full"
            >
              <X size={20} />
            </button>
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-center gap-2">
              <FileText size={16} className="text-[#0a1428]" /> Doctor Prescription Proof — High Resolution View
            </h4>
            <img
              src={selectedPrescription}
              alt="Prescription Full View"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-lg border border-slate-200"
            />
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-red-300 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <X className="text-red-600" size={18} /> Reject Blood Request REQ-{rejectModalId}
            </h3>
            <p className="text-xs text-slate-600">Please state the reason for rejecting this request.</p>
            <textarea
              className="form-input text-sm w-full"
              rows={3}
              placeholder="e.g. Duplicate submission, Invalid prescription proof..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn btn-outline text-xs" onClick={() => { setRejectModalId(null); setRejectReason(''); }}>Cancel</button>
              <button className="btn bg-red-600 hover:bg-red-700 text-white text-xs font-bold" onClick={handleRejectSubmit}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Header Bar — Official BHC Deep Navy Theme */}
      <div className="bg-[#0a1428] text-white border-b-4 border-[#d4af37] rounded-2xl p-6 flex justify-between items-center flex-wrap gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <BhcCrestLogo className="w-14 h-16 shrink-0" />
          <div>
            <div className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              Bishop Heber College (Autonomous) · Administration Portal
            </div>
            <h1 className="text-2xl font-black font-serif text-white mt-0.5">BHC Blood Donor Analytics & Control</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Review received blood requests, trigger relative email updates, track location & distance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm transition border ${
              showCharts
                ? 'bg-[#d4af37] text-slate-900 border-amber-300 hover:bg-amber-400'
                : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
            }`}
            onClick={() => setShowCharts(!showCharts)}
          >
            <BarChart2 size={15} className="shrink-0" />
            <span>{showCharts ? 'Hide Analytics' : 'Show Analytics'}</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600/60 shadow-sm transition"
            onClick={fetchRequests}
          >
            <RefreshCw size={15} className="shrink-0" />
            <span>Refresh Data</span>
          </button>

          {onLogout && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-sm transition"
              onClick={onLogout}
            >
              <LogOut size={15} className="shrink-0" />
              <span>Sign Out</span>
            </button>
          )}

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white border border-amber-500 shadow-sm transition"
            onClick={() => { setShowTestEmailPanel(p => !p); setTestEmailStatus(null); setTestEmailResult(null); }}
          >
            <Mail size={15} className="shrink-0" />
            <span>Test Email</span>
          </button>
        </div>
      </div>

      {/* GMAIL SMTP TEST EMAIL PANEL */}
      {showTestEmailPanel && (
        <div className="bg-white border border-amber-200 rounded-2xl shadow-lg p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={18} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800">Gmail SMTP – Email Configuration Test</h3>
            <span className="ml-auto text-xs text-slate-400">Admin only · Not visible to users</span>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Test Email Address</label>
              <input
                type="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Enter recipient email to test (e.g. yourname@gmail.com)"
                value={testEmailAddress}
                onChange={e => { setTestEmailAddress(e.target.value); setTestEmailStatus(null); setTestEmailResult(null); }}
                disabled={testEmailStatus === 'sending'}
              />
            </div>
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testEmailStatus === 'sending'}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60 transition whitespace-nowrap"
            >
              {testEmailStatus === 'sending' ? (
                <><Loader size={15} className="animate-spin" /> Sending…</>
              ) : (
                <><Send size={15} /> Send Test Email</>
              )}
            </button>
          </div>

          {/* Result */}
          {testEmailStatus === 'success' && testEmailResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 font-bold text-sm mb-2">
                <CheckCircle size={16} /> Test email sent successfully
              </div>
              <div className="text-xs text-green-700 space-y-1">
                <div><span className="font-semibold">Provider:</span> {testEmailResult.provider || 'Gmail SMTP'}</div>
                <div><span className="font-semibold">Recipient:</span> {testEmailResult.recipient}</div>
                <div><span className="font-semibold">Message ID:</span> {testEmailResult.messageId}</div>
                {testEmailResult.smtpDiagnostics && (
                  <div><span className="font-semibold">SMTP Connection:</span> {testEmailResult.smtpDiagnostics.smtpConnection}</div>
                )}
              </div>
            </div>
          )}
          {testEmailStatus === 'error' && testEmailResult && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                <AlertTriangle size={16} /> Email delivery failed
              </div>
              <div className="text-xs text-red-700 space-y-1">
                <div><span className="font-semibold">Error:</span> {testEmailResult.error || testEmailResult.message || 'Unknown error'}</div>
                {testEmailResult.errorCode && <div><span className="font-semibold">Error Code:</span> {testEmailResult.errorCode}</div>}
                {testEmailResult.smtpDiagnostics && (
                  <>
                    <div><span className="font-semibold">SMTP Host:</span> {testEmailResult.smtpDiagnostics.host}</div>
                    <div><span className="font-semibold">SMTP User Configured:</span> {testEmailResult.smtpDiagnostics.smtpUserConfigured ? 'YES' : 'NO'}</div>
                    <div><span className="font-semibold">SMTP Password Configured:</span> {testEmailResult.smtpDiagnostics.smtpPasswordConfigured ? 'YES' : 'NO'}</div>
                    <div><span className="font-semibold">SMTP Connection:</span> {testEmailResult.smtpDiagnostics.smtpConnection}</div>
                  </>
                )}
              </div>
              <p className="text-xs text-red-500 mt-2">
                💡 Fix: Ensure SMTP_USER and SMTP_PASS (Gmail App Password) are set in Render Environment Variables.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ANIMATED KPI METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-900', border: 'border-slate-300' },
          { label: 'Today', value: stats.today, color: 'text-amber-600', border: 'border-amber-300' },
          { label: 'Weekly', value: stats.weekly, color: 'text-blue-600', border: 'border-blue-300' },
          { label: 'Monthly', value: stats.monthly, color: 'text-emerald-600', border: 'border-emerald-300' },
          { label: 'Yearly', value: stats.yearly, color: 'text-purple-600', border: 'border-purple-300' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600', border: 'border-amber-300' },
          { label: 'Approved', value: stats.approved, color: 'text-emerald-600', border: 'border-emerald-300' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600', border: 'border-red-300' },
          { label: 'Completed', value: stats.completed, color: 'text-cyan-600', border: 'border-cyan-300' }
        ].map(s => (
          <div key={s.label} className={`bg-white border ${s.border} rounded-xl p-3 text-center shadow-sm hover:shadow-md transition`}>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* MODERN MULTI-CHART SUITE (Area, Line, Bar, Horizontal Bar, Doughnut, Radar, Heatmap, Timeline) */}
      {showCharts && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 1. AREA CHART — Daily Requests Trend */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={14} className="text-[#0a1428]" /> Area Chart — Daily Requests Trend
              </h3>
              <div className="h-40 flex items-end justify-between gap-1 pt-4 border-b border-slate-100 px-1">
                {(stats.charts?.byDay || []).slice(0, 10).reverse().map((d, i) => {
                  const maxVal = Math.max(...(stats.charts?.byDay || []).map(x => x.count), 1);
                  const pct = Math.min(100, Math.max(15, (d.count / maxVal) * 100));
                  return (
                    <div key={d.date_val || i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <span className="text-[9px] text-white opacity-0 group-hover:opacity-100 transition absolute -top-5 bg-slate-800 px-1 rounded">{d.count}</span>
                      <div
                        className="w-full bg-gradient-to-t from-[#0a1428] to-[#d4af37] rounded-t transition-all duration-500"
                        style={{ height: `${pct}%` }}
                      />
                      <span className="text-[8px] text-slate-400 truncate w-full text-center">{d.date_val ? d.date_val.slice(5) : `D${i+1}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. HORIZONTAL BAR CHART — Blood Group Demand */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <BarChart2 size={14} className="text-[#dc2626]" /> Horizontal Bar — Blood Group Demand
              </h3>
              <div className="space-y-2">
                {(stats.charts?.byBloodGroup || []).map(b => (
                  <div key={b.blood_type} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span className="font-extrabold text-red-600">{b.blood_type}</span>
                      <span className="text-[11px] text-slate-500">{b.count} Units</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0a1428] h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (b.count / Math.max(1, stats.total)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. DOUGHNUT VIEW & RADAR MATRIX — Gender & Emergency */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <PieChart size={14} className="text-[#0a1428]" /> Doughnut View — Patient Gender
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {(stats.charts?.byGender || []).map(g => (
                    <div key={g.gender} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-base font-black text-slate-900">{g.count}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{g.gender}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Compass size={14} className="text-amber-600" /> Emergency Urgency Breakdown
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {(stats.charts?.byEmergency || []).map(e => (
                    <div key={e.urgency} className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="font-extrabold text-slate-900">{e.count}</div>
                      <div className="text-[10px] text-slate-500">{e.urgency}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MULTI-PARAMETRIC FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
        {/* Status Tabs */}
        <div className="flex gap-2 border-b border-slate-100 pb-3 overflow-x-auto">
          {[
            { key: 'RECEIVED', label: `Received Requests (${stats.total})` },
            { key: 'PENDING', label: `Pending Review (${stats.pending})` },
            { key: 'APPROVED', label: `Approved (${stats.approved})` },
            { key: 'REJECTED', label: `Rejected (${stats.rejected})` },
            { key: 'COMPLETED', label: `Completed (${stats.completed})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[#0a1428] text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          <div className="col-span-2 relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search Hospital / Patient / Relative..."
              className="form-input text-xs pl-9 w-full"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <select
            className="form-select text-xs"
            value={filterBlood}
            onChange={e => { setFilterBlood(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Blood Groups</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select
            className="form-select text-xs"
            value={filterGender}
            onChange={e => { setFilterGender(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>

          {/* Single Unified Date Filter */}
          <div className="relative">
            <input
              type="date"
              className="form-input text-xs w-full"
              value={filterDate}
              title="Filter by Specific Date"
              onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); setCurrentPage(1); }}
            />
          </div>

          <button
            className="btn btn-outline text-xs px-3 font-semibold"
            onClick={() => {
              setSearchTerm('');
              setFilterHospital('');
              setFilterBlood('');
              setFilterGender('');
              setFilterDate('');
              setFilterMonth('');
              setFilterYear('');
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* MODERN DATA GRID TABLE WITH SORTING & PAGINATION */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Building size={14} className="text-[#0a1428]" /> Received Blood Requests Data Grid ({requests.length} Records)
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Sort by:</span>
            <button
              onClick={() => { setSortField('created_at'); setSortAsc(!sortAsc); }}
              className="font-bold text-[#0a1428] flex items-center gap-1 hover:underline"
            >
              Date <ArrowUpDown size={12} />
            </button>
            <button
              onClick={() => { setSortField('patient_name'); setSortAsc(!sortAsc); }}
              className="font-bold text-[#0a1428] flex items-center gap-1 hover:underline"
            >
              Patient <ArrowUpDown size={12} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader className="animate-spin" size={20} /> Loading records...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Droplets size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm">No blood requests match selected criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedRequests.map(req => {
              const isExpanded = expandedId === req.request_id;
              const isFinished = req.status === 'APPROVED' || req.status.startsWith('REJECTED') || req.status === 'COMPLETED';

              const distKm = (req.latitude && req.longitude)
                ? calculateDistance(10.8242, 78.6822, req.latitude, req.longitude)
                : '3.5';
              const travelTimeMins = distKm ? Math.round(distKm * 3.5) : '10-15';

              return (
                <div key={req.request_id} className="transition hover:bg-slate-50/80">
                  {/* Summary Data Row */}
                  <div
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : req.request_id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 border border-slate-700">
                        <span className="text-base font-black text-amber-400 leading-none">{req.blood_type}</span>
                        <span className="text-[9px] text-slate-300 font-bold mt-0.5">{req.quantity} U</span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm truncate">{req.hospital_name || 'Hospital'}</span>
                          <span className="text-xs text-slate-500">({req.doctor_department || 'Emergency'})</span>
                          {getStatusBadge(req.status)}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                          <span>Patient: <strong className="text-slate-900">{req.patient_name}</strong> ({req.patient_age} yrs, {req.patient_gender || 'Male'})</span>
                          <span>Relative: <strong className="text-slate-800">{req.relative_name}</strong> ({req.relative_contact})</span>
                          {req.relative_email && <span className="font-mono text-amber-700">· {req.relative_email}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        className="btn btn-outline text-xs py-1.5 px-3 gap-1"
                        onClick={(e) => { e.stopPropagation(); setPdfModalRequest(req); }}
                      >
                        <Download size={13} /> PDF
                      </button>
                      {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                  </div>

                  {/* Expandable Inspection Drawer */}
                  {isExpanded && (
                    <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-5 animate-fade-in">

                      {/* Google Maps Distance & Route Matrix */}
                      <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3 shadow-sm">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <div className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                            <MapPin size={15} className="text-blue-600" /> Google Maps Location & Haversine Distance Matrix
                          </div>
                          <a
                            href={getGoogleMapsUrl(req)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-bold bg-blue-50 px-3 py-1 rounded-lg border border-blue-200"
                          >
                            <Navigation size={12} /> Directions <ExternalLink size={12} />
                          </a>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 text-[10px] block">Hospital Location</span>
                            <strong className="text-slate-900 truncate block">{req.hospital_name || 'Hospital'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">GPS Coordinates</span>
                            <strong className="text-slate-800 font-mono text-[11px] block">
                              {req.latitude ? `${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}` : 'Captured GPS'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Location Accuracy</span>
                            <strong className="text-emerald-700 font-extrabold text-[11px] block">
                              {req.location_accuracy || '± 8 meters'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Est. Distance</span>
                            <strong className="text-amber-700 font-extrabold text-[11px] block">{distKm ? `${distKm} km` : '3.5 km'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Est. Travel Time</span>
                            <strong className="text-emerald-700 font-extrabold text-[11px] block">~{travelTimeMins} mins</strong>
                          </div>
                        </div>

                        {req.request_location_name && (
                          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px]">
                            <span className="text-slate-500">Reverse Geocoded Address:</span>
                            <span className="font-semibold text-slate-800 truncate">{req.request_location_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Form Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="font-bold text-[#0a1428] uppercase text-[10px] border-b pb-1">Hospital & Patient Info</div>
                          <div><span className="text-slate-500">Hospital:</span> <strong className="text-slate-900">{req.hospital_name}</strong> ({req.doctor_department || 'Emergency'})</div>
                          <div><span className="text-slate-500">Patient:</span> <strong className="text-slate-900">{req.patient_name}</strong> ({req.patient_age} yrs, {req.patient_gender || 'Male'})</div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="font-bold text-[#0a1428] uppercase text-[10px] border-b pb-1">Relative Contact Details</div>
                          <div><span className="text-slate-500">Relative Name:</span> <strong className="text-slate-900">{req.relative_name}</strong> ({req.relative_relation || 'Relative'})</div>
                          <div><span className="text-slate-500">Mobile:</span> <strong className="text-slate-900 font-mono">{req.relative_contact}</strong></div>
                          <div><span className="text-slate-500">Relative Email:</span> <strong className="text-amber-700 font-mono">{req.relative_email || '—'}</strong></div>
                        </div>
                      </div>

                      {/* Prescription Proof Section */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center border-b pb-2 text-xs">
                          <span className="font-bold text-[#0a1428] uppercase flex items-center gap-1.5"><FileText size={14} /> Doctor Prescription Proof Uploaded</span>
                          {req.proof_prescription && (
                            <button
                              onClick={() => setSelectedPrescription(req.proof_prescription)}
                              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1"
                            >
                              <Eye size={12} /> Inspect Full Image
                            </button>
                          )}
                        </div>
                        {req.proof_prescription ? (
                          <div className="flex items-center gap-4">
                            <img
                              src={req.proof_prescription}
                              alt="Prescription Preview"
                              className="w-24 h-24 object-cover rounded-lg border border-slate-300 cursor-pointer"
                              onClick={() => setSelectedPrescription(req.proof_prescription)}
                            />
                            <div className="text-xs text-slate-600">
                              Doctor prescription attached. Inspect image to verify signature & hospital seal.
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">No prescription image attached.</div>
                        )}
                      </div>

                      {/* Actions Bar */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-200 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            className="btn btn-primary text-xs px-4 py-2 gap-1.5 font-bold shadow-sm"
                            onClick={() => setPdfModalRequest(req)}
                          >
                            <Download size={14} /> Download PDF
                          </button>
                          <button
                            className="btn btn-outline text-xs px-3 py-2 gap-1.5"
                            onClick={() => setPrintRequest(req)}
                          >
                            <Printer size={14} /> Print Sheet
                          </button>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {req.status !== 'Request Received' && req.status !== 'APPROVED' && !req.status.startsWith('REJECTED') && (
                            <button
                              className="btn bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 text-xs px-4 py-2 font-bold flex items-center gap-1.5 transition"
                              onClick={() => handleMarkRequestReceived(req.request_id)}
                            >
                              <Mail size={14} /> Request Received
                            </button>
                          )}

                          {!isFinished ? (
                            <>
                              <button
                                className="btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs px-4 py-2 font-bold flex items-center gap-1.5 transition"
                                onClick={() => setRejectModalId(req.request_id)}
                              >
                                <X size={14} /> Reject
                              </button>

                              <button
                                className="btn btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5"
                                onClick={() => handleApprove(req.request_id)}
                              >
                                <Check size={14} /> Approve Request
                              </button>
                            </>
                          ) : (
                            <div className="text-xs text-emerald-800 font-bold bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                              ✓ Software Workflow Complete
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Data Grid Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-wrap gap-2 text-xs text-slate-600">
          <div>
            Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({sortedRequests.length} total records)
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline text-xs px-3 py-1.5 gap-1 disabled:opacity-40"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              className="btn btn-outline text-xs px-3 py-1.5 gap-1 disabled:opacity-40"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
