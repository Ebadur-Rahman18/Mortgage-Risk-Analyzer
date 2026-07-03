import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Trash2,
  File,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  HardDrive,
} from "lucide-react";
import { formatBytes, formatDateTime } from "@/lib/utils";
import {
  useUserKnowledgeFiles,
  useUploadUserKnowledgeFile,
  useDeleteUserKnowledgeFile,
  useUserFileStats,
} from "@/hooks/useUserKnowledge";

export default function PersonalKnowledge() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading } = useUserKnowledgeFiles();
  const { data: stats } = useUserFileStats();
  const uploadFile = useUploadUserKnowledgeFile();
  const deleteFile = useDeleteUserKnowledgeFile();

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    Array.from(selectedFiles).forEach((file) => {
      uploadFile.mutate(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteFile.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
    > = {
      pending: { variant: "outline", icon: Loader2 },
      processing: { variant: "default", icon: Loader2 },
      completed: { variant: "secondary", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: AlertCircle },
    };
    const { variant, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {status}
      </Badge>
    );
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "upload":
        return <Upload className="h-4 w-4" />;
      case "google_drive":
        return <Cloud className="h-4 w-4" />;
      default:
        return <HardDrive className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal Knowledge</h1>
          <p className="text-muted-foreground">
            Upload and manage your personal documents for AI-powered search
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_files || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(stats.total_size || 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.processing || 0) + (stats.pending || 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Upload PDFs, Word documents, text files, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              accept=".pdf,.doc,.docx,.txt,.md"
            />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              Drop files here or click to upload
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Supported formats: PDF, DOC, DOCX, TXT, MD
            </p>
            <Button
              className="mt-4"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadFile.isPending}
            >
              {uploadFile.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Select Files
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Files</CardTitle>
          <CardDescription>Manage your uploaded knowledge files</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !files || files.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <File className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No files uploaded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="line-clamp-1">{file.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSourceIcon(file.source_type)}
                        <span className="capitalize">{file.source_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatBytes(file.file_size || 0)}</TableCell>
                    <TableCell>{getStatusBadge(file.processing_status)}</TableCell>
                    <TableCell>{formatDateTime(file.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(file.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file and all associated embeddings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
