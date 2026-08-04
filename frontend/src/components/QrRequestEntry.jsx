import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, Hospital, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

export default function QrRequestEntry({ token, user, onLogin }) {
  const { qrToken } = useParams();
  const navigate = useNavigate();

  const [hospital, setHospital] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);

  // Fetch hospital info from QR token
  useEffect(() => {
    async function fetchHospital() {
      try {
        const res = await fetch(`/api/qr/${qrToken}`);
        if (!res.ok) {
          const err = await res.json();
          setError(err.message || 'Invalid QR code');
        } else {
          setHospital(await res.json());
        }
      } catch {
        setError('Cannot reach server. Please ensure the application is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchHospital();
  }, [qrToken]);

  const handleQrLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    const result = await onLogin(loginEmail, loginPassword, 'hospital');
    if (result) {
      navigate('/');
    }
    setLoginLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
        <Loader size={32} style={{ color: 'var(--accent-red)', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Verifying QR code...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '24px' }}>
        <AlertTriangle size={48} style={{ color: 'var(--warning)' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Invalid QR Code</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '360px' }}>{error}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>This QR code may be invalid, expired, or belong to an unverified hospital.</p>
      </div>
    );
  }

  // If hospital user is already logged in and it's the correct hospital, redirect to dashboard
  if (user && user.role === 'hospital') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '24px' }}>
        <CheckCircle size={48} style={{ color: 'var(--success)' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>You&apos;re already logged in</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Redirecting to your Blood Request Form...</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Open Dashboard</button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
      background: 'radial-gradient(circle at 30% 40%, rgba(230,57,70,0.06) 0%, transparent 60%), #09090b'
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Hospital Info Card */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--accent-red)',
          borderRadius: '16px', padding: '24px', marginBottom: '20px',
          boxShadow: '0 0 24px rgba(230,57,70,0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(230,57,70,0.15)', borderRadius: '10px', padding: '10px' }}>
              <Hospital size={24} style={{ color: 'var(--accent-red)' }} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verified Hospital QR</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{hospital.hospital_name}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>Registration ID</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{hospital.registration_id}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>Contact</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{hospital.hospital_phone}</div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>Address</div>
              <div style={{ color: 'var(--text-primary)' }}>{hospital.hospital_address}</div>
            </div>
          </div>

          <div style={{ marginTop: '14px', padding: '10px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <span style={{ color: 'var(--success)' }}>This hospital is verified by the system administrator.</span>
          </div>
        </div>

        {/* Login to submit request */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <QrCode size={18} style={{ color: 'var(--accent-red)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Sign in to submit a Blood Request</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            Hospital information will be auto-filled. Please sign in with your hospital credentials to continue.
          </p>

          <form onSubmit={handleQrLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Hospital Email</label>
              <input className="form-input" type="email" placeholder="hospital@email.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loginLoading} style={{ width: '100%' }}>
              {loginLoading ? 'Signing in...' : 'Sign In & Open Request Form'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
