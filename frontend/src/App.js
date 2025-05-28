// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';

function App() {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:8000/auth/google';
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
              <h1>📁 Connect your Google Drive</h1>
              <p>Connect your Google Drive account to manage files.</p>
              <button
                onClick={handleGoogleLogin}
                style={{
                  backgroundColor: '#4285F4',
                  color: 'white',
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                Connect Google Drive
              </button>
            </div>
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;