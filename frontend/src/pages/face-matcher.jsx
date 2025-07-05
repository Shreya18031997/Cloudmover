import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { api } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function FaceMatcher() {
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [matches, setMatches] = useState([]);
  const [threshold, setThreshold] = useState(0.6);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target.result);
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFindMatches = async () => {
    if (!image) {
      toast.error('Please upload an image first');
      return;
    }

    setLoading(true);
    try {
      const base64Image = image.split(',')[1];
      const response = await api.post('/find-face-matches', {
        image: base64Image,
        threshold: parseFloat(threshold)
      });

      if (!response.error) {
        setMatches(response.matches || []);
        drawFaceBoxes(response.matches);
        toast.success(`Found ${response.matches.length} matches`);
      } else {
        throw new Error(response.message || 'Failed to find matches');
      }
    } catch (err) {
      console.error('Error finding matches:', err);
      toast.error(err.message || 'Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  const drawFaceBoxes = useCallback((faces) => {
    if (!canvasRef.current || !imagePreview) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imagePreview;

    img.onload = () => {
      // Set canvas dimensions to match the image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the image
      ctx.drawImage(img, 0, 0, img.width, img.height);

      // Draw face boxes
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.font = '16px Arial';
      ctx.fillStyle = '#00FF00';

      faces.forEach((face, index) => {
        const { x, y, width, height } = face.box;
        const similarity = face.similarity || 0;

        // Draw rectangle
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        const text = `Face ${index + 1}: ${(similarity * 100).toFixed(1)}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - 1, y - 25, textWidth + 10, 25);

        // Draw text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x + 5, y - 8);
      });
    };
  }, [imagePreview]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'face-matches.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  useEffect(() => {
    if (imagePreview) {
      drawFaceBoxes(matches);
    }
  }, [imagePreview, threshold, drawFaceBoxes, matches]);

  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Face Matcher</h1>
          <p className="text-muted-foreground">
            Find matching faces in your Google Drive
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => window.history.back()}
          className="mt-4 md:mt-0"
        >
          Back to Dashboard
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
            <CardDescription>
              Upload an image to find matching faces in your Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="image-upload">Select Image</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="threshold">Similarity Threshold: {(threshold * 100).toFixed(0)}%</Label>
                <Input
                  id="threshold"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Less Strict</span>
                  <span>More Strict</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={handleFindMatches}
                disabled={!image || loading}
              >
                {loading ? 'Processing...' : 'Find Matches'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {(imagePreview || matches.length > 0) && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    {matches.length} {matches.length === 1 ? 'match' : 'matches'} found
                  </CardDescription>
                </div>
                {matches.length > 0 && (
                  <Button variant="outline" onClick={handleDownload}>
                    Download Results
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                {imagePreview ? (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 bg-muted/50">
                    <p className="text-muted-foreground">No image selected</p>
                  </div>
                )}
              </div>
              
              {matches.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-4">Match Details:</h3>
                  <div className="border rounded-md divide-y">
                    {matches.map((match, index) => (
                      <div key={index} className="p-4 hover:bg-muted/50">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">Match {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {match.fileName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {(match.similarity * 100).toFixed(1)}% match
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {match.distance ? `Distance: ${match.distance.toFixed(2)}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
