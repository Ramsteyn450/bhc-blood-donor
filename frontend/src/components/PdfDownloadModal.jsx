import React from 'react';
import { Download, Printer, X, ShieldCheck, Heart } from 'lucide-react';
import BhcCrestLogo from './BhcCrestLogo';

export default function PdfDownloadModal({ request, onClose }) {
  if (!request) return null;

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 overflow-y-auto p-4 flex justify-center items-center">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl p-8 shadow-2xl printable-sheet relative space-y-6">

        {/* Dual Action Controls (Hidden on print) */}
        <div className="no-print flex justify-between items-center pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-[#0a1428] font-black text-sm">
            <ShieldCheck size={18} className="text-[#d4af37]" /> Official Request Summary PDF
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="btn btn-primary text-xs px-4 py-2 gap-1.5 shadow"
            >
              <Download size={14} /> Download PDF
            </button>
            <button
              onClick={handlePrintPdf}
              className="btn btn-outline text-xs px-3 py-2 gap-1.5"
            >
              <Printer size={14} /> Print Sheet
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PRINTABLE PDF CONTENT (LIGHTWEIGHT < 50KB - EXCLUDES PRESCRIPTION IMAGE) */}
        <div className="space-y-6 border border-slate-300 p-6 rounded-xl bg-white text-slate-900">

          {/* BHC Official Header */}
          <div className="flex justify-between items-start border-b-2 border-[#0a1428] pb-4">
            <div className="flex items-center gap-3">
              <BhcCrestLogo className="w-12 h-14" />
              <div>
                <div className="text-xl font-black font-serif tracking-tight text-[#0a1428]">BISHOP HEBER COLLEGE</div>
                <div className="text-[11px] font-bold text-[#b45309] tracking-wide uppercase">BHC Blood Donor Emergency Network</div>
                <div className="text-[10px] text-slate-500 italic mt-0.5">Motto: &quot;Nisi Dominus Frustra&quot; · Tiruchirappalli</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-slate-900">REQ-{request.request_id}</div>
              <div className="text-[10px] text-slate-500 font-mono">UUID: {request.request_uuid ? request.request_uuid.slice(0, 18) + '...' : '—'}</div>
              <div className="text-[11px] text-slate-600 font-semibold">{new Date(request.created_at).toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="bg-slate-50 border-l-4 border-[#0a1428] p-3 flex justify-between items-center text-xs border border-slate-200">
            <div>
              <span className="text-slate-500 uppercase font-bold text-[10px]">Workflow Status:</span>
              <span className="ml-2 font-black text-[#0a1428]">{request.status}</span>
            </div>
            <div className="text-slate-700 font-bold flex items-center gap-1">
              <ShieldCheck size={14} className="text-[#b45309]" /> Digitally Verified
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">

            {/* Hospital Information */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-extrabold text-[#0a1428] uppercase text-[10px] border-b pb-1">1. Hospital Information</div>
              <div>
                <div className="text-slate-500 text-[10px]">Hospital Name</div>
                <div className="font-bold text-slate-900">{request.hospital_name || 'Hospital'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">Department / Ward</div>
                <div className="font-semibold text-slate-800">{request.doctor_department || 'Emergency / ICU'}</div>
              </div>
            </div>

            {/* Patient Information */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-extrabold text-[#0a1428] uppercase text-[10px] border-b pb-1">2. Patient Information</div>
              <div>
                <div className="text-slate-500 text-[10px]">Patient Name</div>
                <div className="font-bold text-slate-900">{request.patient_name}</div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-slate-500 text-[10px]">Age</div>
                  <div className="font-semibold text-slate-800">{request.patient_age} yrs</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Gender</div>
                  <div className="font-semibold text-slate-800">{request.patient_gender || 'Male'}</div>
                </div>
              </div>
            </div>

            {/* Blood Requirement */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-extrabold text-[#0a1428] uppercase text-[10px] border-b pb-1">3. Blood Requirement</div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-slate-500 text-[10px]">Blood Group</div>
                  <div className="font-black text-[#dc2626] text-base">{request.blood_type}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Quantity</div>
                  <div className="font-bold text-slate-900">{request.quantity} Units</div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px]">Emergency Level</div>
                <div className="font-extrabold text-red-600">{request.urgency}</div>
              </div>
            </div>

            {/* Relative Details */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="font-extrabold text-[#0a1428] uppercase text-[10px] border-b pb-1">4. Relative Details</div>
              <div>
                <div className="text-slate-500 text-[10px]">Relative Name & Relation</div>
                <div className="font-bold text-slate-900">{request.relative_name} ({request.relative_relation || 'Relative'})</div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-slate-500 text-[10px]">Mobile Number</div>
                  <div className="font-bold font-mono text-slate-900">{request.relative_contact}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Email Address</div>
                  <div className="font-mono text-slate-800 text-[11px] truncate">{request.relative_email || '—'}</div>
                </div>
              </div>
            </div>

          </div>

          {/* 5. Verified Location Link */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5 text-xs">
            <div className="font-extrabold text-[#0a1428] uppercase text-[10px] border-b border-slate-200 pb-1">
              5. Verified Location Link
            </div>
            <div className="pt-1">
              <span className="text-slate-500 font-semibold block text-[11px] mb-1">Clickable Google Maps Location:</span>
              {request.latitude && request.longitude ? (
                <a
                  href={`https://maps.google.com/?q=${request.latitude},${request.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline font-bold font-mono text-[12px] break-all hover:text-blue-900"
                >
                  https://maps.google.com/?q={request.latitude},{request.longitude}
                </a>
              ) : (
                <span className="text-slate-500 italic text-[11px]">Location link unavailable</span>
              )}
            </div>
          </div>

          {/* Admin Remarks */}
          {request.admin_remarks && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-[#0a1428]">Admin Remarks: </span>
              <span className="text-slate-800">{request.admin_remarks}</span>
            </div>
          )}

          {/* MANDATORY COORDINATOR SIGNATURE BLOCK */}
          <div className="pt-10 border-t-2 border-slate-300 flex justify-between items-end text-xs">
            <div>
              <div className="font-bold text-slate-800">Bishop Heber College Blood Donor Network</div>
              <div className="text-[10px] text-slate-500">Autonomous Institution · Tiruchirappalli</div>
            </div>
            <div className="text-right">
              <div className="font-serif italic font-bold text-[#0a1428] text-sm">BHC NSS Coordinator</div>
              <div className="border-t border-slate-400 pt-1 mt-6 text-[10px] font-bold text-slate-700">
                Coordinator Signature (BHC Blood Donor)
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
