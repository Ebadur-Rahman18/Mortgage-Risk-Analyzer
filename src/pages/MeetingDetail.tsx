import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMeeting, useDeleteMeeting, useUpdateMeeting } from "@/hooks/useMeetings";
import { useZoomFiles } from "@/hooks/useZoomFiles";
import { useSyncZoom } from "@/hooks/useSyncZoom";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { MeetingStatus } from "@/lib/validation";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  Video,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  Calendar,
  RefreshCw,
  FileVideo,
  Banknote,
} from "lucide-react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_CONFIG: Record<MeetingStatus, { label: string; variant: BadgeVariant }> = {
  scheduled: { label: "Scheduled", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function getStatusBadge(status: MeetingStatus | null) {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function calcEndTime(scheduledAt: string | null, durationMinutes: number | null): string | null {
  if (!scheduledAt || !durationMinutes) return null;
  const end = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = useEffectivePermissions();
  const isAdmin = profile?.role === "admin";
  const canEdit   = isAdmin || (!permissionsLoading && hasPermission("meetings:update"));
  const canDelete = isAdmin || (!permissionsLoading && hasPermission("meetings:delete"));

  const { data: meeting, isLoading } = useMeeting(id || "");
  const deleteMeeting = useDeleteMeeting();
  const updateMeeting = useUpdateMeeting();
  const { data: appConfig } = useAppConfig();
  const zoomSyncEnabled = appConfig?.features.enableZoomSync ?? true;
  const { data: zoomFiles = [], isLoading: zoomFilesLoading } = useZoomFiles(id);
  const syncZoom = useSyncZoom();

  const handleDelete = async () => {
    if (id) {
      await deleteMeeting.mutateAsync(id);
      navigate("/meetings");
    }
  };

  const handleStatusChange = (newStatus: "completed" | "cancelled") => {
    if (id) {
      updateMeeting.mutate({ id, data: { status: newStatus } });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Video className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg font-semibold">Meeting not found</p>
        <p className="text-muted-foreground text-center max-w-md">
          This meeting does not exist or you do not have access to it.
        </p>
        <Button onClick={() => navigate("/meetings")}>Back to Meetings</Button>
      </div>
    );
  }

  const endTime = calcEndTime(meeting.scheduled_at, meeting.duration_minutes);
  const status = meeting.status ?? null;
  const isActionable = canEdit && status === "scheduled";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/meetings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{meeting.title}</h1>
              {getStatusBadge(status)}
            </div>
            <p className="text-muted-foreground">Meeting Details</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Status action buttons — only for admins when meeting is still scheduled */}
          {isActionable && (
            <>
              <Button
                variant="outline"
                onClick={() => handleStatusChange("completed")}
                disabled={updateMeeting.isPending}
                className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
              >
                {updateMeeting.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Mark Completed
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusChange("cancelled")}
                disabled={updateMeeting.isPending}
                className="border-red-400 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                {updateMeeting.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Cancel Meeting
              </Button>
            </>
          )}

          {/* Edit */}
          {canEdit && (
            <Button variant="outline" asChild>
              <Link to={`/meetings/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}

          {/* Delete */}
          {canDelete && (
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
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
          )}
        </div>
      </div>

      {/* Meeting Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
          <CardDescription>Full information about this meeting</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">

          {/* Status */}
          <div className="space-y-1">
            <p className="text-sm font-medium">Status</p>
            {getStatusBadge(status)}
          </div>

          {/* Date & Start Time */}
          {meeting.scheduled_at && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Start Time
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(meeting.scheduled_at)}
              </p>
            </div>
          )}

          {/* End Time */}
          {endTime && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> End Time
              </p>
              <p className="text-sm text-muted-foreground">{formatDateTime(endTime)}</p>
            </div>
          )}

          {/* Duration */}
          {meeting.duration_minutes && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Duration</p>
              <p className="text-sm text-muted-foreground">{meeting.duration_minutes} minutes</p>
            </div>
          )}

          {/* Location */}
          {meeting.location && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Location
              </p>
              <p className="text-sm text-muted-foreground">{meeting.location}</p>
            </div>
          )}

          {/* Client */}
          {meeting.clients && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> Client
              </p>
              <p className="text-sm text-muted-foreground">{meeting.clients.name}</p>
              {meeting.clients.email && (
                <p className="text-xs text-muted-foreground">{meeting.clients.email}</p>
              )}
            </div>
          )}

          {/* Linked loan */}
          {meeting.loan_id && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" /> Loan
              </p>
              <Link
                to={`/loans/${meeting.loan_id}`}
                className="text-sm text-primary hover:underline"
              >
                {meeting.loans?.loan_number
                  ? `Loan ${meeting.loans.loan_number}`
                  : "View loan"}
              </Link>
            </div>
          )}

          {/* Meeting type */}
          {meeting.meeting_type && meeting.meeting_type !== "manual" && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Type</p>
              <p className="text-sm text-muted-foreground capitalize">
                {meeting.meeting_type.replace(/_/g, " ")}
              </p>
            </div>
          )}

          {/* Zoom Join Link */}
          {meeting.zoom_join_url && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1">
                <Video className="h-3.5 w-3.5" /> Join Link
              </p>
              <a
                href={meeting.zoom_join_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Join Meeting
              </a>
            </div>
          )}

          {/* Zoom cloud recordings (synced) */}
          {(meeting.zoom_meeting_id || meeting.zoom_uuid || zoomFiles.length > 0) && (
            <div className="space-y-2 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <FileVideo className="h-3.5 w-3.5" /> Zoom recordings
                </p>
                {isAdmin && zoomSyncEnabled && id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syncZoom.isPending}
                    onClick={() => syncZoom.mutate({ meeting_id: id })}
                  >
                    {syncZoom.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync from Zoom
                  </Button>
                )}
              </div>
              {zoomFilesLoading ? (
                <p className="text-sm text-muted-foreground">Loading recordings…</p>
              ) : zoomFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No synced files yet. Match this meeting&apos;s Zoom ID or UUID, then run sync from Admin →
                  Integrations → Zoom (or use the button above).
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {zoomFiles.map((zf) => (
                    <li
                      key={zf.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <span className="font-medium">{zf.file_name}</span>
                      <span className="text-muted-foreground">{zf.file_type}</span>
                      {zf.download_url && (
                        <a
                          href={zf.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Download
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Description — full width */}
          {meeting.description && (
            <div className="space-y-1 sm:col-span-2">
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {meeting.description}
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
