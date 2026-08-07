import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Homepage from './pages/Homepage.jsx';
import RegisterPage from './pages/Registerpage.jsx';
import Navbar from './components/layout/Navbar.jsx';
import DemoPage from './pages/DemoPage.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

export default function App() {
  return (
    <AuthProvider>
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/demo" element={<DemoPage />} /> 
      </Routes>
    </Router>
    </AuthProvider>
  );
}