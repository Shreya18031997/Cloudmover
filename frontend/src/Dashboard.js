import React, { useEffect, useState } from 'react';

function Dashboard() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceConnected, setSourceConnected] = useState(false);
  const [destinationConnected, setDestinationConnected] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false);

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

  const transferFile = async (fileId) => {
    try {
      const res = await fetch(
        `http://localhost:8000/transfer-file?file_id=${fileId}&folder_id=${selectedFolder}&delete_source=${deleteAfterTransfer}`,
        { method: 'POST' }
      );
      const data = await res.json();
      alert(data.message || 'Transfer failed.');
      window.location.reload(); // refresh list
    } catch (err) {
      console.error('Transfer failed:', err);
      alert('Transfer failed.');
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 p-6 font-sans">
      <header className="flex flex-col md:flex-row items-center justify-between mb-6 border-b pb-4 border-blue-200">
        <div>
          <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-2">
            📁 CloudMover <span className="text-blue-600">Dashboard</span>
          </h1>
          <p className="text-sm text-blue-700 mt-1">
            Effortlessly move files between Google Drive accounts 🌐
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button
            onClick={connectSource}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            🔗 Connect Source
          </button>
          <button
            onClick={connectDestination}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            📥 Connect Destination
          </button>
        </div>
      </header>

      {destinationConnected && folders.length > 0 && (
        <div className="mb-6 space-y-3">
          <div>
            <label className="text-blue-800 font-medium mr-2">Choose folder:</label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="border rounded px-3 py-2"
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center text-sm text-blue-900">
            <input
              type="checkbox"
              className="mr-2"
              checked={deleteAfterTransfer}
              onChange={(e) => setDeleteAfterTransfer(e.target.checked)}
            />
            Delete source file after transfer
          </label>
        </div>
      )}

      {loading ? (
        <p className="text-blue-800">🔄 Loading source files...</p>
      ) : !sourceConnected ? (
        <p className="text-red-600">❌ Source account not connected.</p>
      ) : (
        <div>
          <h2 className="text-xl font-semibold text-blue-900 mb-3">📂 Files in Source Drive</h2>
          {files.length === 0 ? (
            <p className="text-blue-700">No files found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="bg-white shadow-md rounded p-4 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-blue-900 font-bold">{file.name}</h3>
                    <p className="text-sm text-blue-600">{file.mimeType}</p>
                    <p className="text-sm text-gray-500">{file.size || 0} bytes</p>
                  </div>
                  {destinationConnected && (
                    <button
                      onClick={() => transferFile(file.id)}
                      className="mt-3 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Transfer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;