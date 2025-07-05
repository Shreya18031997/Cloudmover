import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'react-hot-toast';
import { api } from '../lib/utils';
import { Folder, File, Loader2, Upload, Download, Trash2, Plus, X, ArrowLeft, Search, FolderOpen, RefreshCw } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Dashboard = ({ onLogout }) => {
  const [sourceFiles, setSourceFiles] = useState([]);
  const [destinationFiles, setDestinationFiles] = useState([]);
  const [availableFolders, setAvailableFolders] = useState([]);
  const [selectedSourceFiles, setSelectedSourceFiles] = useState([]);
  const [selectedDestinationFiles, setSelectedDestinationFiles] = useState([]);
  const [isLoading, setIsLoading] = useState({ source: false, destination: false });
  const [isTransferring, setIsTransferring] = useState(false);
  const [targetFolder, setTargetFolder] = useState('');
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false);
  const [currentPath, setCurrentPath] = useState({
    source: [{ id: 'root', name: 'Root' }],
    destination: [{ id: 'root', name: 'Root' }]
  });
  const [folderContents, setFolderContents] = useState({
    source: {},
    destination: {}
  });
  
  // Pagination and folder state
  const [pagination, setPagination] = useState({
    source: {
      pageSize: 50,
      nextPageToken: null,
      hasMorePages: false,
      isLoadingMore: false,
      searchQuery: '',
      orderBy: 'name',
      includeFolders: true,
      includeFiles: true,
      currentFolderId: 'root',
      folderInfo: null,
      summary: { totalFiles: 0, totalFolders: 0, totalItemsInPage: 0 }
    },
    destination: {
      pageSize: 50,
      nextPageToken: null,
      hasMorePages: false,
      isLoadingMore: false,
      searchQuery: '',
      orderBy: 'name',
      includeFolders: true,
      includeFiles: true,
      currentFolderId: 'root',
      folderInfo: null,
      summary: { totalFiles: 0, totalFolders: 0, totalItemsInPage: 0 }
    }
  });
  const [activePanel, setActivePanel] = useState('source'); // 'source' or 'destination'
  const [showAddDrive, setShowAddDrive] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [destinationFolders, setDestinationFolders] = useState([]);
  const [sourceEmail, setSourceEmail] = useState('');
  const [destinationEmail, setDestinationEmail] = useState('');

  // Load user info for a drive
  const loadDriveInfo = async (type) => {
    try {
      const token = localStorage.getItem(`${type}Token`);
      if (!token) return;
      
      const response = await api.get(`/drive-info?token=${token}`);
      if (response.email) {
        if (type === 'source') {
          setSourceEmail(response.email);
        } else {
          setDestinationEmail(response.email);
        }
      }
    } catch (error) {
      console.error(`Error loading ${type} drive info:`, error);
    }
  };

  // Load destination folders when transfer dialog opens
  useEffect(() => {
    if (showTransferDialog) {
      // Determine which token to use based on active panel
      const folderType = activePanel === 'source' ? 'destination' : 'source';
      loadDestinationFolders('root');
    }
  }, [showTransferDialog, activePanel]);

  // Load initial data when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      const sourceToken = localStorage.getItem('sourceToken');
      const destinationToken = localStorage.getItem('destinationToken');
      
      // If no tokens at all, redirect to login
      if (!sourceToken && !destinationToken) {
        console.warn('No tokens found, redirecting to login');
        window.location.href = '/';
        return;
      }

      try {
        // Set loading states for both drives
        if (isMounted) {
          setIsLoading({
            source: !!sourceToken,
            destination: !!destinationToken
          });
        }
        
        // Load source files and info if token exists
        if (sourceToken) {
          await Promise.all([
            loadFiles('source', sourceToken),
            loadDriveInfo('source')
          ]);
        }
        
        // Load destination files and info if token exists
        if (destinationToken) {
          await Promise.all([
            loadFiles('destination', destinationToken),
            loadDriveInfo('destination')
          ]);
        }
        
      } catch (error) {
        console.error('Error loading initial data:', error);
        toast.error(error.message || 'Failed to load data');
        
        // If there's an auth error, clear the problematic token
        if (error.response?.status === 401) {
          const driveType = error.config?.url?.includes('source') ? 'source' : 'destination';
          localStorage.removeItem(`${driveType}Token`);
          toast.error(`Please re-authenticate your ${driveType} drive`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(prev => ({
            source: false,
            destination: false
          }));
        }
      }
    };
    
    loadInitialData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const loadFiles = async (type, token, folderId = 'root', loadMore = false) => {
    try {
      const authToken = token || localStorage.getItem(`${type}Token`);
      
      if (!authToken) {
        throw new Error(`No ${type} token found`);
      }
      
      // Set loading state
      if (loadMore) {
        setPagination(prev => ({
          ...prev,
          [type]: { 
            ...prev[type], 
            isLoadingMore: true 
          }
        }));
      } else {
        setIsLoading(prev => ({ ...prev, [type]: true }));
      }
      
      const { 
        pageSize, 
        nextPageToken, 
        searchQuery, 
        orderBy,
        includeFolders,
        includeFiles
      } = pagination[type];
      
      // Build query parameters for the new endpoint
      const params = new URLSearchParams({
        token: authToken,
        folder_id: folderId,
        page_size: pageSize,
        order_by: orderBy,
        include_folders: String(includeFolders),
        include_files: String(includeFiles),
        ...(nextPageToken && loadMore && { page_token: nextPageToken }),
        ...(searchQuery && { search_query: searchQuery })
      });
      
      // Use the new endpoint
      const response = await api.get(`/list-folder-contents?${params.toString()}`);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      const items = response.items || [];
      
      // Update pagination state with folder info and summary
      setPagination(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          nextPageToken: response.nextPageToken || null,
          hasMorePages: response.hasMorePages || false,
          isLoadingMore: false,
          currentFolderId: folderId,
          folderInfo: response.folderInfo || null,
          summary: response.summary || { totalFiles: 0, totalFolders: 0, totalItemsInPage: 0 },
          ...(loadMore ? {} : { nextPageToken: null }) // Reset pagination for new searches
        }
      }));
      
      // Update folder contents
      setFolderContents(prev => {
        const currentItems = prev[type]?.[folderId] || [];
        const updatedItems = loadMore ? [...currentItems, ...items] : items;
        
        return {
          ...prev,
          [type]: {
            ...prev[type],
            [folderId]: updatedItems
          }
        };
      });
      
      // Update the appropriate files state
      if (type === 'source') {
        setSourceFiles(prev => loadMore ? [...prev, ...items] : items);
      } else {
        setDestinationFiles(prev => loadMore ? [...prev, ...items] : items);
      }
      
    } catch (error) {
      console.error(`Error loading ${type} files:`, error);
      toast.error(`Failed to load ${type} files: ${error.message}`);
      
      if (error.response?.status === 401) {
        localStorage.removeItem(`${type}Token`);
      }
    } finally {
      setIsLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleFileSelect = (fileId, checked, type) => {
    const setter = type === 'source' ? setSelectedSourceFiles : setSelectedDestinationFiles;
    setter(prev => 
      checked ? [...prev, fileId] : prev.filter(id => id !== fileId)
    );
  };

  const handleFolderClick = async (folder, type) => {
    // Update the current path
    const newPath = [...(currentPath[type] || []), { id: folder.id, name: folder.name }];
    setCurrentPath(prev => ({
      ...prev,
      [type]: newPath
    }));
    
    // Update pagination state with new folder
    setPagination(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        currentFolderId: folder.id,
        nextPageToken: null, // Reset pagination
        searchQuery: '', // Reset search
        hasMorePages: false
      }
    }));
    
    // Always reload files for the folder to ensure fresh data
    const token = localStorage.getItem(`${type}Token`);
    await loadFiles(type, token, folder.id, false);
  };

  const handleNavigateUp = async (type) => {
    if (currentPath[type].length > 1) {
      const newPath = currentPath[type].slice(0, -1);
      const parentId = newPath[newPath.length - 1]?.id || 'root';
      
      setCurrentPath(prev => ({
        ...prev,
        [type]: newPath
      }));
      
      // Update pagination state with parent folder
      setPagination(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          currentFolderId: parentId,
          nextPageToken: null, // Reset pagination
          searchQuery: '', // Reset search
          hasMorePages: false
        }
      }));
      
      // Load parent folder contents
      const token = localStorage.getItem(`${type}Token`);
      await loadFiles(type, token, parentId, false);
    }
  };
  
  const getCurrentFolderContents = (type) => {
    const currentFolderId = currentPath[type][currentPath[type].length - 1]?.id || 'root';
    return folderContents[type]?.[currentFolderId] || [];
  };

  const handleSearch = (query, type) => {
    // Update search query in pagination state and reset pagination
    setPagination(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        searchQuery: query,
        nextPageToken: null,
        hasMorePages: false
      }
    }));
    
    // Reload files with new search query
    const token = localStorage.getItem(`${type}Token`);
    const currentFolderId = pagination[type].currentFolderId || 'root';
    loadFiles(type, token, currentFolderId, false);
  };
  
  const handleSortChange = (sortBy, type) => {
    setPagination(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        orderBy: sortBy,
        nextPageToken: null // Reset pagination when changing sort
      }
    }));
    
    // Reload files with new sort order
    const token = localStorage.getItem(`${type}Token`);
    const currentFolderId = pagination[type].currentFolderId || 'root';
    loadFiles(type, token, currentFolderId, false);
  };
  
  const toggleFileType = (type, fileType) => {
    // Create a new state with the toggled value
    const updatedPagination = {
      ...pagination,
      [type]: {
        ...pagination[type],
        [fileType]: !pagination[type][fileType],
        nextPageToken: null, // Reset pagination
        hasMorePages: false
      }
    };
    
    // Ensure at least one type is selected
    if (!updatedPagination[type].includeFiles && !updatedPagination[type].includeFolders) {
      // If both are false, toggle the clicked one back to true
      updatedPagination[type][fileType] = true;
    }
    
    // Update state
    setPagination(updatedPagination);
    
    // Reload files with new filters
    const token = localStorage.getItem(`${type}Token`);
    const currentFolderId = updatedPagination[type].currentFolderId || 'root';
    loadFiles(type, token, currentFolderId, false);
  };

  const loadDestinationFolders = async (folderId = 'root', searchQuery = '') => {
    try {
      setIsLoadingFolders(true);
      // Get the appropriate token based on the active panel
      const folderType = activePanel === 'source' ? 'destination' : 'source';
      const token = localStorage.getItem(`${folderType}Token`);
      
      if (!token) {
        throw new Error(`No ${folderType} token found`);
      }

      // Build query parameters with search if provided
      const params = new URLSearchParams({
        token,
        folder_id: folderId,
        page_size: 100, // Increased page size for folders
        include_folders: 'true',
        include_files: 'false',
        ...(searchQuery && { search_query: searchQuery })
      });

      const response = await api.get(`/list-folders?${params.toString()}`);
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Ensure we have an array of folders
      const folders = Array.isArray(response.folders) ? response.folders : [];
      setDestinationFolders(folders);
    } catch (error) {
      console.error('Error loading destination folders:', error);
      toast.error(error.message || 'Failed to load destination folders');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleOpenTransferDialog = async () => {
    setShowTransferDialog(true);
    const currentFolderId = pagination.destination.currentFolderId || 'root';
    await loadDestinationFolders(currentFolderId);
  };

  const handleTransfer = async () => {
    // Check for selected files based on active panel
    const isSourceToDest = activePanel === 'source';
    const selectedFiles = isSourceToDest ? selectedSourceFiles : selectedDestinationFiles;
    
    if (selectedFiles.length === 0) {
      toast.error('Please select files to transfer');
      return;
    }
    
    // Check if a folder is selected (empty string means root folder is selected)
    if (targetFolder === undefined || targetFolder === null) {
      toast.error('Please select a destination folder');
      return;
    }
    
    try {
      setIsTransferring(true);
      const sourceToken = localStorage.getItem('sourceToken');
      const destToken = localStorage.getItem('destinationToken');
      
      if (!sourceToken || !destToken) {
        throw new Error('Please connect both source and destination drives');
      }

      // Get current folder IDs for refreshing after transfer
      const currentSourceFolderId = currentPath.source[currentPath.source.length - 1]?.id || 'root';
      const currentDestFolderId = currentPath.destination[currentPath.destination.length - 1]?.id || 'root';
      
      // Transfer files one by one to handle errors individually
      const results = [];
      
      for (const fileId of selectedFiles) {
        try {
          // Create query parameters
          const params = new URLSearchParams();
          params.append('file_id', fileId);
          if (targetFolder) params.append('folder_id', targetFolder);
          params.append('delete_source', deleteAfterTransfer);
          
          // Set the correct token order based on transfer direction
          if (isSourceToDest) {
            params.append('source_token', sourceToken);
            params.append('dest_token', destToken);
          } else {
            // Reverse the tokens for destination to source transfer
            params.append('source_token', destToken);
            params.append('dest_token', sourceToken);
          }
          
          // Make the request with query parameters
          const response = await api.post(`/transfer-file?${params.toString()}`);
          
          if (response.data && response.data.error) {
            // If the response has an error field, treat it as a failure
            throw new Error(response.data.error);
          }
          
          results.push({
            fileId,
            success: true,
            message: response.data?.message || 'File transferred successfully'
          });
          
          toast.success(response.data?.message || 'File transferred successfully');
        } catch (error) {
          console.error(`Error transferring file ${fileId}:`, error);
          const errorMessage = error.response?.data?.error || 
                             error.message || 
                             'Failed to transfer file';
          
          results.push({
            fileId,
            success: false,
            message: errorMessage
          });
          
          // Only show error toast if it's not a handled error
          if (!error.response?.data?.error) {
            toast.error(`Failed to transfer file: ${errorMessage}`);
          }
        }
      }
      
      // Refresh file lists for both panels
      await Promise.all([
        loadFiles('source', sourceToken, isSourceToDest ? currentSourceFolderId : targetFolder || 'root'),
        loadFiles('destination', destToken, isSourceToDest ? (targetFolder || 'root') : currentDestFolderId)
      ]);
      
      // Clear selections
      setSelectedSourceFiles([]);
      setSelectedDestinationFiles([]);
      setShowTransferDialog(false);
      
      // Log results
      console.log('Transfer results:', results);
      
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error(error.response?.data?.error || error.message || 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleLogout = (type = 'all') => {
    if (type === 'all') {
      // Clear all storage
      localStorage.removeItem('sourceToken');
      localStorage.removeItem('destinationToken');
      
      // Call the parent's logout handler if it exists
      if (onLogout) {
        onLogout();
      }
      
      // Redirect to login
      window.location.href = '/';
    } else {
      // Clear specific drive
      localStorage.removeItem(`${type}Token`);
      
      // Clear the corresponding files
      if (type === 'source') {
        setSourceFiles([]);
        setSelectedSourceFiles([]);
      } else {
        setDestinationFiles([]);
        setSelectedDestinationFiles([]);
      }
      
      toast.success(`${type === 'source' ? 'Source' : 'Destination'} drive disconnected`);
      
      // If no drives are connected, redirect to login
      const sourceToken = localStorage.getItem('sourceToken');
      const destinationToken = localStorage.getItem('destinationToken');
      if (!sourceToken && !destinationToken) {
        window.location.href = '/';
      }
    }
  };

  const handleAddDrive = () => {
    const driveType = activePanel === 'source' ? 'destination' : 'source';
    
    // Redirect to the appropriate auth endpoint
    if (driveType === 'source') {
      window.location.href = `${process.env.REACT_APP_API_BASE_URL}/auth/source`;
    } else {
      window.location.href = `${process.env.REACT_APP_API_BASE_URL}/auth/destination`;
    }
  };

  const handleOpenAddDriveDialog = () => {
    setShowAddDrive(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold text-gray-900">CloudMover</h1>
              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  <Button 
                    variant={activePanel === 'source' ? 'default' : 'outline'}
                    onClick={() => setActivePanel('source')}
                  >
                    Source Drive
                  </Button>
                  <Button 
                    variant={activePanel === 'destination' ? 'default' : 'outline'}
                    onClick={() => setActivePanel('destination')}
                  >
                    Destination Drive
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleOpenAddDriveDialog}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                  disabled={isLoading[activePanel]}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {activePanel === 'source' ? 'Add Destination Drive' : 'Add Source Drive'}
                </Button>
                <Button 
                  onClick={handleOpenTransferDialog}
                  disabled={activePanel === 'source' 
                    ? selectedSourceFiles.length === 0 
                    : selectedDestinationFiles.length === 0}
                >
                  {activePanel === 'source' 
                    ? `Transfer ${selectedSourceFiles.length} file${selectedSourceFiles.length !== 1 ? 's' : ''}`
                    : `Transfer ${selectedDestinationFiles.length} file${selectedDestinationFiles.length !== 1 ? 's' : ''}`}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onLogout}
                  disabled={isLoading[activePanel]}
                >
                  Logout
                </Button>
              </div>
            </div>
            
            {/* Email display */}
            <div className="flex flex-col sm:flex-row sm:items-center text-sm text-gray-600 space-y-1 sm:space-y-0 sm:space-x-4">
              {sourceEmail && (
                <div className="flex items-center">
                  <span className="font-medium">Source:</span>
                  <span className="ml-1 text-blue-600">{sourceEmail}</span>
                </div>
              )}
              {destinationEmail && (
                <div className="flex items-center">
                  <span className="font-medium">Destination:</span>
                  <span className="ml-1 text-green-600">{destinationEmail}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          {isLoading[activePanel] ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <p>Loading {activePanel} drive files...</p>
              </div>
            </div>
          ) : (activePanel === 'source' ? sourceFiles : destinationFiles).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No files found in {activePanel} drive</p>
              <Button 
                variant="outline"
                onClick={handleAddDrive}
                className="mt-2"
              >
                <FcGoogle className="h-4 w-4 mr-2" />
                Connect {activePanel === 'source' ? 'Source' : 'Destination'} Drive
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
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
                  {/* Breadcrumb navigation */}
                  <TableRow>
                    <TableCell colSpan={5} className="p-2">
                      <div className="flex items-center text-sm text-gray-600">
                        {currentPath[activePanel].map((folder, index) => (
                          <React.Fragment key={folder.id}>
                            {index > 0 && <span className="mx-2">/</span>}
                            <button
                              onClick={async () => {
                                const newPath = currentPath[activePanel].slice(0, index + 1);
                                const targetFolderId = newPath[newPath.length - 1]?.id || 'root';
                                
                                // Update path
                                setCurrentPath(prev => ({
                                  ...prev,
                                  [activePanel]: newPath
                                }));
                                
                                // Update pagination state
                                setPagination(prev => ({
                                  ...prev,
                                  [activePanel]: {
                                    ...prev[activePanel],
                                    currentFolderId: targetFolderId,
                                    nextPageToken: null,
                                    searchQuery: '',
                                    hasMorePages: false
                                  }
                                }));
                                
                                // Load files for the target folder
                                const token = localStorage.getItem(`${activePanel}Token`);
                                await loadFiles(activePanel, token, targetFolderId, false);
                              }}
                              className={`hover:text-blue-600 hover:underline ${pagination[activePanel]?.currentFolderId === folder.id ? 'font-bold text-blue-600' : ''}`}
                            >
                              {folder.name || 'Root'}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Search and filter bar */}
                  <TableRow>
                    <TableCell colSpan={5} className="p-2 space-y-2">
                      <div className="flex flex-col md:flex-row gap-2">
                        {/* Sort dropdown */}
                        <Select 
                          value={pagination[activePanel].orderBy}
                          onValueChange={(value) => handleSortChange(value, activePanel)}
                          className="w-full md:w-[180px]"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name">Name (A-Z)</SelectItem>
                            <SelectItem value="name desc">Name (Z-A)</SelectItem>
                            <SelectItem value="modifiedTime desc">Last Modified</SelectItem>
                            <SelectItem value="createdTime desc">Date Added</SelectItem>
                            <SelectItem value="size desc">Size (Largest First)</SelectItem>
                            <SelectItem value="folder">Folders First</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Summary info */}
                      {pagination[activePanel]?.summary && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Showing {pagination[activePanel].summary.totalItemsInPage} items 
                          {pagination[activePanel].summary.totalFolders > 0 && `(${pagination[activePanel].summary.totalFolders} folders, `}
                          {pagination[activePanel].summary.totalFiles > 0 && `${pagination[activePanel].summary.totalFiles} files)`}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  
                  {/* Files and folders */}
                  {getCurrentFolderContents(activePanel).map((item) => (
                    <TableRow 
                      key={item.id}
                      className={item.mimeType === 'application/vnd.google-apps.folder' ? 'cursor-pointer hover:bg-gray-50' : ''}
                      onClick={() => {
                        if (item.mimeType === 'application/vnd.google-apps.folder') {
                          handleFolderClick(item, activePanel);
                        }
                      }}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox 
                          checked={activePanel === 'source' 
                            ? selectedSourceFiles.includes(item.id)
                            : selectedDestinationFiles.includes(item.id)
                          }
                          onCheckedChange={(checked) => handleFileSelect(item.id, checked, activePanel)}
                        />
                      </TableCell>
                      <TableCell className="font-medium flex items-center">
                        {item.mimeType === 'application/vnd.google-apps.folder' ? (
                          <Folder className="h-4 w-4 mr-2 text-blue-500" />
                        ) : (
                          <File className="h-4 w-4 mr-2 text-gray-400" />
                        )}
                        {item.name}
                      </TableCell>
                      <TableCell>
                        {item.mimeType === 'application/vnd.google-apps.folder' 
                          ? 'Folder' 
                          : item.mimeType?.split('.')?.pop() || 'File'}
                      </TableCell>
                      <TableCell>{item.size ? formatFileSize(item.size) : '-'}</TableCell>
                      <TableCell>{item.modifiedTime ? new Date(item.modifiedTime).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Load more button and status */}
                  <TableRow>
                    <TableCell colSpan={5} className="text-center p-4">
                      {pagination[activePanel].isLoadingMore ? (
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading more items...
                        </div>
                      ) : pagination[activePanel].hasMorePages ? (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const token = localStorage.getItem(`${activePanel}Token`);
                            const currentFolderId = pagination[activePanel].currentFolderId || 'root';
                            await loadFiles(activePanel, token, currentFolderId, true);
                          }}
                        >
                          Load More ({pagination[activePanel].summary.totalItemsInPage} of {pagination[activePanel].summary.totalFiles + pagination[activePanel].summary.totalFolders} items)
                        </Button>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {getCurrentFolderContents(activePanel).length === 0 
                            ? 'No items found in this folder' 
                            : 'All items loaded'}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <div>
        {/* Transfer Dialog */}
        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Files</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Transfer To</Label>
                <p className="text-sm text-gray-500 mb-2">
                  {activePanel === 'source' 
                    ? `Destination: ${destinationEmail || 'Not connected'}`
                    : `Source: ${sourceEmail || 'Not connected'}`}
                </p>
              </div>
              
              <div>
                <Label>Destination Folder</Label>
                {isLoadingFolders ? (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading folders...</span>
                  </div>
                ) : (
                  <Select 
                    value={targetFolder === '' ? 'root' : targetFolder} 
                    onValueChange={(value) => setTargetFolder(value === 'root' ? '' : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Root Folder</SelectItem>
                      {destinationFolders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Select a folder in the {activePanel === 'source' ? 'destination' : 'source'} drive
                </p>
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="deleteAfterTransfer" 
                    checked={deleteAfterTransfer}
                    onCheckedChange={(checked) => setDeleteAfterTransfer(checked)}
                  />
                  <label htmlFor="deleteAfterTransfer" className="text-sm font-medium">
                    Delete from source after transfer
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  {deleteAfterTransfer 
                    ? '⚠️ Files will be permanently deleted from source after successful transfer.'
                    : 'Original files will be kept in the source drive.'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowTransferDialog(false)}
                disabled={isTransferring}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleTransfer}
                disabled={isTransferring || isLoadingFolders}
              >
                {isTransferring ? 'Transferring...' : 'Start Transfer'}
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
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">
                You'll be redirected to Google to sign in and authorize access to another Google Drive account.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {activePanel === 'source' 
                  ? 'This will be your destination drive where files will be transferred to.'
                  : 'This will be your source drive where files will be transferred from.'}
              </p>
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddDrive(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddDrive}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <FcGoogle className="h-4 w-4 mr-2" />
                  Continue with Google
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;
