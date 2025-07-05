import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function FaceMatcher() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [matchResult, setMatchResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    setMatchResult(null);

    if (selected) {
      // Preview URL is not used in the component
      URL.createObjectURL(selected);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select an image");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/match-face", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setMatchResult(data);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to connect to server.");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <nav style={{ padding: '1rem', backgroundColor: '#f8f9fa', marginBottom: '1rem' }}>
        <button 
          onClick={() => navigate('/')}
          style={{ marginRight: '1rem', padding: '8px 16px', cursor: 'pointer' }}
        >
          ← Home
        </button>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Dashboard
        </button>
      </nav>

      <h2>🔍 Upload Image to Auto-Tag Face</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      <br />
      <button
        onClick={handleUpload}
        style={{ marginTop: 10, padding: "8px 16px", cursor: "pointer" }}
      >
        Upload & Match
      </button>

      {matchResult && (
        <div style={{ marginTop: 20 }}>
          {matchResult.match ? (
            <p>
              ✅ Match: <strong>{matchResult.match}</strong> (Distance:{" "}
              {matchResult.distance.toFixed(2)})
            </p>
          ) : (
            <p>❌ {matchResult.message || "No match found"}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default FaceMatcher;