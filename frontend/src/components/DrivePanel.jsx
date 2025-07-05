import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

export function DrivePanel({ 
  title, 
  files, 
  selectedFiles, 
  onFileSelect, 
  onFolderClick, 
  onLogout,
  isLoading, 
  type 
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{title}</CardTitle>
          {onLogout && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onLogout}
              className="text-sm"
            >
              Switch Account
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={files.length > 0 && selectedFiles.length === files.length}
                      onCheckedChange={() => {
                        if (selectedFiles.length === files.length) {
                          onFileSelect([], type);
                        } else {
                          onFileSelect(files.map(f => f.id), type);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedFiles.includes(file.id)}
                        onCheckedChange={() => onFileSelect(file.id, type)}
                      />
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:underline"
                      onClick={() => file.mimeType.includes('folder') && onFolderClick(file.id, type)}
                    >
                      {file.name}
                      {file.mimeType.includes('folder') && ' 📁'}
                    </TableCell>
                    <TableCell className="text-right">
                      {file.size ? formatFileSize(file.size) : ''}
                    </TableCell>
                  </TableRow>
                ))}
                {files.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No files found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
