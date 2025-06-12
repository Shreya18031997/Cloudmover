// src/App.js
import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-blue-100 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold text-blue-900 mb-8">
        Google Drive File Transfer
      </h1>

      <div className="flex space-x-6 mb-10">
        <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow">
          Connect Source Drive
        </button>
        <button className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded shadow">
          Connect Destination Drive
        </button>
      </div>

      <div className="w-full max-w-2xl bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Selected Files</h2>
        <div className="border border-gray-300 rounded p-4 text-gray-600">
          {/* Add your file list or file picker component here */}
          No files selected.
        </div>

        <div className="mt-6 flex justify-between">
          <button className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded">
            Clear Selection
          </button>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">
            Transfer to Destination
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;