import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Navbar from './Navbar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

/* ─────────────────────────────────────────────
   ICON COMPONENTS  (inline SVG, no extra deps)
───────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const ClockIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const FileIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const CalendarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const UserIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const XIcon = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/* ─────────────────────────────────────────────
   STYLES OBJECT
───────────────────────────────────────────── */
const S = {
  page: { backgroundColor: '#F7F6F3', minHeight: '100vh', fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  layout: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, minHeight: 'calc(100vh - 60px)' },
  sidebar: { background: '#FFFFFF', borderRight: '1px solid #EEECE5', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: '24px' },
  sectionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888780', marginBottom: 10 },
  card: { background: '#FFFFFF', border: '1px solid #EEECE5', borderRadius: 12, overflow: 'hidden' },
  cardHeader: { padding: '16px 20px', borderBottom: '1px solid #EEECE5', display: 'flex', alignItems: 'center', gap: 10 },
  cardIconWrap: (bg, color) => ({ width: 34, height: 34, borderRadius: 8, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#2C2C2A' },
  cardSub: { fontSize: 12, color: '#888780', marginTop: 2 },
  cardBody: { padding: '20px' },
  fieldWrap: { marginBottom: 13 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#5F5E5A', marginBottom: 5, letterSpacing: '0.02em' },
  selectWrap: { position: 'relative' },
  selectArrow: { position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888780' },
  input: { width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', border: '1px solid #D3D1C7', borderRadius: 8, background: '#F7F6F3', color: '#2C2C2A', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, background 0.15s', appearance: 'none', WebkitAppearance: 'none' },
  btnPrimary: { width: '100%', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, padding: '10px', borderRadius: 8, border: 'none', background: '#0F6E56', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, transition: 'background 0.15s' },
  btnAttach: { width: '100%', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '9px', borderRadius: 8, border: 'none', background: '#BA7517', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnAttachDisabled: { width: '100%', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '9px', borderRadius: 8, border: 'none', background: '#D3D1C7', color: '#888780', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  slotsHeader: { fontSize: 10, fontWeight: 700, color: '#888780', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '18px 0 10px' },
  slotsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  slot: { padding: '7px 8px', borderRadius: 7, border: '1px solid #9FE1CB', background: '#E1F5EE', color: '#0F6E56', fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s', fontFamily: 'inherit' },
  attachCard: { background: '#FFFBF0', border: '1px solid #FAD7A0', borderRadius: 12, overflow: 'hidden' },
  attachHeader: { padding: '16px 20px', borderBottom: '1px solid #FAD7A0', display: 'flex', alignItems: 'center', gap: 10 },
  attachTitle: { fontSize: 14, fontWeight: 600, color: '#854F0B' },
  attachSub: { fontSize: 12, color: '#BA7517', marginTop: 2 },
  fileZone: { border: '1.5px dashed #F5C875', borderRadius: 8, padding: '14px', textAlign: 'center', background: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginBottom: 12 },
  main: { padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 28 },
  greeting: { fontSize: 24, fontWeight: 600, color: '#2C2C2A', letterSpacing: '-0.3px' },
  greetingSub: { fontSize: 13, color: '#888780', marginTop: 4 },
  todayBadge: { display: 'flex', alignItems: 'center', gap: 7, background: '#E1F5EE', border: '1px solid #9FE1CB', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#0F6E56', fontWeight: 500 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  statCard: { background: '#FFFFFF', border: '1px solid #EEECE5', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 5 },
  statIconWrap: (bg, color) => ({ width: 36, height: 36, borderRadius: 8, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }),
  statValue: { fontSize: 26, fontWeight: 700, color: '#2C2C2A', lineHeight: 1 },
  statLabel: { fontSize: 12, color: '#888780', fontWeight: 400 },
  badge: (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: bg, color: color, marginTop: 2 }),
  infoBanner: { display: 'flex', alignItems: 'center', gap: 12, background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#0C447C' },
  tableWrap: { background: '#FFFFFF', border: '1px solid #EEECE5', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#888780', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '13px 18px', borderBottom: '1px solid #EEECE5', background: '#FAFAF8' },
  td: { padding: '15px 18px', verticalAlign: 'middle' },
  docAvatar: (bg, color) => ({ width: 36, height: 36, borderRadius: '50%', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }),
  timeChip: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F7F6F3', border: '1px solid #D3D1C7', color: '#5F5E5A', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 500 },
  statusPill: (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: color }),
  actionBtn: (bg, color, border) => ({ fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: `1px solid ${border}`, background: bg, color: color, cursor: 'pointer', transition: 'all 0.12s' }),
  recordChip: { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #D3D1C7', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#5F5E5A', background: '#F7F6F3', maxWidth: 140, marginBottom: 4 },
  toastBase: (isError) => ({ position: 'fixed', top: 76, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.10)', backgroundColor: isError ? '#FCEBEB' : '#E1F5EE', color: isError ? '#A32D2D' : '#085041', border: `1.5px solid ${isError ? '#F09595' : '#5DCAA5'}`, maxWidth: 400, animation: 'slideIn 0.25s ease' }),
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  modal: { background: '#FFFFFF', borderRadius: 16, padding: '36px 40px', width: 420, boxShadow: '0 25px 60px rgba(0,0,0,0.18)', textAlign: 'center' },
  modalIconWrap: (bg) => ({ width: 52, height: 52, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 24 }),
  modalTitle: { margin: '0 0 8px', color: '#2C2C2A', fontSize: 18, fontWeight: 700 },
  modalMsg: { margin: '0 0 22px', color: '#888780', fontSize: 14, lineHeight: 1.6 },
  modalBtnRow: { display: 'flex', gap: 12 },
  modalBtnCancel: { flex: 1, padding: 11, borderRadius: 10, border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#5F5E5A', fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },
  modalBtnConfirm: (isDelete) => ({ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: isDelete ? '#A32D2D' : '#0F6E56', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }),
};

/* ─────────────────────────────────────────────
   STATUS CONFIG HELPER
───────────────────────────────────────────── */
function getStatusStyle(dbStatus) {
  const map = {
    SCHEDULED:  { bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75', label: 'CONFIRMED' },
    CONFIRMED:  { bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75', label: 'CONFIRMED' },
    ARRIVED:    { bg: '#FAEEDA', color: '#854F0B', dot: '#BA7517', label: 'ARRIVED'   },
    STARTED:    { bg: '#FAEEDA', color: '#854F0B', dot: '#BA7517', label: 'IN PROGRESS'},
    COMPLETED:  { bg: '#EAF3DE', color: '#27500A', dot: '#639922', label: 'COMPLETED' },
    CANCELLED:  { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A', label: 'CANCELLED' },
  };
  return map[dbStatus] || { bg: '#F7F6F3', color: '#5F5E5A', dot: '#888780', label: dbStatus };
}

/* avatar bg palette by index */
const AVATAR_COLORS = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FAECE7', color: '#993C1D' },
];

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
function PatientDashboard() {
  const token = localStorage.getItem('token');

  const [notification, setNotification] = useState({ show: false, message: '', isError: false });
  const [actionModal, setActionModal] = useState({ show: false, type: '', targetId: null, message: '', extraData: null });

  // ── FIX 1: ADD DEPARTMENTS STATE ──
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]); 
  const [doctors, setDoctors] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadAppointmentId, setUploadAppointmentId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [myRecords, setMyRecords] = useState([]);

  const [activeTab, setActiveTab] = useState('ALL');
  
  // Patient Search Bar States
  const [searchDoctorName, setSearchDoctorName] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const today = new Date();
  const minDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentTimeString = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  const todayFormatted = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const userName = localStorage.getItem('userName') || 'Patient';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const showStatusNotification = useCallback((msg, isErr = false) => {
    setNotification({ show: true, message: msg, isError: isErr });
    setTimeout(() => setNotification({ show: false, message: '', isError: false }), 4000);
  }, []);

  const loadInitialPatientWorkspace = useCallback(async () => {
    try {
      const overviewRes = await axios.get(`${API_BASE_URL}/system-overview`);
      setHospitals(overviewRes.data.hospitals || []);
      
      // ── FIX 2: SAVE DEPARTMENTS FROM BACKEND ──
      setDepartments(overviewRes.data.departments || []); 
      
      setDoctors(overviewRes.data.doctors || []);
      
      const appointmentsRes = await axios.get(`${API_BASE_URL}/patient/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sortedAppts = appointmentsRes.data.sort(
        (a, b) => new Date(`${b.date}T${b.start_time || '00:00'}`) - new Date(`${a.date}T${a.start_time || '00:00'}`)
      );
      setMyAppointments(sortedAppts);
      const recordsRes = await axios.get(`${API_BASE_URL}/patient/my-documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyRecords(recordsRes.data || []);
    } catch (err) {
      console.error('Error setting up patient environment maps.');
    }
  }, [token]);

  useEffect(() => {
    loadInitialPatientWorkspace();
    const hasGreeted = sessionStorage.getItem('hasGreeted');
    if (userName && !hasGreeted) {
      showStatusNotification(`Login successful. Welcome back, ${userName}!`, false);
      sessionStorage.setItem('hasGreeted', 'true');
    }
  }, [loadInitialPatientWorkspace, showStatusNotification, userName]);

  // ── FIX 3: ROBUST DATABASE CASCADING DROPDOWNS ──
  // 1. Get doctors in this hospital
  const hospitalDoctors = doctors.filter(doc => doc.hospital_id === parseInt(selectedHospital));
  
  // 2. Find which exact department IDs those doctors belong to (flatten since a doctor can have multiple)
  const availableDeptIds = [...new Set(hospitalDoctors.flatMap(doc => doc.department_ids || []))];
  
  // 3. Display only the Departments that actually exist in this hospital
  const hospitalDepartments = departments.filter(dep => availableDeptIds.includes(dep.id));
  
  // 4. Filter doctors by the selected department ID
  const validFilteredDoctorsList = hospitalDoctors.filter(doc => 
    selectedDepartment ? (doc.department_ids || []).includes(parseInt(selectedDepartment)) : true
  );

  const handleFetchAvailableSlots = async () => {
    if (!selectedDoctor || !filterDate) {
      showStatusNotification('Please select a Doctor and Target Date first.', true);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/slots/${selectedDoctor}?date=${filterDate}`);
      const validLiveSlots = res.data.filter(slot => {
        if (slot.is_booked) return false;
        if (filterDate < minDateString) return false;
        if (filterDate === minDateString) return slot.start_time > currentTimeString;
        return true;
      });
      setAvailableSlots(validLiveSlots);
      if (validLiveSlots.length === 0)
        showStatusNotification('No open appointment timings remaining for this date.', false);
    } catch {
      showStatusNotification('Failed to collect clinician schedule timelines.', true);
    }
  };

  const handleBookSlotClick = (slot) =>
    setActionModal({
      show: true, type: 'BOOK', targetId: slot.id,
      message: `Confirm booking the appointment window from ${slot.start_time} to ${slot.end_time}?`,
    });

  const handleCancelClick = (appt) =>
    setActionModal({
      show: true, type: 'CANCEL', targetId: appt.id,
      message: `Are you sure you want to cancel your appointment with ${appt.doctor_name}?`,
    });

  const handleDeleteFileClick = (record) => {
    const filePath = record.path || record.id;
    if (!filePath) { showStatusNotification('Error: File path missing. Please refresh.', true); return; }
    setActionModal({
      show: true, type: 'DELETE_FILE', targetId: filePath,
      message: `Permanently delete "${record.name}"?`,
    });
  };

  const handleRescheduleClick = async (appt) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/slots/${appt.doctor_id}?date=${appt.date}`);
      const freeSlots = res.data.filter(slot => {
        if (slot.is_booked) return false;
        if (appt.date < minDateString) return false;
        if (appt.date === minDateString) return slot.start_time > currentTimeString;
        return true;
      });
      setRescheduleSlots(freeSlots);
      setActionModal({
        show: true, type: 'RESCHEDULE', targetId: appt.id,
        message: `Select a new 30-minute block for your appointment with ${appt.doctor_name}:`,
        extraData: null,
      });
    } catch {
      showStatusNotification('Could not retrieve optional timing blocks for rescheduling.', true);
    }
  };

  // ── THE CRITICAL FIX: UPDATED BACKEND ROUTES ──
  const executeConfirmedAction = async () => {
    const { type, targetId, extraData } = actionModal;
    setActionModal({ show: false, type: '', targetId: null, message: '', extraData: null });
    try {
      if (type === 'BOOK') {
        // Updated to /patient/book
        await axios.post(`${API_BASE_URL}/patient/book`, { slot_id: targetId }, { headers: { Authorization: `Bearer ${token}` } });
        showStatusNotification('Appointment confirmed successfully.');
      } else if (type === 'CANCEL') {
        // Updated to /patient/cancel/
        await axios.put(`${API_BASE_URL}/patient/cancel/${targetId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        showStatusNotification('Appointment cancelled.');
      } else if (type === 'RESCHEDULE') {
        if (!extraData) { showStatusNotification('No new slot selected.', true); return; }
        // Updated to /patient/reschedule/
        await axios.put(`${API_BASE_URL}/patient/reschedule/${targetId}`, { new_slot_id: parseInt(extraData) }, { headers: { Authorization: `Bearer ${token}` } });
        showStatusNotification('Appointment rescheduled successfully.');
      } else if (type === 'DELETE_FILE') {
        await axios.delete(`${API_BASE_URL}/patient/document?file_path=${encodeURIComponent(targetId)}`, { headers: { Authorization: `Bearer ${token}` } });
        showStatusNotification('File permanently deleted.');
      }
      loadInitialPatientWorkspace();
      if (selectedDoctor && filterDate) handleFetchAvailableSlots();
    } catch (err) {
      const exactError = err.response?.data?.detail || 'Could not connect to the server.';
      showStatusNotification(`Error: ${exactError}`, true);
    }
  };

  const handleUploadRecords = async () => {
    if (!uploadAppointmentId) { showStatusNotification('Please select an appointment first.', true); return; }
    if (uploadedFiles.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('appointment_id', uploadAppointmentId);
    uploadedFiles.forEach(file => formData.append('files', file));
    try {
      await axios.post(`${API_BASE_URL}/patient/upload-records`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showStatusNotification('Medical records attached successfully!');
      setUploadedFiles([]);
      setUploadAppointmentId('');
      await loadInitialPatientWorkspace();
    } catch {
      showStatusNotification('Failed to upload records.', true);
    } finally {
      setIsUploading(false);
    }
  };

  const isApptActiveAndUpcoming = (a) => {
    if (a.status !== 'SCHEDULED' && a.status !== 'CONFIRMED') return false;
    if (a.date < minDateString) return false;
    if (a.date === minDateString) {
      const endTime = a.end_time && a.end_time !== 'N/A' ? a.end_time : '23:59';
      if (endTime < currentTimeString) return false;
    }
    return true;
  };

  const activeCount = myAppointments.filter(isApptActiveAndUpcoming).length;
  const uniqueDoctors = new Set(myAppointments.map(a => a.doctor_id)).size;
  const totalRecords = myRecords.length;

  const filteredAppointments = myAppointments.filter(a => {
    if (activeTab === 'UPCOMING' && !isApptActiveAndUpcoming(a)) return false;
    if (activeTab === 'PAST' && isApptActiveAndUpcoming(a)) return false;
    const matchName = a.doctor_name.toLowerCase().includes(searchDoctorName.toLowerCase());
    const matchDate = searchDate === '' || a.date === searchDate;
    return matchName && matchDate;
  });

  const nextAppt = myAppointments.find(isApptActiveAndUpcoming);

  const focusStyle = (e) => { e.target.style.borderColor = '#1D9E75'; e.target.style.background = '#FFFFFF'; };
  const blurStyle  = (e) => { e.target.style.borderColor = '#D3D1C7'; e.target.style.background = '#F7F6F3'; };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing: border-box; }
        @keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        .slot-btn:hover { background: #9FE1CB !important; border-color: #1D9E75 !important; }
        .appt-row:hover { background: #FAFAF8 !important; }
        .btn-primary-hover:hover { background: #085041 !important; }
        .btn-attach-hover:hover { background: #633806 !important; }
      `}</style>

      <Navbar />

      {/* ── TOAST ── */}
      {notification.show && (
        <div style={S.toastBase(notification.isError)}>
          {notification.isError ? <AlertIcon /> : <CheckIcon />}
          {notification.message}
        </div>
      )}

      {/* ── ACTION MODAL ── */}
      {actionModal.show && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalIconWrap(
              actionModal.type === 'CANCEL' || actionModal.type === 'DELETE_FILE' ? '#FCEBEB' : '#E1F5EE'
            )}>
              {actionModal.type === 'CANCEL'      ? '🚫'
               : actionModal.type === 'RESCHEDULE' ? '🔄'
               : actionModal.type === 'DELETE_FILE'? '🗑️'
               : '📅'}
            </div>
            <h3 style={S.modalTitle}>Confirm Action</h3>
            <p style={S.modalMsg}>{actionModal.message}</p>

            {actionModal.type === 'RESCHEDULE' && (
              <div style={{ marginBottom: 22, textAlign: 'left' }}>
                <label style={{ ...S.label, marginBottom: 6 }}>Available Alternative Blocks</label>
                <div style={S.selectWrap}>
                  <select
                    style={{ ...S.input, paddingRight: 32 }}
                    onChange={e => setActionModal(prev => ({ ...prev, extraData: e.target.value }))}
                  >
                    <option value="">-- Choose alternative timing --</option>
                    {rescheduleSlots.map(s => (
                      <option key={s.id} value={s.id}>{s.start_time} – {s.end_time}</option>
                    ))}
                  </select>
                  <span style={S.selectArrow}><ChevronDown /></span>
                </div>
                {rescheduleSlots.length === 0 && (
                  <p style={{ color: '#A32D2D', fontSize: 12, marginTop: 6 }}>No other slots available on this date.</p>
                )}
              </div>
            )}

            <div style={S.modalBtnRow}>
              <button
                style={S.modalBtnCancel}
                onClick={() => setActionModal({ show: false, type: '', targetId: null, message: '', extraData: null })}
              >
                Cancel
              </button>
              <button
                style={S.modalBtnConfirm(actionModal.type === 'DELETE_FILE')}
                onClick={executeConfirmedAction}
              >
                {actionModal.type === 'DELETE_FILE' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <div style={S.layout}>

        {/* ════════════ SIDEBAR ════════════ */}
        <aside style={S.sidebar}>

          {/* Find & Book */}
          <div>
            <div style={S.sectionLabel}>Find &amp; Book</div>
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div style={S.cardIconWrap('#E1F5EE', '#0F6E56')}>
                  <SearchIcon />
                </div>
                <div>
                  <div style={S.cardTitle}>Find a Consultation</div>
                  <div style={S.cardSub}>Search available doctor slots</div>
                </div>
              </div>
              <div style={S.cardBody}>

                {/* Hospital */}
                <div style={S.fieldWrap}>
                  <label style={S.label}>Hospital Facility</label>
                  <div style={S.selectWrap}>
                    <select
                      value={selectedHospital}
                      onChange={e => { 
                        setSelectedHospital(e.target.value); 
                        setSelectedDepartment(''); // Reset Department
                        setSelectedDoctor(''); 
                        setAvailableSlots([]); 
                      }}
                      style={{ ...S.input, paddingRight: 32 }}
                      onFocus={focusStyle} onBlur={blurStyle}
                    >
                      <option value="">-- Select Medical Facility --</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} ({h.location})</option>)}
                    </select>
                    <span style={S.selectArrow}><ChevronDown /></span>
                  </div>
                </div>

                {/* ── FIX 4: DEPARTMENT DROPDOWN UI ── */}
                <div style={S.fieldWrap}>
                  <label style={S.label}>Medical Department</label>
                  <div style={S.selectWrap}>
                    <select
                      value={selectedDepartment}
                      onChange={e => { 
                        setSelectedDepartment(e.target.value); 
                        setSelectedDoctor(''); 
                        setAvailableSlots([]); 
                      }}
                      style={{ ...S.input, paddingRight: 32, opacity: !selectedHospital ? 0.6 : 1 }}
                      disabled={!selectedHospital}
                      onFocus={focusStyle} onBlur={blurStyle}
                    >
                      <option value="">-- All Departments --</option>
                      {hospitalDepartments.map(dep => (
                        <option key={dep.id} value={dep.id}>{dep.name}</option>
                      ))}
                    </select>
                    <span style={S.selectArrow}><ChevronDown /></span>
                  </div>
                </div>

                {/* Doctor */}
                <div style={S.fieldWrap}>
                  <label style={S.label}>Specialising Practitioner</label>
                  <div style={S.selectWrap}>
                    <select
                      value={selectedDoctor}
                      onChange={e => { setSelectedDoctor(e.target.value); setAvailableSlots([]); }}
                      style={{ ...S.input, paddingRight: 32, opacity: !selectedHospital ? 0.6 : 1 }}
                      disabled={!selectedHospital}
                      onFocus={focusStyle} onBlur={blurStyle}
                    >
                      <option value="">-- Choose Practitioner --</option>
                      {validFilteredDoctorsList.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name.startsWith('Dr') ? d.name : `Dr. ${d.name}`} ({d.specialization})
                        </option>
                      ))}
                    </select>
                    <span style={S.selectArrow}><ChevronDown /></span>
                  </div>
                </div>

                {/* Date */}
                <div style={S.fieldWrap}>
                  <label style={S.label}>Target Consultation Date</label>
                  <input
                    type="date" min={minDateString} value={filterDate}
                    onChange={e => { setFilterDate(e.target.value); setAvailableSlots([]); }}
                    style={S.input}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>

                <button
                  className="btn-primary-hover"
                  onClick={handleFetchAvailableSlots}
                  style={S.btnPrimary}
                >
                  <SearchIcon /> Search Slots
                </button>

                {/* Slots */}
                {availableSlots.length > 0 && (
                  <>
                    <div style={S.slotsHeader}>
                      Available 30-Min Openings ({availableSlots.length})
                    </div>
                    <div style={S.slotsGrid}>
                      {availableSlots.map((slot, idx) => (
                        <button
                          key={slot.id}
                          className="slot-btn"
                          onClick={() => handleBookSlotClick(slot)}
                          style={{
                            ...S.slot,
                            gridColumn: idx === availableSlots.length - 1 && availableSlots.length % 2 !== 0
                              ? '1 / -1' : undefined,
                          }}
                        >
                          <ClockIcon size={11} />
                          {slot.start_time} – {slot.end_time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Attach Records */}
          <div>
            <div style={S.sectionLabel}>Medical Records</div>
            <div style={S.attachCard}>
              <div style={S.attachHeader}>
                <div style={S.cardIconWrap('#FAEEDA', '#854F0B')}>
                  <FileIcon size={15} />
                </div>
                <div>
                  <div style={S.attachTitle}>Attach Medical Records</div>
                  <div style={S.attachSub}>Securely save PDFs for an appointment</div>
                </div>
              </div>
              <div style={{ padding: '16px 18px' }}>

                {/* Appointment select */}
                <div style={S.fieldWrap}>
                  <label style={{ ...S.label, color: '#854F0B' }}>Select Upcoming Appointment</label>
                  <div style={S.selectWrap}>
                    <select
                      value={uploadAppointmentId}
                      onChange={e => setUploadAppointmentId(e.target.value)}
                      style={{ ...S.input, background: 'rgba(255,255,255,0.7)', borderColor: '#FAD7A0', paddingRight: 32 }}
                    >
                      <option value="">-- Choose Appointment --</option>
                      {myAppointments.map(appt => (
                        <option key={appt.id} value={appt.id}>
                          {appt.date} ({appt.start_time} – {appt.end_time}) — {appt.doctor_name}
                        </option>
                      ))}
                    </select>
                    <span style={S.selectArrow}><ChevronDown /></span>
                  </div>
                </div>

                {/* File drop zone */}
                <div style={S.fileZone}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
                  {uploadedFiles.length > 0 ? (
                    <div style={{ fontSize: 11, color: '#854F0B', fontWeight: 600 }}>
                      {uploadedFiles.map(f => f.name).join(', ')}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#BA7517' }}>No file chosen</div>
                  )}
                  <label style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#BA7517', cursor: 'pointer', textDecoration: 'underline' }}>
                    Click to select PDF
                    <input
                      type="file" accept=".pdf" multiple
                      onChange={e => setUploadedFiles(Array.from(e.target.files))}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                <button
                  className={isUploading || uploadedFiles.length === 0 ? '' : 'btn-attach-hover'}
                  onClick={handleUploadRecords}
                  disabled={isUploading || uploadedFiles.length === 0}
                  style={isUploading || uploadedFiles.length === 0 ? S.btnAttachDisabled : S.btnAttach}
                >
                  <UploadIcon />
                  {isUploading ? 'Uploading…' : 'Attach Files to Appointment'}
                </button>
              </div>
            </div>
          </div>

        </aside>

        {/* ════════════ MAIN ════════════ */}
        <main style={S.main}>

          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={S.greeting}>{greeting}, {userName}</div>
              <div style={S.greetingSub}>Here's a summary of your healthcare activity</div>
            </div>
            <div style={S.todayBadge}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#1D9E75', display: 'inline-block',
                animation: 'pulse 2s infinite',
              }} />
              {todayFormatted}
            </div>
          </div>

          {/* Stats Row */}
          <div style={S.statsRow}>
            <div style={S.statCard}>
              <div style={S.statIconWrap('#E1F5EE', '#0F6E56')}><CalendarIcon size={17} /></div>
              <div style={S.statValue}>{activeCount}</div>
              <div style={S.statLabel}>Active Appointment{activeCount !== 1 ? 's' : ''}</div>
              <div style={S.badge('#EAF3DE', '#27500A')}>● Confirmed</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statIconWrap('#E6F1FB', '#185FA5')}><UserIcon size={17} /></div>
              <div style={S.statValue}>{uniqueDoctors}</div>
              <div style={S.statLabel}>Doctors Consulted</div>
              <div style={S.badge('#E6F1FB', '#0C447C')}>This year</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statIconWrap('#FAEEDA', '#854F0B')}><FileIcon size={17} /></div>
              <div style={S.statValue}>{totalRecords}</div>
              <div style={S.statLabel}>Records Attached</div>
              <div style={S.badge('#FAEEDA', '#854F0B')}>On file</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statIconWrap('#EAF3DE', '#27500A')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <div style={S.statValue}>{availableSlots.length || '—'}</div>
              <div style={S.statLabel}>Open Slots Found</div>
              <div style={S.badge('#EAF3DE', '#27500A')}>
                {availableSlots.length > 0 ? 'Live results' : 'Search above'}
              </div>
            </div>
          </div>

          {/* Info Banner */}
          {nextAppt && (
            <div style={S.infoBanner}>
              <InfoIcon />
              <div style={{ fontSize: 13 }}>
                <strong>Upcoming:</strong> Your consultation with <strong>{nextAppt.doctor_name}</strong> is confirmed for{' '}
                <strong>{nextAppt.start_time} – {nextAppt.end_time}</strong> on <strong>{nextAppt.date}</strong>.
                Please bring a valid ID and arrive 10 minutes early.
              </div>
            </div>
          )}

          {/* Consultations Log */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#2C2C2A', letterSpacing: '-0.2px' }}>
                  My Booked Consultations
                </span>
                <span style={{ fontSize: 12, color: '#888780', marginLeft: 8 }}>
                  {myAppointments.length} total · {activeCount} active
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap' }}>
                
                {/* Doctor Name Search Input */}
                <input 
                  type="text"
                  placeholder="Search doctor..."
                  value={searchDoctorName}
                  onChange={(e) => setSearchDoctorName(e.target.value)}
                  style={{
                    padding: '7px 12px', borderRadius: '8px', border: '1px solid #D3D1C7',
                    fontSize: '12px', outline: 'none', background: '#FFFFFF', width: '160px',
                    fontFamily: 'inherit', transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1D9E75'}
                  onBlur={(e) => e.target.style.borderColor = '#D3D1C7'}
                />

                {/* Date Search Input */}
                <input 
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  style={{
                    padding: '7px 12px', borderRadius: '8px', border: '1px solid #D3D1C7',
                    fontSize: '12px', outline: 'none', background: '#FFFFFF', 
                    fontFamily: 'inherit', transition: 'border-color 0.2s', color: searchDate ? '#2C2C2A' : '#888780'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1D9E75'}
                  onBlur={(e) => e.target.style.borderColor = '#D3D1C7'}
                />

                {/* Tab pills */}
                <div style={{
                  display: 'flex', gap: 4,
                  background: '#EEECE5', borderRadius: 8, padding: 3,
                }}>
                  {['ALL', 'UPCOMING', 'PAST'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                        padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: activeTab === tab ? '#FFFFFF' : 'transparent',
                        color: activeTab === tab ? '#2C2C2A' : '#888780',
                        boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={S.tableWrap}>
              {filteredAppointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888780' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#5F5E5A', marginBottom: 4 }}>
                    {(searchDoctorName || searchDate) ? 'No matches found for your search criteria' : 'No appointments found'}
                  </div>
                  <div style={{ fontSize: 13 }}>Use the booking panel on the left to schedule a consultation</div>
                </div>
              ) : (
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['Medical Officer', 'Date Scheduled', 'Time Window', 'Live Status', 'Actions', 'Saved Records'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((appt, idx) => {
                      const endTime = appt.end_time && appt.end_time !== 'N/A' ? appt.end_time : '23:59';
                      const isTimePassed = new Date() > new Date(`${appt.date}T${endTime}:00`);
                      const canEdit = !isTimePassed && (appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED');
                      const st = getStatusStyle(appt.status);
                      const av = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      const thisRecords = myRecords.filter(r => r.path && r.path.includes(`appt_${appt.id}_`));
                      const initials = appt.doctor_name.replace('Dr. ', '').slice(0, 2).toUpperCase();

                      // ── FIX 5: SHOW TRUE DATABASE DEPARTMENT NAME (MANY-TO-MANY) ──
                      const docInfo = doctors.find(d => d.id === appt.doctor_id);
                      const deptNames = docInfo ? departments.filter(dep => (docInfo.department_ids || []).includes(dep.id)).map(d => d.name) : [];
                      const docSpecialty = deptNames.length > 0 ? deptNames.join(', ') : (docInfo ? docInfo.specialization : 'Specialist');

                      return (
                        <tr
                          key={appt.id}
                          className="appt-row"
                          style={{ borderBottom: '1px solid #EEECE5', transition: 'background 0.1s' }}
                        >
                          {/* Doctor */}
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={S.docAvatar(av.bg, av.color)}>{initials}</div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#2C2C2A', fontSize: 13 }}>{appt.doctor_name}</div>
                                <div style={{ fontSize: 11, color: '#888780', marginTop: 1 }}>{docSpecialty}</div>
                              </div>
                            </div>
                          </td>

                          {/* Date */}
                          <td style={S.td}>
                            <div style={{ fontWeight: 500, color: '#2C2C2A', fontSize: 13 }}>{appt.date}</div>
                            <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>
                              {new Date(appt.date) >= new Date(minDateString) ? 'Upcoming' : 'Past'}
                            </div>
                          </td>

                          {/* Time */}
                          <td style={S.td}>
                            <div style={S.timeChip}>
                              <ClockIcon size={12} />
                              {appt.start_time} – {appt.end_time}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={S.td}>
                            <span style={S.statusPill(st.bg, st.color)}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
                              {st.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={S.td}>
                            {canEdit ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => handleRescheduleClick(appt)}
                                  style={S.actionBtn('#E6F1FB', '#185FA5', '#85B7EB')}
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => handleCancelClick(appt)}
                                  style={S.actionBtn('#FCEBEB', '#A32D2D', '#F09595')}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: '#B4B2A9', fontSize: 12, fontWeight: 600 }}>
                                {appt.status === 'COMPLETED' ? '✓ Finished'
                                  : appt.status === 'CANCELLED' ? '✕ Void'
                                  : '🔒 Locked'}
                              </span>
                            )}
                          </td>

                          {/* Records */}
                          <td style={S.td}>
                            {thisRecords.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {thisRecords.map(record => (
                                  <div key={record.id} style={S.recordChip}>
                                    <FileIcon size={11} />
                                    <a
                                      href={record.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: '#185FA5', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600 }}
                                    >
                                      {record.name}
                                    </a>
                                    <button
                                      onClick={() => handleDeleteFileClick(record)}
                                      title="Delete"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888780', padding: '0 2px', display: 'flex', alignItems: 'center' }}
                                    >
                                      <XIcon size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#B4B2A9', fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

export default PatientDashboard;