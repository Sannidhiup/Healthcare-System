import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Navbar from './Navbar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

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
  
  const [patients, setPatients] = useState([]);
  const [patientEditModal, setPatientEditModal] = useState({ show: false, data: null });

  const [docId, setDocId] = useState('');
  const [selectedDoctorData, setSelectedDoctorData] = useState(null);
  const [viewDate, setViewDate] = useState('');
  const [slots, setSlots] = useState([{ date: '', start_time: '', end_time: '' }]);
  const [leftSearchQuery, setLeftSearchQuery] = useState('');
  const [rightSearchQuery, setRightSearchQuery] = useState('');

  const [slotFilterHospitalId, setSlotFilterHospitalId] = useState('');
  const [slotFilterDepartmentId, setSlotFilterDepartmentId] = useState('');

  const [hospForm, setHospForm] = useState({ id: null, name: '', location: '' });
  const [deptForm, setDeptForm] = useState({ id: null, name: '', hospital_id: '' });
  const [docForm, setDocForm] = useState({ 
    id: null, name: '', email: '', password: '', phone: '', 
    specialization: '', years_of_experience: '', hospital_id: '', department_ids: [] 
  });

  const [bulkHospitalsInput, setBulkHospitalsInput] = useState('');
  const [bulkDepartmentsInput, setBulkDepartmentsInput] = useState('');

  // --- LAZY LOADING IMPLEMENTATION ---
  // Ref-based load/loading flags avoid the stale-closure problem of checking
  // `state.length === 0` (which caused duplicate parallel fetches whenever
  // multiple loaders ran together, e.g. on the default 'slots' tab).
  const hospitalsRef = useRef({ loaded: false, loading: false });
  const departmentsRef = useRef({ loaded: false, loading: false });
  const doctorsRef = useRef({ loaded: false, loading: false });
  const patientsRef = useRef({ loaded: false, loading: false });

  const loadHospitals = async (force = false) => {
    if (hospitalsRef.current.loading) return;
    if (hospitalsRef.current.loaded && !force) return;
    hospitalsRef.current.loading = true;
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/hospitals`, { headers: { Authorization: `Bearer ${token}` } });
      setHospitals(res.data || []);
      hospitalsRef.current.loaded = true;
    } catch (err) { console.error("Error fetching hospitals"); }
    finally { hospitalsRef.current.loading = false; }
  };

  const loadDepartments = async (force = false) => {
    if (departmentsRef.current.loading) return;
    if (departmentsRef.current.loaded && !force) return;
    departmentsRef.current.loading = true;
    try {
      // Departments usually need Hospital data to map names, so load both
      if (!hospitalsRef.current.loaded) await loadHospitals();
      const res = await axios.get(`${API_BASE_URL}/admin/departments`, { headers: { Authorization: `Bearer ${token}` } });
      setDepartments(res.data || []);
      departmentsRef.current.loaded = true;
    } catch (err) { console.error("Error fetching departments"); }
    finally { departmentsRef.current.loading = false; }
  };

  const loadDoctors = async (force = false) => {
    if (doctorsRef.current.loading) return;
    if (doctorsRef.current.loaded && !force) return;
    doctorsRef.current.loading = true;
    try {
      // Doctors form needs Hospitals and Departments, so load them if empty
      if (!hospitalsRef.current.loaded) await loadHospitals();
      if (!departmentsRef.current.loaded) await loadDepartments();
      const res = await axios.get(`${API_BASE_URL}/admin/doctors`, { headers: { Authorization: `Bearer ${token}` } });
      setDoctors(res.data || []);
      doctorsRef.current.loaded = true;
    } catch (err) { console.error("Error fetching doctors"); }
    finally { doctorsRef.current.loading = false; }
  };

  const loadPatients = async (force = false) => {
    if (patientsRef.current.loading) return;
    if (patientsRef.current.loaded && !force) return;
    patientsRef.current.loading = true;
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/patients`, { headers: { Authorization: `Bearer ${token}` } });
      setPatients(res.data || []);
      patientsRef.current.loaded = true;
    } catch (err) { console.error("Error fetching patients"); }
    finally { patientsRef.current.loading = false; }
  };

  // Effect triggers ONLY when activeTab changes
  useEffect(() => {
    if (activeTab === 'hospitals') loadHospitals();
    if (activeTab === 'departments') loadDepartments();
    if (activeTab === 'doctors') loadDoctors();
    if (activeTab === 'patients') loadPatients();
    if (activeTab === 'slots') {
      // Slots tab needs hospital, dept, and doctor data for the dropdowns
      loadHospitals();
      loadDepartments();
      loadDoctors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


  const addSlotRow = () => setSlots([...slots, { date: '', start_time: '', end_time: '' }]);
  const removeSlotRow = (index) => setSlots(slots.filter((_, i) => i !== index));
  const updateSlotRow = (index, field, value) => { const updated = [...slots]; updated[index][field] = value; setSlots(updated); };

  const handleSaveSlots = async () => {
    if (!docId) { showStatusNotification("Please search and select a target doctor on the creation panel first.", true); return; }
    const hasEmptyFields = slots.some(s => !s.date || !s.start_time || !s.end_time);
    if (hasEmptyFields) { showStatusNotification("Please fill out Date, Start Time, and End Time for all rows.", true); return; }
    const dataToSend = slots.map(s => ({ doctor_id: parseInt(docId), start_date: s.date, end_date: s.date, start_time: s.start_time, end_time: s.end_time }));
    try {
      await axios.post(`${API_BASE_URL}/admin/generate-slots`, dataToSend, { headers: { Authorization: `Bearer ${token}` } });
      
      const doctorName = selectedDoctorData ? selectedDoctorData.name : `ID: ${docId}`;
      showStatusNotification(`Successfully created slots for ${doctorName}`);
      
      setSlots([{ date: '', start_time: '', end_time: '' }]);
      if (viewDate) handleFetchSlots();
    } catch { showStatusNotification("Failed to save automated slots.", true); }
  };

  const handleFetchSlots = async () => {
    if (!docId || !viewDate) { showStatusNotification("Please select a Doctor and specify a filtering Target Date first.", true); return; }
    try {
      const res = await axios.get(`${API_BASE_URL}/slots/${docId}?date=${viewDate}`);
      setActiveSlots(res.data);
    } catch { showStatusNotification("Could not find slot records matching specified variables.", true); }
  };

  const triggerDeleteConfirmation = (type, id, msg) => setDeleteModal({ show: true, type, id, message: msg });

  const executeConfirmedDelete = async () => {
    const { type, id } = deleteModal;
    setDeleteModal({ show: false, type: '', id: null, message: '' });
    try {
      if (type === 'slot') { await axios.delete(`${API_BASE_URL}/admin/slots/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Slot deleted successfully."); handleFetchSlots(); }
      else if (type === 'hospital') { await axios.delete(`${API_BASE_URL}/admin/hospitals/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Hospital deleted successfully."); loadHospitals(true); }
      else if (type === 'department') { await axios.delete(`${API_BASE_URL}/admin/departments/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Department deleted successfully."); loadDepartments(true); }
      else if (type === 'doctor') { await axios.delete(`${API_BASE_URL}/admin/doctors/${id}`, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Doctor deleted successfully."); loadDoctors(true); }
    } catch { showStatusNotification("Failed to delete record.", true); }
  };

  const filteredDoctorsLeft = doctors.filter(d => {
    const matchesName = d.name.toLowerCase().includes(leftSearchQuery.toLowerCase()) || d.id.toString() === leftSearchQuery;
    const matchesHospital = slotFilterHospitalId ? d.hospital_id === parseInt(slotFilterHospitalId) : true;
    const matchesDept = slotFilterDepartmentId ? d.departments?.some(dept => dept.id === parseInt(slotFilterDepartmentId)) : true;
    
    return matchesName && matchesHospital && matchesDept;
  });

  const filteredDoctorsRight = doctors.filter(d => d.name.toLowerCase().includes(rightSearchQuery.toLowerCase()) || d.id.toString() === rightSearchQuery);
  
  const selectDoctorLeft = (doctor) => { 
    setDocId(doctor.id); 
    setLeftSearchQuery(`${doctor.name}`); 
    setSelectedDoctorData(doctor); 
  };
  
  const selectDoctorRight = (doctor) => { 
    setDocId(doctor.id); 
    setRightSearchQuery(`${doctor.name}`); 
  };

  const handleHospitalSubmit = async (e) => {
    e.preventDefault();
    try {
      if (hospForm.id) { await axios.put(`${API_BASE_URL}/admin/hospitals/${hospForm.id}`, { name: hospForm.name, location: hospForm.location }, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Hospital updated successfully."); }
      else { await axios.post(`${API_BASE_URL}/admin/hospitals/bulk`, [{ name: hospForm.name, location: hospForm.location }], { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification(`Hospital "${hospForm.name}" added successfully.`); }
      setHospForm({ id: null, name: '', location: '' }); loadHospitals(true);
    } catch { showStatusNotification("Failed to save hospital.", true); }
  };

  const handleBulkHospitalSubmit = async (e) => {
    e.preventDefault();
    if (!bulkHospitalsInput.trim()) return;
    const rows = bulkHospitalsInput.trim().split('\n');
    const hospitalPayloadArray = rows.map(row => { const parts = row.split(','); return { name: parts[0]?.trim() || '', location: parts[1]?.trim() || '' }; });
    try {
      await axios.post(`${API_BASE_URL}/admin/hospitals/bulk`, hospitalPayloadArray, { headers: { Authorization: `Bearer ${token}` } });
      showStatusNotification(`Successfully added ${hospitalPayloadArray.length} hospitals.`);
      setBulkHospitalsInput(''); loadHospitals(true);
    } catch { showStatusNotification("Failed to add hospitals in bulk.", true); }
  };

  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: deptForm.name, hospital_id: parseInt(deptForm.hospital_id) };
    try {
      if (deptForm.id) { await axios.put(`${API_BASE_URL}/admin/departments/${deptForm.id}`, payload, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification("Department updated successfully."); }
      else { await axios.post(`${API_BASE_URL}/admin/departments`, payload, { headers: { Authorization: `Bearer ${token}` } }); showStatusNotification(`Department "${deptForm.name}" added successfully.`); }
      setDeptForm({ id: null, name: '', hospital_id: '' }); loadDepartments(true);
    } catch { showStatusNotification("Failed to save department.", true); }
  };

  const handleBulkDepartmentSubmit = async (e) => {
    e.preventDefault();
    if (!deptForm.hospital_id || !bulkDepartmentsInput.trim()) { showStatusNotification("Provide a valid Hospital first.", true); return; }
    const lines = bulkDepartmentsInput.trim().split('\n');
    try {
      for (let line of lines) { if (line.trim()) await axios.post(`${API_BASE_URL}/admin/departments`, { name: line.trim(), hospital_id: parseInt(deptForm.hospital_id) }, { headers: { Authorization: `Bearer ${token}` } }); }
      showStatusNotification(`Successfully added all departments.`);
      setBulkDepartmentsInput(''); loadDepartments(true);
    } catch { showStatusNotification("Failed to add departments in bulk.", true); }
  };

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      name: docForm.name, 
      email: docForm.email, 
      password: docForm.password || "dummy123", 
      phone: docForm.phone, 
      role: "DOCTOR", 
      specialization: docForm.specialization, 
      years_of_experience: parseInt(docForm.years_of_experience), 
      hospital_id: parseInt(docForm.hospital_id), 
      department_ids: docForm.department_ids 
    };
    try {
      if (docForm.id) { 
        await axios.put(`${API_BASE_URL}/admin/doctors/${docForm.id}`, payload, { headers: { Authorization: `Bearer ${token}` } }); 
        showStatusNotification(`${docForm.name} updated successfully.`); 
      }
      else { 
        await axios.post(`${API_BASE_URL}/admin/doctors`, payload, { headers: { Authorization: `Bearer ${token}` } }); 
        showStatusNotification(`${docForm.name} added successfully.`); 
      }
      setDocForm({ id: null, name: '', email: '', password: '', phone: '', specialization: '', years_of_experience: '', hospital_id: '', department_ids: [] }); 
      loadDoctors(true);
    } catch { showStatusNotification("Failed to save doctor.", true); }
  };

  const handlePatientSubmit = async (e) => {
    e.preventDefault();
    const pData = patientEditModal.data;
    try {
      await axios.put(`${API_BASE_URL}/admin/patients/${pData.user_id}`, {
        name: pData.name,
        phone: pData.phone,
        age: parseInt(pData.age),
        blood_group: pData.blood_group
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      showStatusNotification(`Patient ${pData.name} updated successfully.`);
      setPatientEditModal({ show: false, data: null });
      loadPatients(true);
    } catch { showStatusNotification("Failed to update patient details.", true); }
  };

  const deptStyle = (name) => {
    const map = {
      Cardiology:  { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
      Radiology:   { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
      Neurology:   { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
      Orthopedics: { bg: '#F0FDF4', color: '#059669', border: '#A7F3D0' },
    };
    return map[name] || { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
  };

  const avatarGradients = [
    'linear-gradient(135deg,#4F46E5,#7C3AED)',
    'linear-gradient(135deg,#0D9488,#14B8A6)',
    'linear-gradient(135deg,#D97706,#F59E0B)',
    'linear-gradient(135deg,#DC2626,#EF4444)',
    'linear-gradient(135deg,#2563EB,#3B82F6)',
  ];
  const avatarGrad = (id) => avatarGradients[(id - 1) % avatarGradients.length];

  return (
    <div style={{ backgroundColor: '#F0F4FF', minHeight: '100vh', fontFamily: "'Outfit', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');

        * { box-sizing: border-box; }

        input[type="text"]:focus, input[type="email"]:focus,
        input[type="password"]:focus, input[type="number"]:focus,
        input[type="tel"]:focus, input[type="date"]:focus,
        input[type="time"]:focus, textarea:focus, select:focus {
          border-color: #3B82F6 !important;
          background: #fff !important;
          outline: none;
        }

        .cc-tab-btn { transition: all 0.15s; }
        .cc-tab-btn:hover { color: #111827 !important; }

        .cc-tr:hover td { background: #F5F8FF !important; }

        .cc-add-row:hover { background: #EFF6FF !important; }

        .cc-btn-edit:hover  { background: #DBEAFE !important; }
        .cc-btn-del:hover   { background: #FEE2E2 !important; }
        .cc-btn-save:hover  { opacity: 0.92; transform: translateY(-1px); }
        .cc-btn-teal:hover  { opacity: 0.92; transform: translateY(-1px); }

        .cc-dr-drop div:hover { background: #F0F7FF !important; }

        @keyframes ccSlideIn {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .cc-toast { animation: ccSlideIn 0.3s ease; }
        .cc-panel { animation: ccSlideIn 0.2s ease; }
      `}</style>

      <Navbar />

      {/* ── TOAST NOTIFICATION ── */}
      {notification.show && (
        <div className="cc-toast" style={{
          position:'fixed', top:72, right:24, zIndex:9999,
          display:'flex', alignItems:'center', gap:10,
          padding:'12px 18px', borderRadius:12, fontSize:13, fontWeight:600,
          boxShadow:'0 8px 30px rgba(0,0,0,0.12)',
          backgroundColor: notification.isError ? '#FFF1F1' : '#F0FDF4',
          color: notification.isError ? '#B91C1C' : '#166534',
          border:`1.5px solid ${notification.isError ? '#FECACA' : '#86EFAC'}`,
          maxWidth:420,
        }}>
          <i className={`ti ${notification.isError ? 'ti-alert-triangle' : 'ti-circle-check'}`}
             style={{fontSize:18}} />
          {notification.message}
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteModal.show && (
        <div style={{
          position:'fixed', inset:0, backgroundColor:'rgba(11,29,58,0.55)',
          display:'flex', justifyContent:'center', alignItems:'center',
          zIndex:99999, backdropFilter:'blur(4px)',
        }}>
          <div style={{
            background:'white', borderRadius:20, padding:'36px 40px',
            width:380, boxShadow:'0 25px 60px rgba(0,0,0,0.18)', textAlign:'center',
          }}>
            <div style={{
              width:56, height:56, borderRadius:'50%', background:'#FEF2F2',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 18px',
            }}>
              <i className="ti ti-trash" style={{fontSize:26, color:'#EF4444'}} />
            </div>
            <h3 style={{margin:'0 0 10px', color:'#0B1D3A', fontSize:18, fontWeight:700}}>Confirm Deletion</h3>
            <p style={{margin:'0 0 28px', color:'#6B7280', fontSize:14, lineHeight:1.6}}>{deleteModal.message}</p>
            <div style={{display:'flex', gap:12}}>
              <button
                onClick={() => setDeleteModal({ show:false, type:'', id:null, message:'' })}
                style={{flex:1, padding:'11px', borderRadius:10, border:'1.5px solid #E5E7EB', background:'white', color:'#374151', fontWeight:600, cursor:'pointer', fontSize:14, fontFamily:'inherit'}}>
                Cancel
              </button>
              <button
                onClick={executeConfirmedDelete}
                style={{flex:1, padding:'11px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#EF4444,#DC2626)', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:'inherit'}}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PATIENT EDIT MODAL ── */}
      {patientEditModal.show && (
        <div style={{
          position:'fixed', inset:0, backgroundColor:'rgba(11,29,58,0.55)',
          display:'flex', justifyContent:'center', alignItems:'center',
          zIndex:99999, backdropFilter:'blur(4px)',
        }}>
          <div style={{
            background:'white', borderRadius:20, padding:'32px',
            width:'100%', maxWidth:440, boxShadow:'0 25px 60px rgba(0,0,0,0.18)',
          }}>
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:24}}>
              <div style={{width:44, height:44, borderRadius:12, background:'#FCE7F3', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <i className="ti ti-user-edit" style={{fontSize:22, color:'#EC4899'}} />
              </div>
              <div>
                <h3 style={{margin:0, color:'#0B1D3A', fontSize:18, fontWeight:700}}>Edit Patient Profile</h3>
                <p style={{margin:0, color:'#6B7280', fontSize:12, marginTop:2}}>Update database record for {patientEditModal.data?.name}</p>
              </div>
            </div>

            <form onSubmit={handlePatientSubmit}>
              <div style={S.fieldWrap}>
                <label style={S.label}>Full Name</label>
                <input type="text" required
                  value={patientEditModal.data.name} 
                  onChange={e => setPatientEditModal({ ...patientEditModal, data: { ...patientEditModal.data, name: e.target.value } })} 
                  style={S.input} />
              </div>
              <div style={S.fieldWrap}>
                <label style={S.label}>Phone Number</label>
                <input type="text" required
                  value={patientEditModal.data.phone} 
                  onChange={e => setPatientEditModal({ ...patientEditModal, data: { ...patientEditModal.data, phone: e.target.value } })} 
                  style={S.input} />
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24}}>
                <div style={S.fieldWrap}>
                  <label style={S.label}>Age</label>
                  <input type="number" required
                    onWheel={(e) => e.target.blur()}
                    value={patientEditModal.data.age} 
                    onChange={e => setPatientEditModal({ ...patientEditModal, data: { ...patientEditModal.data, age: e.target.value } })} 
                    style={S.input} />
                </div>
                <div style={S.fieldWrap}>
                  <label style={S.label}>Blood Group</label>
                  <input type="text" required
                    value={patientEditModal.data.blood_group} 
                    onChange={e => setPatientEditModal({ ...patientEditModal, data: { ...patientEditModal.data, blood_group: e.target.value } })} 
                    style={S.input} />
                </div>
              </div>
              <div style={{display:'flex', gap:12}}>
                <button type="button" 
                  onClick={() => setPatientEditModal({ show:false, data:null })}
                  style={{...S.btnCancel, flex:1, margin:0}}>
                  Cancel
                </button>
                <button type="submit" style={{...S.btnPrimary, flex:1, margin:0, background:'linear-gradient(135deg,#DB2777,#EC4899)'}}>
                  <i className="ti ti-device-floppy" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div style={{
        background:'white', borderBottom:'1px solid #DDE4F0',
        padding:'0 28px', display:'flex', gap:2, overflowX:'auto',
        boxShadow:'0 1px 6px rgba(11,29,58,0.06)',
        position:'sticky', top:0, zIndex:90,
      }}>
        {[
          { key:'slots',       icon:'ti-calendar-time',     label:'Doctor Slot Entries',    accent:'#3B82F6' },
          { key:'hospitals',   icon:'ti-building-hospital', label:'Hospitals Onboarding',   accent:'#10B981' },
          { key:'departments', icon:'ti-folders',           label:'Departments Onboarding', accent:'#F59E0B' },
          { key:'doctors',     icon:'ti-stethoscope',       label:'Doctors Directory',      accent:'#8B5CF6' },
          { key:'patients',    icon:'ti-users-group',       label:'Patient Management',     accent:'#EC4899' },
        ].map(t => (
          <button key={t.key} className="cc-tab-btn"
            onClick={() => setActiveTab(t.key)}
            style={{
              padding:'14px 18px', fontSize:13, background:'none', border:'none',
              borderBottom: activeTab === t.key ? `2.5px solid ${t.accent}` : '2.5px solid transparent',
              color: activeTab === t.key ? t.accent : '#6B7280',
              fontWeight: activeTab === t.key ? 700 : 500,
              cursor:'pointer', display:'flex', alignItems:'center', gap:7,
              whiteSpace:'nowrap', fontFamily:'inherit',
            }}>
            <span style={{
              width:22, height:22, borderRadius:6, display:'flex',
              alignItems:'center', justifyContent:'center', fontSize:13,
              background: activeTab === t.key ? `${t.accent}15` : '#F3F4F6',
              color: activeTab === t.key ? t.accent : '#9CA3AF',
            }}>
              <i className={`ti ${t.icon}`} />
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:'24px 28px'}}>

        {/* ════════════════════════════════
            TAB 1 — DOCTOR SLOT ENTRIES
        ════════════════════════════════ */}
        {activeTab === 'slots' && (
          <div className="cc-panel">
            {/* KPI Row */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24}}>
              {[
                { label:'Total Slots Today', value: activeSlots.length || '—', sub:'from last fetch', icon:'ti-calendar', accent:'#3B82F6' },
                { label:'Available',         value: activeSlots.filter(s=>!s.is_booked).length || '—', sub:'open for booking', icon:'ti-circle-check', accent:'#10B981' },
                { label:'Booked',            value: activeSlots.filter(s=>s.is_booked).length  || '—', sub:'confirmed appointments', icon:'ti-user-check', accent:'#F59E0B' },
                { label:'Slot Duration',     value:'30 min', sub:'standard block size', icon:'ti-clock', accent:'#8B5CF6' },
              ].map((k,i) => (
                <div key={i} style={{background:'white', borderRadius:12, padding:'16px 18px', border:'1px solid #DDE4F0', boxShadow:'0 1px 4px rgba(11,29,58,0.06)'}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                    <span style={{fontSize:11, fontWeight:600, color:'#8896AC', textTransform:'uppercase', letterSpacing:'0.7px'}}>{k.label}</span>
                    <span style={{width:28,height:28,borderRadius:7,background:`${k.accent}15`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <i className={`ti ${k.icon}`} style={{fontSize:14,color:k.accent}} />
                    </span>
                  </div>
                  <div style={{fontSize:26, fontWeight:700, color:'#0B1D3A', lineHeight:1}}>{k.value}</div>
                  <div style={{fontSize:11, color:'#8896AC', marginTop:5}}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>

              {/* LEFT — Create Slots */}
              <div style={S.card}>
                <div style={S.cardHead('#EFF6FF','#3B82F6')}>
                  <div style={{...S.headIcon, background:'#DBEAFE'}}>
                    <i className="ti ti-calendar-plus" style={{fontSize:18,color:'#3B82F6'}} />
                  </div>
                  <div>
                    <div style={S.cardTitle}>Doctor Slot Entries Engine</div>
                    <div style={S.cardSub}>Filter by Hospital & Dept to select a Doctor</div>
                  </div>
                </div>
                <div style={S.cardBody}>

                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14}}>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>1. Select Hospital</label>
                      <select 
                        value={slotFilterHospitalId} 
                        onChange={e => {
                          setSlotFilterHospitalId(e.target.value);
                          setSlotFilterDepartmentId('');
                          setDocId('');
                          setLeftSearchQuery('');
                          setSelectedDoctorData(null);
                        }} 
                        style={S.input}
                      >
                        <option value="">All Hospitals...</option>
                        {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </div>

                    <div style={S.fieldWrap}>
                      <label style={S.label}>2. Select Department</label>
                      <select 
                        value={slotFilterDepartmentId} 
                        onChange={e => {
                          setSlotFilterDepartmentId(e.target.value);
                          setDocId('');
                          setLeftSearchQuery('');
                          setSelectedDoctorData(null);
                        }} 
                        style={S.input}
                        disabled={!slotFilterHospitalId}
                      >
                        <option value="">All Departments...</option>
                        {departments
                          .filter(d => slotFilterHospitalId ? d.hospital_id === parseInt(slotFilterHospitalId) : true)
                          .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                        }
                      </select>
                    </div>
                  </div>

                  {/* Doctor search */}
                  <div style={S.fieldWrap}>
                    <label style={S.label}>3. Search & Select Doctor</label>
                    <div style={{position:'relative'}}>
                      <i className="ti ti-search" style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#9CA3AF',pointerEvents:'none'}} />
                      <input type="text" placeholder={!slotFilterDepartmentId ? "Pick Hospital & Dept first..." : "Type name or ID..."}
                        value={leftSearchQuery}
                        disabled={!slotFilterDepartmentId}
                        onChange={e => { setLeftSearchQuery(e.target.value); if (!e.target.value) { setDocId(''); setSelectedDoctorData(null); } }}
                        style={{...S.input, paddingLeft:34}} />
                      {leftSearchQuery && !docId && filteredDoctorsLeft.length > 0 && (
                        <div className="cc-dr-drop" style={S.dropdown}>
                          {filteredDoctorsLeft.map(d => (
                            <div key={d.id} onClick={() => selectDoctorLeft(d)} style={S.dropRow}>
                              <div style={{width:28,height:28,borderRadius:'50%',background:avatarGrad(d.id),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                                {d.name.slice(0,2).toUpperCase()}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600,color:'#0B1D3A',fontSize:13}}>{d.name}</div>
                                <div style={{fontSize:11,color:'#9CA3AF'}}>{d.specialization}</div>
                              </div>
                              <span style={S.idPill}>ID {d.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected doctor chip with Hospital/Dept details */}
                  {docId && selectedDoctorData && (
                    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'linear-gradient(135deg,#EFF6FF,#F0FDF4)',border:'1px solid #93C5FD',borderRadius:10,marginBottom:14}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>
                        {selectedDoctorData.name.slice(0,2).toUpperCase()}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#0B1D3A'}}>{selectedDoctorData.name}</div>
                        <div style={{fontSize:11,color:'#8896AC'}}>
                          {selectedDoctorData.hospital_name || 'Hospital'} • {selectedDoctorData.departments?.map(d=>d.name).join(', ') || 'No Departments Assigned'}
                        </div>
                      </div>
                      <div onClick={() => { setDocId(''); setLeftSearchQuery(''); setSelectedDoctorData(null); }}
                        style={{width:22,height:22,borderRadius:'50%',background:'rgba(0,0,0,0.06)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:12,color:'#6B7280'}}>
                        ×
                      </div>
                    </div>
                  )}

                  <div style={{height:1,background:'#DDE4F0',margin:'16px 0'}} />
                  <div style={{fontSize:11,fontWeight:600,color:'#8896AC',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:10}}>Proposed Allocation Slots</div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 36px',gap:8,marginBottom:6,padding:'0 2px'}}>
                    {['Slot Date','Start Time Block','End Time Block',''].map((h,i) => (
                      <div key={i} style={{fontSize:10.5,fontWeight:600,color:'#8896AC',textTransform:'uppercase',letterSpacing:'0.7px'}}>{h}</div>
                    ))}
                  </div>

                  {slots.map((slot, index) => (
                    <div key={index} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 36px',gap:8,marginBottom:8,alignItems:'center',background:'#F8FAFF',padding:'10px',borderRadius:10,border:'1px solid #DDE4F0'}}>
                      <input type="date" value={slot.date} onChange={e => updateSlotRow(index,'date',e.target.value)} style={S.slotInput} />
                      <input type="time" value={slot.start_time} onChange={e => updateSlotRow(index,'start_time',e.target.value)} style={S.slotInput} />
                      <input type="time" value={slot.end_time} onChange={e => updateSlotRow(index,'end_time',e.target.value)} style={S.slotInput} />
                      <button onClick={() => removeSlotRow(index)}
                        style={{width:32,height:32,borderRadius:8,border:'1px solid #FECACA',background:'#FEF2F2',color:'#EF4444',cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                        ×
                      </button>
                    </div>
                  ))}

                  <div className="cc-add-row" onClick={addSlotRow}
                    style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'#3B82F6',background:'white',border:'1.5px dashed #93C5FD',borderRadius:9,padding:'8px 16px',cursor:'pointer',fontWeight:600,marginBottom:16}}>
                    <i className="ti ti-plus" /> Add New Slot Row
                  </div>

                  <button className="cc-btn-save" onClick={handleSaveSlots} style={S.btnPrimary}>
                    <i className="ti ti-device-floppy" /> Save Slots
                  </button>
                </div>
              </div>

              {/* RIGHT — Monitor */}
              <div style={S.card}>
                <div style={S.cardHead('#F0FDF4','#10B981')}>
                  <div style={{...S.headIcon, background:'#DCFCE7'}}>
                    <i className="ti ti-eye" style={{fontSize:18,color:'#10B981'}} />
                  </div>
                  <div>
                    <div style={S.cardTitle}>Monitor & Cancel Slots</div>
                    <div style={S.cardSub}>Audit and manage existing slot records</div>
                  </div>
                </div>
                <div style={S.cardBody}>

                  <div style={S.fieldWrap}>
                    <label style={S.label}>Search Doctor by Name (For Auditing)</label>
                    <div style={{position:'relative'}}>
                      <i className="ti ti-search" style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#9CA3AF',pointerEvents:'none'}} />
                      <input type="text" placeholder="Type name or ID..."
                        value={rightSearchQuery}
                        onChange={e => { setRightSearchQuery(e.target.value); if (!e.target.value) setDocId(''); }}
                        style={{...S.input, paddingLeft:34}} />
                      {rightSearchQuery && !docId && filteredDoctorsRight.length > 0 && (
                        <div className="cc-dr-drop" style={S.dropdown}>
                          {filteredDoctorsRight.map(d => (
                            <div key={d.id} onClick={() => selectDoctorRight(d)} style={S.dropRow}>
                              <div style={{width:28,height:28,borderRadius:'50%',background:avatarGrad(d.id),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                                {d.name.slice(0,2).toUpperCase()}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600,color:'#0B1D3A',fontSize:13}}>{d.name}</div>
                                <div style={{fontSize:11,color:'#9CA3AF'}}>{d.specialization}</div>
                              </div>
                              <span style={S.idPill}>ID {d.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,alignItems:'flex-end',margin:'4px 0 16px'}}>
                    <div>
                      <label style={S.label}>Filter Target Date Context</label>
                      <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} style={{...S.input,marginBottom:0}} />
                    </div>
                    <button onClick={handleFetchSlots}
                      style={{height:42,padding:'0 18px',background:'linear-gradient(135deg,#0D9488,#14B8A6)',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6}}>
                      <i className="ti ti-database-search" style={{fontSize:15}} /> Fetch Slots
                    </button>
                  </div>

                  {activeSlots.length === 0 ? (
                    <div style={{textAlign:'center',padding:'48px 20px',color:'#8896AC'}}>
                      <i className="ti ti-calendar-search" style={{fontSize:44,display:'block',marginBottom:12,color:'#C8D3E8'}} />
                      <div style={{fontSize:13}}>Search a doctor and date to view slots</div>
                    </div>
                  ) : (
                    <div style={{borderRadius:12,border:'1px solid #DDE4F0',overflow:'hidden'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                        <thead>
                          <tr style={{background:'#F8FAFF'}}>
                            {['Time Window','Booking Status','Action'].map(h => (
                              <th key={h} style={{textAlign:'left',fontSize:10.5,fontWeight:600,color:'#8896AC',textTransform:'uppercase',letterSpacing:'0.7px',padding:'10px 14px',borderBottom:'1px solid #DDE4F0'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeSlots.map(s => (
                            <tr key={s.id} className="cc-tr" style={{borderBottom:'1px solid #F0F4FF'}}>
                              <td style={{padding:'12px 14px',fontWeight:600,color:'#0B1D3A'}}>
                                <div style={{display:'flex',alignItems:'center',gap:6}}>
                                  <i className="ti ti-clock" style={{fontSize:14,color:'#8896AC'}} />
                                  {s.start_time} – {s.end_time}
                                </div>
                              </td>
                              <td style={{padding:'12px 14px'}}>
                                <span style={{
                                  display:'inline-flex',alignItems:'center',gap:5,
                                  padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700,
                                  background: s.is_booked ? '#FEF2F2' : '#F0FDF4',
                                  color: s.is_booked ? '#DC2626' : '#059669',
                                  border:`1px solid ${s.is_booked ? '#FECACA' : '#A7F3D0'}`,
                                }}>
                                  <span style={{width:6,height:6,borderRadius:'50%',background:s.is_booked?'#DC2626':'#059669',display:'inline-block'}} />
                                  {s.is_booked ? 'Booked' : 'Available'}
                                </span>
                              </td>
                              <td style={{padding:'12px 14px'}}>
                                <button className="cc-btn-del"
                                  onClick={() => triggerDeleteConfirmation('slot',s.id,'Are you sure you want to permanently delete this slot?')}
                                  style={{fontSize:12,color:'#DC2626',background:'#FEF2F2',border:'1px solid #FECACA',padding:'5px 12px',borderRadius:7,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{background:'#F8FAFF',padding:'10px 14px',fontSize:12,color:'#8896AC',borderTop:'1px solid #DDE4F0',display:'flex',alignItems:'center',gap:6}}>
                        <i className="ti ti-clock" style={{fontSize:13}} />
                        <span style={{background:'white',border:'1px solid #DDE4F0',borderRadius:10,padding:'2px 8px',fontWeight:600,color:'#4A5568',fontSize:11}}>{activeSlots.length}</span>
                        slot(s) fetched
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 2 — HOSPITALS ONBOARDING
        ════════════════════════════════ */}
        {activeTab === 'hospitals' && (
          <div className="cc-panel" style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:24}}>
            <div style={{display:'flex',flexDirection:'column',gap:18}}>

              <div style={S.card}>
                <div style={S.cardHead('#EFF6FF','#3B82F6')}>
                  <div style={{...S.headIcon, background:'#DBEAFE'}}>
                    <i className={`ti ${hospForm.id ? 'ti-edit' : 'ti-building-hospital'}`} style={{fontSize:18,color:'#3B82F6'}} />
                  </div>
                  <div>
                    <div style={S.cardTitle}>{hospForm.id ? 'Edit Facility Profile' : 'Add Single Hospital'}</div>
                    <div style={S.cardSub}>Register a new hospital facility</div>
                  </div>
                </div>
                <div style={S.cardBody}>
                  <form onSubmit={handleHospitalSubmit}>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Hospital Name</label>
                      <input type="text" required placeholder="e.g. Apollo Hospital"
                        value={hospForm.name} onChange={e => setHospForm({...hospForm,name:e.target.value})} style={S.input} />
                    </div>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Location</label>
                      <div style={{position:'relative'}}>
                        <i className="ti ti-map-pin" style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#9CA3AF',pointerEvents:'none'}} />
                        <input type="text" required placeholder="e.g. Hebbal, Bangalore"
                          value={hospForm.location} onChange={e => setHospForm({...hospForm,location:e.target.value})} style={{...S.input,paddingLeft:34}} />
                      </div>
                    </div>
                    <button type="submit" className="cc-btn-save" style={S.btnPrimary}>
                      <i className="ti ti-device-floppy" /> {hospForm.id ? 'Update Hospital' : 'Save Hospital'}
                    </button>
                    {hospForm.id && (
                      <button type="button" onClick={() => setHospForm({id:null,name:'',location:''})} style={S.btnCancel}>
                        <i className="ti ti-x" /> Cancel Edit
                      </button>
                    )}
                  </form>
                </div>
              </div>

              {!hospForm.id && (
                <div style={S.card}>
                  <div style={S.cardHead('#F0FDF4','#10B981')}>
                    <div style={{...S.headIcon, background:'#DCFCE7'}}>
                      <i className="ti ti-clipboard-list" style={{fontSize:18,color:'#10B981'}} />
                    </div>
                    <div>
                      <div style={S.cardTitle}>Batch Import</div>
                      <div style={S.cardSub}>Format: Name, Location (one per line)</div>
                    </div>
                  </div>
                  <div style={S.cardBody}>
                    <form onSubmit={handleBulkHospitalSubmit}>
                      <textarea rows="4" placeholder={"Apollo Hospital, Hebbal\nKC Hospital, RR Nagar"}
                        value={bulkHospitalsInput} onChange={e => setBulkHospitalsInput(e.target.value)}
                        style={{...S.input,height:100,resize:'vertical',fontFamily:'monospace',fontSize:13}} />
                      <button type="submit" className="cc-btn-teal" style={S.btnTeal}>
                        <i className="ti ti-upload" /> Import All
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Registry table */}
            <div style={S.card}>
              <div style={S.cardHead('#F5F3FF','#8B5CF6')}>
                <div style={{...S.headIcon, background:'#EDE9FE'}}>
                  <i className="ti ti-list-details" style={{fontSize:18,color:'#8B5CF6'}} />
                </div>
                <div>
                  <div style={S.cardTitle}>Infrastructure Registry</div>
                  <div style={S.cardSub}>{hospitals.length} facilities registered</div>
                </div>
              </div>
              <div style={S.cardBody}>
                <div style={{borderRadius:12,border:'1px solid #DDE4F0',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{background:'#F8FAFF'}}>
                        {['#','Hospital Facility','Location','Actions'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hospitals.map((h, index) => (
                        <tr key={h.id} className="cc-tr" style={{borderBottom:'1px solid #F0F4FF'}}>
                          <td style={S.td}><span style={S.idChip}>{index + 1}</span></td>
                          <td style={S.td}>
                            <div style={{fontWeight:700,color:'#0B1D3A',fontSize:13}}>{h.name}</div>
                          </td>
                          <td style={S.td}>
                            <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:'#4A5568'}}>
                              <span style={{width:6,height:6,borderRadius:'50%',background:'#EF4444',flexShrink:0}} />
                              {h.location}
                            </span>
                          </td>
                          <td style={S.td}>
                            <div style={{display:'flex',gap:6}}>
                              <button className="cc-btn-edit" onClick={() => setHospForm(h)} style={S.btnEdit}>Edit</button>
                              <button className="cc-btn-del" onClick={() => triggerDeleteConfirmation('hospital',h.id,`Delete "${h.name}"?`)} style={S.btnDel}>Remove</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {hospitals.length === 0 && (
                        <tr><td colSpan={4} style={{textAlign:'center',color:'#8896AC',padding:'36px 0',fontSize:13}}>No hospitals registered yet</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{background:'#F8FAFF',padding:'10px 14px',fontSize:12,color:'#8896AC',borderTop:'1px solid #DDE4F0',display:'flex',alignItems:'center',gap:6}}>
                    <i className="ti ti-building-hospital" style={{fontSize:13}} />
                    Showing <span style={{background:'white',border:'1px solid #DDE4F0',borderRadius:10,padding:'2px 8px',fontWeight:600,color:'#4A5568',fontSize:11,margin:'0 2px'}}>{hospitals.length}</span> facilities
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 3 — DEPARTMENTS ONBOARDING
        ════════════════════════════════ */}
        {activeTab === 'departments' && (
          <div className="cc-panel" style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:24}}>
            <div style={{display:'flex',flexDirection:'column',gap:18}}>

              <div style={S.card}>
                <div style={S.cardHead('#FFFBEB','#F59E0B')}>
                  <div style={{...S.headIcon, background:'#FEF3C7'}}>
                    <i className={`ti ${deptForm.id ? 'ti-edit' : 'ti-folder-plus'}`} style={{fontSize:18,color:'#F59E0B'}} />
                  </div>
                  <div>
                    <div style={S.cardTitle}>{deptForm.id ? 'Edit Department Profile' : 'Add Single Department'}</div>
                    <div style={S.cardSub}>Register a new hospital division</div>
                  </div>
                </div>
                <div style={S.cardBody}>
                  <form onSubmit={handleDepartmentSubmit}>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Department Name</label>
                      <input type="text" required placeholder="e.g. Cardiology"
                        value={deptForm.name} onChange={e => setDeptForm({...deptForm,name:e.target.value})} style={S.input} />
                    </div>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Assign to Hospital</label>
                      <select 
                        required 
                        value={deptForm.hospital_id} 
                        onChange={e => setDeptForm({...deptForm, hospital_id: e.target.value})} 
                        style={S.input}
                      >
                        <option value="">Select a Hospital...</option>
                        {hospitals.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="cc-btn-save" style={S.btnPrimary}>
                      <i className="ti ti-device-floppy" /> {deptForm.id ? 'Update Department' : 'Save Department'}
                    </button>
                    {deptForm.id && (
                      <button type="button" onClick={() => setDeptForm({id:null,name:'',hospital_id:''})} style={S.btnCancel}>
                        <i className="ti ti-x" /> Cancel Edit
                      </button>
                    )}
                  </form>
                </div>
              </div>

              {!deptForm.id && (
                <div style={S.card}>
                  <div style={S.cardHead('#F0FDF4','#10B981')}>
                    <div style={{...S.headIcon, background:'#DCFCE7'}}>
                      <i className="ti ti-clipboard-list" style={{fontSize:18,color:'#10B981'}} />
                    </div>
                    <div>
                      <div style={S.cardTitle}>Batch Import</div>
                      <div style={S.cardSub}>One department name per line</div>
                    </div>
                  </div>
                  <div style={S.cardBody}>
                    <form onSubmit={handleBulkDepartmentSubmit}>
                      <textarea rows="4" placeholder={"Cardiology\nNeurology\nRadiology"}
                        value={bulkDepartmentsInput} onChange={e => setBulkDepartmentsInput(e.target.value)}
                        style={{...S.input,height:100,resize:'vertical',fontFamily:'monospace',fontSize:13}} />
                      <button type="submit" className="cc-btn-teal" style={S.btnTeal}>
                        <i className="ti ti-upload" /> Import All
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Departments table */}
            <div style={S.card}>
              <div style={S.cardHead('#F5F3FF','#8B5CF6')}>
                <div style={{...S.headIcon, background:'#EDE9FE'}}>
                  <i className="ti ti-sitemap" style={{fontSize:18,color:'#8B5CF6'}} />
                </div>
                <div>
                  <div style={S.cardTitle}>Department Division Operations</div>
                  <div style={S.cardSub}>{departments.length} departments registered</div>
                </div>
              </div>
              <div style={S.cardBody}>
                <div style={{borderRadius:12,border:'1px solid #DDE4F0',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{background:'#F8FAFF'}}>
                        {['#','Department Name','Hospital','Actions'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d, index) => {
                        const ds = deptStyle(d.name);
                        return (
                          <tr key={d.id} className="cc-tr" style={{borderBottom:'1px solid #F0F4FF'}}>
                            <td style={S.td}><span style={S.idChip}>{index + 1}</span></td>
                            <td style={S.td}>
                              <span style={{background:ds.bg,color:ds.color,border:`1px solid ${ds.border}`,borderRadius:20,fontSize:12,fontWeight:700,padding:'3px 12px'}}>
                                {d.name}
                              </span>
                            </td>
                            <td style={S.td}>
                              <span style={{fontWeight:600, color:'#4A5568'}}>
                                {hospitals.find(h => h.id === d.hospital_id)?.name || `Hospital ID: ${d.hospital_id}`}
                              </span>
                            </td>
                            <td style={S.td}>
                              <div style={{display:'flex',gap:6}}>
                                <button className="cc-btn-edit" onClick={() => setDeptForm(d)} style={S.btnEdit}>Edit</button>
                                <button className="cc-btn-del" onClick={() => triggerDeleteConfirmation('department',d.id,`Delete department "${d.name}"?`)} style={S.btnDel}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {departments.length === 0 && (
                        <tr><td colSpan={4} style={{textAlign:'center',color:'#8896AC',padding:'36px 0',fontSize:13}}>No departments registered yet</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{background:'#F8FAFF',padding:'10px 14px',fontSize:12,color:'#8896AC',borderTop:'1px solid #DDE4F0',display:'flex',alignItems:'center',gap:6}}>
                    <i className="ti ti-folders" style={{fontSize:13}} />
                    Showing <span style={{background:'white',border:'1px solid #DDE4F0',borderRadius:10,padding:'2px 8px',fontWeight:600,color:'#4A5568',fontSize:11,margin:'0 2px'}}>{departments.length}</span> departments
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 4 — DOCTORS DIRECTORY
        ════════════════════════════════ */}
        {activeTab === 'doctors' && (
          <div className="cc-panel" style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:24}}>

            <div style={S.card}>
              <div style={S.cardHead('#EFF6FF','#3B82F6')}>
                <div style={{...S.headIcon, background:'#DBEAFE'}}>
                  <i className={`ti ${docForm.id ? 'ti-edit' : 'ti-user-plus'}`} style={{fontSize:18,color:'#3B82F6'}} />
                </div>
                <div>
                  <div style={S.cardTitle}>{docForm.id ? 'Edit Doctor Profile' : 'Register Doctor Account'}</div>
                  <div style={S.cardSub}>Create or update practitioner record</div>
                </div>
              </div>
              <div style={S.cardBody}>
                <form onSubmit={handleDoctorSubmit}>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Full Name</label>
                    <input type="text" required placeholder="Dr. Full Name"
                      value={docForm.name} onChange={e => setDocForm({...docForm,name:e.target.value})} style={S.input} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Email</label>
                      <input type="email" required placeholder="doctor@email.com"
                        value={docForm.email} onChange={e => setDocForm({...docForm,email:e.target.value})} style={S.input} />
                    </div>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Phone</label>
                      <input type="text" required placeholder="+91 ..."
                        value={docForm.phone} onChange={e => setDocForm({...docForm,phone:e.target.value})} style={S.input} />
                    </div>
                  </div>
                  
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Password</label>
                    <input type="password" required={!docForm.id} placeholder={docForm.id ? "Leave blank to keep current" : "••••••••"}
                      value={docForm.password} onChange={e => setDocForm({...docForm,password:e.target.value})} style={S.input} />
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Specialization</label>
                      <input type="text" required placeholder="e.g. MBBS"
                        value={docForm.specialization} onChange={e => setDocForm({...docForm,specialization:e.target.value})} style={S.input} />
                    </div>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Experience (Years)</label>
                      <input type="number" required placeholder="10"
                        onWheel={(e) => e.target.blur()} // Fix for scrolling changing the number
                        value={docForm.years_of_experience} onChange={e => setDocForm({...docForm,years_of_experience:e.target.value})} style={S.input} />
                    </div>
                  </div>
                  
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Primary Hospital</label>
                    <select 
                      required 
                      value={docForm.hospital_id} 
                      onChange={e => setDocForm({...docForm, hospital_id: e.target.value, department_ids: []})}
                      style={S.input}
                    >
                      <option value="">Select a Hospital...</option>
                      {hospitals.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Assigned Departments</label>
                    <div style={{...S.input, height: 'auto', maxHeight: 130, overflowY: 'auto', padding: '10px'}}>
                      {!docForm.hospital_id ? (
                        <div style={{color:'#9CA3AF', fontSize:12, fontStyle: 'italic'}}>Select a hospital first</div>
                      ) : (
                        departments
                          .filter(d => d.hospital_id === parseInt(docForm.hospital_id))
                          .map(d => (
                            <label key={d.id} style={{display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:13, cursor: 'pointer', color:'#0B1D3A'}}>
                              <input
                                type="checkbox"
                                checked={docForm.department_ids.includes(d.id)}
                                onChange={(e) => {
                                  const newIds = e.target.checked
                                    ? [...docForm.department_ids, d.id]
                                    : docForm.department_ids.filter(id => id !== d.id);
                                  setDocForm({...docForm, department_ids: newIds});
                                }}
                                style={{accentColor: '#3B82F6', width: 14, height: 14, cursor: 'pointer'}}
                              />
                              {d.name}
                            </label>
                          ))
                      )}
                      {docForm.hospital_id && departments.filter(d => d.hospital_id === parseInt(docForm.hospital_id)).length === 0 && (
                        <div style={{color:'#9CA3AF', fontSize:12, fontStyle: 'italic'}}>No departments found for this hospital.</div>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="cc-btn-save" style={S.btnPrimary}>
                    <i className="ti ti-stethoscope" /> {docForm.id ? 'Update Doctor' : 'Register Doctor'}
                  </button>
                  {docForm.id && (
                    <button type="button" onClick={() => setDocForm({id:null,name:'',email:'',password:'',phone:'',specialization:'',years_of_experience:'',hospital_id:'',department_ids:[]})} style={S.btnCancel}>
                      <i className="ti ti-x" /> Cancel Edit
                    </button>
                  )}
                </form>
              </div>
            </div>

            {/* Doctors table */}
            <div style={S.card}>
              <div style={S.cardHead('#F5F3FF','#8B5CF6')}>
                <div style={{...S.headIcon, background:'#EDE9FE'}}>
                  <i className="ti ti-users" style={{fontSize:18,color:'#8B5CF6'}} />
                </div>
                <div>
                  <div style={S.cardTitle}>Medical Staff Directory</div>
                  <div style={S.cardSub}>{doctors.length} practitioners registered</div>
                </div>
              </div>
              <div style={S.cardBody}>
                <div style={{borderRadius:12,border:'1px solid #DDE4F0',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{background:'#F8FAFF'}}>
                        {['#','Doctor','Contact Info','Specialization','Exp','Assignments','Actions'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map((d, index) => (
                        <tr key={d.id} className="cc-tr" style={{borderBottom:'1px solid #F0F4FF'}}>
                          <td style={S.td}><span style={S.idChip}>{index + 1}</span></td>
                          <td style={S.td}>
                            <div style={{display:'flex',alignItems:'center',gap:9}}>
                              <div style={{width:32,height:32,borderRadius:'50%',background:avatarGrad(d.id),display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
                                {d.name.slice(0,2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{fontWeight:700,color:'#0B1D3A',fontSize:13}}>{d.name}</div>
                                <div style={{fontSize:11,color:'#8896AC'}}>ID: DR-{String(d.id).padStart(3,'0')}</div>
                              </div>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{fontSize:12, color:'#4A5568'}}>
                              <div style={{fontWeight:600}}>{d.email}</div>
                              <div>{d.phone}</div>
                            </div>
                          </td>
                          <td style={S.td}>
                            <span style={{background:'#EFF6FF',color:'#2563EB',borderRadius:20,fontSize:12,fontWeight:600,padding:'3px 10px',border:'1px solid #BFDBFE'}}>
                              {d.specialization}
                            </span>
                          </td>
                          <td style={S.td}>
                            <span style={{fontWeight:600,color:'#0B1D3A'}}>{d.years_of_experience}</span>
                            <span style={{fontSize:11,color:'#8896AC'}}> Yrs</span>
                          </td>
                          <td style={S.td}>
                            <div style={{fontSize:12, color:'#4A5568', fontWeight:600}}>
                              {d.hospital_name || 'No Hospital'}
                              <div style={{fontSize:11, color:'#8896AC', fontWeight:400, marginTop:2}}>
                                {d.departments && d.departments.length > 0 
                                  ? d.departments.map(dept => dept.name).join(', ') 
                                  : 'No Departments'}
                              </div>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{display:'flex',gap:6}}>
                              <button className="cc-btn-edit" onClick={() => {
                                setDocForm({
                                  id: d.id,
                                  name: d.name || '',
                                  email: d.email || '',
                                  phone: d.phone || '',
                                  specialization: d.specialization || '',
                                  years_of_experience: d.years_of_experience || '',
                                  hospital_id: d.hospital_id || '',
                                  department_ids: d.departments ? d.departments.map(dept => dept.id) : [],
                                  password: '' // Explicitly clear password from form on edit
                                });
                              }} style={S.btnEdit}>Edit</button>
                              <button className="cc-btn-del" onClick={() => triggerDeleteConfirmation('doctor',d.id,`Delete Dr. ${d.name}?`)} style={S.btnDel}>Remove</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {doctors.length === 0 && (
                        <tr><td colSpan={7} style={{textAlign:'center',color:'#8896AC',padding:'36px 0',fontSize:13}}>No doctors registered yet</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{background:'#F8FAFF',padding:'10px 14px',fontSize:12,color:'#8896AC',borderTop:'1px solid #DDE4F0',display:'flex',alignItems:'center',gap:6}}>
                    <i className="ti ti-stethoscope" style={{fontSize:13}} />
                    Showing <span style={{background:'white',border:'1px solid #DDE4F0',borderRadius:10,padding:'2px 8px',fontWeight:600,color:'#4A5568',fontSize:11,margin:'0 2px'}}>{doctors.length}</span> practitioners
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            TAB 5 — PATIENT MANAGEMENT
        ════════════════════════════════ */}
        {activeTab === 'patients' && (
          <div className="cc-panel" style={{display:'grid',gridTemplateColumns:'1fr',gap:24}}>
            <div style={S.card}>
              <div style={S.cardHead('#FDF2F8','#EC4899')}>
                <div style={{...S.headIcon, background:'#FCE7F3'}}>
                  <i className="ti ti-users-group" style={{fontSize:18,color:'#EC4899'}} />
                </div>
                <div>
                  <div style={S.cardTitle}>Patient Management</div>
                  <div style={S.cardSub}>{patients.length} patients registered in the system</div>
                </div>
              </div>
              <div style={S.cardBody}>
                <div style={{borderRadius:12,border:'1px solid #DDE4F0',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{background:'#F8FAFF'}}>
                        {['#', 'Patient Name', 'Contact Info', 'Age', 'Blood Group', 'Actions'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((p, index) => (
                        <tr key={p.id} className="cc-tr" style={{borderBottom:'1px solid #F0F4FF'}}>
                          <td style={S.td}><span style={S.idChip}>{index + 1}</span></td>
                          <td style={S.td}>
                            <div style={{display:'flex',alignItems:'center',gap:9}}>
                              <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#EC4899,#BE185D)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
                                {p.name.slice(0,2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{fontWeight:700,color:'#0B1D3A',fontSize:13}}>{p.name}</div>
                                <div style={{fontSize:11,color:'#8896AC'}}>User ID: {p.user_id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{fontSize:12, color:'#4A5568'}}>
                              <div style={{fontWeight:600}}>{p.email}</div>
                              <div>{p.phone}</div>
                            </div>
                          </td>
                          <td style={S.td}><span style={{fontWeight:600,color:'#0B1D3A'}}>{p.age}</span></td>
                          <td style={S.td}>
                            <span style={{background:'#FEF2F2',color:'#DC2626',borderRadius:20,fontSize:12,fontWeight:700,padding:'3px 10px',border:'1px solid #FECACA'}}>
                              {p.blood_group}
                            </span>
                          </td>
                          <td style={S.td}>
                            <button className="cc-btn-edit" onClick={() => setPatientEditModal({ show: true, data: { ...p } })} style={{...S.btnEdit, color:'#DB2777', background:'#FCE7F3', border:'1px solid #FBCFE8'}}>
                              <i className="ti ti-edit" /> Edit Details
                            </button>
                          </td>
                        </tr>
                      ))}
                      {patients.length === 0 && (
                        <tr><td colSpan={6} style={{textAlign:'center',color:'#8896AC',padding:'36px 0',fontSize:13}}>No patients registered yet</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{background:'#F8FAFF',padding:'10px 14px',fontSize:12,color:'#8896AC',borderTop:'1px solid #DDE4F0',display:'flex',alignItems:'center',gap:6}}>
                    <i className="ti ti-users-group" style={{fontSize:13}} />
                    Showing <span style={{background:'white',border:'1px solid #DDE4F0',borderRadius:10,padding:'2px 8px',fontWeight:600,color:'#4A5568',fontSize:11,margin:'0 2px'}}>{patients.length}</span> patients
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── SHARED STYLE TOKENS ─── */
const S = {
  card: {
    background:'white', borderRadius:16,
    boxShadow:'0 1px 3px rgba(11,29,58,0.07),0 4px 16px rgba(11,29,58,0.05)',
    border:'1px solid #DDE4F0', overflow:'hidden',
  },
  cardHead: (bg, accent) => ({
    background:bg, padding:'16px 22px',
    display:'flex', alignItems:'center', gap:12,
    borderBottom:`1px solid ${accent}20`,
  }),
  headIcon: {
    width:38, height:38, borderRadius:10,
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  cardTitle: { fontSize:15, fontWeight:700, color:'#0B1D3A' },
  cardSub:   { fontSize:12, color:'#8896AC', marginTop:2 },
  cardBody:  { padding:'20px 22px' },
  fieldWrap: { marginBottom:14 },
  label: {
    fontSize:11, fontWeight:600, color:'#4A5568',
    display:'block', marginBottom:5,
    textTransform:'uppercase', letterSpacing:'0.6px',
  },
  input: {
    width:'100%', padding:'10px 12px',
    border:'1.5px solid #DDE4F0', borderRadius:10,
    fontSize:13, color:'#0B1D3A',
    background:'#F8FAFF', outline:'none',
    fontFamily:'inherit', transition:'border-color 0.15s',
    boxSizing:'border-box',
  },
  slotInput: {
    width:'100%', padding:'9px 10px',
    border:'1.5px solid #DDE4F0', borderRadius:9,
    fontSize:13, color:'#0B1D3A',
    background:'white', outline:'none',
    fontFamily:'inherit', boxSizing:'border-box',
  },
  dropdown: {
    position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
    background:'white', border:'1px solid #DDE4F0',
    borderRadius:12, boxShadow:'0 10px 30px rgba(11,29,58,0.12)',
    zIndex:200, maxHeight:220, overflowY:'auto',
  },
  dropRow: {
    padding:'10px 14px', cursor:'pointer',
    borderBottom:'1px solid #F0F4FF',
    fontSize:13, display:'flex', alignItems:'center', gap:8,
    transition:'background 0.1s', background:'white',
  },
  idPill: {
    marginLeft:'auto', background:'#EFF6FF', color:'#2563EB',
    borderRadius:20, fontSize:11, fontWeight:700, padding:'2px 9px',
  },
  btnPrimary: {
    width:'100%', padding:'12px',
    background:'linear-gradient(135deg,#1D4ED8,#3B82F6)',
    color:'white', border:'none', borderRadius:10,
    fontSize:14, fontWeight:700, cursor:'pointer',
    boxShadow:'0 4px 14px rgba(37,99,235,0.28)',
    marginTop:4, display:'flex', alignItems:'center',
    justifyContent:'center', gap:7, fontFamily:'inherit',
    transition:'all 0.2s',
  },
  btnTeal: {
    width:'100%', padding:'11px',
    background:'linear-gradient(135deg,#0D9488,#14B8A6)',
    color:'white', border:'none', borderRadius:10,
    fontSize:13, fontWeight:700, cursor:'pointer',
    marginTop:10, display:'flex', alignItems:'center',
    justifyContent:'center', gap:7, fontFamily:'inherit',
    transition:'all 0.2s',
  },
  btnCancel: {
    width:'100%', marginTop:10, padding:'11px',
    background:'white', color:'#6B7280',
    border:'1.5px solid #DDE4F0', borderRadius:10,
    fontSize:13, fontWeight:600, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:6, fontFamily:'inherit',
  },
  th: {
    textAlign:'left', fontSize:10.5, fontWeight:600,
    color:'#8896AC', textTransform:'uppercase',
    letterSpacing:'0.7px', padding:'10px 14px',
    borderBottom:'1px solid #DDE4F0', whiteSpace:'nowrap',
  },
  td: { padding:'12px 14px', verticalAlign:'middle' },
  idChip: {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    background:'#F0F4FF', color:'#4A5568',
    borderRadius:6, padding:'3px 8px',
    fontSize:11, fontWeight:700, fontFamily:'monospace',
  },
  btnEdit: {
    background:'#EFF6FF', color:'#2563EB',
    border:'1px solid #BFDBFE', padding:'5px 12px',
    borderRadius:7, cursor:'pointer', fontSize:12,
    fontWeight:600, fontFamily:'inherit',
  },
  btnDel: {
    background:'#FEF2F2', color:'#DC2626',
    border:'1px solid #FECACA', padding:'5px 12px',
    borderRadius:7, cursor:'pointer', fontSize:12,
    fontWeight:600, fontFamily:'inherit',
  },
};

export default AdminDashboard;