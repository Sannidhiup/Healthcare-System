import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './Navbar';

function AdminDashboard() {
  const token = localStorage.getItem('token');
  const [activeTab, setActiveTab] = useState('slots');
  const [notification, setNotification] = useState({ show: false, message: '', isError: false });
  const [deleteModal, setDeleteModal] = useState({ show: false, type: '', id: null, message: '' });

  const showStatusNotification = (msg, isErr = false) => {
    setNotification({ show: true, message: msg, isError: isErr });
    setTimeout(() => setNotification({ show: false, message: '', isError: false }), 4000);
  };

  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [activeSlots, setActiveSlots] = useState([]);

  const [docId, setDocId] = useState('');
  const [viewDate, setViewDate] = useState('');
  const [slots, setSlots] = useState([{ date: '', start_time: '', end_time: '' }]);
  const [leftSearchQuery, setLeftSearchQuery] = useState('');
  const [rightSearchQuery, setRightSearchQuery] = useState('');

  const [hospForm, setHospForm] = useState({ id: null, name: '', location: '' });
  const [deptForm, setDeptForm] = useState({ id: null, name: '', hospital_id: '' });
  const [docForm, setDocForm] = useState({ id: null, name: '', email: '', password: '', phone: '', specialization: '', years_of_experience: '', hospital_id: '', department_id: '' });

  const [bulkHospitalsInput, setBulkHospitalsInput] = useState('');
  const [bulkDepartmentsInput, setBulkDepartmentsInput] = useState('');

  const loadSystemData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8001/system-overview');
      setHospitals(res.data.hospitals || []);
      setDoctors(res.data.doctors || []);
      setDepartments(res.data.departments || []);
    } catch (err) { console.error("Error fetching data from system-overview"); }
  };

  useEffect(() => { loadSystemData(); }, []);

  const addSlotRow = () => setSlots([...slots, { date: '', start_time: '', end_time: '' }]);
  const removeSlotRow = (index) => setSlots(slots.filter((_, i) => i !== index));
  const updateSlotRow = (index, field, value) => { const updated = [...slots]; updated[index][field] = value; setSlots(updated); };

  const handleSaveSlots = async () => {
    if (!docId) { showStatusNotification("Please search and select a target doctor on the creation panel first.", true); return; }
    const hasEmptyFields = slots.some(s => !s.date || !s.start_time || !s.end_time);
    if (hasEmptyFields) { showStatusNotification("Please fill out Date, Start Time, and End Time for all rows.", true); return; }
    const dataToSend = slots.map(s => ({ doctor_id: parseInt(docId), start_date: s.date, end_date: s.date, start_time: s.start_time, end_time: s.end_time }));
    try {
      await axios.post('http://127.0.0.1:8001/admin/generate-slots', dataToSend, { headers: { Authorization: `Bearer ${token}` } });
      showStatusNotification(`Successfully generated 30-minute intervals automatically for Doctor ID: ${docId}`);
      setSlots([{ date: '', start_time: '', end_time: '' }]);
      if (viewDate) handleFetchSlots();
    } catch { showStatusNotification("Failed to save automated slots. Check backend loop syntax parameters.", true); }
  };

  const handleFetchSlots = async () => {
    if (!docId || !viewDate) { showStatusNotification("Please select a Doctor and specify a filtering Target Date first.", true); return; }
    try {
      const res = await axios.get(`http://127.0.0.1:8001/slots/${docId}?date=${viewDate}`);
      setActiveSlots(res.data);
    } catch { showStatusNotification("Could not find slot records matching specified variables.", true); }
  };

  const triggerDeleteConfirmation = (type, id, msg) => setDeleteModal({ show: true, type, id, message: msg });

  const executeConfirmedDelete = async () => {
    const { type, id } = deleteModal;
    setDeleteModal({ show: false, type: '', id: null, message: '' });
    try {
      if (type === 'slot') { await axios.delete(`http://127.0.0.1:8001/slots/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Slot entry deleted cleanly."); handleFetchSlots(); }
      else if (type === 'hospital') { await axios.delete(`http://127.0.0.1:8001/hospitals/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Hospital reference system and child nodes pruned."); loadSystemData(); }
      else if (type === 'department') { await axios.delete(`http://127.0.0.1:8001/departments/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Target diagnostic department entity dropped."); loadSystemData(); }
      else if (type === 'doctor') { await axios.delete(`http://127.0.0.1:8001/doctors/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Doctor practitioner profiling block stripped out."); loadSystemData(); }
    } catch { showStatusNotification("Execution failed. Record cascade constraint may be locked.", true); }
  };

  const filteredDoctorsLeft = doctors.filter(d => d.name.toLowerCase().includes(leftSearchQuery.toLowerCase()) || d.id.toString() === leftSearchQuery);
  const filteredDoctorsRight = doctors.filter(d => d.name.toLowerCase().includes(rightSearchQuery.toLowerCase()) || d.id.toString() === rightSearchQuery);
  const selectDoctorLeft = (doctor) => { setDocId(doctor.id); setLeftSearchQuery(`${doctor.name} (ID: ${doctor.id})`); };
  const selectDoctorRight = (doctor) => { setDocId(doctor.id); setRightSearchQuery(`${doctor.name} (ID: ${doctor.id})`); };

  const handleHospitalSubmit = async (e) => {
    e.preventDefault();
    try {
      if (hospForm.id) { await axios.put(`http://127.0.0.1:8001/hospitals/${hospForm.id}`, { name: hospForm.name, location: hospForm.location }, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Hospital data modified successfully."); }
      else { await axios.post('http://127.0.0.1:8001/hospitals/bulk', [{ name: hospForm.name, location: hospForm.location }], { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification(`Hospital "${hospForm.name}" registered safely.`); }
      setHospForm({ id: null, name: '', location: '' }); loadSystemData();
    } catch { showStatusNotification("Hospital transaction processing failed.", true); }
  };

  const handleBulkHospitalSubmit = async (e) => {
    e.preventDefault();
    if (!bulkHospitalsInput.trim()) return;
    const rows = bulkHospitalsInput.trim().split('\n');
    const hospitalPayloadArray = rows.map(row => { const parts = row.split(','); return { name: parts[0]?.trim() || '', location: parts[1]?.trim() || '' }; });
    try {
      await axios.post('http://127.0.0.1:8001/hospitals/bulk', hospitalPayloadArray, { headers: { Authorization: `Bearer ${token}` } });
      showStatusNotification(`Bulk saved ${hospitalPayloadArray.length} clinical facilities successfully.`);
      setBulkHospitalsInput(''); loadSystemData();
    } catch { showStatusNotification("Bulk operational load failed.", true); }
  };

  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: deptForm.name, hospital_id: parseInt(deptForm.hospital_id) };
    try {
      if (deptForm.id) { await axios.put(`http://127.0.0.1:8001/departments/${deptForm.id}`, payload, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Department metrics modified successfully."); }
      else { await axios.post('http://127.0.0.1:8001/departments', payload, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification(`Department division "${deptForm.name}" activated.`); }
      setDeptForm({ id: null, name: '', hospital_id: '' }); loadSystemData();
    } catch { showStatusNotification("Department sync transaction error.", true); }
  };

  const handleBulkDepartmentSubmit = async (e) => {
    e.preventDefault();
    if (!deptForm.hospital_id || !bulkDepartmentsInput.trim()) { showStatusNotification("Provide a valid Hospital ID inside the form field first.", true); return; }
    const lines = bulkDepartmentsInput.trim().split('\n');
    try {
      for (let line of lines) { if (line.trim()) await axios.post('http://127.0.0.1:8001/departments', { name: line.trim(), hospital_id: parseInt(deptForm.hospital_id) }, { headers: { Authorization: `Bearer ${token}` } }); }
      showStatusNotification(`Successfully generated all line-pasted departments.`);
      setBulkDepartmentsInput(''); loadSystemData();
    } catch { showStatusNotification("Failed to finalize multi-row additions.", true); }
  };

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: docForm.name, email: docForm.email, password: docForm.password || "dummy123", phone: docForm.phone, role: "DOCTOR", specialization: docForm.specialization, years_of_experience: parseInt(docForm.years_of_experience), hospital_id: parseInt(docForm.hospital_id), department_id: parseInt(docForm.department_id) };
    try {
      if (docForm.id) { await axios.put(`http://127.0.0.1:8001/doctors/${docForm.id}`, payload, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification(`Dr. ${docForm.name}'s profile criteria updated.`); }
      else { await axios.post('http://127.0.0.1:8001/doctors', payload, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification(`Dr. ${docForm.name} integrated into active directory.`); }
      setDocForm({ id: null, name: '', email: '', password: '', phone: '', specialization: '', years_of_experience: '', hospital_id: '', department_id: '' }); loadSystemData();
    } catch { showStatusNotification("Personnel sync validation rejected.", true); }
  };

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <Navbar />

      {/* ── NOTIFICATION TOAST ── */}
      {notification.show && (
        <div style={{
          position: 'fixed', top: 76, right: 24, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          backgroundColor: notification.isError ? '#fff1f1' : '#f0fdf4',
          color: notification.isError ? '#c0392b' : '#166534',
          border: `1.5px solid ${notification.isError ? '#fca5a5' : '#86efac'}`,
          maxWidth: 420, animation: 'slideIn 0.3s ease',
        }}>
          <span style={{ fontSize: 18 }}>{notification.isError ? '⚠️' : '✅'}</span>
          {notification.message}
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteModal.show && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '36px 40px', width: 380, boxShadow: '0 25px 60px rgba(0,0,0,0.20)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 26 }}>🗑️</div>
            <h3 style={{ margin: '0 0 10px', color: '#111827', fontSize: 18, fontWeight: 700 }}>Confirm Deletion</h3>
            <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>{deleteModal.message}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteModal({ show: false, type: '', id: null, message: '' })}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={executeConfirmedDelete}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 28px', display: 'flex', gap: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {[
          { key: 'slots',       emoji: '📅', label: 'Doctor Slot Entries' },
          { key: 'hospitals',   emoji: '🏢', label: 'Hospitals Onboarding' },
          { key: 'departments', emoji: '🗂️', label: 'Departments Onboarding' },
          { key: 'doctors',     emoji: '🩺', label: 'Doctors Directory' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '14px 18px', fontSize: 13.5, background: 'none', border: 'none',
            borderBottom: activeTab === t.key ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === t.key ? '#2563eb' : '#6b7280',
            fontWeight: activeTab === t.key ? 700 : 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 28px' }}>

        {/* ════════════════════════════════
            TAB 1 — DOCTOR SLOT ENTRIES
        ════════════════════════════════ */}
        {activeTab === 'slots' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* LEFT — Create Slots */}
            <div style={C.card}>
              <div style={C.cardTop('#eff6ff', '#2563eb')}>
                <span style={{ fontSize: 22 }}>📅</span>
                <div>
                  <div style={C.cardTitle}>Doctor Slot Entries Engine</div>
                  <div style={C.cardSub}>Auto-generate 30-min appointment blocks</div>
                </div>
              </div>
              <div style={C.cardBody}>
                <div style={C.fieldWrap}>
                  <label style={C.label}>Search Doctor by Name (For Creation)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={C.searchIco}>🔍</span>
                    <input type="text" placeholder="Type name or ID to select doctor for slots..."
                      value={leftSearchQuery}
                      onChange={e => { setLeftSearchQuery(e.target.value); if (!e.target.value) setDocId(''); }}
                      style={{ ...C.inp, paddingLeft: 36 }} />
                    {leftSearchQuery && !docId && filteredDoctorsLeft.length > 0 && (
                      <div style={C.dropdown}>
                        {filteredDoctorsLeft.map(d => (
                          <div key={d.id} onClick={() => selectDoctorLeft(d)} style={C.dropRow}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            <strong style={{ color: '#111827' }}>{d.name}</strong>
                            <span style={{ color: '#9ca3af', fontSize: 12 }}> · {d.specialization}</span>
                            <span style={C.idPill}>ID {d.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ margin: '20px 0 12px' }}>
                  <div style={C.sectionLabel}>Proposed Allocation Slots</div>
                </div>

                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 8, marginBottom: 6, padding: '0 2px' }}>
                  {['Slot Date', 'Start Time Block', 'End Time Block', ''].map((h, i) => (
                    <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                  ))}
                </div>

                {slots.map((slot, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input type="date" value={slot.date} onChange={e => updateSlotRow(index, 'date', e.target.value)} style={C.slotInp} />
                    <input type="time" value={slot.start_time} onChange={e => updateSlotRow(index, 'start_time', e.target.value)} style={C.slotInp} />
                    <input type="time" value={slot.end_time} onChange={e => updateSlotRow(index, 'end_time', e.target.value)} style={C.slotInp} />
                    <button onClick={() => removeSlotRow(index)} style={C.removeBtn} title="Remove row">✕</button>
                  </div>
                ))}

                <button onClick={addSlotRow} style={C.addRowBtn}>＋ Add New Slot Row</button>
                <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '20px 0' }} />
                <button onClick={handleSaveSlots} style={C.savePrimary}>💾 Save Slots</button>
              </div>
            </div>

            {/* RIGHT — Monitor */}
            <div style={C.card}>
              <div style={C.cardTop('#f0fdf4', '#16a34a')}>
                <span style={{ fontSize: 22 }}>👁️</span>
                <div>
                  <div style={C.cardTitle}>Monitor & Cancel Slots</div>
                  <div style={C.cardSub}>Audit and manage existing slot records</div>
                </div>
              </div>
              <div style={C.cardBody}>
                <div style={C.fieldWrap}>
                  <label style={C.label}>Search Doctor by Name (For Auditing)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={C.searchIco}>🔍</span>
                    <input type="text" placeholder="Type name or ID..."
                      value={rightSearchQuery}
                      onChange={e => { setRightSearchQuery(e.target.value); if (!e.target.value) setDocId(''); }}
                      style={{ ...C.inp, paddingLeft: 36 }} />
                    {rightSearchQuery && !docId && filteredDoctorsRight.length > 0 && (
                      <div style={C.dropdown}>
                        {filteredDoctorsRight.map(d => (
                          <div key={d.id} onClick={() => selectDoctorRight(d)} style={C.dropRow}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            <strong style={{ color: '#111827' }}>{d.name}</strong>
                            <span style={{ color: '#9ca3af', fontSize: 12 }}> · {d.specialization}</span>
                            <span style={C.idPill}>ID {d.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end', margin: '16px 0' }}>
                  <div>
                    <label style={C.label}>Filter Target Date Context</label>
                    <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} style={{ ...C.inp, marginBottom: 0 }} />
                  </div>
                  <button onClick={handleFetchSlots} style={{ height: 42, padding: '0 20px', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                    🔍 Fetch Slots
                  </button>
                </div>

                {activeSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                    <div style={{ fontSize: 13 }}>Search a doctor and date to view slots</div>
                  </div>
                ) : (
                  <table style={C.table}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Time Window', 'Booking Status', 'Action'].map(h => <th key={h} style={C.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {activeSlots.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ ...C.td, fontWeight: 600, color: '#111827' }}>{s.start_time} – {s.end_time}</td>
                          <td style={C.td}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.is_booked ? '#fef2f2' : '#f0fdf4', color: s.is_booked ? '#dc2626' : '#16a34a', border: `1px solid ${s.is_booked ? '#fecaca' : '#bbf7d0'}` }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.is_booked ? '#dc2626' : '#16a34a', display: 'inline-block' }} />
                              {s.is_booked ? 'Booked' : 'Available'}
                            </span>
                          </td>
                          <td style={C.td}>
                            <button onClick={() => triggerDeleteConfirmation('slot', s.id, 'Are you sure you want to permanently delete this slot?')}
                              style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 2 — HOSPITALS ONBOARDING
        ════════════════════════════════ */}
        {activeTab === 'hospitals' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div style={C.card}>
                <div style={C.cardTop('#eff6ff', '#2563eb')}>
                  <span style={{ fontSize: 22 }}>{hospForm.id ? '✏️' : '🏢'}</span>
                  <div>
                    <div style={C.cardTitle}>{hospForm.id ? 'Edit Facility Profile' : 'Add Single Hospital'}</div>
                    <div style={C.cardSub}>Register a new hospital facility</div>
                  </div>
                </div>
                <div style={C.cardBody}>
                  <form onSubmit={handleHospitalSubmit}>
                    <div style={C.fieldWrap}><label style={C.label}>Hospital Name</label><input type="text" required placeholder="e.g. Apollo Hospital" value={hospForm.name} onChange={e => setHospForm({ ...hospForm, name: e.target.value })} style={C.inp} /></div>
                    <div style={C.fieldWrap}><label style={C.label}>Location</label><input type="text" required placeholder="e.g. Hebbal, Bangalore" value={hospForm.location} onChange={e => setHospForm({ ...hospForm, location: e.target.value })} style={C.inp} /></div>
                    <button type="submit" style={C.savePrimary}>💾 {hospForm.id ? 'Update Hospital' : 'Save Hospital'}</button>
                    {hospForm.id && <button type="button" onClick={() => setHospForm({ id: null, name: '', location: '' })} style={C.cancelBtn}>✕ Cancel Edit</button>}
                  </form>
                </div>
              </div>

              {!hospForm.id && (
                <div style={C.card}>
                  <div style={C.cardTop('#f0fdf4', '#16a34a')}>
                    <span style={{ fontSize: 22 }}>📋</span>
                    <div>
                      <div style={C.cardTitle}>Or Paste List Rows Alternatively</div>
                      <div style={C.cardSub}>Format: Name, Location (one per line)</div>
                    </div>
                  </div>
                  <div style={C.cardBody}>
                    <form onSubmit={handleBulkHospitalSubmit}>
                      <textarea rows="4" placeholder={"Apollo, Hebbal\nKC Hospital, RR Nagar"} value={bulkHospitalsInput} onChange={e => setBulkHospitalsInput(e.target.value)} style={{ ...C.inp, height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                      <button type="submit" style={C.savePrimary}>💾 Save</button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            <div style={C.card}>
              <div style={C.cardTop('#faf5ff', '#7c3aed')}>
                <span style={{ fontSize: 22 }}>🏗️</span>
                <div>
                  <div style={C.cardTitle}>Infrastructure Registry</div>
                  <div style={C.cardSub}>{hospitals.length} facilities registered</div>
                </div>
              </div>
              <div style={C.cardBody}>
                <table style={C.table}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['ID', 'Hospital Facility', 'Location', 'Actions'].map(h => <th key={h} style={C.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {hospitals.map(h => (
                      <tr key={h.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={C.td}><span style={C.idChip}>{h.id}</span></td>
                        <td style={{ ...C.td, fontWeight: 700, color: '#111827' }}>{h.name}</td>
                        <td style={{ ...C.td, color: '#6b7280' }}>📍 {h.location}</td>
                        <td style={C.td}>
                          <button onClick={() => setHospForm(h)} style={C.editBtn}>Edit</button>
                          <button onClick={() => triggerDeleteConfirmation('hospital', h.id, `Delete "${h.name}"?`)} style={C.delBtn}>Remove</button>
                        </td>
                      </tr>
                    ))}
                    {hospitals.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: '36px 0', fontSize: 13 }}>No hospitals registered yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 3 — DEPARTMENTS ONBOARDING
        ════════════════════════════════ */}
        {activeTab === 'departments' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div style={C.card}>
                <div style={C.cardTop('#fffbeb', '#d97706')}>
                  <span style={{ fontSize: 22 }}>{deptForm.id ? '✏️' : '🗂️'}</span>
                  <div>
                    <div style={C.cardTitle}>{deptForm.id ? 'Edit Department Profile' : 'Add Single Department'}</div>
                    <div style={C.cardSub}>Register a new hospital division</div>
                  </div>
                </div>
                <div style={C.cardBody}>
                  <form onSubmit={handleDepartmentSubmit}>
                    <div style={C.fieldWrap}><label style={C.label}>Department Name</label><input type="text" required placeholder="e.g. Cardiology" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} style={C.inp} /></div>
                    <div style={C.fieldWrap}><label style={C.label}>Parent Hospital ID</label><input type="number" required placeholder="e.g. 1" value={deptForm.hospital_id} onChange={e => setDeptForm({ ...deptForm, hospital_id: e.target.value })} style={C.inp} /></div>
                    <button type="submit" style={C.savePrimary}>💾 {deptForm.id ? 'Update Department' : 'Save Department'}</button>
                    {deptForm.id && <button type="button" onClick={() => setDeptForm({ id: null, name: '', hospital_id: '' })} style={C.cancelBtn}>✕ Cancel Edit</button>}
                  </form>
                </div>
              </div>

              {!deptForm.id && (
                <div style={C.card}>
                  <div style={C.cardTop('#f0fdf4', '#16a34a')}>
                    <span style={{ fontSize: 22 }}>📋</span>
                    <div>
                      <div style={C.cardTitle}>Or Paste List Strings Alternatively</div>
                      <div style={C.cardSub}>One department name per line</div>
                    </div>
                  </div>
                  <div style={C.cardBody}>
                    <form onSubmit={handleBulkDepartmentSubmit}>
                      <textarea rows="4" placeholder={"Cardiology\nNeurology\nRadiology"} value={bulkDepartmentsInput} onChange={e => setBulkDepartmentsInput(e.target.value)} style={{ ...C.inp, height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                      <button type="submit" style={C.savePrimary}>💾 Save</button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            <div style={C.card}>
              <div style={C.cardTop('#faf5ff', '#7c3aed')}>
                <span style={{ fontSize: 22 }}>🏛️</span>
                <div>
                  <div style={C.cardTitle}>Department Division Operations</div>
                  <div style={C.cardSub}>{departments.length} departments registered</div>
                </div>
              </div>
              <div style={C.cardBody}>
                <table style={C.table}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['ID', 'Department Name', 'Hospital ID', 'Actions'].map(h => <th key={h} style={C.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(d => {
                      const dColors = { Cardiology: ['#fff7ed','#ea580c'], Neurology: ['#faf5ff','#7c3aed'], Radiology: ['#f0fdf4','#16a34a'] };
                      const [bg, fg] = dColors[d.name] || ['#f1f5f9', '#475569'];
                      return (
                        <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={C.td}><span style={C.idChip}>{d.id}</span></td>
                          <td style={C.td}><span style={{ background: bg, color: fg, borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '4px 12px', border: `1px solid ${fg}30` }}>{d.name}</span></td>
                          <td style={C.td}><span style={C.idChip}>{d.hospital_id}</span></td>
                          <td style={C.td}>
                            <button onClick={() => setDeptForm(d)} style={C.editBtn}>Edit</button>
                            <button onClick={() => triggerDeleteConfirmation('department', d.id, `Delete department node "${d.name}"?`)} style={C.delBtn}>Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                    {departments.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: '36px 0', fontSize: 13 }}>No departments registered yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 4 — DOCTORS DIRECTORY
        ════════════════════════════════ */}
        {activeTab === 'doctors' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>

            <div style={C.card}>
              <div style={C.cardTop('#eff6ff', '#2563eb')}>
                <span style={{ fontSize: 22 }}>{docForm.id ? '✏️' : '🩺'}</span>
                <div>
                  <div style={C.cardTitle}>{docForm.id ? 'Edit Doctor Profile' : 'Register Doctor Account'}</div>
                  <div style={C.cardSub}>Create or update practitioner record</div>
                </div>
              </div>
              <div style={C.cardBody}>
                <form onSubmit={handleDoctorSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                    <div style={{ ...C.fieldWrap, gridColumn: '1 / 3' }}><label style={C.label}>Full Name</label><input type="text" required placeholder="Dr. Full Name" value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} style={C.inp} /></div>
                    <div style={C.fieldWrap}><label style={C.label}>Email</label><input type="email" required placeholder="doctor@email.com" value={docForm.email} onChange={e => setDocForm({ ...docForm, email: e.target.value })} style={C.inp} /></div>
                    <div style={C.fieldWrap}><label style={C.label}>Phone</label><input type="text" required placeholder="+91 ..." value={docForm.phone} onChange={e => setDocForm({ ...docForm, phone: e.target.value })} style={C.inp} /></div>
                    {!docForm.id && <div style={{ ...C.fieldWrap, gridColumn: '1 / 3' }}><label style={C.label}>Password</label><input type="password" required placeholder="••••••••" value={docForm.password} onChange={e => setDocForm({ ...docForm, password: e.target.value })} style={C.inp} /></div>}
                    <div style={C.fieldWrap}><label style={C.label}>Specialization</label><input type="text" required placeholder="e.g. MBBS" value={docForm.specialization} onChange={e => setDocForm({ ...docForm, specialization: e.target.value })} style={C.inp} /></div>
                    <div style={C.fieldWrap}><label style={C.label}>Experience (Years)</label><input type="number" required placeholder="10" value={docForm.years_of_experience} onChange={e => setDocForm({ ...docForm, years_of_experience: e.target.value })} style={C.inp} /></div>
                    <div style={C.fieldWrap}><label style={C.label}>Hospital ID</label><input type="number" required placeholder="1" value={docForm.hospital_id} onChange={e => setDocForm({ ...docForm, hospital_id: e.target.value })} style={C.inp} /></div>
                    <div style={C.fieldWrap}><label style={C.label}>Department ID</label><input type="number" required placeholder="1" value={docForm.department_id} onChange={e => setDocForm({ ...docForm, department_id: e.target.value })} style={C.inp} /></div>
                  </div>
                  <button type="submit" style={C.savePrimary}>💾 {docForm.id ? 'Update Doctor' : 'Register Doctor'}</button>
                  {docForm.id && <button type="button" onClick={() => setDocForm({ id: null, name: '', email: '', password: '', phone: '', specialization: '', years_of_experience: '', hospital_id: '', department_id: '' })} style={C.cancelBtn}>✕ Cancel Edit</button>}
                </form>
              </div>
            </div>

            <div style={C.card}>
              <div style={C.cardTop('#faf5ff', '#7c3aed')}>
                <span style={{ fontSize: 22 }}>🪪</span>
                <div>
                  <div style={C.cardTitle}>Medical Staff Directory</div>
                  <div style={C.cardSub}>{doctors.length} practitioners registered</div>
                </div>
              </div>
              <div style={C.cardBody}>
                <table style={C.table}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['ID', 'Dr. Name', 'Specialization', 'Exp', 'Hosp ID', 'Dept ID', 'Actions'].map(h => <th key={h} style={C.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={C.td}><span style={C.idChip}>{d.id}</span></td>
                        <td style={C.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              {d.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, color: '#111827', fontSize: 13 }}>{d.name}</span>
                          </div>
                        </td>
                        <td style={C.td}><span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 20, fontSize: 12, fontWeight: 600, padding: '3px 10px' }}>{d.specialization}</span></td>
                        <td style={{ ...C.td, color: '#6b7280', fontSize: 13 }}>{d.years_of_experience} Yrs</td>
                        <td style={C.td}><span style={C.idChip}>{d.hospital_id}</span></td>
                        <td style={C.td}><span style={C.idChip}>{d.department_id}</span></td>
                        <td style={C.td}>
                          <button onClick={() => setDocForm(d)} style={C.editBtn}>Edit</button>
                          <button onClick={() => triggerDeleteConfirmation('doctor', d.id, `Delete Dr. ${d.name}?`)} style={C.delBtn}>Remove</button>
                        </td>
                      </tr>
                    ))}
                    {doctors.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '36px 0', fontSize: 13 }}>No doctors registered yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SHARED STYLE SYSTEM ──
const C = {
  card: { background: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6', overflow: 'hidden' },
  cardTop: (bg, accent) => ({ background: bg, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${accent}20` }),
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#111827' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardBody: { padding: '20px 22px' },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 },
  inp: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#111827', boxSizing: 'border-box', background: '#fafafa', outline: 'none', transition: 'border-color 0.15s' },
  slotInp: { width: '100%', padding: '9px 10px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, color: '#111827', boxSizing: 'border-box', background: '#fafafa', outline: 'none' },
  searchIco: { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 200, overflowY: 'auto', marginTop: 4 },
  dropRow: { padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid #f9fafb', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.1s' },
  idPill: { marginLeft: 'auto', background: '#eff6ff', color: '#2563eb', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 9px' },
  removeBtn: { width: 34, height: 34, borderRadius: 8, border: '1.5px solid #fee2e2', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  addRowBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2563eb', background: '#eff6ff', border: '1.5px dashed #bfdbfe', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, marginTop: 4 },
  savePrimary: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', marginTop: 4 },
  cancelBtn: { width: '100%', marginTop: 10, padding: '11px', background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' },
  td: { padding: '12px 14px', verticalAlign: 'middle' },
  idChip: { display: 'inline-block', background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' },
  editBtn: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginRight: 6 },
  delBtn: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
};

export default AdminDashboard;
