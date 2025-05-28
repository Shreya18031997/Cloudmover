// frontend/src/Dashboard.js
import React, { useEffect, useState } from 'react';
import FileList from './FileList';

function Dashboard() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>📁 Welcome, {email}</h1>
      {email && <FileList email={email} />}
    </div>
  );
}

export default Dashboard;