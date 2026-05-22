import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  
  // Custom Logout Confirmation Modal State
  const [showConfirm, setShowConfirm] = useState(false);

  const executeLogout = () => {
    localStorage.removeItem('token'); // Clears JWT session cache securely
    setShowConfirm(false);
    navigate('/'); // Smoothly routes back to the custom Login screen
  };

  return (
    <nav style={navStyle}>
      <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#1e293b' }}>
        🩺 CoreCare Management System
      </div>
      
      {/* Visual Trigger Button */}
      <button onClick={() => setShowConfirm(true)} style={logoutBtnStyle}>
        Log Out
      </button>

      {/* ==========================================
          CUSTOM REAL-WORLD LOGOUT CONFIRMATION MODAL
          ========================================== */}
      {showConfirm && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>Confirm Logout</h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
              Are you sure you want to end your workspace session?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={executeLogout} style={confirmActionBtnStyle}>
                Yes, Log Out
              </button>
              <button onClick={() => setShowConfirm(false)} style={cancelActionBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// ==========================================
// STYLING ENGINE BOUNDARIES
// ==========================================
const navStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: 'white',
  padding: '15px 40px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  borderBottom: '1px solid #e2e8f0',
  position: 'sticky',
  top: 0,
  zIndex: 1000
};

const logoutBtnStyle = {
  backgroundColor: '#fee2e2',
  color: '#ef4444',
  border: '1px solid #fca5a5',
  padding: '8px 18px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '14px'
};

// Modal Overlay block mapping
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.4)', // Dark transparent background
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 99999 // Sits perfectly over everything, including sticky headers
};

const modalCardStyle = {
  background: 'white',
  padding: '25px 35px',
  borderRadius: '12px',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  textAlign: 'center',
  width: '340px',
  border: '1px solid #e2e8f0'
};

const confirmActionBtnStyle = {
  backgroundColor: '#ef4444',
  color: 'white',
  border: 'none',
  padding: '10px 18px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '14px'
};

const cancelActionBtnStyle = {
  backgroundColor: '#f1f5f9',
  color: '#475569',
  border: '1px solid #cbd5e1',
  padding: '10px 18px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '14px'
};

export default Navbar;