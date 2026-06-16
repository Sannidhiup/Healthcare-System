import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Navbar from './Navbar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

/* ─────────────────────────────────────────────
   INLINE SVG ICONS
───────────────────────────────────────────── */
const StethIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
    <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/>
    <circle cx="20" cy="10" r="2"/>
  </svg>
);
const ClockIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const CalendarIcon = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const UserIcon = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const NoteIcon = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SaveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

/* ─────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────── */
function getStatusStyle(status) {
  const map = {
    SCHEDULED:  { bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75', label: 'Scheduled'  },
    CONFIRMED:  { bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75', label: 'Confirmed'  },
    ARRIVED:    { bg: '#FAEEDA', color: '#854F0B', dot: '#BA7517', label: 'Arrived'    },
    STARTED:    { bg: '#E6F1FB', color: '#185FA5', dot: '#378ADD', label: 'In Progress' },
    COMPLETED:  { bg: '#EAF3DE', color: '#27500A', dot: '#639922', label: 'Finished'   },
    CANCELLED:  { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A', label: 'Cancelled'  },
  };
  return map[status] || { bg: '#F7F6F3', color: '#5F5E5A', dot: '#888780', label: status };
}

const AVATAR_COLORS = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FAECE7', color: '#993C1D' },
  { bg: '#FBEAF0', color: '#993556' },
];

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
function DoctorDashboard() {
  const token = localStorage.getItem('token');
  const [notification, setNotification] = useState({ show: false, message: '', isError: false });

  const [schedule, setSchedule] = useState([]);
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [summaryText, setSummaryText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const notesContainerRef = useRef(null);

  const [aiModal, setAiModal] = useState({ show: false, patientId: null, patientName: '' });
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef(null);

  const [activeTab, setActiveTab] = useState('ALL');
  
  // ── NEW: PATIENT SEARCH BAR STATE ──
  const [searchQuery, setSearchQuery] = useState(''); 

  const showStatusNotification = useCallback((msg, isErr = false) => {
    setNotification({ show: true, message: msg, isError: isErr });
    setTimeout(() => setNotification({ show: false, message: '', isError: false }), 4000);
  }, []);

  const loadDoctorSchedule = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/doctor/my-schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sorted = res.data.sort(
        (a, b) =>
          new Date(`${b.date}T${b.time.split(' - ')[0]}`) -
          new Date(`${a.date}T${a.time.split(' - ')[0]}`)
      );
      setSchedule(sorted);
      if (activeAppointment) {
        const updated = sorted.find(a => a.id === activeAppointment.id);
        if (updated) setActiveAppointment(updated);
      }
    } catch (err) { console.error('Error fetching schedule:', err); }
  }, [token, activeAppointment]);

  useEffect(() => {
    loadDoctorSchedule();
    const userName = localStorage.getItem('userName') || '';
    const hasGreeted = sessionStorage.getItem('hasGreeted');
    if (userName && !hasGreeted) {
      const formatted = userName.startsWith('Dr') ? userName : `Dr. ${userName}`;
      showStatusNotification(`Welcome to your portal, ${formatted}`, false);
      sessionStorage.setItem('hasGreeted', 'true');
    }
  }, [loadDoctorSchedule, showStatusNotification]);

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatHistory, isTyping]);

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    const previousSchedule = [...schedule];
    const previousActive = activeAppointment ? { ...activeAppointment } : null;

    setSchedule(prev => prev.map(appt =>
      appt.id === appointmentId ? { ...appt, status: newStatus } : appt
    ));
    if (activeAppointment && activeAppointment.id === appointmentId) {
      setActiveAppointment(prev => ({ ...prev, status: newStatus }));
    }

    try {
      await axios.put(
        `${API_BASE_URL}/doctor/appointment/${appointmentId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showStatusNotification('Status successfully updated.');
    } catch (err) {
      setSchedule(previousSchedule);
      setActiveAppointment(previousActive);
      showStatusNotification(err.response?.data?.detail || 'Failed to update status', true);
    }
  };

  const handleSelectAppointment = (appt) => {
    setActiveAppointment(appt);
    setSummaryText(appt.summary || '');
    setTimeout(() => notesContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSaveSummary = async () => {
    if (!summaryText.trim()) { showStatusNotification('Notes cannot be empty.', true); return; }
    setIsSaving(true);
    try {
      await axios.put(
        `${API_BASE_URL}/doctor/appointment/${activeAppointment.id}/summary`,
        { summary: summaryText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showStatusNotification('Clinical summary saved! Appointment marked as Finished.');
      loadDoctorSchedule();
    } catch (err) {
      showStatusNotification(err.response?.data?.detail || 'Failed to save notes', true);
    } finally { setIsSaving(false); }
  };

  const handleSendChatMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { sender: 'doctor', text: userMessage }]);
    setIsTyping(true);
    const docName = localStorage.getItem('userName') || '';
    const formattedName = docName.startsWith('Dr') ? docName : `Dr. ${docName}`;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/doctor/chat`,
        { patient_id: aiModal.patientId, question: userMessage, doctor_name: formattedName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChatHistory(prev => [...prev, { sender: 'ai', text: res.data.answer }]);
    } catch {
      setChatHistory(prev => [...prev, { sender: 'ai', text: '⚠️ Error connecting to AI. Please try again.' }]);
    } finally { setIsTyping(false); }
  };

  const openAiModal = (appt) => {
    setAiModal({ show: true, patientId: appt.patient_id, patientName: appt.patient_name });
    const docName = localStorage.getItem('userName') || '';
    const formattedName = docName.startsWith('Dr') ? docName : `Dr. ${docName}`;
    setChatHistory([{
      sender: 'ai',
      text: `Hello ${formattedName}. I have loaded the records for ${appt.patient_name}. What would you like to know?`,
    }]);
  };

  /* derived */
  const userName = localStorage.getItem('userName') || '';
  const formattedDrName = userName.startsWith('Dr') ? userName : `Dr. ${userName}`;
  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const scheduled  = schedule.filter(a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length;
  const inProgress = schedule.filter(a => a.status === 'STARTED' || a.status === 'ARRIVED').length;
  const finished   = schedule.filter(a => a.status === 'COMPLETED').length;

  // ── FIX: FILTER BY TABS AND SEARCH BAR STRING SIMULTANEOUSLY ──
  const filteredSchedule = schedule.filter(a => {
    // 1. Check if it matches the current Tab
    let matchesTab = true;
    if (activeTab === 'TODAY')    matchesTab = a.date === todayISO;
    if (activeTab === 'ACTIVE')   matchesTab = ['SCHEDULED','CONFIRMED','ARRIVED','STARTED'].includes(a.status);
    if (activeTab === 'FINISHED') matchesTab = a.status === 'COMPLETED' || a.status === 'CANCELLED';
    
    // 2. Check if the patient name matches the search box
    const matchesSearch = a.patient_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  const focusStyle = e => { e.target.style.borderColor = '#1D9E75'; e.target.style.background = '#FFFFFF'; };
  const blurStyle  = e => { e.target.style.borderColor = '#D3D1C7'; e.target.style.background = '#F7F6F3'; };

  /* ─── RENDER ─── */
  return (
    <div style={{ backgroundColor: '#F7F6F3', minHeight: '100vh', fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing: border-box; }
        @keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulse   { 0%,100%{opacity:1;} 50%{opacity:.35;} }
        @keyframes blink   { 0%,100%{opacity:1;} 50%{opacity:.2;} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }
        .appt-row:hover { background: #FAFAF8 !important; }
        .slot-select:focus { border-color:#1D9E75 !important; outline:none; }
        .btn-hover-teal:hover  { background:#085041 !important; }
        .btn-hover-blue:hover  { background:#0C447C !important; }
        .btn-hover-purple:hover{ background:#3C3489 !important; }
        .tab-btn { transition: all .15s; }
        .chat-input:focus { border-color:#1D9E75 !important; outline:none; }
      `}</style>

      <Navbar />

      {/* ── TOAST ── */}
      {notification.show && (
        <div style={{
          position:'fixed', top:76, right:24, zIndex:9999,
          display:'flex', alignItems:'center', gap:10,
          padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:600,
          boxShadow:'0 8px 30px rgba(0,0,0,0.10)',
          backgroundColor: notification.isError ? '#FCEBEB' : '#E1F5EE',
          color: notification.isError ? '#A32D2D' : '#085041',
          border:`1.5px solid ${notification.isError ? '#F09595' : '#5DCAA5'}`,
          maxWidth:400, animation:'slideIn .25s ease',
        }}>
          {notification.isError ? <AlertIcon /> : <CheckIcon />}
          {notification.message}
        </div>
      )}

      {/* ── AI CHAT MODAL ── */}
      {aiModal.show && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(15,23,42,0.55)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:99999 }}>
          <div style={{ background:'#FFFFFF', borderRadius:16, width:500, height:620, display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.20)', overflow:'hidden', animation:'fadeUp .25s ease' }}>

            {/* Modal header */}
            <div style={{ background:'#0F6E56', padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, color:'#FFFFFF', fontWeight:700, fontSize:16 }}>
                  <SparkleIcon /> Clinical AI Assistant
                </div>
                <div style={{ fontSize:12, color:'#9FE1CB', marginTop:4 }}>
                  Analysing records for: <strong style={{ color:'#E1F5EE' }}>{aiModal.patientName}</strong>
                </div>
              </div>
              <button
                onClick={() => setAiModal({ show:false, patientId:null, patientName:'' })}
                style={{ background:'rgba(255,255,255,0.15)', border:'none', width:32, height:32, borderRadius:'50%', color:'#FFFFFF', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              >
                <XIcon />
              </button>
            </div>

            {/* Chat messages */}
            <div ref={chatScrollRef} style={{ flex:1, padding:'20px', overflowY:'auto', background:'#F7F6F3', display:'flex', flexDirection:'column', gap:14 }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{ display:'flex', justifyContent: msg.sender === 'doctor' ? 'flex-end' : 'flex-start' }}>
                  {msg.sender === 'ai' && (
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'#E1F5EE', color:'#0F6E56', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginRight:8, fontSize:13, fontWeight:700 }}>
                      AI
                    </div>
                  )}
                  <div style={{
                    maxWidth:'78%', padding:'11px 15px', borderRadius:12, fontSize:13, lineHeight:1.55,
                    background: msg.sender === 'doctor' ? '#0F6E56' : '#FFFFFF',
                    color: msg.sender === 'doctor' ? '#FFFFFF' : '#2C2C2A',
                    border: msg.sender === 'ai' ? '1px solid #EEECE5' : 'none',
                    borderBottomRightRadius: msg.sender === 'doctor' ? 4 : 12,
                    borderBottomLeftRadius: msg.sender === 'ai' ? 4 : 12,
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#E1F5EE', color:'#0F6E56', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>AI</div>
                  <div style={{ background:'#FFFFFF', border:'1px solid #EEECE5', padding:'10px 16px', borderRadius:12, borderBottomLeftRadius:4 }}>
                    <span style={{ display:'flex', gap:4 }}>
                      {[0,1,2].map(i => (
                        <span key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#1D9E75', display:'inline-block', animation:`blink 1.2s infinite ${i*0.2}s` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <form onSubmit={handleSendChatMessage} style={{ padding:'14px 18px', background:'#FFFFFF', borderTop:'1px solid #EEECE5', display:'flex', gap:10 }}>
              <input
                className="chat-input"
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about diagnoses, blood pressure, past records…"
                style={{ flex:1, padding:'10px 16px', borderRadius:24, border:'1px solid #D3D1C7', fontSize:13, background:'#F7F6F3', color:'#2C2C2A', fontFamily:'inherit', transition:'border-color .15s' }}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isTyping}
                style={{
                  background: chatInput.trim() && !isTyping ? '#0F6E56' : '#D3D1C7',
                  color:'#FFFFFF', border:'none', borderRadius:24,
                  padding:'0 18px', fontWeight:600, cursor: chatInput.trim() && !isTyping ? 'pointer' : 'not-allowed',
                  display:'flex', alignItems:'center', gap:6, fontSize:13, fontFamily:'inherit',
                  transition:'background .15s',
                }}
              >
                <SendIcon /> Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── PAGE BODY ── */}
      <div style={{ padding:'32px 40px', maxWidth:1340, margin:'0 auto' }}>

        {/* Page header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <div style={{ fontSize:24, fontWeight:600, color:'#2C2C2A', letterSpacing:'-0.3px' }}>
              {greeting}, {formattedDrName}
            </div>
            <div style={{ fontSize:13, color:'#888780', marginTop:4 }}>
              Here's your clinical schedule and patient overview
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'#E1F5EE', border:'1px solid #9FE1CB', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#0F6E56', fontWeight:500 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#1D9E75', display:'inline-block', animation:'pulse 2s infinite' }} />
            {todayStr}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          {[
            { icon:<CalendarIcon size={17}/>, value:scheduled,  label:'Scheduled Today',  iconBg:'#E1F5EE', iconColor:'#0F6E56', badge:'Upcoming',    badgeBg:'#E1F5EE', badgeColor:'#27500A' },
            { icon:<UserIcon size={17}/>,     value:inProgress, label:'In Progress',      iconBg:'#E6F1FB', iconColor:'#185FA5', badge:'Active now',  badgeBg:'#E6F1FB', badgeColor:'#0C447C' },
            { icon:<CheckIcon/>,              value:finished,   label:'Consultations Done',iconBg:'#EAF3DE', iconColor:'#27500A', badge:'Completed',    badgeBg:'#EAF3DE', badgeColor:'#27500A' },
            { icon:<NoteIcon size={17}/>,     value:schedule.length, label:'Total Appointments',iconBg:'#FAEEDA', iconColor:'#854F0B', badge:'All time', badgeBg:'#FAEEDA', badgeColor:'#854F0B' },
          ].map((s, i) => (
            <div key={i} style={{ background:'#FFFFFF', border:'1px solid #EEECE5', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ width:36, height:36, borderRadius:8, background:s.iconBg, color:s.iconColor, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                {s.icon}
              </div>
              <div style={{ fontSize:26, fontWeight:700, color:'#2C2C2A', lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:12, color:'#888780', margin:'4px 0' }}>{s.label}</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999, background:s.badgeBg, color:s.badgeColor }}>
                {s.badge}
              </div>
            </div>
          ))}
        </div>

        {/* Schedule card */}
        <div style={{ background:'#FFFFFF', border:'1px solid #EEECE5', borderRadius:14, overflow:'hidden', marginBottom:28 }}>

          {/* Card header */}
          <div style={{ padding:'18px 28px', borderBottom:'1px solid #EEECE5', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'#E1F5EE', color:'#0F6E56', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <StethIcon />
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#2C2C2A' }}>My Daily Schedule</div>
                <div style={{ fontSize:12, color:'#888780', marginTop:2 }}>Update live status, write summaries, and chat with AI</div>
              </div>
            </div>

            {/* ── NEW: SEARCH AND TABS WRAPPER ── */}
            <div style={{ display:'flex', alignItems:'center', gap:15, flexWrap:'wrap' }}>
              
              {/* Search Bar */}
              <input 
                type="text"
                placeholder="Search patient name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: '1px solid #D3D1C7',
                  fontSize: '13px', outline: 'none', background: '#F7F6F3', width: '220px',
                  fontFamily: 'inherit', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1D9E75'}
                onBlur={(e) => e.target.style.borderColor = '#D3D1C7'}
              />

              {/* Tab pills */}
              <div style={{ display:'flex', gap:4, background:'#EEECE5', borderRadius:8, padding:3 }}>
                {['ALL','TODAY','ACTIVE','FINISHED'].map(tab => (
                  <button
                    key={tab}
                    className="tab-btn"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      fontFamily:'inherit', fontSize:11, fontWeight:600,
                      padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer',
                      background: activeTab === tab ? '#FFFFFF' : 'transparent',
                      color: activeTab === tab ? '#2C2C2A' : '#888780',
                      boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {filteredSchedule.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#888780' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>☕</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#5F5E5A', marginBottom:4 }}>
                {searchQuery ? `No patients matching "${searchQuery}"` : 'No appointments found'}
              </div>
              <div style={{ fontSize:13 }}>Your schedule is clear for this view.</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['Patient Name','Date','Time Window','Live Status','Clinical Actions'].map(h => (
                    <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:700, color:'#888780', letterSpacing:'0.07em', textTransform:'uppercase', padding:'13px 22px', borderBottom:'1px solid #EEECE5', background:'#FAFAF8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSchedule.map((appt, idx) => {
                  const isLocked    = appt.status === 'COMPLETED' || appt.status === 'CANCELLED';
                  const canSummary  = appt.status === 'STARTED'   || appt.status === 'COMPLETED';
                  const canAsk      = appt.status !== 'CANCELLED';
                  const isActive    = activeAppointment?.id === appt.id;
                  const st          = getStatusStyle(appt.status);
                  const av          = AVATAR_COLORS[idx % AVATAR_COLORS.length];

                  return (
                    <tr
                      key={appt.id}
                      className="appt-row"
                      style={{ borderBottom:'1px solid #EEECE5', background: isActive ? '#F0FBF7' : 'transparent', transition:'background .1s' }}
                    >
                      {/* Patient name */}
                      <td style={{ padding:'15px 22px', verticalAlign:'middle' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:'50%', background: isActive ? '#1D9E75' : av.bg, color: isActive ? '#FFFFFF' : av.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0, transition:'all .2s' }}>
                            {appt.patient_name.slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight:600, color:'#2C2C2A', fontSize:13 }}>{appt.patient_name}</div>
                            <div style={{ fontSize:11, color:'#888780', marginTop:1 }}>Patient</div>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding:'15px 22px', verticalAlign:'middle' }}>
                        <div style={{ fontWeight:500, color:'#2C2C2A', fontSize:13 }}>{appt.date}</div>
                        <div style={{ fontSize:11, color:'#888780', marginTop:1 }}>{appt.date === todayISO ? 'Today' : appt.date > todayISO ? 'Upcoming' : 'Past'}</div>
                      </td>

                      {/* Time */}
                      <td style={{ padding:'15px 22px', verticalAlign:'middle' }}>
                        <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#F7F6F3', border:'1px solid #D3D1C7', color:'#5F5E5A', borderRadius:6, padding:'5px 10px', fontSize:12, fontWeight:500 }}>
                          <ClockIcon size={12}/> {appt.time}
                        </div>
                      </td>

                      {/* Status dropdown */}
                      <td style={{ padding:'15px 22px', verticalAlign:'middle' }}>
                        {isLocked ? (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:999, fontSize:11, fontWeight:700, background:st.bg, color:st.color }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:st.dot, display:'inline-block' }} />
                            {st.label}
                          </span>
                        ) : (
                          <div style={{ position:'relative', display:'inline-block' }}>
                            <select
                              className="slot-select"
                              value={appt.status === 'CONFIRMED' ? 'SCHEDULED' : appt.status}
                              onChange={e => handleUpdateStatus(appt.id, e.target.value)}
                              style={{
                                fontFamily:'inherit', fontSize:12, fontWeight:600,
                                padding:'6px 32px 6px 10px',
                                border:`1px solid ${st.dot}`,
                                borderRadius:8, cursor:'pointer',
                                background: st.bg, color:st.color,
                                appearance:'none', WebkitAppearance:'none',
                                transition:'border-color .15s',
                              }}
                            >
                              <option value="SCHEDULED">Scheduled</option>
                              <option value="ARRIVED">Arrived</option>
                              <option value="STARTED">Started</option>
                              <option value="COMPLETED">Finished</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                            <span style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:st.color }}>
                              <ChevronDown />
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding:'15px 22px', verticalAlign:'middle' }}>
                        <div style={{ display:'flex', gap:8 }}>
                          {/* Write / View Summary */}
                          <button
                            className={canSummary ? (appt.status === 'COMPLETED' ? 'btn-hover-blue' : 'btn-hover-teal') : ''}
                            onClick={() => handleSelectAppointment(appt)}
                            disabled={!canSummary}
                            style={{
                              fontFamily:'inherit', fontSize:11, fontWeight:600,
                              padding:'6px 12px', borderRadius:7,
                              display:'flex', alignItems:'center', gap:5, cursor: canSummary ? 'pointer' : 'not-allowed',
                              border: !canSummary ? '1px solid #EEECE5' : appt.status === 'COMPLETED' ? '1px solid #85B7EB' : 'none',
                              background: !canSummary ? '#F7F6F3' : appt.status === 'COMPLETED' ? '#E6F1FB' : '#0F6E56',
                              color: !canSummary ? '#B4B2A9' : appt.status === 'COMPLETED' ? '#185FA5' : '#FFFFFF',
                              transition:'background .15s',
                            }}
                          >
                            {appt.status === 'COMPLETED' ? <><EyeIcon /> View Summary</> : <><EditIcon /> Write Summary</>}
                          </button>

                          {/* Ask AI */}
                          <button
                            className={canAsk ? 'btn-hover-purple' : ''}
                            onClick={() => openAiModal(appt)}
                            disabled={!canAsk}
                            style={{
                              fontFamily:'inherit', fontSize:11, fontWeight:600,
                              padding:'6px 12px', borderRadius:7,
                              display:'flex', alignItems:'center', gap:5, cursor: canAsk ? 'pointer' : 'not-allowed',
                              border: !canAsk ? '1px solid #EEECE5' : '1px solid #AFA9EC',
                              background: !canAsk ? '#F7F6F3' : '#EEEDFE',
                              color: !canAsk ? '#B4B2A9' : '#534AB7',
                              transition:'background .15s',
                            }}
                          >
                            <SparkleIcon /> Ask AI
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── APPOINTMENT SUMMARY BOX ── */}
        <div ref={notesContainerRef} style={{ background:'#FFFFFF', border:'1px solid #EEECE5', borderRadius:14, overflow:'hidden' }}>

          <div style={{ padding:'18px 28px', borderBottom:'1px solid #EEECE5', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:8, background:'#FAEEDA', color:'#854F0B', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <NoteIcon size={17}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:'#2C2C2A' }}>Appointment Summary Box</div>
              <div style={{ fontSize:12, color:'#888780', marginTop:2 }}>
                {activeAppointment
                  ? `Writing clinical notes for ${activeAppointment.patient_name}`
                  : 'Select a patient from the table above to view or write their summary'}
              </div>
            </div>
          </div>

          <div style={{ padding:'28px 32px' }}>
            {!activeAppointment ? (
              <div style={{ textAlign:'center', padding:'48px 20px', border:'1.5px dashed #D3D1C7', borderRadius:12, color:'#888780' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>☝️</div>
                <div style={{ fontSize:14, fontWeight:600, color:'#5F5E5A', marginBottom:4 }}>No patient selected</div>
                <div style={{ fontSize:13 }}>Change an appointment status to "Started" and click "Write Summary" to begin.</div>
              </div>
            ) : (
              <div style={{ animation:'fadeUp .2s ease' }}>
                {/* Patient meta strip */}
                <div style={{ display:'flex', gap:24, marginBottom:22, padding:'14px 18px', background:'#F7F6F3', borderRadius:10, fontSize:13, flexWrap:'wrap' }}>
                  {[
                    { label:'Patient',        value: activeAppointment.patient_name },
                    { label:'Date',           value: activeAppointment.date },
                    { label:'Time',           value: activeAppointment.time },
                    { label:'Current Status', value: getStatusStyle(activeAppointment.status).label, isBadge:true },
                  ].map(item => (
                    <div key={item.label}>
                      <span style={{ color:'#888780', fontSize:11, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>{item.label}</span>
                      <div style={{ marginTop:3 }}>
                        {item.isBadge ? (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:5,
                            padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700,
                            background: getStatusStyle(activeAppointment.status).bg,
                            color: getStatusStyle(activeAppointment.status).color,
                          }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background:getStatusStyle(activeAppointment.status).dot, display:'inline-block' }} />
                            {item.value}
                          </span>
                        ) : (
                          <span style={{ fontWeight:600, color:'#2C2C2A', fontSize:13 }}>{item.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes label */}
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5F5E5A', letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>
                  Clinical Notes &amp; Diagnosis
                </label>

                {/* Textarea */}
                <textarea
                  value={summaryText}
                  onChange={e => setSummaryText(e.target.value)}
                  placeholder={
                    activeAppointment.status === 'STARTED'
                      ? 'Enter consultation summary, diagnosis, and prescribed treatments here…'
                      : 'Records are locked. Cannot edit summary outside of an active "Started" appointment.'
                  }
                  readOnly={activeAppointment.status !== 'STARTED'}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                  style={{
                    width:'100%', height:200, padding:'15px 16px',
                    borderRadius:10, border:'1px solid #D3D1C7',
                    fontSize:13, fontFamily:'inherit', resize:'vertical',
                    boxSizing:'border-box', outline:'none', lineHeight:1.65,
                    background: activeAppointment.status !== 'STARTED' ? '#F7F6F3' : '#FFFFFF',
                    color:'#2C2C2A', transition:'border-color .15s, background .15s',
                  }}
                />

                {/* Save button */}
                {activeAppointment.status === 'STARTED' && (
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:18 }}>
                    <button
                      onClick={handleSaveSummary}
                      disabled={isSaving}
                      className={isSaving ? '' : 'btn-hover-teal'}
                      style={{
                        fontFamily:'inherit', padding:'12px 24px', borderRadius:9,
                        border:'none',
                        background: isSaving ? '#D3D1C7' : '#0F6E56',
                        color:'#FFFFFF', fontWeight:700, fontSize:14,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        display:'flex', alignItems:'center', gap:8,
                        transition:'background .15s',
                      }}
                    >
                      <SaveIcon />
                      {isSaving ? 'Saving…' : 'Save Summary & Finish Appointment'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default DoctorDashboard;