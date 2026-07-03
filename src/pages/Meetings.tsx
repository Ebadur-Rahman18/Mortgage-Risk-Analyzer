import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMeetings, useDeleteMeeting } from "@/hooks/useMeetings";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2, Edit, Eye, Video, Users, ArrowLeft } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { MeetingStatus } from "@/lib/validation";

const getMeetingSourceBadge = (meetingType: string | null, metadata: Record<string, unknown> | null) => {
  if (meetingType === 'teams' || metadata?.teams_meeting_id) {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
        <Users className="h-3 w-3" />
        Teams
      </Badge>
    );
  }
  return null;
};

export default function Meetings() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = useEffectivePermissions();
  const isAdmin = profile?.role === "admin";
  // Admin always has access. Otherwise wait for permissions and check.
  const canCreate = isAdmin || (!permissionsLoading && hasPermission("meetings:create"));
  const canEdit   = isAdmin || (!permissionsLoading && hasPermission("meetings:update"));
  const canDelete = isAdmin || (!permissionsLoading && hasPermission("meetings:delete"));

  const filters = statusFilter !== "all" ? { status: statusFilter } : undefined;
  const { data: meetings, isLoading } = useMeetings(filters);
  const deleteMeeting = useDeleteMeeting();

  const handleDelete = () => {
    if (deleteId) {
      deleteMeeting.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: MeetingStatus | null) => {
    const variants: Record<MeetingStatus, "default" | "secondary" | "destructive"> = {
      scheduled: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    return <Badge variant={variants[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
            <p className="text-muted-foreground">
              Manage your meetings and Zoom integrations
            </p>
          </div>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/meetings/new">
              <Plus className="mr-2 h-4 w-4" />
              Schedule Meeting
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Meetings</CardTitle>
          <CardDescription>Filter by status</CardDescription>
        </CardHeader>
        <CardContent>
          <SearchableSelect
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-[200px]"
            options={[
              { value: "all", label: "All Meetings" },
              { value: "scheduled", label: "Scheduled" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </CardContent>
      </Card>

      {/* Meetings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Loading meetings...</p>
            </div>
          ) : !meetings || meetings.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">No meetings found</p>
              {canCreate && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/meetings/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule your first meeting
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Join</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell className="font-medium">{meeting.title}</TableCell>
                    <TableCell>
                      {meeting.clients?.name || "-"}
                    </TableCell>
                    <TableCell>{meeting.scheduled_at ? formatDateTime(meeting.scheduled_at) : "-"}</TableCell>
                    <TableCell>
                      {meeting.duration_minutes ? `${meeting.duration_minutes} min` : "-"}
                    </TableCell>
                    <TableCell>
                      {getMeetingSourceBadge(meeting.meeting_type, meeting.metadata as Record<string, unknown> | null)}
                    </TableCell>
                    <TableCell>{getStatusBadge(meeting.status as MeetingStatus | null)}</TableCell>
                    <TableCell>
                      {meeting.zoom_join_url ? (
                        <a
                          href={meeting.zoom_join_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-primary hover:underline"
                        >
                          <Video className="mr-1 h-4 w-4" />
                          Join
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/meetings/${meeting.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/meetings/${meeting.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(meeting.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
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
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
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
