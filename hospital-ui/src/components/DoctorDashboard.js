import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Navbar from './Navbar';

function DoctorDashboard() {
  const token = localStorage.getItem('token');
  const [notification, setNotification] = useState({ show: false, message: '', isError: false });
  const [schedule, setSchedule] = useState([]);

  const showStatusNotification = useCallback((msg, isErr = false) => {
    setNotification({ show: true, message: msg, isError: isErr });
    setTimeout(() => setNotification({ show: false, message: '', isError: false }), 4000);
  }, []);

  const loadDoctorSchedule = useCallback(async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8001/doctor/my-schedule', { headers: { Authorization: `Bearer ${token}` } });
      setSchedule(res.data || []);
    } catch (err) {
      console.error("Failed to query target doctor schedule matrix mapping.");
      showStatusNotification("Error connecting to live server timeline records.", true);
    }
  }, [token, showStatusNotification]);

  useEffect(() => {
    loadDoctorSchedule();
    const userName = localStorage.getItem('userName');
    const hasGreeted = sessionStorage.getItem('hasGreeted');
    if (userName && !hasGreeted) {
      showStatusNotification(`Login successful, Welcome back Dr. ${userName}`, false);
      sessionStorage.setItem('hasGreeted', 'true');
    }
  }, [loadDoctorSchedule, showStatusNotification]);

  const confirmed = schedule.filter(a => a.status === 'CONFIRMED' || a.status === 'BOOKED').length;
  const total = schedule.length;

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <Navbar />

      {/* ── NOTIFICATION TOAST ── */}
      {notification.show && (
        <div style={{ position: 'fixed', top: 76, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backgroundColor: notification.isError ? '#fff1f1' : '#f0fdf4', color: notification.isError ? '#c0392b' : '#166534', border: `1.5px solid ${notification.isError ? '#fca5a5' : '#86efac'}` }}>
          <span style={{ fontSize: 18 }}>{notification.isError ? '⚠️' : '✅'}</span>
          {notification.message}
        </div>
      )}

      <div style={{ padding: '28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 24 }}>
          {[
            { label: "Today's Appointments", value: total, icon: '📅', bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe' },
            { label: 'Confirmed Patients', value: confirmed, icon: '✅', bg: '#f0fdf4', fg: '#16a34a', border: '#bbf7d0' },
            { label: 'Pending / Other', value: total - confirmed, icon: '🕐', bg: '#fffbeb', fg: '#d97706', border: '#fde68a' },
          ].map((stat, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, padding: '20px 22px', border: `1px solid ${stat.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: stat.fg, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SCHEDULE TABLE ── */}
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>

          {/* Card Header */}
          <div style={{ background: '#eff6ff', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #dbeafe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🏥</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Clinical Appointments Schedule</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Live patient booking view</div>
              </div>
            </div>
            <button onClick={loadDoctorSchedule} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
              🔄 Refresh List
            </button>
          </div>

          {/* Table */}
          <div style={{ padding: '8px 0' }}>
            {schedule.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>No appointments scheduled</div>
                <div style={{ fontSize: 13 }}>No patients have booked allocations inside your registered slot pools yet.</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Patient Name', 'Appointment Date', 'Allocated Time Window', 'Current Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 20px', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((appt, i) => {
                    const isConfirmed = appt.status === 'CONFIRMED' || appt.status === 'BOOKED';
                    return (
                      <tr key={appt.id} style={{ borderBottom: i < schedule.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                              {appt.patient_name.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{appt.patient_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', color: '#6b7280', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>📆</span>
                            <span style={{ fontWeight: 500 }}>{appt.date}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                          <span style={{ background: '#f3f4f6', color: '#374151', padding: '6px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            ⏱ {appt.time}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: isConfirmed ? '#16a34a' : '#6b7280', background: isConfirmed ? '#f0fdf4' : '#f3f4f6', border: `1px solid ${isConfirmed ? '#bbf7d0' : '#e5e7eb'}`, padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isConfirmed ? '#16a34a' : '#9ca3af', display: 'inline-block' }} />
                            {appt.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DoctorDashboard;
