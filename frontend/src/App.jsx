import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, ShieldCheck, QrCode, LogIn, Sparkles, User, Lock, AlertTriangle, Building, Award, Calendar, KeyRound, CheckCircle, X } from 'lucide-react';
import PublicRequestForm from './components/PublicRequestForm';
import CollegeAdminDashboard from './components/CollegeAdminDashboard';
import AdminForgotPassword from './components/AdminForgotPassword';
import BhcCrestLogo from './components/BhcCrestLogo';
import BhcLoadingScreen from './components/BhcLoadingScreen';

function Navigation({ token, user, onLogout }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin') || location.pathname.startsWith('/forgot-password');

  return (
    <header className="no-print sticky top-0 z-40 shadow-md">
      {/* Main Header Bar with BHC Crest Shield */}
      <div className="bg-[#0a1428] border-b-2 border-[#d4af37] px-4 py-3 text-white">
        <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-3">
          {/* Brand Header replicating input_file_0.png exactly */}
          <Link to="/" className="flex items-center gap-4 group">
            <BhcCrestLogo className="w-14 h-16 shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-black font-serif tracking-widest text-white uppercase leading-none">
                BISHOP HEBER COLLEGE
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-[1px] w-6 bg-[#d4af37]" />
                <span className="text-[10px] md:text-[11px] font-black tracking-[0.22em] text-[#d4af37] uppercase">
                  AUTONOMOUS · TIRUCHIRAPPALLI
                </span>
                <div className="h-[1px] w-12 bg-[#d4af37]" />
              </div>
              <div className="h-[1px] w-full bg-[#d4af37]/60 mt-1" />
            </div>
          </Link>

          {/* Navigation Toggle — Clean Sleek Pills without double-border artifacts */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <Link
              to="/"
              className={`px-4 py-2 rounded-xl transition flex items-center gap-2 border ${
                !isAdmin
                  ? 'bg-[#d4af37] text-slate-900 border-amber-300 font-extrabold shadow-md'
                  : 'bg-[#111c35]/80 text-slate-300 border-slate-700/60 hover:text-white hover:bg-[#162447]'
              }`}
            >
              <QrCode size={15} />
              <span>Blood Request Form</span>
            </Link>
            <Link
              to="/admin"
              className={`px-4 py-2 rounded-xl transition flex items-center gap-2 border ${
                isAdmin
                  ? 'bg-[#d4af37] text-slate-900 border-amber-300 font-extrabold shadow-md'
                  : 'bg-[#111c35]/80 text-slate-300 border-slate-700/60 hover:text-white hover:bg-[#162447]'
              }`}
            >
              <ShieldCheck size={15} />
              <span>College Admin Portal</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

// College Admin Login Component (Production-Ready: No Demo Boxes, Fixed Icon Padding)
function AdminLogin({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(email, password);
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-4 my-12 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl space-y-6 text-center">
        <BhcCrestLogo className="w-16 h-20 mx-auto" />
        <div>
          <h2 className="text-xl font-black text-slate-900 font-serif">College Administrator Portal</h2>
          <p className="text-xs text-[#b45309] font-bold mt-1">Bishop Heber College (Autonomous), Tiruchirappalli</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="form-group">
            <label className="form-label text-xs font-bold text-slate-700">Admin Email</label>
            <input
              type="email"
              className="form-input text-xs px-4 py-2.5 w-full font-medium"
              placeholder="Enter admin email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <div className="flex justify-between items-center mb-1">
              <label className="form-label text-xs font-bold text-slate-700">Password</label>
              <Link
                to="/forgot-password"
                className="text-[11px] font-extrabold text-[#b45309] hover:underline flex items-center gap-1"
              >
                <KeyRound size={12} /> Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              className="form-input text-xs px-4 py-2.5 w-full font-medium"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full py-3 text-xs font-extrabold shadow-md rounded-xl" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In as College Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="no-print bg-[#060c18] border-t border-[#162447] text-white mt-16 py-8 px-4 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
        <div className="flex items-center gap-4">
          <BhcCrestLogo className="w-12 h-14 shrink-0" />
          <div>
            <div className="font-black font-serif text-white text-sm">BISHOP HEBER COLLEGE</div>
            <div className="text-[#d4af37] font-extrabold text-[11px] uppercase tracking-wider">AUTONOMOUS · TIRUCHIRAPPALLI</div>
            <div className="text-slate-400 text-[10px] mt-0.5">Nisi Dominus Frustra · NAAC A++ Grade · NBA Accredited · Est. 1966</div>
          </div>
        </div>
        <div className="text-slate-400 text-[11px]">
          © {new Date().getFullYear()} Bishop Heber College Blood Donor Network. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}

function MainAppContent() {
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const [token, setToken] = useState(() => sessionStorage.getItem('bhc_admin_token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('bhc_admin_user')); } catch { return null; }
  });

  // Re-trigger smooth loading screen animation on route change
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleAdminLogin = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'admin' })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        sessionStorage.setItem('bhc_admin_token', data.token);
        sessionStorage.setItem('bhc_admin_user', JSON.stringify(data.user));
      } else {
        const err = await res.json();
        alert(`Login Failed: ${err.message}`);
      }
    } catch {
      alert('Error connecting to server.');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('bhc_admin_token');
    sessionStorage.removeItem('bhc_admin_user');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* Premium BHC Splash Screen & Route Transition Animation */}
      {loading && <BhcLoadingScreen minDuration={900} onFinished={() => setLoading(false)} />}

      <Navigation token={token} user={user} onLogout={handleLogout} />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<PublicRequestForm />} />
          <Route path="/request" element={<PublicRequestForm />} />
          <Route path="/qr" element={<PublicRequestForm />} />
          <Route path="/forgot-password" element={<AdminForgotPassword />} />

          <Route
            path="/admin"
            element={
              !token ? (
                <AdminLogin onLogin={handleAdminLogin} />
              ) : (
                <CollegeAdminDashboard token={token} user={user} onLogout={handleLogout} />
              )
            }
          />

          <Route path="*" element={<PublicRequestForm />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MainAppContent />
    </BrowserRouter>
  );
}
