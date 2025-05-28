// frontend/src/FileList.js
import React, { useEffect, useState } from 'react';

function FileList({ email }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(`http://localhost:8000/list-files?email=${email}`);
        const data = await response.json();
        setFiles(data.files || []);
      } catch (error) {
        console.error("Failed to fetch files:", error);
      } finally {
        setLoading(false);
      }
    };

    if (email) {
      fetchFiles();
    }
  }, [email]);

  if (loading) return <p>Loading files...</p>;

  return (
    <div>
      <h2>📂 Google Drive Files</h2>
      <ul>
        {files.map((file) => (
          <li key={file.id}>
            <strong>{file.name}</strong> ({file.mimeType}, {file.size || 0} bytes)
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FileList;