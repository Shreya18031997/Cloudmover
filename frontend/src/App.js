import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/NewDashboard';
import LoginPage from './pages/LoginPage';
import { api } from './lib/utils';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle token from URL on initial load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const type = params.get('type');

    if (token && type) {
      console.log('App: Found token in URL, storing in localStorage');
      
      // Store token based on the type (source or destination)
      if (type === 'source' || type === 'destination') {
        localStorage.setItem(`${type}Token`, token);
        
        // Clean up the URL
        window.history.replaceState({}, document.title, '/dashboard');
        
        // Update auth state if this is a source token (initial login)
        if (type === 'source') {
          setUser({ email: 'user@example.com' });
          setIsAuthenticated(true);
        } else {
          // If adding a destination drive, just refresh the page to update the UI
          window.location.reload();
        }
      }
    }
  }, [location]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      console.log('App: Checking authentication status...');
      try {
        const sourceToken = localStorage.getItem('sourceToken');
        console.log('App: Found source token in localStorage:', !!sourceToken);
        
        // If no source token, user is not authenticated
        if (!sourceToken) {
          console.log('App: No source token found, user is not authenticated');
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        try {
          console.log('App: Validating source token with backend...');
          const response = await api.get(`/session/validate?token=${sourceToken}`);
          console.log('App: Token validation response:', response);
          
          if (response.valid) {
            console.log('App: Source token is valid, user is authenticated');
            setUser({ email: response.user?.email || 'user@example.com' });
            setIsAuthenticated(true);
          } else {
            console.warn('App: Source token validation failed');
            // Clear all tokens on source token failure
            localStorage.removeItem('sourceToken');
            localStorage.removeItem('destinationToken');
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('App: Error validating token:', error);
          if (error.response?.status === 401 || error.message === 'Network Error') {
            // Clear all tokens on network/validation error
            localStorage.removeItem('sourceToken');
            localStorage.removeItem('destinationToken');
          }
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('App: Auth check failed:', error);
        localStorage.removeItem('sourceToken');
        localStorage.removeItem('destinationToken');
        setIsAuthenticated(false);
      } finally {
        console.log('App: Auth check complete, setting loading to false');
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    setIsAuthenticated(true);
    // Token is already set in localStorage by LoginPage
  };

  const handleLogout = async () => {
    try {
      const sourceToken = localStorage.getItem('sourceToken');
      // Invalidate both tokens on the server if they exist
      if (sourceToken) {
        await api.delete(`/session/logout?token=${sourceToken}`);
      }
      const destinationToken = localStorage.getItem('destinationToken');
      if (destinationToken) {
        await api.delete(`/session/logout?token=${destinationToken}`);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Clear all auth data
      localStorage.removeItem('sourceToken');
      localStorage.removeItem('destinationToken');
      setUser(null);
      setIsAuthenticated(false);
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </div>
  );
}

// Wrap App with Router
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;