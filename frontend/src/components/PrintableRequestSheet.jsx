import React from 'react';
import { Printer, X, Heart, ShieldCheck } from 'lucide-react';

export default function PrintableRequestSheet({ request, onClose }) {
  if (!request) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 overflow-y-auto p-4 flex justify-center">
      <div className="bg-white text-black w-full max-w-3xl rounded-xl p-8 my-auto shadow-2xl printable-sheet relative">

        {/* Action Bar (Hidden when printing) */}
        <div className="no-print flex justify-between items-center pb-4 mb-6 border-b border-gray-200">
          <div className="flex items-center gap-2 text-red-600 font-bold">
            <Heart size={20} /> Printable Emergency Blood Request Sheet
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-red-600 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition"
            >
              <Printer size={16} /> Print 1-Page Sheet (PDF)
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-black">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* 1-PAGE PRINTABLE CONTAINER */}
        <div className="space-y-3.5 printable-sheet">

          {/* Printable Header */}
          <div className="flex justify-between items-start border-b-2 border-red-600 pb-2.5">
            <div>
              <div className="text-xl font-black tracking-tight text-red-600">BHC BLOOD DONOR</div>
              <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Hospital-to-College Blood Request Document</div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold">REQ-{request.request_id}</div>
              <div className="text-[10px] text-gray-500 font-mono">UUID: {request.request_uuid ? request.request_uuid.slice(0, 18) + '...' : '—'}</div>
              <div className="text-[11px] text-gray-600">Date: {new Date(request.created_at).toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Status Ribbon */}
          <div className="bg-gray-100 border-l-4 border-red-600 p-2 flex justify-between items-center text-xs">
            <div>
              <span className="text-gray-500 uppercase font-bold text-[9px]">Request Status:</span>
              <span className="ml-2 text-xs font-extrabold text-red-600">{request.status}</span>
            </div>
            <div className="text-[11px] text-gray-600 flex items-center gap-1 font-semibold">
              <ShieldCheck size={13} className="text-green-600" /> College Administrator Verified
            </div>
          </div>

          {/* Two-Column Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">

            {/* Hospital & Patient Details */}
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <h3 className="font-bold text-gray-900 text-[9px] uppercase tracking-wider border-b pb-0.5 text-red-600">
                1. Hospital & Patient Info
              </h3>
              <div>
                <div className="text-[9px] text-gray-500">Hospital Name</div>
                <div className="font-bold text-gray-900 text-[11px]">{request.hospital_name || 'Hospital'}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">Department / Ward</div>
                <div className="font-semibold text-gray-800 text-[11px]">{request.doctor_department || 'Emergency'}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <div className="text-[9px] text-gray-500">Patient Name</div>
                  <div className="font-bold text-gray-900 text-[11px]">{request.patient_name}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">Age / Gender</div>
                  <div className="font-semibold text-gray-800 text-[11px]">{request.patient_age} yrs · {request.patient_gender || 'Male'}</div>
                </div>
              </div>
            </div>

            {/* Blood Requirement & Relative Details */}
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <h3 className="font-bold text-gray-900 text-[9px] uppercase tracking-wider border-b pb-0.5 text-red-600">
                2. Blood & Contact Details
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] text-gray-500">Blood Group</div>
                  <div className="text-base font-black text-red-600">{request.blood_type}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">Units Needed</div>
                  <div className="text-sm font-bold text-gray-900">{request.quantity} Units</div>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500">Emergency Level</div>
                <div className="font-extrabold text-red-600 text-[11px]">{request.urgency}</div>
              </div>
              <div className="pt-0.5">
                <div className="text-[9px] text-gray-500">Patient Relative</div>
                <div className="font-bold text-gray-900 text-[11px]">{request.relative_name} ({request.relative_relation || 'Relative'})</div>
                <div className="text-[11px] font-mono font-semibold text-gray-700">{request.relative_contact}</div>
              </div>
            </div>

          </div>

          {/* Verified Location Hyperlink */}
          <div className="text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-200 space-y-1">
            <div className="font-bold text-gray-900 text-[9px] uppercase tracking-wider border-b pb-0.5">
              Verified Location Link
            </div>
            <div className="pt-0.5 text-[10px]">
              <span className="text-gray-600 font-semibold block mb-0.5">Clickable Google Maps URL:</span>
              {request.latitude && request.longitude ? (
                <a
                  href={`https://maps.google.com/?q=${request.latitude},${request.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline font-mono font-bold hover:text-blue-900 text-[11px] break-all"
                >
                  https://maps.google.com/?q={request.latitude},{request.longitude}
                </a>
              ) : (
                <span className="text-gray-500 italic">Location link unavailable</span>
              )}
            </div>
          </div>

          {/* Doctor Prescription Image Proof */}
          <div className="space-y-1 border-t pt-2.5">
            <div className="font-bold text-[9px] uppercase tracking-wider text-gray-900">
              3. Uploaded Doctor Prescription Proof
            </div>
            {request.proof_prescription ? (
              <div className="border border-gray-300 rounded-lg p-1.5 text-center bg-gray-50">
                <img
                  src={request.proof_prescription}
                  alt="Doctor Prescription Proof"
                  className="max-h-40 mx-auto object-contain rounded border"
                />
              </div>
            ) : (
              <div className="p-2 text-center text-[10px] text-gray-500 italic bg-gray-100 rounded">
                No prescription image preview available.
              </div>
            )}
          </div>

          {/* Footer & Signatures */}
          <div className="pt-4 border-t-2 border-gray-300 flex justify-between items-end text-xs">
            <div>
              <div className="font-semibold text-gray-700 text-[10px]">Document generated by BHC Blood Donor System</div>
              <div className="text-gray-500 text-[9px]">Workflow completed upon College Administrator review.</div>
            </div>
            <div className="text-center w-44">
              <div className="border-b border-gray-900 mb-1 pb-4"></div>
              <div className="font-bold text-gray-900 text-[10px]">College Administrator Signature</div>
              <div className="text-[9px] text-gray-500">Seal & Authorization</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
