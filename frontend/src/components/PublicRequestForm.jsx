import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, Building, User, Phone, FileText, Camera, Upload, CheckCircle,
  AlertTriangle, Clock, Droplets, ShieldCheck, QrCode, X, Loader, Globe, MapPin, Mail, ChevronRight, Home, Info, RefreshCw, Image as ImageIcon, Share2
} from 'lucide-react';
import BhcCrestLogo from './BhcCrestLogo';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// 12 EXPANDED TRICHY HOSPITALS
const DEFAULT_12_HOSPITALS = [
  'K.A.P. Viswanatham Government Medical College Hospital',
  'Apollo Speciality Hospital',
  'Kauvery Hospital (KMC)',
  'ABC Hospital',
  'Maruthi Hospital',
  'Child Jesus Hospital',
  'Deepam Hospital',
  'Royal Pearl Hospital',
  'Frontline Hospital',
  'Srinivasa Hospital',
  'GVN Hospital',
  'BHC Medical Unit & Health Center'
];

// REGEX VALIDATORS
const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const TRANSLATIONS = {
  en: {
    appHeaderTitle: "BHC Emergency Blood Request",
    appHeaderSub: "Bishop Heber College · Tiruchirappalli",
    commonQrBtn: "QR",
    hospitalSection: "1. Hospital Details",
    selectHospital: "Hospital Name (Type or Select)",
    department: "Department / Ward",
    patientSection: "2. Patient Details",
    patientName: "Patient Full Name",
    patientAge: "Age",
    patientGender: "Gender",
    male: "Male",
    female: "Female",
    other: "Other",
    bloodSection: "3. Blood Requirement",
    bloodGroup: "Blood Group",
    unitsRequired: "Units (Bags)",
    neededBy: "Required Date & Time",
    emergencyLevel: "Urgency Level",
    critical: "Critical (Immediate)",
    high: "High (< 6 Hours)",
    normal: "Normal (< 24 Hours)",
    relativeSection: "4. Relative Contact Info",
    relativeName: "Relative Name",
    relationship: "Relationship to Patient",
    mobileNumber: "Mobile Number (10 Digits)",
    emailAddress: "Email Address",
    reason: "Medical Reason / Doctor Notes",
    prescriptionSection: "5. Doctor Requisition Proof",
    mandatory: "*Required",
    uploaded: "Proof Attached",
    uploadGallery: "Gallery",
    captureCamera: "Camera",
    liveWebcam: "Webcam Scanner",
    submitBtn: "Submit Emergency Request",
    submitting: "Sending Request...",
    successTitle: "Blood Request Submitted!",
    successSubtitle: "Your request has been transmitted to College Admin for NSS volunteer dispatch.",
    requestId: "Request ID",
    submitAnother: "Submit Another Request",
    workflowNotice: "NSS VOLUNTEER WORKFLOW: Relatives do NOT need to visit the college campus. Willing student donors will contact you directly.",
    phoneErr: "Enter valid 10-digit Indian mobile number.",
    emailErr: "Enter valid email address."
  },
  ta: {
    appHeaderTitle: "அவசர இரத்த தேவை படிவம்",
    appHeaderSub: "பிஷப் ஹீபர் கல்லூரி · திருச்சிராப்பள்ளி",
    commonQrBtn: "QR",
    hospitalSection: "1. மருத்துவமனை விவரங்கள்",
    selectHospital: "மருத்துவமனை பெயர்",
    department: "பிரிவு / வார்டு",
    patientSection: "2. நோயாளி விவரங்கள்",
    patientName: "நோயாளி பெயர்",
    patientAge: "வயது",
    patientGender: "பாலினம்",
    male: "ஆண்",
    female: "பெண்",
    other: "இதர",
    bloodSection: "3. இரத்த தேவை விவரங்கள்",
    bloodGroup: "இரத்த பிரிவு",
    unitsRequired: "தேவைப்படும் அலகுகள் (Units)",
    neededBy: "தேவைப்படும் நேரம்",
    emergencyLevel: "அவசர நிலை",
    critical: "மிகவும் அவசரம் (உடனே)",
    high: "அவசரம் (< 6 மணி)",
    normal: "சாதாரண (< 24 மணி)",
    relativeSection: "4. உறவினர் தொடர்பு விவரங்கள்",
    relativeName: "உறவினர் பெயர்",
    relationship: "உறவுமுறை",
    mobileNumber: "கைபேசி எண் (10 இலக்கம்)",
    emailAddress: "மின்னஞ்சல் முகவரி",
    reason: "மருத்துவக் குறிப்புகள்",
    prescriptionSection: "5. மருத்துவர் பரிந்துரை சீட்டு (Proof)",
    mandatory: "*கட்டாயம்",
    uploaded: "பதிவேற்றப்பட்டது",
    uploadGallery: "கேலரி",
    captureCamera: "கேமரா",
    liveWebcam: "வெப்கேம்",
    submitBtn: "கோரிக்கையை அனுப்புக",
    submitting: "அனுப்பப்படுகிறது...",
    successTitle: "கோரிக்கை அனுப்பப்பட்டது!",
    successSubtitle: "கல்லூரி நிர்வாகி பரிசீலனைக்கு தகவல் அனுப்பப்பட்டுள்ளது.",
    requestId: "கோரிக்கை எண்",
    submitAnother: "மற்றொரு கோரிக்கை அனுப்புக",
    workflowNotice: "முக்கிய குறிப்பு: நோயாளி உறவினர்கள் கல்லூரிக்கு நேரில் வரத் தேவையில்லை.",
    phoneErr: "சரியான 10 இலக்க எண்ணை உள்ளிடவும்.",
    emailErr: "சரியான மின்னஞ்சலை உள்ளிடவும்."
  }
};

function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);

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
        setError('Direct camera stream unavailable. Please tap "Camera" or "Gallery" to upload photo.');
      }
    })();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const usePhoto = () => {
    if (captured) {
      fetch(captured).then(r => r.blob()).then(blob => {
        const file = new File([blob], `prescription_${Date.now()}.jpg`, { type: 'image/jpeg' });
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
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {}
    })();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a1428] border border-amber-500/40 rounded-3xl p-5 w-full max-w-sm shadow-2xl text-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold flex items-center gap-2 text-amber-400">
            <Camera size={18} /> Take Requisition Photo
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><X size={20} /></button>
        </div>

        {error ? (
          <div className="p-5 text-center text-amber-300 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs">
            <AlertTriangle className="mx-auto mb-2 text-amber-400" size={28} />
            <p>{error}</p>
          </div>
        ) : captured ? (
          <div className="text-center space-y-3">
            <img src={captured} alt="Captured Prescription" className="w-full max-h-64 object-contain rounded-xl border border-white/20" />
            <div className="flex justify-center gap-2">
              <button className="btn btn-outline text-xs py-2 px-4 rounded-xl" onClick={retake}>Retake</button>
              <button className="btn btn-gold text-xs py-2 px-4 rounded-xl font-bold" onClick={usePhoto}>
                <CheckCircle size={15} /> Confirm Photo
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black min-h-[220px] flex items-center justify-center border border-white/10">
              <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-64 object-contain" />
              {!ready && <Loader className="animate-spin text-amber-400 absolute" size={24} />}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button className="btn btn-gold w-full py-3 text-xs font-black rounded-xl" onClick={capturePhoto} disabled={!ready}>
              <Camera size={16} /> Capture Photo Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicRequestForm() {
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang];

  const [hospitals, setHospitals] = useState(DEFAULT_12_HOSPITALS);
  const [commonQr, setCommonQr] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const [form, setForm] = useState({
    hospital_name: DEFAULT_12_HOSPITALS[0],
    doctor_department: 'Emergency / ICU',
    patient_name: '',
    patient_age: '',
    patient_gender: 'Male',
    blood_type: 'O+',
    quantity: 2,
    urgency: 'CRITICAL',
    needed_by: '',
    relative_name: '',
    relative_relation: 'Spouse',
    relative_contact: '',
    relative_alternate_contact: '',
    relative_email: '',
    reason: '',
    proof_prescription: null
  });

  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    locationName: '',
    accuracy: '',
    status: 'detecting',
    errorMsg: ''
  });

  const [showInstructions, setShowInstructions] = useState(true);
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);


  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      setLocation(l => ({ ...l, status: 'denied', errorMsg: 'Geolocation unsupported on this browser.' }));
      return;
    }

    setLocation(l => ({ ...l, status: 'detecting' }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracyMeters = Math.round(pos.coords.accuracy || 0);
        const accuracyStr = `± ${accuracyMeters}m GPS`;

        let addressName = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)} (Trichy)`;

        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData.display_name) {
              addressName = geoData.display_name;
            }
          }
        } catch (geoErr) {
          console.log('Reverse geocode fallback:', geoErr.message);
        }

        setLocation({
          latitude: lat,
          longitude: lng,
          locationName: addressName,
          accuracy: accuracyStr,
          status: 'success',
          errorMsg: ''
        });
      },
      (err) => {
        let msg = 'GPS Permission Denied. Tap to enable location on phone.';
        if (err.code === err.TIMEOUT) msg = 'Location timed out. Please retry.';
        setLocation(l => ({ ...l, status: 'denied', errorMsg: msg }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestGpsLocation();
  }, []);

  useEffect(() => {
    async function loadHospitalsAndQr() {
      try {
        const [hRes, qrRes] = await Promise.all([
          fetch('/api/public/hospitals'),
          fetch('/api/public/common-qr')
        ]);
        if (hRes.ok) {
          const list = await hRes.json();
          if (list && list.length > 0) {
            setHospitals(list.map(h => h.hospital_name));
          }
        }
        if (qrRes.ok) setCommonQr(await qrRes.json());
      } catch {}
    }
    loadHospitalsAndQr();
  }, []);

  const setField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));

    if (key === 'relative_contact') {
      if (!PHONE_REGEX.test(value)) {
        setPhoneError(t.phoneErr);
      } else {
        setPhoneError('');
      }
    }

    if (key === 'relative_email') {
      if (!EMAIL_REGEX.test(value)) {
        setEmailError(t.emailErr);
      } else {
        setEmailError('');
      }
    }
  };

  const processPrescriptionFile = async (file) => {
    if (!file) return;
    setUploadingFile(true);

    const previewUrl = URL.createObjectURL(file);
    const formData = new FormData();
    formData.append('prescription', file);

    try {
      const res = await fetch('/api/public/upload-prescription', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setForm(f => ({
          ...f,
          proof_prescription: { url: data.url, preview: previewUrl, filename: file.name }
        }));
      } else {
        alert('Prescription upload failed. Please try again.');
      }
    } catch {
      alert('Error uploading file. Check network connection.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processPrescriptionFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!PHONE_REGEX.test(form.relative_contact)) {
      setPhoneError(t.phoneErr);
      alert(t.phoneErr);
      return;
    }
    if (!EMAIL_REGEX.test(form.relative_email)) {
      setEmailError(t.emailErr);
      alert(t.emailErr);
      return;
    }
    if (!form.proof_prescription?.url) {
      alert('Doctor Prescription proof is mandatory. Please upload or take a photo.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        proof_prescription: form.proof_prescription.url,
        latitude: location.latitude,
        longitude: location.longitude,
        request_location_name: location.locationName,
        location_accuracy: location.accuracy
      };

      const res = await fetch('/api/public/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setSubmittedData({
          requestId: data.request_id,
          requestUuid: data.request_uuid,
          hospitalName: form.hospital_name,
          patientName: form.patient_name,
          bloodType: form.blood_type,
          urgency: form.urgency
        });
      } else {
        alert(`Submission Error: ${data.message || data.error || 'Server error occurred during submission.'}`);
      }
    } catch (err) {
      alert(`Network Error: ${err.message || 'Connecting to server failed.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS RECEIPT VIEW (MOBILE APP STYLE)
  if (submittedData) {
    const handleShareSuccessRequest = async () => {
      try {
        const shareText = 
`🩸 BHC EMERGENCY BLOOD REQUEST [REQ-${submittedData.requestId}]
----------------------------------------
Hospital: ${submittedData.hospitalName || 'Hospital'}
Patient Name: ${submittedData.patientName || 'Patient'}
Blood Group: ${submittedData.bloodType || ''} (${submittedData.urgency || 'CRITICAL'} Urgency)
Relative Contact: ${form.relative_contact || ''} (${form.relative_name || 'Relative'})
${location.latitude && location.longitude ? `Location: https://maps.google.com/?q=${location.latitude},${location.longitude}` : ''}
Date: ${new Date().toLocaleDateString('en-IN')}

Bishop Heber College Blood Donor Network · Tiruchirappalli`;

        if (navigator.share) {
          await navigator.share({
            title: `BHC Blood Request [REQ-${submittedData.requestId}]`,
            text: shareText
          });
        } else {
          await navigator.clipboard.writeText(shareText);
          alert('Request summary copied to clipboard! You can paste and share on WhatsApp or social media.');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          alert(`Share Error: ${err.message}`);
        }
      }
    };

    return (
      <div className="w-full max-w-md mx-auto min-h-screen bg-slate-50 border-x border-slate-200 p-4 my-0 animate-fade-in flex flex-col justify-between">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center shadow-xl space-y-5 mt-4">
          <div className="w-16 h-16 bg-emerald-100 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
            <CheckCircle size={38} />
          </div>
          <div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              Request Sent
            </span>
            <h2 className="text-xl font-black text-slate-900 font-serif mt-2">{t.successTitle}</h2>
            <p className="text-slate-600 text-xs mt-1 leading-relaxed">{t.successSubtitle}</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-200 pb-2">
              <span>{t.requestId}</span>
              <span className="font-black text-slate-900 text-sm">REQ-{submittedData.requestId}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Hospital</span>
              <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{submittedData.hospitalName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Patient Name</span>
              <span className="font-bold text-slate-900">{submittedData.patientName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Blood Group</span>
              <span className="font-black text-red-600 text-lg bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-200">{submittedData.bloodType}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 text-left flex gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
            <div className="text-[11px] leading-relaxed font-medium">{t.workflowNotice}</div>
          </div>

          {/* Share Request Button */}
          <button
            type="button"
            onClick={handleShareSuccessRequest}
            className="w-full py-3.5 bg-[#b45309] hover:bg-[#92400e] text-white font-black text-xs rounded-2xl shadow flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Share2 size={16} />
            <span>Share Request (WhatsApp / Apps)</span>
          </button>
        </div>

        <div className="my-6">
          <button
            className="btn btn-primary w-full py-4 text-sm font-black shadow-xl rounded-2xl"
            onClick={() => { setSubmittedData(null); setForm(f => ({ ...f, proof_prescription: null })); }}
          >
            {t.submitAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-slate-50 border-x border-slate-200 relative pb-28 animate-fade-in shadow-2xl">


      {/* Camera Modal Fallback */}
      {showCamera && (
        <CameraModal
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            processPrescriptionFile(file);
            setShowCamera(false);
          }}
        />
      )}

      {/* Instructions Overlay Sheet — Displayed BEFORE Blood Request Form */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-3 flex items-center justify-center animate-fade-in">
          <div className="bg-white text-slate-900 border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 relative my-4">
            <div className="text-center space-y-1.5 border-b border-slate-100 pb-3">
              <BhcCrestLogo className="w-14 h-18 mx-auto drop-shadow-sm" />
              <h2 className="text-xl font-black font-serif text-slate-900">Before You Submit Blood Request</h2>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-amber-300">
                Bishop Heber College Network
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p className="font-extrabold text-slate-900 text-xs">Thank you for using BHC Blood Donor.</p>

              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <CheckCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>You will receive an email confirmation once submitted.</span>
                </div>

                <div className="flex items-start gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-300 font-bold text-amber-950">
                  <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                  <span>"Request Received" DOES NOT mean request is approved yet.</span>
                </div>

                <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <ShieldCheck size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <span>Verified first by College Administrator.</span>
                </div>

                <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <Heart size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <span>If approved, college NSS offline process will proceed.</span>
                </div>

                <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <Phone size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Student volunteer will contact you directly if available.</span>
                </div>

                <div className="flex items-start gap-2 bg-[#0a1428] text-white p-3 rounded-xl border border-slate-800">
                  <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-400 text-[11px]">Office Hours: 10:00 AM – 4:00 PM (Mon-Fri)</div>
                    <div className="text-[10px] text-slate-300 mt-0.5">Off-hour requests processed next working day.</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="btn btn-primary w-full py-3.5 text-xs font-black shadow-lg rounded-2xl flex items-center justify-center gap-1.5"
            >
              <span>Continue to Request Form</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* MOBILE APPLICATION TOP HEADER */}
      <header className="bg-[#0a1428] text-white p-4 sticky top-0 z-30 shadow-lg border-b-2 border-[#d4af37]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BhcCrestLogo className="w-10 h-12 shrink-0 drop-shadow" />
            <div>
              <h1 className="text-sm font-black font-serif text-white tracking-tight leading-tight">
                {t.appHeaderTitle}
              </h1>
              <p className="text-[10px] text-amber-400 font-semibold truncate max-w-[200px]">
                {t.appHeaderSub}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setLang(l => (l === 'en' ? 'ta' : 'en'))}
              className="bg-white/10 hover:bg-white/20 border border-amber-400/40 text-amber-300 text-[11px] px-2.5 py-1 rounded-xl font-bold transition"
            >
              {lang === 'en' ? 'தமிழ்' : 'ENG'}
            </button>
            {commonQr && (
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="bg-white/10 hover:bg-white/20 border border-amber-400/40 text-amber-300 p-1.5 rounded-xl transition"
              >
                <QrCode size={16} />
              </button>
            )}
          </div>
        </div>

        {/* MOBILE GPS LOCATION BADGE BAR */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex justify-between items-center text-[11px]">
          {location.status === 'success' ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold w-full justify-between">
              <span className="flex items-center gap-1 truncate max-w-[240px]">
                <CheckCircle size={13} className="shrink-0 text-emerald-400" />
                <span className="truncate text-slate-200">{location.locationName}</span>
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                {location.accuracy}
              </span>
            </div>
          ) : location.status === 'denied' ? (
            <div className="flex items-center justify-between w-full text-amber-300 font-medium text-[10px]">
              <span className="truncate max-w-[220px]">GPS Access Required</span>
              <button
                type="button"
                onClick={requestGpsLocation}
                className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded font-extrabold text-[9px] uppercase hover:bg-amber-300 flex items-center gap-1"
              >
                <RefreshCw size={10} /> Retry GPS
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-300 text-[10px]">
              <Loader className="animate-spin text-amber-400" size={12} />
              <span>Detecting GPS Location...</span>
            </div>
          )}
        </div>
      </header>

      {/* MOBILE ONE-COLUMN FORM CONTAINER */}
      <form onSubmit={handleSubmit} className="p-4 space-y-5">

        {/* 1. Hospital Selection */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-l-4 border-amber-500 pl-2.5 py-0.5">
            <Building size={16} className="text-[#0a1428]" /> {t.hospitalSection}
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.selectHospital} <span className="text-red-500">*</span></label>
            <input
              type="text"
              list="mobile-hospitals-list"
              className="form-input text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-medium"
              placeholder="e.g. Apollo, Kauvery, MGMGH..."
              value={form.hospital_name}
              onChange={e => setField('hospital_name', e.target.value)}
              required
            />
            <datalist id="mobile-hospitals-list">
              {hospitals.map((h, idx) => (
                <option key={idx} value={h} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.department}</label>
            <input
              className="form-input text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-medium"
              placeholder="e.g. Emergency, ICU, Ward 3B"
              value={form.doctor_department}
              onChange={e => setField('doctor_department', e.target.value)}
            />
          </div>
        </div>

        {/* 2. Patient Details */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-l-4 border-amber-500 pl-2.5 py-0.5">
            <User size={16} className="text-[#0a1428]" /> {t.patientSection}
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.patientName} <span className="text-red-500">*</span></label>
            <input
              className="form-input text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-medium"
              placeholder="Patient Full Name"
              value={form.patient_name}
              onChange={e => setField('patient_name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label text-xs font-bold text-slate-700">{t.patientAge} <span className="text-red-500">*</span></label>
              <input
                className="form-input text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-medium"
                type="number"
                min="0"
                max="120"
                placeholder="Age"
                value={form.patient_age}
                onChange={e => setField('patient_age', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label text-xs font-bold text-slate-700">{t.patientGender}</label>
              <select
                className="form-select text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-medium bg-white"
                value={form.patient_gender}
                onChange={e => setField('patient_gender', e.target.value)}
              >
                <option value="Male">{t.male}</option>
                <option value="Female">{t.female}</option>
                <option value="Other">{t.other}</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Blood Requirement (Touch-Friendly Blood Group Grid) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-l-4 border-red-500 pl-2.5 py-0.5">
            <Droplets size={16} className="text-red-600" /> {t.bloodSection}
          </div>

          {/* Blood Group Fast Selector Grid for Touch Screens */}
          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700 mb-1.5 block">
              {t.bloodGroup} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_TYPES.map(bg => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setField('blood_type', bg)}
                  className={`py-3 rounded-xl font-black text-sm transition-all border ${
                    form.blood_type === bg
                      ? 'bg-red-600 text-white border-red-600 shadow-md scale-105'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label text-xs font-bold text-slate-700">{t.unitsRequired} <span className="text-red-500">*</span></label>
              <input
                className="form-input text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-bold text-center"
                type="number"
                min="1"
                max="10"
                value={form.quantity}
                onChange={e => setField('quantity', parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label text-xs font-bold text-slate-700">{t.neededBy}</label>
              <input
                className="form-input text-xs py-3 px-2 w-full rounded-xl border-slate-300 font-medium"
                type="datetime-local"
                value={form.needed_by}
                onChange={e => setField('needed_by', e.target.value)}
              />
            </div>
          </div>

          {/* Urgency Pill Cards */}
          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700 mb-1.5 block">{t.emergencyLevel} <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'CRITICAL', label: t.critical, activeBg: 'bg-red-600 text-white border-red-600' },
                { value: 'HIGH', label: t.high, activeBg: 'bg-amber-600 text-white border-amber-600' },
                { value: 'NORMAL', label: t.normal, activeBg: 'bg-emerald-600 text-white border-emerald-600' }
              ].map(lvl => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setField('urgency', lvl.value)}
                  className={`py-2.5 px-1 rounded-xl text-[11px] font-black text-center border transition-all ${
                    form.urgency === lvl.value ? `${lvl.activeBg} shadow-md` : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Patient Relative Contact Info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-l-4 border-amber-500 pl-2.5 py-0.5">
            <Phone size={16} className="text-[#0a1428]" /> {t.relativeSection}
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.relativeName} <span className="text-red-500">*</span></label>
            <input
              className="form-input text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-medium"
              placeholder="Relative Full Name"
              value={form.relative_name}
              onChange={e => setField('relative_name', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.relationship}</label>
            <input
              className="form-input text-base py-3 px-3.5 w-full rounded-xl border-slate-300 font-medium"
              placeholder="e.g. Spouse, Son, Sister"
              value={form.relative_relation}
              onChange={e => setField('relative_relation', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.mobileNumber} <span className="text-red-500">*</span></label>
            <input
              className={`form-input text-base py-3 px-3.5 w-full rounded-xl font-bold tracking-wider ${phoneError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
              type="tel"
              placeholder="e.g. 9876543210"
              value={form.relative_contact}
              onChange={e => setField('relative_contact', e.target.value)}
              required
            />
            {phoneError && (
              <p className="text-[11px] text-red-600 mt-1 font-bold flex items-center gap-1">
                <AlertTriangle size={12} /> {phoneError}
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.emailAddress} <span className="text-red-500">*</span></label>
            <input
              className={`form-input text-base py-3 px-3.5 w-full rounded-xl font-medium ${emailError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
              type="email"
              placeholder="relative@example.com"
              value={form.relative_email}
              onChange={e => setField('relative_email', e.target.value)}
              required
            />
            {emailError && (
              <p className="text-[11px] text-red-600 mt-1 font-bold flex items-center gap-1">
                <AlertTriangle size={12} /> {emailError}
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">{t.reason}</label>
            <textarea
              className="form-input text-sm py-2.5 px-3 w-full rounded-xl border-slate-300 font-medium"
              rows={2}
              placeholder="e.g. ICU emergency, Surgery..."
              value={form.reason}
              onChange={e => setField('reason', e.target.value)}
            />
          </div>
        </div>

        {/* 5. Doctor Prescription Proof (Direct Mobile Camera / Gallery Access) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-l-4 border-amber-500 pl-2.5 py-0.5">
              <FileText size={16} className="text-[#0a1428]" /> {t.prescriptionSection}
            </div>
            {form.proof_prescription && (
              <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle size={13} /> {t.uploaded}
              </span>
            )}
          </div>

          <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-3.5 text-center">
            {form.proof_prescription?.preview ? (
              <div className="relative mb-3">
                <img
                  src={form.proof_prescription.preview}
                  alt="Prescription Preview"
                  className="w-full max-h-48 object-contain rounded-xl border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setField('proof_prescription', null)}
                  className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1 rounded-full shadow"
                >
                  <X size={16} />
                </button>
              </div>
            ) : null}

            {uploadingFile ? (
              <div className="py-6 text-xs text-slate-600 flex items-center justify-center gap-2 font-bold">
                <Loader className="animate-spin text-red-600" size={18} /> Uploading Requisition Photo...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Direct Camera — label wrapping input for iOS Safari */}
                  <label
                    htmlFor="native-camera-input"
                    className="py-3 px-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
                  >
                    <Camera size={16} className="text-red-600" />
                    <span>Take Photo (Camera)</span>
                  </label>
                  <input
                    id="native-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {/* Gallery — label wrapping input */}
                  <label
                    htmlFor="native-gallery-input"
                    className="py-3 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                  >
                    <ImageIcon size={16} className="text-slate-600" />
                    <span>Choose Gallery</span>
                  </label>
                  <input
                    id="native-gallery-input"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Validation Errors Alert Banner */}
        {(phoneError || emailError) && (
          <div className="p-3 bg-red-50 border border-red-300 rounded-2xl text-xs text-red-900 flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <span>Please fix phone number and email validation errors above.</span>
          </div>
        )}

      </form>

      {/* STICKY BOTTOM BAR FOR NATIVE MOBILE FORM SUBMISSION */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3.5 shadow-2xl max-w-md mx-auto">
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-4 text-base font-black rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitting || !form.proof_prescription?.url || !!phoneError || !!emailError}
        >
          {submitting ? (
            <><Loader className="animate-spin" size={20} /> {t.submitting}</>
          ) : (
            <><ShieldCheck size={20} /> {t.submitBtn}</>
          )}
        </button>
      </div>

    </div>
  );
}
