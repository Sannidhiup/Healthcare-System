import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Core Workflow Component Imports
import LoginPage from './components/Login';
import RegisterPage from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Main Landing/Authentication Gateway */}
          <Route path="/" element={<LoginPage />} />
          
          {/* Patient Self-Registration Onboarding Endpoint */}
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Role-Based Secure Workspace Dashboards */}
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;