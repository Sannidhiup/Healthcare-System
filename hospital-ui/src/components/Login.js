import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// The dynamic variable pointing to Render
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

function Login() {
  // --- LOGIN STATE ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [modal, setModal] = useState({ show: false, message: '', isError: false });
  
  const navigate = useNavigate();

  // --- FORGOT PASSWORD STATE ---
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState('request'); // 'request' or 'reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotIsError, setForgotIsError] = useState(false);

  // ==========================================
  // 1. STANDARD LOGIN FUNCTION
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE_URL}/login`, { email, password });
      
      localStorage.setItem('token', res.data.access_token);
      const userRole = res.data.role; 
      const userName = res.data.name;
      const userExtraInfo = res.data.extra_info || ""; 

      localStorage.setItem('userName', userName);
      localStorage.setItem('userRole', userRole); 
      localStorage.setItem('userExtraInfo', userExtraInfo); 
      
      sessionStorage.removeItem('hasGreeted'); 

      setModal({ show: true, message: `Login successful, Welcome back ${userName}`, isError: false });

      setTimeout(() => {
        setModal({ show: false, message: '', isError: false });
        if (userRole === 'ADMIN') navigate('/admin-dashboard');
        else if (userRole === 'DOCTOR') navigate('/doctor-dashboard');
        else if (userRole === 'PATIENT') navigate('/patient-dashboard');
      }, 1500);

    } catch (err) {
      const backendError = err.response?.data?.detail || "Invalid email or password credentials.";
      setModal({ show: true, message: `Error: ${backendError}`, isError: true });
    }
  };

  // ==========================================
  // 2. FORGOT PASSWORD FUNCTIONS
  // ==========================================
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true); setForgotMessage(''); setForgotIsError(false);

    try {
      await axios.post(`${API_BASE_URL}/forgot-password`, { email: forgotEmail });
      setForgotStep('reset');
      setForgotMessage('If an account exists, a 6-digit code has been sent.');
    } catch (err) {
      setForgotMessage('Failed to connect to the server.');
      setForgotIsError(true);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotOtp || !forgotNewPassword) return;
    setForgotLoading(true); setForgotMessage(''); setForgotIsError(false);

    try {
      const res = await axios.post(`${API_BASE_URL}/reset-password`, {
        email: forgotEmail,
        otp: forgotOtp,
        new_password: forgotNewPassword
      });
      setForgotMessage(res.data.message || 'Password successfully reset!');
      
      // Close modal after success
      setTimeout(() => {
        closeForgotModal();
      }, 2000);
    } catch (err) {
      setForgotMessage(err.response?.data?.detail || 'Invalid OTP or expired link.');
      setForgotIsError(true);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('request');
    setForgotEmail('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotMessage('');
    setForgotIsError(false);
  };

  // ==========================================
  // RENDER UI
  // ==========================================
  return (
    <div style={containerStyle}>
      
      {/* ── EXISTING LOGIN NOTIFICATION MODAL ── */}
      {modal.show && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalCardStyle, border: modal.isError ? '1px solid #fca5a5' : '1px solid #86efac' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: modal.isError ? '#b91c1c' : '#15803d' }}>
              {modal.message}
            </p>
            {modal.isError && (
              <button onClick={() => setModal({ show: false, message: '', isError: false })} style={modalCloseBtnStyle}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── NEW FORGOT PASSWORD MODAL ── */}
      {showForgotModal && (
        <div style={modalOverlayStyle}>
          <div style={{...modalCardStyle, width: '350px', position: 'relative'}}>
            {/* Close Button (X) */}
            <span 
              onClick={closeForgotModal} 
              style={{position: 'absolute', top: '10px', right: '15px', cursor: 'pointer', fontSize: '18px', color: '#64748b', fontWeight: 'bold'}}
            >
              ✕
            </span>

            <h3 style={{ color: '#2563eb', marginTop: '10px', marginBottom: '15px' }}>
              {forgotStep === 'request' ? 'Reset Password' : 'Enter Reset Code'}
            </h3>

            {forgotMessage && (
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: forgotIsError ? '#b91c1c' : '#15803d', marginBottom: '15px', background: forgotIsError ? '#fee2e2' : '#dcfce7', padding: '8px', borderRadius: '6px' }}>
                {forgotMessage}
              </p>
            )}

            {/* STEP 1: Ask for Email */}
            {forgotStep === 'request' && (
              <form onSubmit={handleRequestOtp} style={{ textAlign: 'left' }}>
                <label style={labelStyle}>Patient Email Address</label>
                <input 
                  type="email" required value={forgotEmail} 
                  onChange={(e) => setForgotEmail(e.target.value)} 
                  style={inputStyle} placeholder="patient@example.com" 
                />
                <button type="submit" disabled={forgotLoading} style={{...btnStyle, backgroundColor: forgotLoading ? '#94a3b8' : '#2563eb'}}>
                  {forgotLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            )}

            {/* STEP 2: Enter OTP & New Password */}
            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword} style={{ textAlign: 'left' }}>
                <label style={labelStyle}>6-Digit OTP</label>
                <input 
                  type="text" maxLength="6" required value={forgotOtp} 
                  onChange={(e) => setForgotOtp(e.target.value)} 
                  style={{...inputStyle, letterSpacing: '3px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold'}} 
                  placeholder="123456" 
                />

                <label style={labelStyle}>New Password</label>
                <input 
                  type="password" required value={forgotNewPassword} 
                  onChange={(e) => setForgotNewPassword(e.target.value)} 
                  style={inputStyle} placeholder="••••••••" 
                />

                <button type="submit" disabled={forgotLoading} style={{...btnStyle, backgroundColor: forgotLoading ? '#94a3b8' : '#2563eb'}}>
                  {forgotLoading ? 'Verifying...' : 'Reset My Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN LOGIN CARD ── */}
      <div style={cardStyle}>
        <h2 style={{ color: '#2563eb', textAlign: 'center', marginBottom: '25px' }}>Login</h2>
        <form onSubmit={handleLogin}>
          <label style={labelStyle}>Email</label>
          <input 
            type="email" required value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={inputStyle} placeholder="enter your email" 
          />

          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"} required value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ ...inputStyle, paddingRight: '40px' }} placeholder="••••••••" 
            />
            <span 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px', userSelect: 'none' }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? '🙈' : '👁️'}
            </span>
          </div>

          <button type="submit" style={btnStyle}>Login</button>
        </form>

        {/* FORGOT PASSWORD LINK */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <span 
            onClick={() => { setShowForgotModal(true); setForgotEmail(email); }} 
            style={{ color: '#475569', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Forgot your password?
          </span>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
          New patient?{' '}
          <span 
            onClick={() => navigate('/register')} 
            style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Create an account here
          </span>
        </p>

      </div>
    </div>
  );
}

// ==========================================
// STYLING PARAMETERS ENGINE
// ==========================================
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9', position: 'relative' };
const cardStyle = { background: 'white', padding: '35px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '380px', zIndex: 1 };
const labelStyle = { display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '5px', marginTop: '15px' };
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px' };
const btnStyle = { width: '100%', backgroundColor: '#2563eb', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '25px' };

const modalOverlayStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalCardStyle = { background: 'white', padding: '20px 30px', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' };
const modalCloseBtnStyle = { marginTop: '15px', padding: '8px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };

export default Login;