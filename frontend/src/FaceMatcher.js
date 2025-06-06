import React, { useState } from "react";

function FaceMatcher() {
  const [file, setFile] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileChange = (e) => {
  const selected = e.target.files[0];
  setFile(selected);
  setMatchResult(null);

  if (selected) {
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
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