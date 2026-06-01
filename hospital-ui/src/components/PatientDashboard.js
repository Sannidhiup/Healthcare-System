import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Navbar from './Navbar';

// ── THE MAGIC VARIABLE ──
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

function PatientDashboard() {
  const token = localStorage.getItem('token');
  const [notification, setNotification] = useState({ show: false, message: '', isError: false });
  const [actionModal, setActionModal] = useState({ show: false, type: '', targetId: null, message: '', extraData: null });

  const showStatusNotification = useCallback((msg, isErr = false) => {
    setNotification({ show: true, message: msg, isError: isErr });
    setTimeout(() => setNotification({ show: false, message: '', isError: false }), 4000);
  }, []);

  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  
  // ── NEW AI FEATURE STATES ──
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const loadInitialPatientWorkspace = useCallback(async () => {
    try {
      const overviewRes = await axios.get(`${API_BASE_URL}/system-overview`);
      setHospitals(overviewRes.data.hospitals || []);
      setDoctors(overviewRes.data.doctors || []);
      const appointmentsRes = await axios.get(`${API_BASE_URL}/patient/appointments`, { headers: { Authorization: `Bearer ${token}` } });
      setMyAppointments(appointmentsRes.data || []);
    } catch (err) { console.error("Error setting up patient environment maps."); }
  }, [token]);

  useEffect(() => {
    loadInitialPatientWorkspace();
    const userName = localStorage.getItem('userName');
    const hasGreeted = sessionStorage.getItem('hasGreeted');
    if (userName && !hasGreeted) {
      showStatusNotification(`Login successful, Welcome back ${userName}`, false);
      sessionStorage.setItem('hasGreeted', 'true');
    }
  }, [loadInitialPatientWorkspace, showStatusNotification]);

  const validFilteredDoctorsList = doctors.filter(doc => doc.hospital_id === parseInt(selectedHospital));

  const handleFetchAvailableSlots = async () => {
    if (!selectedDoctor || !filterDate) { showStatusNotification("Please select a Doctor and specific Target Date first.", true); return; }
    try {
      const res = await axios.get(`${API_BASE_URL}/slots/${selectedDoctor}?date=${filterDate}`);
      const now = new Date();
      const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0');
      const todayString = `${year}-${month}-${day}`;
      const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const validLiveSlots = res.data.filter(slot => {
        if (slot.is_booked) return false;
        if (filterDate === todayString) return slot.start_time > currentTimeString;
        return true;
      });
      setAvailableSlots(validLiveSlots);
      if (validLiveSlots.length === 0) showStatusNotification("No open appointment timings remaining for this date configuration.", false);
    } catch { showStatusNotification("Failed to collect clinician schedule timelines.", true); }
  };

  const handleBookSlotClick = (slot) => setActionModal({ show: true, type: 'BOOK', targetId: slot.id, message: `Confirm booking appointment window from ${slot.start_time} to ${slot.end_time}?` });

  const handleCancelClick = (appt) => setActionModal({ show: true, type: 'CANCEL', targetId: appt.id, message: `Are you sure you want to drop your appointment with Dr. ${appt.doctor_name}? This slot will return to open public inventory.` });

  const handleRescheduleClick = async (appt) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/slots/${appt.doctor_id}?date=${appt.date}`);
      const now = new Date();
      const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0');
      const todayString = `${year}-${month}-${day}`;
      const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const freeSlots = res.data.filter(slot => {
        if (slot.is_booked) return false;
        if (appt.date === todayString) return slot.start_time > currentTimeString;
        return true;
      });
      setRescheduleSlots(freeSlots);
      setActionModal({ show: true, type: 'RESCHEDULE', targetId: appt.id, message: `Select a new 30-minute timing block below for your appointment with Dr. ${appt.doctor_name}:`, extraData: null });
    } catch { showStatusNotification("Could not retrieve optional timing blocks for rescheduling.", true); }
  };

  const executeConfirmedAction = async () => {
    const { type, targetId, extraData } = actionModal;
    setActionModal({ show: false, type: '', targetId: null, message: '', extraData: null });
    try {
      if (type === 'BOOK') { await axios.post(`${API_BASE_URL}/appointments/book`, { slot_id: targetId }, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Appointment confirmed successfully."); }
      else if (type === 'CANCEL') { await axios.delete(`${API_BASE_URL}/appointments/cancel/${targetId}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Appointment canceled cleanly."); }
      else if (type === 'RESCHEDULE') {
        if (!extraData) { showStatusNotification("Rescheduling aborted: No new slot timing was selected.", true); return; }
        await axios.put(`${API_BASE_URL}/appointments/reschedule/${targetId}`, { new_slot_id: parseInt(extraData) }, { headers: { Authorization: `Bearer ${token}` } });
        showStatusNotification("Appointment schedule successfully modified.");
      }
      loadInitialPatientWorkspace();
      if (selectedDoctor && filterDate) handleFetchAvailableSlots();
    } catch { showStatusNotification("Oops! We couldn't complete this request. Please try again.", true); }
  };

  // ── NEW: FILE UPLOAD HANDLER ──
  const handleUploadRecords = async () => {
    if (uploadedFiles.length === 0) return;
    setIsUploading(true);
    
    // Create the multipart form envelope
    const formData = new FormData();
    uploadedFiles.forEach(file => formData.append("files", file));

    try {
      // Send to the FastAPI backend (we will build this endpoint next!)
      await axios.post(`${API_BASE_URL}/patient/upload-records`, formData, {
        headers: { Authorization: `Bearer ${token}` } // Axios automatically sets multipart headers for FormData
      });
      
      showStatusNotification("Medical records securely uploaded to cloud storage!");
      setUploadedFiles([]); // Clear out the input after success
    } catch (error) {
      showStatusNotification("Failed to upload records to the server.", true);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <Navbar />

      {/* ── NOTIFICATION TOAST ── */}
      {notification.show && (
        <div style={{ position: 'fixed', top: 76, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backgroundColor: notification.isError ? '#fff1f1' : '#f0fdf4', color: notification.isError ? '#c0392b' : '#166534', border: `1.5px solid ${notification.isError ? '#fca5a5' : '#86efac'}`, maxWidth: 420 }}>
          <span style={{ fontSize: 18 }}>{notification.isError ? '⚠️' : '✅'}</span>
          {notification.message}
        </div>
      )}

      {/* ── ACTION MODAL ── */}
      {actionModal.show && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '36px 40px', width: 420, boxShadow: '0 25px 60px rgba(0,0,0,0.20)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 26 }}>
              {actionModal.type === 'CANCEL' ? '🚫' : actionModal.type === 'RESCHEDULE' ? '🔄' : '📅'}
            </div>
            <h3 style={{ margin: '0 0 10px', color: '#111827', fontSize: 18, fontWeight: 700 }}>Confirm Appointment</h3>
            <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>{actionModal.message}</p>

            {actionModal.type === 'RESCHEDULE' && (
              <div style={{ marginBottom: 22, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Available Alternative Blocks</label>
                <select style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, background: '#fafafa', color: '#111827' }}
                  onChange={e => setActionModal(prev => ({ ...prev, extraData: e.target.value }))}>
                  <option value="">-- Choose alternative open timing --</option>
                  {rescheduleSlots.map(s => <option key={s.id} value={s.id}>{s.start_time} - {s.end_time}</option>)}
                </select>
                {rescheduleSlots.length === 0 && <p style={{ color: '#dc2626', fontSize: 12, margin: '6px 0 0' }}>No other slots available on this doctor's day.</p>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setActionModal({ show: false, type: '', targetId: null, message: '', extraData: null })}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={executeConfirmedAction}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '28px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ── */}
        <div>
          {/* 1. FIND & BOOK CARD */}
          <div style={P.card}>
            <div style={P.cardTop}>
              <span style={{ fontSize: 22 }}>🔍</span>
              <div>
                <div style={P.cardTitle}>Find & Book Consultation</div>
                <div style={P.cardSub}>Search available doctor slots</div>
              </div>
            </div>
            <div style={P.cardBody}>

              <div style={P.field}>
                <label style={P.label}>Select Hospital Facility</label>
                <select value={selectedHospital} onChange={e => { setSelectedHospital(e.target.value); setSelectedDoctor(''); setAvailableSlots([]); }} style={P.sel}>
                  <option value="">-- Select Medical Facility --</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} ({h.location})</option>)}
                </select>
              </div>

              <div style={P.field}>
                <label style={P.label}>Select Specializing Practitioner</label>
                <select value={selectedDoctor} onChange={e => { setSelectedDoctor(e.target.value); setAvailableSlots([]); }} style={{ ...P.sel, opacity: !selectedHospital ? 0.6 : 1 }} disabled={!selectedHospital}>
                  <option value="">-- Choose Practitioner --</option>
                  {validFilteredDoctorsList.map(d => <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization})</option>)}
                </select>
              </div>

              <div style={P.field}>
                <label style={P.label}>Target Consultation Date</label>
                <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setAvailableSlots([]); }} style={P.inp} />
              </div>

              <button onClick={handleFetchAvailableSlots} style={P.searchBtn}>🔍 Search Slots</button>

              {availableSlots.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                    Available 30-Min Openings ({availableSlots.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableSlots.map(slot => (
                      <button key={slot.id} onClick={() => handleBookSlotClick(slot)} style={{ background: 'white', color: '#0369a1', border: '1.5px solid #7dd3fc', padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.borderColor = '#0369a1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#7dd3fc'; }}>
                        ⏱ {slot.start_time} – {slot.end_time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. UPLOAD MEDICAL RECORDS CARD */}
          <div style={{ ...P.card, marginTop: '24px' }}>
            <div style={{...P.cardTop, background: '#f0fdf4', borderBottom: '1px solid #dcfce3'}}>
              <span style={{ fontSize: 22 }}>📁</span>
              <div>
                <div style={P.cardTitle}>Upload Medical Records</div>
                <div style={P.cardSub}>Securely save PDFs for your doctors</div>
              </div>
            </div>
            <div style={P.cardBody}>
              <div style={P.field}>
                <label style={P.label}>Select Lab Reports or Summaries (PDF)</label>
                <input 
                  type="file" 
                  accept=".pdf" 
                  multiple 
                  onChange={(e) => setUploadedFiles(Array.from(e.target.files))} 
                  style={{...P.inp, background: 'white'}}
                />
              </div>
              <button 
                onClick={handleUploadRecords} 
                disabled={isUploading || uploadedFiles.length === 0}
                style={{ 
                  ...P.searchBtn, 
                  background: isUploading || uploadedFiles.length === 0 ? '#d1d5db' : 'linear-gradient(135deg, #10b981, #059669)', 
                  boxShadow: isUploading || uploadedFiles.length === 0 ? 'none' : '0 4px 14px rgba(16,185,129,0.3)',
                  cursor: isUploading || uploadedFiles.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {isUploading ? '⏳ Uploading to Cloud...' : '☁️ Upload Files'}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: MY APPOINTMENTS ── */}
        <div style={P.card}>
          <div style={P.cardTop}>
            <span style={{ fontSize: 22 }}>📋</span>
            <div>
              <div style={P.cardTitle}>My Booked Consultations Log</div>
              <div style={P.cardSub}>{myAppointments.length} active appointment{myAppointments.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style={P.cardBody}>
            {myAppointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>No appointments yet</div>
                <div style={{ fontSize: 13 }}>Use the booking panel to schedule your first consultation</div>
              </div>
            ) : (
              <table style={P.table}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Medical Officer', 'Date Scheduled', 'Time Window', 'Status', 'Actions Control'].map(h => <th key={h} style={P.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {myAppointments.map(appt => (
                    <tr key={appt.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={P.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {appt.doctor_name.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{appt.doctor_name}</span>
                        </div>
                      </td>
                      <td style={{ ...P.td, color: '#6b7280', fontSize: 13 }}>{appt.date}</td>
                      <td style={P.td}><span style={{ background: '#f3f4f6', color: '#374151', padding: '5px 11px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{appt.start_time} – {appt.end_time}</span></td>
                      <td style={P.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: appt.status === 'CONFIRMED' ? '#16a34a' : '#6b7280', background: appt.status === 'CONFIRMED' ? '#f0fdf4' : '#f3f4f6', border: `1px solid ${appt.status === 'CONFIRMED' ? '#bbf7d0' : '#e5e7eb'}`, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: appt.status === 'CONFIRMED' ? '#16a34a' : '#9ca3af', display: 'inline-block' }} />
                          {appt.status}
                        </span>
                      </td>
                      <td style={P.td}>
                        <button onClick={() => handleRescheduleClick(appt)} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginRight: 6 }}>Reschedule</button>
                        <button onClick={() => handleCancelClick(appt)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Cancel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const P = {
  card: { background: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6', overflow: 'hidden' },
  cardTop: { background: '#eff6ff', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #dbeafe' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#111827' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardBody: { padding: '22px' },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 },
  inp: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#111827', boxSizing: 'border-box', background: '#fafafa', outline: 'none' },
  sel: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#111827', boxSizing: 'border-box', background: '#fafafa', outline: 'none' },
  searchBtn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: 'white', border: 'none', borderRadius: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', marginTop: 4 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' },
  td: { padding: '13px 14px', verticalAlign: 'middle' },
};

export default PatientDashboard;