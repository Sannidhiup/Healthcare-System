import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// The dynamic variable pointing to Render
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Custom Modal State with error color handling
  const [modal, setModal] = useState({ show: false, message: '', isError: false });
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // FIX: Changed hardcoded localhost to API_BASE_URL
      const res = await axios.post(`${API_BASE_URL}/login`, { email, password });
      
      // 1. Securely cache the system token
      localStorage.setItem('token', res.data.access_token);

      // 2. Grab name and role parameters directly from your updated backend response
      const userRole = res.data.role; 
      const userName = res.data.name;

      // 3. Store name in memory so the background dashboard components can read it
      localStorage.setItem('userName', userName);
      sessionStorage.removeItem('hasGreeted'); // Wipe old greeting session flags

      // 4. Trigger the exact custom popup confirmation layout string requested
      setModal({ 
        show: true, 
        message: `Login successful, Welcome back ${userName}`, 
        isError: false 
      });

      // Hold redirection briefly so they can read the custom success message card
      setTimeout(() => {
        setModal({ show: false, message: '', isError: false });
        
        // Match the exact route paths active in App.js
        if (userRole === 'ADMIN') {
          navigate('/admin-dashboard');
        } else if (userRole === 'DOCTOR') {
          navigate('/doctor-dashboard');
        } else if (userRole === 'PATIENT') {
          navigate('/patient-dashboard');
        }
      }, 1500);

    } catch (err) {
      // Catch bad credentials or server drop errors elegantly
      const backendError = err.response?.data?.detail || "Invalid email or password credentials.";
      setModal({ 
        show: true, 
        message: `Error: ${backendError}`, 
        isError: true 
      });
    }
  };

  return (
    <div style={containerStyle}>
      
      {/* CUSTOM REAL-WORLD MODAL NOTIFICATION */}
      {modal.show && (
        <div style={modalOverlayStyle}>
          <div style={{
            ...modalCardStyle,
            border: modal.isError ? '1px solid #fca5a5' : '1px solid #86efac'
          }}>
            <p style={{ 
              margin: 0, 
              fontWeight: 'bold', 
              color: modal.isError ? '#b91c1c' : '#15803d' 
            }}>
              {modal.message}
            </p>
            {modal.isError && (
              <button 
                onClick={() => setModal({ show: false, message: '', isError: false })} 
                style={modalCloseBtnStyle}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ color: '#2563eb', textAlign: 'center', marginBottom: '25px' }}>Login</h2>
        <form onSubmit={handleLogin}>
          <label style={labelStyle}>Email</label>
          <input 
            type="email" 
            required 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={inputStyle} 
            placeholder="enter your email" 
          />

          <label style={labelStyle}>Password</label>
          <input 
            type="password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={inputStyle} 
            placeholder="••••••••" 
          />

          <button type="submit" style={btnStyle}>Login</button>
        </form>

        {/* Dynamic New Patient Account Onboarding Shortcut Link */}
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

const modalOverlayStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalCardStyle = { background: 'white', padding: '20px 30px', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center' };
const modalCloseBtnStyle = { marginTop: '15px', padding: '8px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };

export default Login;