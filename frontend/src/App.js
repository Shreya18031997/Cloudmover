// frontend/src/App.js
import React from 'react';

function App() {
  // Function to trigger login
  const handleGoogleLogin = async () => {
    try {
      const response = await window.location.href('http://localhost:8000/auth/google', {
        method: 'GET',
        redirect: 'follow',
      });

      // Open Google's login screen in a new tab
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>📁 Connect your google drive</h1>
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
  );
}

export default App;