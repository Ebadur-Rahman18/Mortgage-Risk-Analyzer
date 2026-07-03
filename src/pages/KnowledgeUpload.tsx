import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, ArrowLeft, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useKnowledgeCategories } from "@/hooks/useKnowledge";
import { suggestKnowledgeCategories } from "@/lib/knowledge-category-suggestions";
import { DocumentExtractViewer } from "@/components/knowledge/DocumentExtractViewer";
import {
  waitForDocumentExtract,
  type DocumentExtractViewModel,
} from "@/lib/document-extract-utils";

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "processing" | "parsing" | "completed" | "error";
  progress: number;
  error?: string;
  path?: string;
  extractedContent?: string;
  knowledgeEntryId?: string;
  documentExtract?: DocumentExtractViewModel | null;
}

export default function KnowledgeUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: categories } = useKnowledgeCategories();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const suggestions = suggestKnowledgeCategories(categories ?? [], {
    title: formData.title,
    summary: formData.description,
    tags: formData.tags,
  });
  const topSuggestion = suggestions[0];
  const suggestedCategory = categories?.find((c) => c.id === topSuggestion?.categoryId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    // Filter for allowed file types
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/json",
      "text/markdown",
    ];

    const validFiles = selectedFiles.filter((file) => {
      if (
        !allowedTypes.includes(file.type) &&
        !file.name.endsWith(".md") &&
        !file.name.endsWith(".json") &&
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".pptx") &&
        !file.name.toLowerCase().endsWith(".doc")
      ) {
        toast.error(
          `${file.name}: Unsupported file type. Use PDF, DOCX, XLSX, PPTX, TXT, MD, or JSON.`,
        );
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File size exceeds 10MB`);
        return false;
      }
      return true;
    });

    setFiles(
      validFiles.map((file) => ({
        file,
        status: "pending",
        progress: 0,
      }))
    );

    // Auto-populate title with first file's name (without extension) if title is empty
    if (validFiles.length > 0 && !formData.title) {
      const firstFileName = validFiles[0].name.replace(/\.[^/.]+$/, "");
      setFormData({ ...formData, title: firstFileName });
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const extractTextContent = async (file: File): Promise<string> => {
    // Extract text content from text-based files
    if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      try {
        const text = await file.text();
        return text;
      } catch (error) {
        console.error("Error reading text file:", error);
        return "";
      }
    }

    if (file.type === "application/json" || file.name.endsWith(".json")) {
      try {
        const text = await file.text();
        return text;
      } catch (error) {
        console.error("Error reading JSON file:", error);
        return "";
      }
    }
    
    // For PDFs and other binary formats, return empty (will use file viewer instead)
    return "";
  };

  const uploadFile = async (
    uploadedFile: UploadedFile,
    index: number,
  ): Promise<{ url: string; path: string; extractedContent: string } | null> => {
    if (!user) {
      console.error("❌ No user logged in");
      return null;
    }

    try {
      console.log("📤 Uploading file:", uploadedFile.file.name);
      console.log("📦 File size:", (uploadedFile.file.size / 1024).toFixed(2), "KB");
      console.log("📝 File type:", uploadedFile.file.type);

      // Extract text content before upload
      const extractedContent = await extractTextContent(uploadedFile.file);
      console.log("📄 Extracted content length:", extractedContent.length, "characters");

      // Update status to uploading and store extracted content
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: "uploading", progress: 30, extractedContent } : f))
      );

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}-${uploadedFile.file.name}`;
      console.log("💾 Uploading to path:", fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("user-knowledge")
        .upload(fileName, uploadedFile.file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("❌ Storage upload error:", uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      console.log("✅ File uploaded to storage:", uploadData.path);

      // Update progress
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 60, path: uploadData.path } : f))
      );

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("user-knowledge")
        .getPublicUrl(uploadData.path);

      console.log("🔗 Public URL:", urlData.publicUrl);

      return { url: urlData.publicUrl, path: uploadData.path, extractedContent };
    } catch (error: any) {
      console.error("❌ Upload error:", error);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "error", error: error.message || "Upload failed" } : f
        )
      );
      return null;
    }
  };


  const createKnowledgeEntry = async (
    fileUrl: string,
    fileName: string,
    filePath: string,
    index: number,
    extractedContent: string = ""
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log("📝 Creating knowledge entry for file:", fileName);
      console.log("📄 Extracted content length:", extractedContent.length, "characters");
      
      // Update status to processing
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: "processing", progress: 80 } : f))
      );

      // Generate slug from filename
      const slug = fileName
        .replace(/\.[^/.]+$/, "") // Remove extension
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Use extracted content if available, otherwise create a placeholder that indicates file viewing
      const contentToStore = extractedContent 
        ? extractedContent 
        : `# ${fileName}\n\nThis file has been uploaded. Open it from this page using **Download** or **View file** (works with private storage).\n\n**File Type:** ${fileName.split('.').pop()?.toUpperCase()}\n**Uploaded:** ${new Date().toLocaleDateString()}`;
      
      console.log("💾 Content to store:", contentToStore.length, "characters");

      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      const isPdf = fileExtension === 'pdf';

      // Create knowledge entry directly in database
      const { data: entry, error } = await supabase
        .from("knowledge_entries")
        .insert({
          title: formData.title || fileName.replace(/\.[^/.]+$/, ""),
          content: contentToStore,
          slug: `${slug}-${Date.now()}`,
          category_id: formData.category || null,
          tags: formData.tags.length > 0 ? formData.tags : null,
          summary: formData.description || `Uploaded file: ${fileName}`,
          status: "published",
          author_id: user.id,
          metadata: {
            file_url: fileUrl,
            file_path: filePath,
            storage_bucket: "user-knowledge",
            file_name: fileName,
            file_type: fileExtension,
            mime_type: files[index]?.file?.type || null,
            file_size: files[index]?.file?.size,
            has_extracted_content: !!extractedContent,
            is_pdf: isPdf,
            uploaded_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Error creating knowledge entry:", error);
        throw error;
      }

      console.log("✅ Knowledge entry created:", entry);

      try {
        const { data: parseData, error: parseFnErr } = await supabase.functions.invoke("parse-document", {
          body: { knowledge_entry_id: entry.id, storage_bucket: "user-knowledge" },
        });
        if (parseFnErr) {
          console.warn("parse-document:", parseFnErr.message);
          toast.warning("Uploaded. Text extraction may still be processing — open the article to retry.");
        } else if (parseData && typeof parseData === "object" && "error" in parseData) {
          toast.warning(String((parseData as { error?: string }).error ?? "Parse failed"));
        }

        setFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, status: "parsing", progress: 90, knowledgeEntryId: entry.id } : f,
          ),
        );

        const extractModel = await waitForDocumentExtract(entry.id);

        if (extractModel?.parse_status === "done") {
          toast.success(
            `Extracted ${extractModel.word_count?.toLocaleString() ?? "—"} words${
              extractModel.page_count ? ` from ${extractModel.page_count} pages` : ""
            }. Ready for AI agents.`,
          );
        } else if (extractModel?.parse_status === "error") {
          toast.error(extractModel.parse_error ?? "Document extraction failed");
        }

        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: "completed",
                  progress: 100,
                  knowledgeEntryId: entry.id,
                  documentExtract: extractModel,
                }
              : f,
          ),
        );
      } catch (parseErr) {
        console.warn("parse-document invoke:", parseErr);
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: "completed", progress: 100, knowledgeEntryId: entry.id }
              : f,
          ),
        );
      }

      return true;
    } catch (error: any) {
      console.error("❌ Processing error:", error);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: "error", error: error.message || "Failed to create knowledge entry" }
            : f
        )
      );
      return false;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to upload files");
      return;
    }
    console.log("🚀 Starting upload process for", files.length, "file(s)");
    console.log("👤 User ID:", user.id);

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const uploadedFile = files[i];
        console.log(`📁 Processing file ${i + 1}/${files.length}:`, uploadedFile.file.name);

        // Upload file to storage
        const fileUrl = await uploadFile(uploadedFile, i);

        if (fileUrl) {
          console.log("✅ File uploaded to storage:", fileUrl.url);

          // Create knowledge entry in database with extracted content
          await createKnowledgeEntry(fileUrl.url, uploadedFile.file.name, fileUrl.path, i, fileUrl.extractedContent);
        } else {
          console.error("❌ File upload failed for:", uploadedFile.file.name);
        }

      }

      const successCount = files.filter((f) => f.status === "completed").length;
      const errorCount = files.filter((f) => f.status === "error").length;

      console.log(`📊 Upload complete: ${successCount} success, ${errorCount} errors`);

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file(s). Review extracted content below.`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to upload ${errorCount} file(s)`);
      }
    } catch (error: any) {
      console.error("❌ Upload process error:", error);
      toast.error("Upload process failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "uploading":
      case "processing":
      case "parsing":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Knowledge Files</h1>
          <p className="text-muted-foreground">
            Upload documents to automatically extract and index knowledge
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/knowledge")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>
            Upload documents to automatically extract and index knowledge
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Requirements Notice */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">File Upload Requirements</h4>
                <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  <p><strong>Supported formats:</strong> PDF, DOCX, XLSX, PPTX, TXT, MD, JSON</p>
                  <p><strong>Maximum file size:</strong> 10MB per file</p>
                  <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">Files are stored securely and only accessible by you</p>
                </div>
              </div>
            </div>
          </div>
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="file">Select Files</Label>
            <Input
              id="file"
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
              accept=".pdf,.txt,.docx,.md,.json,.xlsx,.pptx"
            />
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            {!formData.category && suggestedCategory && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="text-sm font-medium">Suggested category: {suggestedCategory.name}</p>
                <p className="text-xs text-muted-foreground">{topSuggestion.reason}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setFormData({ ...formData, category: suggestedCategory.id })}
                >
                  Apply Suggestion
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Auto-populated from filename - edit if needed"
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Auto-filled from filename. Edit to customize.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add a description for these files"
                rows={3}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <SearchableSelect
                value={formData.category}
                onChange={(value) => setFormData({ ...formData, category: value })}
                disabled={uploading}
                placeholder="Select a category"
                options={(categories ?? []).map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add tags (press Enter)"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || uploading}
                >
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                        disabled={uploading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <Label>Selected Files ({files.length})</Label>
              <div className="space-y-2">
                {files.map((uploadedFile, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(uploadedFile.status)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{uploadedFile.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedFile.file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          uploadedFile.status === "completed"
                            ? "default"
                            : uploadedFile.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {uploadedFile.status}
                      </Badge>
                    </div>
                    {uploadedFile.status !== "pending" && uploadedFile.status !== "completed" && (
                      <Progress value={uploadedFile.progress} className="h-1" />
                    )}
                    {uploadedFile.error && (
                      <p className="text-xs text-destructive">{uploadedFile.error}</p>
                    )}
                    {uploadedFile.status === "parsing" && (
                      <p className="text-xs text-muted-foreground">Extracting text and structure…</p>
                    )}
                    {uploadedFile.documentExtract?.parse_status === "done" && (
                      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                        <p className="mb-2 text-sm font-medium">Extract preview</p>
                        <DocumentExtractViewer
                          extract={uploadedFile.documentExtract}
                          compact
                          showRagHint
                        />
                        {uploadedFile.knowledgeEntryId && (
                          <Button
                            type="button"
                            variant="link"
                            className="mt-2 h-auto p-0"
                            onClick={() =>
                              navigate(`/knowledge/${uploadedFile.knowledgeEntryId}#extracted-document`)
                            }
                          >
                            Open full article view
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/knowledge")}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
