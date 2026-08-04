import React, { useState, useEffect } from 'react';
import { Megaphone, CheckSquare, PhoneCall, FileText, CheckCircle2, History, Clock, Heart, Loader, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

export default function StudentDashboard({ user, token, triggerNotification }) {
  const [announcements, setAnnouncements] = useState([]);
  const [myVerifications, setMyVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed', 'my-donations'
  const [volunteeringRequest, setVolunteeringRequest] = useState(null);

  // Verification Checklist State
  const [checklist, setChecklist] = useState({
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
    step6: false,
    step7: false
  });

  // Verification Form Answers
  const [answers, setAnswers] = useState({
    patientInHospital: true,
    bloodStillNeeded: true,
    bloodTypeConfirmed: true,
    quantityConfirmed: true,
    patientCondition: '',
    relativeConfirmed: true,
    addressConfirmed: true,
    notes: ''
  });

  const loadData = async () => {
    try {
      // Fetch announced requests
      const feedRes = await fetch('/api/requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        // Students only see ANNOUNCED status requests in the feed
        setAnnouncements(feedData.filter(r => r.status === 'ANNOUNCED'));
      }

      // Fetch personal volunteer history
      const historyRes = await fetch('/api/student/verifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setMyVerifications(historyData);
      }
    } catch (err) {
      console.error('Error loading student dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleVolunteerClick = (req) => {
    setVolunteeringRequest(req);
    // Reset checklist & answers
    setChecklist({
      step1: false,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
      step6: false,
      step7: false
    });
    setAnswers({
      patientInHospital: true,
      bloodStillNeeded: true,
      bloodTypeConfirmed: true,
      quantityConfirmed: true,
      patientCondition: '',
      relativeConfirmed: true,
      addressConfirmed: true,
      notes: ''
    });
  };

  const handleToggleChecklist = (step) => {
    setChecklist(prev => ({ ...prev, [step]: !prev[step] }));
  };

  const handleRadioChange = (name, val) => {
    setAnswers(prev => ({ ...prev, [name]: val }));
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setAnswers(prev => ({ ...prev, [name]: value }));
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();

    // Check if checklist is fully complete
    const isChecklistComplete = Object.values(checklist).every(v => v === true);
    if (!isChecklistComplete) {
      alert('Please check off all verification steps in the checklist to confirm you have completed the relative contact protocol.');
      return;
    }

    try {
      const res = await fetch('/api/verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: volunteeringRequest.request_id,
          patientInHospital: answers.patientInHospital,
          bloodStillNeeded: answers.bloodStillNeeded,
          bloodTypeConfirmed: answers.bloodTypeConfirmed,
          quantityConfirmed: answers.quantityConfirmed,
          patientCondition: answers.patientCondition,
          relativeConfirmed: answers.relativeConfirmed,
          addressConfirmed: answers.addressConfirmed,
          verificationNotes: answers.notes
        })
      });

      if (res.ok) {
        alert('Verification submitted successfully! NSS coordinator will review and assign schedule.');
        setVolunteeringRequest(null);
        loadData();
        
        // Trigger notifications
        triggerNotification('sms', `Your verification for REQ-${volunteeringRequest.request_id} has been submitted. Status: PENDING NSS approval.`, user.student_phone || '9988776601');
        triggerNotification('email', `Blood request verification submitted for relative ${volunteeringRequest.relative_name} (${volunteeringRequest.relative_contact}).`, user.email);
      } else {
        const err = await res.json();
        alert(`Failed to submit: ${err.message}`);
      }
    } catch (err) {
      alert('Failed to submit verification');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Student Volunteer Hub</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Check the classroom announcement feed, volunteer to donate, call patient relatives to verify status, and view certificates.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`btn ${activeTab === 'feed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('feed'); setVolunteeringRequest(null); setShowCertificate(null); }}
          >
            <Megaphone size={16} /> Classroom Feed
          </button>
          <button 
            className={`btn ${activeTab === 'my-donations' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('my-donations'); setVolunteeringRequest(null); setShowCertificate(null); }}
          >
            <History size={16} /> My Volunteer History ({myVerifications.length})
          </button>
        </div>
      </div>

      {showCertificate ? (
        <div className="dashboard-section" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="section-header">
            <h2 className="section-title"><Award size={20} className="logo-icon" /> Appreciation Certificate</h2>
            <button className="btn btn-secondary btn-small" onClick={() => setShowCertificate(null)}>Back to History</button>
          </div>
          
          <div className="certificate-container">
            <div className="cert-title">CERTIFICATE OF APPRECIATION</div>
            <div className="cert-subtitle">NATIONAL SERVICE SCHEME (NSS)</div>
            
            <div className="cert-text">
              This certificate is proudly awarded to<br />
              <span className="cert-name">{showCertificate.student_name || user.name}</span><br />
              of <strong>{showCertificate.college_name || 'City College of Engineering'}</strong><br />
              for volunteering and successfully donating <strong>1 Unit</strong> of <strong>{showCertificate.blood_type || user.bloodType}</strong> blood<br />
              to satisfy hospital requirement <strong>REQ-{showCertificate.request_id}</strong> on <strong>{new Date(showCertificate.donation_date || Date.now()).toLocaleDateString()}</strong>.<br />
              Your selfless contribution helped save a patient's life.
            </div>

            <div className="cert-footer">
              <div className="cert-sign">
                <div className="cert-sign-name" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px' }}>K. R. Sharma</div>
                <div className="cert-sign-title">NSS Program Officer</div>
              </div>
              <div className="cert-id">
                VERIFICATION HASH: BLOOD-SECURE-{showCertificate.verification_id}-{showCertificate.student_id}-2026
              </div>
              <div className="cert-sign">
                <div className="cert-sign-name" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px' }}>Dr. Arun Kumar</div>
                <div className="cert-sign-title">Attending Doctor / Hospital Admin</div>
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>Print Certificate</button>
          </div>
        </div>
      ) : volunteeringRequest ? (
        <div className="dashboard-section" style={{ animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <div className="section-header">
            <h2 className="section-title"><CheckSquare size={20} className="logo-icon" /> Student Verification Checklist Form</h2>
            <button className="btn btn-secondary btn-small" onClick={() => setVolunteeringRequest(null)}>Back to Feed</button>
          </div>

          <form onSubmit={handleVerificationSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '24px' }}>
              
              {/* Left Column: Read Only Hospital Request info */}
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--accent-red)', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  Hospital Blood Requirement Details (Read-only)
                </h3>
                <table style={{ width: '100%', fontSize: '13px', borderSpacing: '0 8px', borderCollapse: 'separate' }}>
                  <tbody>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>Hospital:</td><td style={{ fontWeight: 600 }}>{volunteeringRequest.hospital_name}</td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>Blood Needed:</td><td style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>{volunteeringRequest.blood_type}</td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>Quantity:</td><td style={{ fontWeight: 600 }}>{volunteeringRequest.quantity} Units</td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>Urgency:</td><td><span className={`badge ${volunteeringRequest.urgency.toLowerCase()}`}>{volunteeringRequest.urgency}</span></td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>Patient details:</td><td>{volunteeringRequest.patient_name} (Age: {volunteeringRequest.patient_age})</td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>Reason:</td><td>{volunteeringRequest.reason}</td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>Doctor Details:</td><td>Dr. {volunteeringRequest.doctor_name} ({volunteeringRequest.doctor_phone})</td></tr>
                  </tbody>
                </table>

                {/* Relative Contact Notice */}
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-red)', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                    <PhoneCall size={16} /> PATIENT RELATIVE CONTACT PROTOCOL
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    You must call the relative below to confirm the current patient status before submitting this form.
                  </p>
                  <div style={{ marginTop: '12px', fontSize: '14px', color: 'white', fontWeight: 600 }}>
                    Relative Name: {volunteeringRequest.relative_name}<br />
                    Phone Number: <span style={{ color: 'var(--accent-red)' }}>{volunteeringRequest.relative_contact}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Steps to verify */}
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--accent-red)', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  Verification Call Steps (Must Check All)
                </h3>
                <div className="checklist-container">
                  <div className="checklist-title">Relative Verification Checklist</div>
                  
                  <div className="checklist-item" onClick={() => handleToggleChecklist('step1')}>
                    <div className={`checklist-checkbox ${checklist.step1 ? 'checked' : ''}`}>{checklist.step1 ? '✓' : ''}</div>
                    <div className="checklist-text">Step 1: Call relative number provided above</div>
                  </div>
                  <div className="checklist-item" onClick={() => handleToggleChecklist('step2')}>
                    <div className={`checklist-checkbox ${checklist.step2 ? 'checked' : ''}`}>{checklist.step2 ? '✓' : ''}</div>
                    <div className="checklist-text">Step 2: Introduce yourself as a College NSS Volunteer</div>
                  </div>
                  <div className="checklist-item" onClick={() => handleToggleChecklist('step3')}>
                    <div className={`checklist-checkbox ${checklist.step3 ? 'checked' : ''}`}>{checklist.step3 ? '✓' : ''}</div>
                    <div className="checklist-text">Step 3: Ask relative if patient is still in the hospital</div>
                  </div>
                  <div className="checklist-item" onClick={() => handleToggleChecklist('step4')}>
                    <div className={`checklist-checkbox ${checklist.step4 ? 'checked' : ''}`}>{checklist.step4 ? '✓' : ''}</div>
                    <div className="checklist-text">Step 4: Confirm if blood is still actively needed</div>
                  </div>
                  <div className="checklist-item" onClick={() => handleToggleChecklist('step5')}>
                    <div className={`checklist-checkbox ${checklist.step5 ? 'checked' : ''}`}>{checklist.step5 ? '✓' : ''}</div>
                    <div className="checklist-text">Step 5: Confirm blood type matches ({volunteeringRequest.blood_type})</div>
                  </div>
                  <div className="checklist-item" onClick={() => handleToggleChecklist('step6')}>
                    <div className={`checklist-checkbox ${checklist.step6 ? 'checked' : ''}`}>{checklist.step6 ? '✓' : ''}</div>
                    <div className="checklist-text">Step 6: Inquire about patient's current condition</div>
                  </div>
                  <div className="checklist-item" onClick={() => handleToggleChecklist('step7')}>
                    <div className={`checklist-checkbox ${checklist.step7 ? 'checked' : ''}`}>{checklist.step7 ? '✓' : ''}</div>
                    <div className="checklist-text">Step 7: Confirm delivery address & hospital room/ward</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Checklist Answers section */}
            <h3 style={{ fontSize: '15px', color: 'var(--accent-red)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              Verification Answers (Confirmation Layer)
            </h3>
            
            <div className="radio-group-wrapper">
              <div className="radio-question-card">
                <span className="radio-question-text">Q1. Patient still in hospital?</span>
                <div className="radio-options-flex">
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.patientInHospital === true} onChange={() => handleRadioChange('patientInHospital', true)} /> YES
                  </label>
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.patientInHospital === false} onChange={() => handleRadioChange('patientInHospital', false)} /> NO
                  </label>
                </div>
              </div>

              <div className="radio-question-card">
                <span className="radio-question-text">Q2. Blood still needed by the patient?</span>
                <div className="radio-options-flex">
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.bloodStillNeeded === true} onChange={() => handleRadioChange('bloodStillNeeded', true)} /> YES
                  </label>
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.bloodStillNeeded === false} onChange={() => handleRadioChange('bloodStillNeeded', false)} /> NO
                  </label>
                </div>
              </div>

              <div className="radio-question-card">
                <span className="radio-question-text">Q3. Blood type confirmed matches ({volunteeringRequest.blood_type})?</span>
                <div className="radio-options-flex">
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.bloodTypeConfirmed === true} onChange={() => handleRadioChange('bloodTypeConfirmed', true)} /> YES
                  </label>
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.bloodTypeConfirmed === false} onChange={() => handleRadioChange('bloodTypeConfirmed', false)} /> NO
                  </label>
                </div>
              </div>

              <div className="radio-question-card">
                <span className="radio-question-text">Q4. Quantity confirmed matches ({volunteeringRequest.quantity} Units)?</span>
                <div className="radio-options-flex">
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.quantityConfirmed === true} onChange={() => handleRadioChange('quantityConfirmed', true)} /> YES
                  </label>
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.quantityConfirmed === false} onChange={() => handleRadioChange('quantityConfirmed', false)} /> NO
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Q5. Patient Current Condition (Brief notes from relative conversation) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  name="patientCondition"
                  placeholder="Example: Stable, surgery scheduled tomorrow 9 AM"
                  value={answers.patientCondition}
                  onChange={handleTextChange}
                  required
                />
              </div>

              <div className="radio-question-card">
                <span className="radio-question-text">Q6. Relative confirmed all details listed above?</span>
                <div className="radio-options-flex">
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.relativeConfirmed === true} onChange={() => handleRadioChange('relativeConfirmed', true)} /> YES
                  </label>
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.relativeConfirmed === false} onChange={() => handleRadioChange('relativeConfirmed', false)} /> NO
                  </label>
                </div>
              </div>

              <div className="radio-question-card">
                <span className="radio-question-text">Q7. Delivery hospital address and room/ward verified?</span>
                <div className="radio-options-flex">
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.addressConfirmed === true} onChange={() => handleRadioChange('addressConfirmed', true)} /> YES
                  </label>
                  <label className="radio-label">
                    <input className="radio-input" type="radio" checked={answers.addressConfirmed === false} onChange={() => handleRadioChange('addressConfirmed', false)} /> NO
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Verification Call Notes (Optional)</label>
                <textarea 
                  className="form-textarea" 
                  rows="2" 
                  name="notes"
                  placeholder="Any additional details or special requests from family..."
                  value={answers.notes}
                  onChange={handleTextChange}
                ></textarea>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setVolunteeringRequest(null)}>Cancel</button>
              <button className="btn btn-primary" type="submit">Submit Verification</button>
            </div>
          </form>
        </div>
      ) : activeTab === 'feed' ? (
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title"><Megaphone size={20} className="logo-icon" /> Classroom Announcement Feed</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading feed...</div>
          ) : announcements.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
              No active blood requirements announced in class today. Take a break!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {announcements.map((req) => (
                <div key={req.request_id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-secondary)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', transition: 'var(--transition-normal)', position: 'relative' }}>
                  
                  {/* Blood Type Accent Circle */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className={`badge ${req.urgency.toLowerCase()}`}>{req.urgency}</span>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginTop: '8px' }}>{req.hospital_name}</h3>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(230,57,70,0.1)', border: '2px solid var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-red)', fontWeight: 800, fontSize: '18px' }}>
                      {req.blood_type}
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><strong>Quantity Required:</strong> {req.quantity} Units</div>
                    <div><strong>Attending Doctor:</strong> Dr. {req.doctor_name} ({req.doctor_phone})</div>
                    <div><strong>Reason:</strong> {req.reason}</div>
                    <div><strong>Needed By:</strong> {new Date(req.needed_by).toLocaleString()}</div>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleVolunteerClick(req)}
                    style={{ marginTop: '10px', width: '100%' }}
                  >
                    Volunteer & Call Relative
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title"><History size={20} className="logo-icon" /> My Donation Status & History</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading history...</div>
          ) : myVerifications.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              You haven't volunteered for any requests yet.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Req ID</th>
                    <th>Hospital</th>
                    <th>Blood Type</th>
                    <th>Verification</th>
                    <th>Schedule Details</th>
                    <th>Donation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myVerifications.map((v) => (
                    <tr key={v.verification_id}>
                      <td style={{ fontWeight: 600, color: 'white' }}>REQ-{v.request_id}</td>
                      <td>{v.hospital_name}</td>
                      <td style={{ fontWeight: 600, color: 'white' }}>{v.blood_type}</td>
                      <td>
                        <span className={`badge ${v.verification_status.toLowerCase()}`}>
                          {v.verification_status}
                        </span>
                      </td>
                      <td>
                        {v.donation_date ? (
                          <div style={{ fontSize: '12px' }}>
                            <span style={{ color: 'white' }}>{new Date(v.donation_date).toLocaleDateString()}</span>
                            <br />
                            <span style={{ color: 'var(--text-muted)' }}>{v.location}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting schedule</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${v.donation_status ? v.donation_status.toLowerCase() : 'pending'}`}>
                          {v.donation_status || 'AWAITING COLLECTION'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
