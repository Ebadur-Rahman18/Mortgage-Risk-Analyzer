// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMeeting, useCreateMeeting, useUpdateMeeting } from "@/hooks/useMeetings";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import {
  meetingSchema,
  MeetingFormData,
  MeetingStatus,
  MEETING_STATUSES,
  MEETING_TYPES,
} from "@/lib/validation";
import { useLoans } from "@/hooks/useLoans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Lock } from "lucide-react";

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function MeetingForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = useEffectivePermissions();
  // Admin (role="admin") always has access. Otherwise require explicit permission.
  const isAdmin = profile?.role === "admin";
  const canManage =
    isAdmin ||
    (isEdit ? hasPermission("meetings:update") : hasPermission("meetings:create"));

  const { data: meeting, isLoading: loadingMeeting } = useMeeting(id || "");
  const { data: clients } = useClients();
  const { data: loansResult } = useLoans();
  const loans = loansResult?.rows ?? [];
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();

  // Default form values: when editing, use loaded meeting so status and all fields show correctly
  const defaultFormValues: MeetingFormData = (isEdit && meeting)
    ? {
        title: meeting.title,
        description: meeting.description || "",
        meeting_date: meeting.scheduled_at ? meeting.scheduled_at.slice(0, 16) : "",
        duration_minutes: meeting.duration_minutes ?? undefined,
        location: meeting.location || "",
        client_id: meeting.client_id || "",
        loan_id: meeting.loan_id || "",
        meeting_type: (meeting.meeting_type as MeetingFormData["meeting_type"]) || "manual",
        zoom_meeting_id: meeting.zoom_meeting_id || "",
        zoom_join_url: meeting.zoom_join_url || "",
        status: (meeting.status as MeetingStatus) || "scheduled",
      }
    : {
        title: "",
        description: "",
        meeting_date: "",
        duration_minutes: undefined,
        location: "",
        client_id: "",
        loan_id: "",
        meeting_type: "manual",
        zoom_meeting_id: "",
        zoom_join_url: "",
        status: "scheduled",
      };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: defaultFormValues,
  });

  const clientId = watch("client_id");
  const loanId = watch("loan_id");
  const currentStatus = watch("status");

  // Editing core fields (title, time, duration) is locked for non-admins when
  // the meeting has already been completed or cancelled.
  const meetingStatus = meeting?.status ?? null;
  const isLocked =
    isEdit &&
    !isAdmin &&
    (meetingStatus === "completed" || meetingStatus === "cancelled");

  useEffect(() => {
    if (meeting) {
      reset({
        title: meeting.title,
        description: meeting.description || "",
        meeting_date: meeting.scheduled_at ? meeting.scheduled_at.slice(0, 16) : "",
        duration_minutes: meeting.duration_minutes || undefined,
        location: meeting.location || "",
        client_id: meeting.client_id || "",
        loan_id: meeting.loan_id || "",
        meeting_type: (meeting.meeting_type as MeetingFormData["meeting_type"]) || "manual",
        zoom_meeting_id: meeting.zoom_meeting_id || "",
        zoom_join_url: meeting.zoom_join_url || "",
        status: (meeting.status as MeetingStatus) || "scheduled",
      });
    }
  }, [meeting, reset]);

  const onSubmit = async (data: MeetingFormData) => {
    try {
      const formattedData = {
        ...data,
        client_id: data.client_id || null,
        loan_id: data.loan_id || null,
        meeting_type: data.meeting_type ?? "manual",
        duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : null,
        location: data.location || null,
      };

      if (isEdit && id) {
        await updateMeeting.mutateAsync({ id, data: formattedData });
      } else {
        await createMeeting.mutateAsync(formattedData);
      }

      navigate("/meetings");
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const isSubmitting = createMeeting.isPending || updateMeeting.isPending;

  // Wait for meeting data in edit mode. For create mode, admins can proceed immediately.
  const mustWaitForPermissions = !isAdmin && permissionsLoading;
  if (loadingMeeting || mustWaitForPermissions) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {isEdit ? "Edit Meeting" : "Schedule Meeting"}
        </h1>
        <p className="text-muted-foreground">Loading…</p>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Users without the required permission cannot create or edit meetings
  if (!canManage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/meetings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Access Restricted</h1>
            <p className="text-muted-foreground">You do not have permission to manage meetings</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex h-32 flex-col items-center justify-center gap-2 p-6">
            <p className="text-muted-foreground text-center">
              Only administrators can create or edit meetings.
            </p>
            <Button variant="outline" onClick={() => navigate("/meetings")}>
              Back to Meetings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/meetings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Edit Meeting" : "Schedule Meeting"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update meeting details" : "Create a new meeting"}
          </p>
        </div>
      </div>

      {/* Locked state notice for non-admins */}
      {isLocked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            This meeting is <strong>{meetingStatus}</strong>. Core fields are read-only.
            Only administrators can modify a completed or cancelled meeting.
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting Information</CardTitle>
          <CardDescription>Fill in the meeting details below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">

              {/* Title */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="Weekly Team Sync"
                  disabled={isSubmitting || isLocked}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              {/* Meeting Date */}
              <div className="space-y-2">
                <Label htmlFor="meeting_date">
                  Date & Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="meeting_date"
                  type="datetime-local"
                  {...register("meeting_date")}
                  disabled={isSubmitting || isLocked}
                />
                {errors.meeting_date && (
                  <p className="text-sm text-destructive">{errors.meeting_date.message}</p>
                )}
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  {...register("duration_minutes", { valueAsNumber: true })}
                  placeholder="60"
                  disabled={isSubmitting || isLocked}
                />
                {errors.duration_minutes && (
                  <p className="text-sm text-destructive">{errors.duration_minutes.message}</p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  {...register("location")}
                  placeholder="Conference room, video link, etc."
                  disabled={isSubmitting || isLocked}
                />
              </div>

              {/* Client */}
              <div className="space-y-2">
                <Label htmlFor="client_id">Client</Label>
                <SearchableSelect
                  value={clientId || "none"}
                  onChange={(value) => setValue("client_id", value === "none" ? "" : value)}
                  disabled={isSubmitting || isLocked}
                  placeholder="Select a client (optional)"
                  options={[
                    { value: "none", label: "None" },
                    ...(clients ?? []).map((client) => ({
                      value: client.id,
                      label: client.name,
                    })),
                  ]}
                />
              </div>

              {/* Loan (optional — links meeting to pipeline / calendar) */}
              <div className="space-y-2">
                <Label htmlFor="loan_id">Loan</Label>
                <SearchableSelect
                  value={loanId || "none"}
                  onChange={(value) => setValue("loan_id", value === "none" ? "" : value)}
                  disabled={isSubmitting || isLocked}
                  placeholder="Select a loan (optional)"
                  options={[
                    { value: "none", label: "None" },
                    ...loans.map((loan) => ({
                      value: loan.id,
                      label: `${loan.loan_number}${loan.borrowers ? ` — ${loan.borrowers.first_name ?? ""} ${loan.borrowers.last_name ?? ""}`.trim() : ""}`,
                    })),
                  ]}
                />
              </div>

              {/* Meeting type — borrower appointments use calendar styling */}
              <div className="space-y-2">
                <Label htmlFor="meeting_type">Meeting type</Label>
                <SearchableSelect
                  value={watch("meeting_type") || "manual"}
                  onChange={(value) =>
                    setValue("meeting_type", value as MeetingFormData["meeting_type"])
                  }
                  disabled={isSubmitting || isLocked}
                  placeholder="Type"
                  options={MEETING_TYPES.map((t) => ({
                    value: t,
                    label:
                      t === "borrower_appointment"
                        ? "Borrower appointment"
                        : t === "teams"
                          ? "Microsoft Teams"
                          : "Manual / general",
                  }))}
                />
              </div>

              {/* Status — edit mode only, admin only */}
              {isEdit && isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <SearchableSelect
                    value={currentStatus || "scheduled"}
                    onChange={(value) => setValue("status", value as MeetingStatus)}
                    disabled={isSubmitting}
                    options={MEETING_STATUSES.map((s) => ({
                      value: s,
                      label: STATUS_LABELS[s],
                    }))}
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Meeting agenda and notes..."
                  rows={4}
                  disabled={isSubmitting || isLocked}
                />
              </div>

            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/meetings")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEdit ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>{isEdit ? "Update Meeting" : "Schedule Meeting"}</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
