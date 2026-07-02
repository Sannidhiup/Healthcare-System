import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// The dynamic variable pointing to Render
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

function Register() {
  const navigate = useNavigate();

  // Step control: 'phone' -> 'otp' -> 'details'
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);

  // Step 1: phone number
  const [phone, setPhone] = useState('');

  // Step 2: OTP
  const [otp, setOtp] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');

  // Step 3: account details (phone carried over automatically)
  const [formData, setFormData] = useState({
    name: '', email: '', password: '',
    age: '', gender: '', blood_group: '', role: 'PATIENT'
  });

  // Custom In-App Notification State
  const [modal, setModal] = useState({ show: false, message: '', isError: false });

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  // ==========================================
  // STEP 1: SEND OTP
  // ==========================================
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      setModal({ show: true, message: 'Error: Phone number must be exactly 10 digits', isError: true });
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/register/send-otp`, { phone });
      setModal({ show: true, message: 'OTP sent to your phone number.', isError: false });
      setTimeout(() => setModal({ show: false, message: '', isError: false }), 2000);
      setStep('otp');
    } catch (err) {
      const backendError = err.response?.data?.detail || 'Failed to send OTP. Please try again.';
      setModal({ show: true, message: `Error: ${backendError}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // STEP 2: VERIFY OTP
  // ==========================================
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/register/verify-otp`, { phone, otp });
      setRegistrationToken(res.data.registration_token);
      setStep('details');
    } catch (err) {
      const backendError = err.response?.data?.detail || 'Invalid or expired OTP.';
      setModal({ show: true, message: `Error: ${backendError}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/register/send-otp`, { phone });
      setModal({ show: true, message: 'A new OTP has been sent.', isError: false });
      setTimeout(() => setModal({ show: false, message: '', isError: false }), 2000);
    } catch (err) {
      const backendError = err.response?.data?.detail || 'Failed to resend OTP.';
      setModal({ show: true, message: `Error: ${backendError}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // STEP 3: CREATE ACCOUNT
  // ==========================================
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        phone,
        age: parseInt(formData.age),
        registration_token: registrationToken
      };

      await axios.post(`${API_BASE_URL}/register`, payload);

      setModal({
        show: true,
        message: 'PATIENT account created successfully! Redirecting to login...',
        isError: false
      });

      setTimeout(() => {
        setModal({ show: false, message: '', isError: false });
        navigate('/');
      }, 2000);

    } catch (err) {
      const backendError = err.response?.data?.detail || 'Registration rejected. Please verify form details.';
      setModal({ show: true, message: `Error: ${backendError}`, isError: true });

      // If the registration token expired/was invalid, safest is to send them back to step 1
      if (err.response?.status === 401) {
        setStep('phone');
        setOtp('');
        setRegistrationToken('');
      }
    }
  };

  return (
    <div style={containerStyle}>

      {/* CUSTOM REAL-WORLD MODAL BANNER */}
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

      <div style={cardStyle}>
        <h2 style={{ color: '#2563eb', textAlign: 'center', margin: '0 0 8px 0' }}>Patient Registration</h2>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '22px' }}>
          {['phone', 'otp', 'details'].map((s, i) => (
            <div key={s} style={{
              width: '28px', height: '4px', borderRadius: '2px',
              backgroundColor: (step === s || ['phone', 'otp', 'details'].indexOf(step) > i) ? '#2563eb' : '#e2e8f0'
            }} />
          ))}
        </div>

        {/* ── STEP 1: PHONE NUMBER ── */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp}>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0, marginBottom: '15px' }}>
              Enter your phone number. We'll send a one-time code to verify it's really you before creating your account.
            </p>
            <label style={labelStyle}>Phone Number</label>
            <input
              type="text" required maxLength="10" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              style={inputStyle} placeholder="9876543210"
            />
            <button type="submit" disabled={loading} style={{ ...btnStyle, backgroundColor: loading ? '#94a3b8' : '#2563eb', width: '100%', marginTop: '20px' }}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
              Already have an account?{' '}
              <span onClick={() => navigate('/')} style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>
                Login here
              </span>
            </p>
          </form>
        )}

        {/* ── STEP 2: VERIFY OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0, marginBottom: '15px' }}>
              Enter the 6-digit code sent to <strong>{phone}</strong>.
            </p>
            <label style={labelStyle}>OTP Code</label>
            <input
              type="text" maxLength="6" required value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              style={{ ...inputStyle, letterSpacing: '3px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}
              placeholder="123456"
            />
            <button type="submit" disabled={loading} style={{ ...btnStyle, backgroundColor: loading ? '#94a3b8' : '#2563eb', width: '100%', marginTop: '20px' }}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px' }}>
              <span onClick={() => setStep('phone')} style={{ color: '#64748b', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                Change phone number
              </span>
              <span onClick={handleResendOtp} style={{ color: '#2563eb', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                Resend OTP
              </span>
            </div>
          </form>
        )}

        {/* ── STEP 3: ACCOUNT DETAILS ── */}
        {step === 'details' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Full Name</label>
              <input type="text" required value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} style={inputStyle} placeholder="Jane Doe" />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" required value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} style={inputStyle} placeholder="jane@example.com" />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" required value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} style={inputStyle} placeholder="••••••••" />
            </div>

            <div>
              <label style={labelStyle}>Phone Number</label>
              <input type="text" value={phone} disabled style={{ ...inputStyle, backgroundColor: '#f1f5f9', color: '#64748b' }} />
            </div>

            <div>
              <label style={labelStyle}>Age</label>
              <input type="number" required value={formData.age} onChange={(e) => handleInputChange('age', e.target.value)} style={inputStyle} placeholder="25" />
            </div>

            <div>
              <label style={labelStyle}>Gender</label>
              <select value={formData.gender} required onChange={(e) => handleInputChange('gender', e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Blood Group</label>
              <select value={formData.blood_group} required onChange={(e) => handleInputChange('blood_group', e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button type="submit" style={{ ...btnStyle, backgroundColor: '#16a34a', margin: 0 }}>Save</button>
              <button type="button" onClick={() => navigate('/')} style={{ ...btnStyle, backgroundColor: '#64748b', margin: 0 }}>Cancel</button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}

// Styling Cohesion Elements
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9', position: 'relative', fontFamily: 'Arial, sans-serif' };
const cardStyle = { background: 'white', padding: '35px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '500px', zIndex: 1 };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px', backgroundColor: 'white' };
const btnStyle = { flex: 1, color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' };
const modalOverlayStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalCardStyle = { background: 'white', padding: '20px 30px', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center' };
const modalCloseBtnStyle = { marginTop: '15px', padding: '8px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };

export default Register;
