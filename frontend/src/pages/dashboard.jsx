import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'react-hot-toast';
import { api } from '../lib/utils';

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function Dashboard({ user, onLogout }) {
  const [files, setFiles] = useState([]);
  const [drives, setDrives] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDrive, setShowAddDrive] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [targetDrive, setTargetDrive] = useState('');
  const [targetFolder, setTargetFolder] = useState('');
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false);
  const [currentPath, setCurrentPath] = useState(['root']);
  const navigate = useNavigate();

  // Load drives and files on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const [drivesRes] = await Promise.all([
          api.get('/list-files')
        ]);
        
        setDrives(drivesRes.data);
        
        if (drivesRes.data.length > 0) {
          setSelectedDrive(drivesRes.data[0].id);
          loadFiles(drivesRes.data[0].id);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const loadFiles = async (driveId) => {
    try {
      setIsLoading(true);
      const response = await api.get(`/list-files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDrive = async () => {
    try {
      window.location.href = `${process.env.REACT_APP_API_BASE_URL}/auth/destination`;
    } catch (error) {
      console.error('Error adding drive:', error);
      toast.error('Failed to add new drive');
    }
  };

  const handleDriveChange = (driveId) => {
    setSelectedDrive(driveId);
    loadFiles(driveId);
  };

  const handleFileSelect = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleTransfer = async () => {
    if (!selectedFiles.length || !targetDrive || !targetFolder) {
      toast.error('Please select files and destination');
      return;
    }

    try {
      setIsLoading(true);
      await api.post('/transfer', {
        fileIds: selectedFiles,
        sourceDrive: selectedDrive,
        targetDrive,
        targetFolder,
        deleteAfterTransfer
      });

      toast.success('Transfer completed successfully');
      setShowTransferDialog(false);
      setSelectedFiles([]);
      loadFiles(selectedDrive);
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error('Transfer failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we have any drives
  if (drives.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome to CloudMover</h1>
          <p className="mb-6">Connect your first Google Drive to get started</p>
          <Button onClick={handleAddDrive}>
            Add Google Drive
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">CloudMover</h1>
          <div className="flex items-center space-x-4">
            <Select onValueChange={handleDriveChange} value={selectedDrive}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select Drive" />
              </SelectTrigger>
              <SelectContent>
                {drives.map(drive => (
                  <SelectItem key={drive.id} value={drive.id}>
                    {drive.name} ({drive.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAddDrive(true)}>Add Drive</Button>
            <Button variant="outline" onClick={onLogout}>Logout</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-medium">Files</h2>
            <Button 
              onClick={() => setShowTransferDialog(true)}
              disabled={selectedFiles.length === 0}
            >
              Transfer Selected ({selectedFiles.length})
            </Button>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No files found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedFiles.includes(file.id)}
                        onCheckedChange={() => handleFileSelect(file.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell>{file.mimeType?.split('.')?.pop() || 'Folder'}</TableCell>
                    <TableCell>{file.size ? formatFileSize(file.size) : '-'}</TableCell>
                    <TableCell>{file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Files</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Destination Drive</Label>
              <Select onValueChange={setTargetDrive} value={targetDrive}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a drive" />
                </SelectTrigger>
                <SelectContent>
                  {drives
                    .filter(drive => drive.id !== selectedDrive)
                    .map(drive => (
                      <SelectItem key={drive.id} value={drive.id}>
                        {drive.name} ({drive.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Destination Folder (optional)</Label>
              <Input 
                placeholder="Leave blank for root folder"
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="delete-after"
                checked={deleteAfterTransfer}
                onCheckedChange={(checked) => setDeleteAfterTransfer(!!checked)}
              />
              <Label htmlFor="delete-after">Delete files after transfer</Label>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowTransferDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer}
              disabled={!targetDrive || isLoading}
            >
              {isLoading ? 'Transferring...' : 'Start Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Drive Dialog */}
      <Dialog open={showAddDrive} onOpenChange={setShowAddDrive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Google Drive</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mb-4">
            You'll be redirected to Google to sign in and authorize access to your Google Drive.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDrive(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDrive}>
              Continue to Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
