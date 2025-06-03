import React, { useEffect, useState } from 'react';
import styles from './Dashboard.module.css';

function Dashboard() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceConnected, setSourceConnected] = useState(false);
  const [destinationConnected, setDestinationConnected] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [fileTypeFilter, setFileTypeFilter] = useState('All');

  const fetchFolders = async () => {
    try {
      const res = await fetch('http://localhost:8000/list-folders');
      const data = await res.json();
      if (!data.error && data.folders.length > 0) {
        setFolders(data.folders);
        setSelectedFolder(data.folders[0].id);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sourceRes = await fetch(`http://localhost:8000/list-files?email=source`);
        const sourceData = await sourceRes.json();
        if (!sourceData.error) {
          setFiles(sourceData.files || []);
          setSourceConnected(true);
        }

        const destRes = await fetch(`http://localhost:8000/list-files?email=destination`);
        const destData = await destRes.json();
        if (!destData.error) {
          setDestinationConnected(true);
          await fetchFolders();
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

    for (const fileId of selectedFileIds) {
      try {
        const res = await fetch(
          `http://localhost:8000/transfer-file?file_id=${fileId}&folder_id=${selectedFolder}&delete_source=${deleteAfterTransfer}`,
          { method: 'POST' }
        );
        const data = await res.json();
        console.log(`✅ ${fileId}: ${data.message}`);
      } catch (err) {
        console.error(`❌ Failed to transfer ${fileId}:`, err);
      }
    }

    alert(`✅ Transferred ${selectedFileIds.length} file(s).`);
    window.location.reload();
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
          <button onClick={connectSource} className={styles.button}>
            🔗 Connect Source Drive
          </button>
          <button
            onClick={connectDestination}
            className={`${styles.button} ${styles.buttonGreen}`}
          >
            📥 Connect Destination Drive
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