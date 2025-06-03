import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard'; // ⬅️ this pulls in your dashboard file

function App() {
  const connectSource = () => {
    window.location.href = 'http://localhost:8000/auth/source';
  };

  const connectDestination = () => {
    window.location.href = 'http://localhost:8000/auth/destination';
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
              <h1>🔗 Connect Two Google Drives</h1>
              <p>Use the buttons below to connect both your source and destination Drive accounts.</p>
              <button onClick={connectSource} style={{ marginRight: 16 }}>
                Connect Source Drive
              </button>
              <button onClick={connectDestination}>
                Connect Destination Drive
              </button>
            </div>
          }
        />

        {/* ✅ This renders Dashboard.js when the user visits /dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;