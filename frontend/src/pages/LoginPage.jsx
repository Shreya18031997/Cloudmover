import { Button } from '../components/ui/button';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  
  const handleGoogleLogin = () => {
    // Clear any existing tokens
    localStorage.removeItem('token');
    localStorage.removeItem('driveType');
    
    // Redirect to backend OAuth endpoint
    window.location.href = `${process.env.REACT_APP_API_BASE_URL}/auth/source`;
  };
  
  // Simple check if we were redirected back with an error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    
    if (error) {
      toast.error('Login failed. Please try again.');
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to CloudMover
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to transfer files between your Google Drive accounts
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <Button
            onClick={handleGoogleLogin}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
