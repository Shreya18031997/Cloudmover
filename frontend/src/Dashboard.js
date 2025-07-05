import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Dashboard.module.css';

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceConnected, setSourceConnected] = useState(false);
  const [destinationConnected, setDestinationConnected] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [fileTypeFilter, setFileTypeFilter] = useState('All');
  const [sourceToken, setSourceToken] = useState(localStorage.getItem('sourceToken') || '');
  const [destToken, setDestToken] = useState(localStorage.getItem('destToken') || '');

  // Handle tokens from URL parameters
  useEffect(() => {
    const type = searchParams.get('type');
    const token = searchParams.get('token');
    
    if (type && token) {
      if (type === 'source') {
        setSourceToken(token);
        localStorage.setItem('sourceToken', token);
        setSourceConnected(true);
      } else if (type === 'destination') {
        setDestToken(token);
        localStorage.setItem('destToken', token);
        setDestinationConnected(true);
      }
      
      // Clean URL
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, navigate]);

  const fetchFolders = async (token) => {
    if (!token) return;
    
    try {
      const res = await fetch(`http://localhost:8000/list-folders?token=${token}`);
      const data = await res.json();
      if (!data.error && data.folders.length > 0) {
        setFolders(data.folders);
        setSelectedFolder(data.folders[0].id);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  const fetchFiles = async (token) => {
    if (!token) return [];
    
    try {
      const res = await fetch(`http://localhost:8000/list-files?token=${token}`);
      const data = await res.json();
      return data.error ? [] : (data.files || []);
    } catch (err) {
      console.error('Error fetching files:', err);
      return [];
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check if we have tokens and validate them
        if (sourceToken) {
          const sourceFiles = await fetchFiles(sourceToken);
          setFiles(sourceFiles);
          setSourceConnected(sourceFiles.length > 0 || true);
        }

        if (destToken) {
          setDestinationConnected(true);
          await fetchFolders(destToken);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sourceToken, destToken]);

  const connectSource = () => {
    window.location.href = 'http://localhost:8000/auth/source';
  };

  const connectDestination = () => {
    window.location.href = 'http://localhost:8000/auth/destination';
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    setSelectedFileIds(filteredFiles.map((file) => file.id));
  };

  const clearSelection = () => {
    setSelectedFileIds([]);
  };

  const transferSelectedFiles = async () => {
    if (!selectedFileIds.length) {
      alert('No files selected.');
      return;
    }

    if (!sourceToken || !destToken) {
      alert('Please connect both source and destination accounts.');
      return;
    }

    for (const fileId of selectedFileIds) {
      try {
        const res = await fetch(
          `http://localhost:8000/transfer-file?file_id=${fileId}&folder_id=${selectedFolder}&delete_source=${deleteAfterTransfer}&source_token=${sourceToken}&dest_token=${destToken}`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (data.error) {
          console.error(`❌ ${fileId}: ${data.error}`);
        } else {
          console.log(`✅ ${fileId}: ${data.message}`);
        }
      } catch (err) {
        console.error(`❌ Failed to transfer ${fileId}:`, err);
      }
    }

    alert(`✅ Transfer completed for ${selectedFileIds.length} file(s).`);
    // Refresh files list
    const refreshedFiles = await fetchFiles(sourceToken);
    setFiles(refreshedFiles);
    setSelectedFileIds([]);
  };

  const getFileCategory = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType === 'application/pdf') return 'PDFs';
    if (
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType.includes('sheet') ||
      mimeType.includes('presentation')
    )
      return 'Documents';
    return 'Others';
  };

  const filteredFiles =
    fileTypeFilter === 'All'
      ? files
      : files.filter((file) => getFileCategory(file.mimeType) === fileTypeFilter);

  return (
    <div className={styles.container}>
      <nav style={{ padding: '1rem', backgroundColor: '#f8f9fa', marginBottom: '1rem' }}>
        <button 
          onClick={() => navigate('/')}
          className={styles.button}
          style={{ marginRight: '1rem' }}
        >
          ← Home
        </button>
        <button 
          onClick={() => navigate('/face-matcher')}
          className={styles.button}
        >
          Face Matcher
        </button>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            📁 CloudMover <span style={{ color: '#005c99' }}>Dashboard</span>
          </h1>
          <p className={styles.subtitle}>
            Effortlessly move your files between Google Drive accounts 🌐
          </p>
        </div>

        <div>
          <button 
            onClick={connectSource} 
            className={styles.button}
            style={{ 
              backgroundColor: sourceConnected ? '#22c55e' : '#3b82f6',
              marginRight: '10px'
            }}
          >
            {sourceConnected ? '✅ Source Connected' : '🔗 Connect Source Drive'}
          </button>
          <button
            onClick={connectDestination}
            className={`${styles.button} ${styles.buttonGreen}`}
            style={{ 
              backgroundColor: destinationConnected ? '#22c55e' : '#10b981'
            }}
          >
            {destinationConnected ? '✅ Destination Connected' : '📥 Connect Destination Drive'}
          </button>
        </div>
      </header>

      {destinationConnected && folders.length > 0 && (
        <>
          <div className={styles.dropdown}>
            <label htmlFor="folderSelect" style={{ marginRight: 8 }}>
              Choose destination folder:
            </label>
            <select
              id="folderSelect"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px' }}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.checkbox}>
            <label>
              <input
                type="checkbox"
                checked={deleteAfterTransfer}
                onChange={(e) => setDeleteAfterTransfer(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Delete source file after transfer
            </label>
          </div>
        </>
      )}

      {loading ? (
        <p>🔄 Loading source files...</p>
      ) : !sourceConnected ? (
        <p>❌ Source account not connected.</p>
      ) : (
        <section>
          <h2 style={{ color: '#003366' }}>📂 Files in Source Drive</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ marginRight: 8 }}>Filter by Type:</label>
            {['All', 'Images', 'Documents', 'PDFs', 'Videos', 'Others'].map((type) => (
              <button
                key={type}
                onClick={() => setFileTypeFilter(type)}
                className={styles.button}
                style={{
                  backgroundColor: fileTypeFilter === type ? '#0f9d58' : '#4285f4',
                  marginRight: 6,
                }}
              >
                {type}
              </button>
            ))}
          </div>

          {selectedFileIds.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <button onClick={clearSelection} className={styles.button}>
                Clear Selection ({selectedFileIds.length})
              </button>
              <button
                onClick={transferSelectedFiles}
                className={`${styles.button} ${styles.buttonGreen}`}
              >
                Transfer Selected Files
              </button>
            </div>
          )}

          {filteredFiles.length > 0 && selectedFileIds.length === 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <button onClick={selectAllFiles} className={styles.button}>
                Select All
              </button>
            </div>
          )}

          {filteredFiles.length === 0 ? (
            <p>No files found for this filter.</p>
          ) : (
            <ul className={styles.fileList}>
              {filteredFiles.map((file) => (
                <li key={file.id} className={styles.fileItem}>
                  <div>
                    <input
                      type="checkbox"
                      checked={selectedFileIds.includes(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                      style={{ marginRight: 10 }}
                    />
                    <strong>{file.name}</strong> ({file.mimeType}, {file.size || 0} bytes)
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default Dashboard;