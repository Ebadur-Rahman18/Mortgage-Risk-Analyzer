import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  MessageSquare,
  Bug,
  Lightbulb,
  TrendingUp,
  Clock,
  RefreshCw,
  Loader2,
  Eye,
  Star,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface FeedbackItem {
  id: string;
  user_id: string;
  type: "bug" | "feature" | "improvement" | "general";
  subject: string;
  message: string;
  rating: number | null;
  status: "pending" | "reviewed" | "resolved" | "closed";
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function FeedbackManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState<FeedbackItem["status"]>("pending");

  // Fetch all feedback
  const { data: allFeedback = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async (): Promise<FeedbackItem[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as FeedbackItem[];
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: allFeedback.length,
      pending: allFeedback.filter(f => f.status === "pending").length,
      bugs: allFeedback.filter(f => f.type === "bug").length,
      features: allFeedback.filter(f => f.type === "feature").length,
    };
  }, [allFeedback]);

  // Filter feedback
  const filteredFeedback = useMemo(() => {
    return allFeedback.filter((feedback) => {
      const matchesSearch = search === "" || 
        feedback.subject.toLowerCase().includes(search.toLowerCase()) ||
        feedback.message.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || feedback.type === typeFilter;
      const matchesStatus = statusFilter === "all" || feedback.status === statusFilter;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [allFeedback, search, typeFilter, statusFilter]);

  // Update feedback mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FeedbackItem> }) => {
      const { data, error } = await supabase
        .from("feedback")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast.success("Feedback updated successfully");
      setViewDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update feedback: ${error.message}`);
    },
  });

  const handleViewFeedback = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setAdminNotes(feedback.admin_notes || "");
    setNewStatus(feedback.status);
    setViewDialogOpen(true);
  };

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) return;

    const updates: Partial<FeedbackItem> = {
      status: newStatus,
      admin_notes: adminNotes.trim() || null,
    };

    if (newStatus === "resolved" && selectedFeedback.status !== "resolved") {
      updates.resolved_at = new Date().toISOString();
    }

    await updateFeedbackMutation.mutateAsync({
      id: selectedFeedback.id,
      updates,
    });
  };

  const getTypeIcon = (type: FeedbackItem["type"]) => {
    switch (type) {
      case "bug": return <Bug className="h-4 w-4" />;
      case "feature": return <Lightbulb className="h-4 w-4" />;
      case "improvement": return <TrendingUp className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: FeedbackItem["status"]) => {
    switch (status) {
      case "pending": return "yellow";
      case "reviewed": return "blue";
      case "resolved": return "green";
      case "closed": return "gray";
      default: return "gray";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback Management</h1>
          <p className="text-muted-foreground">
            Review and manage user feedback, bug reports, and feature requests
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bug Reports</CardTitle>
            <Bug className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bugs}</div>
            <p className="text-xs text-muted-foreground">Issues reported</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feature Requests</CardTitle>
            <Lightbulb className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.features}</div>
            <p className="text-xs text-muted-foreground">New ideas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Feedback</CardTitle>
          <CardDescription>View and manage all submitted feedback</CardDescription>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject, message, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <SearchableSelect
              value={typeFilter}
              onChange={setTypeFilter}
              className="w-[150px]"
              options={[
                { value: "all", label: "All Types" },
                { value: "bug", label: "Bug" },
                { value: "feature", label: "Feature" },
                { value: "improvement", label: "Improvement" },
                { value: "general", label: "General" },
              ]}
            />
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-[150px]"
              options={[
                { value: "all", label: "All Status" },
                { value: "pending", label: "Pending" },
                { value: "reviewed", label: "Reviewed" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredFeedback.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                    <p>No feedback found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredFeedback.map((feedback) => (
                  <TableRow key={feedback.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(feedback.type)}
                        <span className="capitalize">{feedback.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{feedback.subject}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {feedback.user_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {feedback.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span>{feedback.rating}/5</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-${getStatusColor(feedback.status)}-500 text-${getStatusColor(feedback.status)}-600`}>
                        {feedback.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(feedback.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewFeedback(feedback)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View/Edit Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
            <DialogDescription>
              Review and respond to user feedback
            </DialogDescription>
          </DialogHeader>
          
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Type</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getTypeIcon(selectedFeedback.type)}
                    <span className="capitalize font-medium">{selectedFeedback.type}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Rating</Label>
                  <div className="flex items-center gap-1 mt-1">
                    {selectedFeedback.rating ? (
                      <>
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{selectedFeedback.rating}/5</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not rated</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Subject</Label>
                <p className="mt-1 font-medium">{selectedFeedback.subject}</p>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Message</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                  {selectedFeedback.message}
                </p>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Submitted</Label>
                <p className="mt-1 text-sm">{formatDate(selectedFeedback.created_at)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <SearchableSelect
                  value={newStatus}
                  onChange={(value) => setNewStatus(value as FeedbackItem["status"])}
                  options={[
                    { value: "pending", label: "Pending" },
                    { value: "reviewed", label: "Reviewed" },
                    { value: "resolved", label: "Resolved" },
                    { value: "closed", label: "Closed" },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-notes">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this feedback..."
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateFeedback}
              disabled={updateFeedbackMutation.isPending}
            >
              {updateFeedbackMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Update Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
