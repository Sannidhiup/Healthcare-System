import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Register() {
  const navigate = useNavigate();

  // Form Field States
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '',
    age: '', gender: '', blood_group: '', role: 'PATIENT'
  });

  // Custom In-App Notification State
  const [modal, setModal] = useState({ show: false, message: '', isError: false });

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    try {
      // Numbers must be integers for the FastAPI schema parsing validation rules
      const payload = {
        ...formData,
        age: parseInt(formData.age)
      };

      await axios.post('http://127.0.0.1:8001/register', payload);

      setModal({ 
        show: true, 
        message: "PATIENT account created successfully! Redirecting to login...", 
        isError: false 
      });

      setTimeout(() => {
        setModal({ show: false, message: '', isError: false });
        navigate('/'); // Bounce cleanly to the login landing grid
      }, 2000);

    } catch (err) {
      const backendError = err.response?.data?.detail || "Registration rejected. Please verify form details.";
      setModal({ show: true, message: `Error: ${backendError}`, isError: true });
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
        <h2 style={{ color: '#2563eb', textAlign: 'center', margin: '0 0 20px 0' }}>Patient Registration</h2>
        
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
            <input type="text" required value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} style={inputStyle} placeholder="9876543210" />
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