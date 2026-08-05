import React, { useState, useRef } from 'react';
import { Download, Printer, Share2, X, ShieldCheck, Loader } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import BhcCrestLogo from './BhcCrestLogo';

export default function PdfDownloadModal({ request, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const printableRef = useRef(null);

  if (!request) return null;

  // 1. DOWNLOAD PDF: Generates BHC_Blood_Request_<ID>.pdf directly (NO print dialog!)
  const handleDownloadPdf = async () => {
    if (!printableRef.current) return;
    setDownloading(true);
    try {
      const element = printableRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 16; // 8mm margins left/right
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 8, 8, imgWidth, Math.min(imgHeight, pdfHeight - 16));
      pdf.save(`BHC_Blood_Request_${request.request_id || 1}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Error generating PDF file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // 2. PRINT PDF: Opens browser print dialog directly (NO file download!)
  const handlePrintPdf = () => {
    window.print();
  };

  // 3. SHARE REQUEST: Native Web Share API or JPG Card + Text Clipboard Fallback
  const handleShareRequest = async () => {
    setSharing(true);
    try {
      const reqId = request.request_id || 1;
      const shareText = 
`🩸 BHC EMERGENCY BLOOD REQUEST [REQ-${reqId}]
----------------------------------------
Hospital: ${request.hospital_name || 'Hospital'} (${request.doctor_department || 'Emergency'})
Patient Name: ${request.patient_name || 'Patient'} (${request.patient_age || ''} yrs, ${request.patient_gender || 'Male'})
Blood Group: ${request.blood_type || ''} (${request.quantity || 1} Units)
Emergency Level: ${request.urgency || 'CRITICAL'}
Relative Contact: ${request.relative_contact || ''} (${request.relative_name || 'Relative'})
${request.latitude && request.longitude ? `Location: https://maps.google.com/?q=${request.latitude},${request.longitude}` : ''}
Date: ${new Date(request.created_at || Date.now()).toLocaleDateString('en-IN')}

Bishop Heber College Blood Donor Network · Tiruchirappalli`;

      let shareFile = null;
      if (printableRef.current) {
        try {
          const canvas = await html2canvas(printableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
          if (blob) {
            shareFile = new File([blob], `BHC_Blood_Request_Card_REQ-${reqId}.jpg`, { type: 'image/jpeg' });
          }
        } catch (imgErr) {
          console.log('Share card creation fallback:', imgErr);
        }
      }

      if (navigator.share) {
        const shareData = {
          title: `BHC Blood Request [REQ-${reqId}]`,
          text: shareText
        };
        if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
          shareData.files = [shareFile];
        }
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareText);
        if (shareFile) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(shareFile);
          a.download = shareFile.name;
          a.click();
        }
        alert('Request summary copied to clipboard & JPG card downloaded! Share on WhatsApp / Social Media.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert(`Share Error: ${err.message}`);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 overflow-y-auto p-4 flex justify-center items-center print-backdrop">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative space-y-5 my-4 print-card">

        {/* Triple Action Control Bar (Hidden on print) */}
        <div className="no-print flex flex-wrap justify-between items-center pb-3 border-b border-slate-200 gap-2">
          <div className="flex items-center gap-2 text-[#0a1428] font-black text-sm">
            <ShieldCheck size={18} className="text-[#d4af37]" /> Official Request Summary Document
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Action 1: Download PDF File */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow active:scale-95 transition"
            >
              {downloading ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Download PDF</span>
            </button>

            {/* Action 2: Direct Print Browser Dialog */}
            <button
              onClick={handlePrintPdf}
              className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow active:scale-95 transition"
            >
              <Printer size={14} />
              <span>Print PDF</span>
            </button>

            {/* Action 3: Native Web Share API */}
            <button
              onClick={handleShareRequest}
              disabled={sharing}
              className="bg-[#b45309] hover:bg-[#92400e] text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow active:scale-95 transition"
            >
              {sharing ? <Loader size={14} className="animate-spin" /> : <Share2 size={14} />}
              <span>Share Request</span>
            </button>

            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg border border-slate-200">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE PDF CONTENT (SINGLE PAGE A4 SHEET) */}
        <div ref={printableRef} className="space-y-2.5 border border-slate-300 p-4 rounded-xl bg-white text-slate-900 printable-sheet">

          {/* BHC Official Header */}
          <div className="flex justify-between items-start border-b-2 border-[#0a1428] pb-2.5">
            <div className="flex items-center gap-3">
              <BhcCrestLogo className="w-10 h-12" />
              <div>
                <div className="text-lg font-black font-serif tracking-tight text-[#0a1428]">BISHOP HEBER COLLEGE</div>
                <div className="text-[10px] font-bold text-[#b45309] tracking-wide uppercase">BHC Blood Donor Emergency Network</div>
                <div className="text-[9px] text-slate-500 italic mt-0.5">Motto: &quot;Nisi Dominus Frustra&quot; · Tiruchirappalli</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold text-slate-900">REQ-{request.request_id}</div>
              <div className="text-[9px] text-slate-500 font-mono">UUID: {request.request_uuid ? request.request_uuid.slice(0, 18) + '...' : '—'}</div>
              <div className="text-[10px] text-slate-600 font-semibold">{new Date(request.created_at || Date.now()).toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="bg-slate-50 border-l-4 border-[#0a1428] p-2 flex justify-between items-center text-xs border border-slate-200">
            <div>
              <span className="text-slate-500 uppercase font-bold text-[9px]">Workflow Status:</span>
              <span className="ml-2 font-black text-[#0a1428] text-xs">{request.status}</span>
            </div>
            <div className="text-slate-700 font-bold flex items-center gap-1 text-[11px]">
              <ShieldCheck size={13} className="text-[#b45309]" /> Digitally Verified
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">

            {/* Hospital Information */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
              <div className="font-extrabold text-[#0a1428] uppercase text-[9px] border-b pb-0.5">1. Hospital Information</div>
              <div>
                <div className="text-slate-500 text-[9px]">Hospital Name</div>
                <div className="font-bold text-slate-900 text-[11px] leading-tight">{request.hospital_name || 'Hospital'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Department / Ward</div>
                <div className="font-semibold text-slate-800 text-[11px]">{request.doctor_department || 'Emergency / ICU'}</div>
              </div>
            </div>

            {/* Patient Information */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
              <div className="font-extrabold text-[#0a1428] uppercase text-[9px] border-b pb-0.5">2. Patient Information</div>
              <div>
                <div className="text-slate-500 text-[9px]">Patient Name</div>
                <div className="font-bold text-slate-900 text-[11px]">{request.patient_name}</div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-slate-500 text-[9px]">Age</div>
                  <div className="font-semibold text-slate-800 text-[11px]">{request.patient_age} yrs</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px]">Gender</div>
                  <div className="font-semibold text-slate-800 text-[11px]">{request.patient_gender || 'Male'}</div>
                </div>
              </div>
            </div>

            {/* Blood Requirement */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
              <div className="font-extrabold text-[#0a1428] uppercase text-[9px] border-b pb-0.5">3. Blood Requirement</div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-slate-500 text-[9px]">Blood Group</div>
                  <div className="font-black text-[#dc2626] text-sm">{request.blood_type}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px]">Quantity</div>
                  <div className="font-bold text-slate-900 text-[11px]">{request.quantity} Units</div>
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[9px]">Emergency Level</div>
                <div className="font-extrabold text-red-600 text-[11px]">{request.urgency}</div>
              </div>
            </div>

            {/* Relative Details */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
              <div className="font-extrabold text-[#0a1428] uppercase text-[9px] border-b pb-0.5">4. Relative Details</div>
              <div>
                <div className="text-slate-500 text-[9px]">Relative Name & Relation</div>
                <div className="font-bold text-slate-900 text-[11px]">{request.relative_name} ({request.relative_relation || 'Relative'})</div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-slate-500 text-[9px]">Mobile Number</div>
                  <div className="font-bold font-mono text-slate-900 text-[11px]">{request.relative_contact}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px]">Email Address</div>
                  <div className="font-mono text-slate-800 text-[10px] truncate">{request.relative_email || '—'}</div>
                </div>
              </div>
            </div>

          </div>

          {/* 5. Verified Location Link */}
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1 text-xs">
            <div className="font-extrabold text-[#0a1428] uppercase text-[9px] border-b border-slate-200 pb-0.5">
              5. Verified Location Link
            </div>
            <div className="pt-0.5">
              <span className="text-slate-500 font-semibold block text-[10px] mb-0.5">Clickable Google Maps Location:</span>
              {request.latitude && request.longitude ? (
                <a
                  href={`https://maps.google.com/?q=${request.latitude},${request.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline font-bold font-mono text-[11px] break-all hover:text-blue-900"
                >
                  https://maps.google.com/?q={request.latitude},{request.longitude}
                </a>
              ) : (
                <span className="text-slate-500 italic text-[10px]">Location link unavailable</span>
              )}
            </div>
          </div>

          {/* Admin Remarks */}
          {request.admin_remarks && (
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-[#0a1428]">Admin Remarks: </span>
              <span className="text-slate-800 text-[11px]">{request.admin_remarks}</span>
            </div>
          )}

          {/* MANDATORY COORDINATOR SIGNATURE BLOCK */}
          <div className="pt-4 border-t-2 border-slate-300 flex justify-between items-end text-xs">
            <div>
              <div className="font-bold text-slate-800 text-[11px]">Bishop Heber College Blood Donor Network</div>
              <div className="text-[9px] text-slate-500">Autonomous Institution · Tiruchirappalli</div>
            </div>
            <div className="text-right">
              <div className="font-serif italic font-bold text-[#0a1428] text-xs">BHC NSS Coordinator</div>
              <div className="border-t border-slate-400 pt-0.5 mt-4 text-[9px] font-bold text-slate-700">
                Coordinator Signature (BHC Blood Donor)
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
