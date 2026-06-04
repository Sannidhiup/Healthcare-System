import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Navbar from './Navbar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';

function DoctorDashboard() {
  const token = localStorage.getItem('token');
  const [notification, setNotification] = useState({ show: false, message: '', isError: false });
  
  const [schedule, setSchedule] = useState([]);
  
  // ── SUMMARY BOX STATE ──
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [summaryText, setSummaryText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const notesContainerRef = useRef(null);

  // ── AI CHAT STATE ──
  const [aiModal, setAiModal] = useState({ show: false, patientId: null, patientName: '' });
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef(null);

  const showStatusNotification = useCallback((msg, isErr = false) => {
    setNotification({ show: true, message: msg, isError: isErr });
    setTimeout(() => setNotification({ show: false, message: '', isError: false }), 4000);
  }, []);

  const loadDoctorSchedule = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/doctor/my-schedule`, { headers: { Authorization: `Bearer ${token}` } });
      const sortedData = res.data.sort((a, b) => new Date(`${b.date}T${b.time.split(' - ')[0]}`) - new Date(`${a.date}T${a.time.split(' - ')[0]}`));
      setSchedule(sortedData);

      if (activeAppointment) {
        const updatedActive = sortedData.find(a => a.id === activeAppointment.id);
        if (updatedActive) setActiveAppointment(updatedActive);
      }
    } catch (err) { console.error("Error fetching schedule:", err); }
  }, [token, activeAppointment]);

  useEffect(() => {
    loadDoctorSchedule();
    const userName = localStorage.getItem('userName') || '';
    const hasGreeted = sessionStorage.getItem('hasGreeted');
    if (userName && !hasGreeted) {
      const formattedName = userName.startsWith('Dr') ? userName : `Dr. ${userName}`;
      showStatusNotification(`Welcome to your portal, ${formattedName}`, false);
      sessionStorage.setItem('hasGreeted', 'true');
    }
  }, [loadDoctorSchedule, showStatusNotification]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    try {
      await axios.put(`${API_BASE_URL}/doctor/appointment/${appointmentId}/status`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      showStatusNotification(`Status successfully updated.`);
      loadDoctorSchedule(); 
    } catch (err) { showStatusNotification(err.response?.data?.detail || "Failed to update status", true); }
  };

  const handleSelectAppointment = (appointment) => {
    setActiveAppointment(appointment);
    setSummaryText(appointment.summary || "");
    setTimeout(() => { notesContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const handleSaveSummary = async () => {
    if (!summaryText.trim()) { showStatusNotification("Notes cannot be empty.", true); return; }
    setIsSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/doctor/appointment/${activeAppointment.id}/summary`, { summary: summaryText }, { headers: { Authorization: `Bearer ${token}` } });
      showStatusNotification("Clinical summary saved! Appointment marked as Finished.");
      loadDoctorSchedule();
    } catch (err) { showStatusNotification(err.response?.data?.detail || "Failed to save notes", true); } 
    finally { setIsSaving(false); }
  };

  const handleSendChatMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { sender: 'doctor', text: userMessage }]);
    setIsTyping(true);

    // ── FIX: Grab the exact doctor name to send to Python ──
    const docName = localStorage.getItem('userName') || '';
    const formattedName = docName.startsWith('Dr') ? docName : `Dr. ${docName}`;

    try {
      const res = await axios.post(`${API_BASE_URL}/doctor/chat`, 
        { 
          patient_id: aiModal.patientId, 
          question: userMessage,
          doctor_name: formattedName // ── FIX: Sending the name securely! ──
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChatHistory(prev => [...prev, { sender: 'ai', text: res.data.answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: "⚠️ Error connecting to AI securely. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const openAiModal = (appt) => {
    setAiModal({ show: true, patientId: appt.patient_id, patientName: appt.patient_name });
    const docName = localStorage.getItem('userName') || '';
    const formattedName = docName.startsWith('Dr') ? docName : `Dr. ${docName}`;
    
    setChatHistory([{ sender: 'ai', text: `Hello ${formattedName}. I have loaded the records for ${appt.patient_name}. What would you like to know?` }]);
  };

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', paddingBottom: '60px' }}>
      <Navbar />

      {notification.show && (
        <div style={{ position: 'fixed', top: 76, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backgroundColor: notification.isError ? '#fff1f1' : '#f0fdf4', color: notification.isError ? '#c0392b' : '#166534', border: `1.5px solid ${notification.isError ? '#fca5a5' : '#86efac'}`, maxWidth: 420 }}>
          <span style={{ fontSize: 18 }}>{notification.isError ? '⚠️' : '✅'}</span>
          {notification.message}
        </div>
      )}

      {/* ── AI CHAT MODAL ── */}
      {aiModal.show && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '500px', height: '600px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>✨ Clinical AI Assistant</h3>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Analyzing records for: {aiModal.patientName}</div>
              </div>
              <button onClick={() => setAiModal({ show: false, patientId: null, patientName: '' })} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 32, height: 32, borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div ref={chatScrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: msg.sender === 'doctor' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ 
                    maxWidth: '80%', padding: '12px 16px', borderRadius: '14px', fontSize: '14px', lineHeight: 1.5,
                    background: msg.sender === 'doctor' ? '#2563eb' : 'white', 
                    color: msg.sender === 'doctor' ? 'white' : '#334155',
                    border: msg.sender === 'ai' ? '1px solid #e2e8f0' : 'none',
                    borderBottomRightRadius: msg.sender === 'doctor' ? '4px' : '14px',
                    borderBottomLeftRadius: msg.sender === 'ai' ? '4px' : '14px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                  }}>
                    {msg.sender === 'ai' && <span style={{ fontSize: 16, marginRight: 6 }}>🤖</span>}
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: '14px', color: '#94a3b8', fontSize: '20px', display: 'flex', gap: 4, alignItems: 'center', fontWeight: 'bold', letterSpacing: '2px', height: '24px' }}>
                    <span style={{ animation: 'blink 1s infinite' }}>.....</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendChatMessage} style={{ padding: '16px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about blood pressure, past diagnoses..." 
                style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: '#f1f5f9' }}
              />
              <button type="submit" disabled={!chatInput.trim() || isTyping} style={{ background: chatInput.trim() && !isTyping ? '#2563eb' : '#94a3b8', color: 'white', border: 'none', borderRadius: '24px', padding: '0 20px', fontWeight: 600, cursor: chatInput.trim() && !isTyping ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MAIN DASHBOARD LAYOUT ── */}
      <div style={{ padding: '30px 40px', maxWidth: 1300, margin: '0 auto' }}>
        
        <div style={P.card}>
          <div style={P.cardTop}>
            <span style={{ fontSize: 24 }}>🩺</span>
            <div>
              <div style={P.cardTitle}>My Daily Schedule</div>
              <div style={P.cardSub}>Update live status, write summaries, and chat with AI</div>
            </div>
          </div>
          
          <div style={P.cardBody}>
            {schedule.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>☕</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>No appointments found</div>
                <div style={{ fontSize: 14 }}>Your schedule is currently clear.</div>
              </div>
            ) : (
              <table style={P.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Patient Name', 'Date', 'Time Window', 'Live Status Control', 'Clinical Actions'].map(h => <th key={h} style={P.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(appt => {
                    const isStatusLocked = appt.status === 'COMPLETED' || appt.status === 'CANCELLED';
                    const canWriteOrView = appt.status === 'STARTED' || appt.status === 'COMPLETED';
                    const canAskAi = appt.status !== 'CANCELLED'; 

                    return (
                      <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9', background: activeAppointment?.id === appt.id ? '#eff6ff' : 'transparent' }} onMouseEnter={e => { if (activeAppointment?.id !== appt.id) e.currentTarget.style.background = '#f8fafc'; }} onMouseLeave={e => { if (activeAppointment?.id !== appt.id) e.currentTarget.style.background = 'transparent'; }}>
                        
                        <td style={P.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: activeAppointment?.id === appt.id ? '#3b82f6' : '#e2e8f0', color: activeAppointment?.id === appt.id ? 'white' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                              {appt.patient_name.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{appt.patient_name}</span>
                          </div>
                        </td>
                        
                        <td style={{ ...P.td, color: '#64748b', fontWeight: 500 }}>{appt.date}</td>
                        <td style={{ ...P.td, color: '#334155', fontWeight: 600 }}>{appt.time}</td>
                        
                        <td style={P.td}>
                          <select 
                            value={appt.status === 'CONFIRMED' ? 'SCHEDULED' : appt.status} 
                            onChange={(e) => handleUpdateStatus(appt.id, e.target.value)}
                            disabled={isStatusLocked}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, color: '#334155', outline: 'none', cursor: isStatusLocked ? 'not-allowed' : 'pointer', background: isStatusLocked ? '#f1f5f9' : 'white' }}
                          >
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="ARRIVED">Arrived</option>
                            <option value="STARTED">Started</option>
                            <option value="COMPLETED">Finished</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </td>
                        
                        <td style={P.td}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => handleSelectAppointment(appt)} 
                              disabled={!canWriteOrView}
                              style={{ 
                                padding: '8px 12px', 
                                borderRadius: '8px', 
                                border: appt.status === 'COMPLETED' ? '1px solid #2563eb' : 'none', 
                                background: !canWriteOrView ? '#f1f5f9' : (appt.status === 'COMPLETED' ? 'white' : '#2563eb'), 
                                color: !canWriteOrView ? '#94a3b8' : (appt.status === 'COMPLETED' ? '#2563eb' : 'white'), 
                                fontSize: '12px', 
                                fontWeight: 700, 
                                cursor: !canWriteOrView ? 'not-allowed' : 'pointer' 
                              }}
                            >
                              {appt.status === 'COMPLETED' ? '👁️ View Summary' : '✍️ Write Summary'}
                            </button>

                            <button 
                              onClick={() => openAiModal(appt)}
                              disabled={!canAskAi} 
                              style={{ 
                                padding: '8px 12px', 
                                borderRadius: '8px', 
                                border: !canAskAi ? '1px solid #cbd5e1' : '1px solid #e2e8f0', 
                                background: !canAskAi ? '#f1f5f9' : 'linear-gradient(135deg, #fdf4ff, #fae8ff)', 
                                color: !canAskAi ? '#94a3b8' : '#9333ea', 
                                fontSize: '12px', 
                                fontWeight: 700, 
                                cursor: !canAskAi ? 'not-allowed' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 4 
                              }}
                            >
                              ✨ Ask AI
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
        </div>

        {/* ── BOTTOM SECTION: CLINICAL NOTES TEXTAREA ── */}
        <div ref={notesContainerRef} style={{ ...P.card, marginTop: '30px' }}>
          <div style={{ ...P.cardTop, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 24 }}>📝</span>
            <div>
              <div style={P.cardTitle}>Appointment Summary Box</div>
              <div style={P.cardSub}>
                {activeAppointment ? `Writing notes for ${activeAppointment.patient_name}` : "Select a patient from the table above to view or write their summary."}
              </div>
            </div>
          </div>
          
          <div style={{ padding: '30px' }}>
            {!activeAppointment ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                <div style={{ fontSize: 32, marginBottom: '10px' }}>👆</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>No patient selected</div>
                <div style={{ fontSize: 13 }}>Change an appointment status to "Started" and click "Write Summary" to begin.</div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '10px', fontSize: '13px', color: '#475569' }}>
                  <div><strong>Patient:</strong> {activeAppointment.patient_name}</div>
                  <div><strong>Date:</strong> {activeAppointment.date}</div>
                  <div><strong>Time:</strong> {activeAppointment.time}</div>
                  <div><strong>Current Status:</strong> <span style={{ background: 'white', padding: '2px 8px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{activeAppointment.status}</span></div>
                </div>

                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Clinical Notes & Diagnosis</label>
                <textarea 
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  placeholder={activeAppointment.status === 'STARTED' ? "Enter consultation summary, diagnosis, and prescribed treatments here..." : "Records are locked. Cannot edit summary outside of an active 'Started' appointment."}
                  readOnly={activeAppointment.status !== 'STARTED'}
                  style={{ width: '100%', height: '200px', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', background: activeAppointment.status !== 'STARTED' ? '#f8fafc' : 'white', color: '#1e293b' }}
                />

                {activeAppointment.status === 'STARTED' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button onClick={handleSaveSummary} disabled={isSaving} style={{ padding: '14px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                      {isSaving ? 'Saving...' : '💾 Save Summary & Finish Appointment'}
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

const P = {
  card: { background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' },
  cardTop: { background: '#f8fafc', padding: '24px 30px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #e2e8f0' },
  cardTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a' },
  cardSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  cardBody: { padding: '0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '16px 30px', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '16px 30px', verticalAlign: 'middle' }
};

export default DoctorDashboard;