import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTask, useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { useClients } from "@/hooks/useClients";
import { useMeetings } from "@/hooks/useMeetings";
import { supabase } from "@/lib/supabase";
import { taskSchema, TaskFormData } from "@/lib/validation";
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
import { ArrowLeft, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

export default function TaskForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [users, setUsers] = useState<Profile[]>([]);

  const { data: task, isLoading: loadingTask } = useTask(id || "");
  const { data: clients } = useClients();
  const { data: meetings } = useMeetings();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: "todo",
      priority: "medium",
    },
  });

  const status = watch("status");
  const priority = watch("priority");
  const assignedTo = watch("assigned_to");
  const clientId = watch("client_id");
  const meetingId = watch("meeting_id");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        due_date: task.due_date ? task.due_date.slice(0, 16) : "",
        assigned_to: task.assigned_to || "",
        client_id: task.client_id || "",
        meeting_id: task.meeting_id || "",
      });
    }
  }, [task, reset]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const onSubmit = async (data: TaskFormData) => {
    try {
      const formattedData = {
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        assigned_to: data.assigned_to || null,
        client_id: data.client_id || null,
        meeting_id: data.meeting_id || null,
        due_date: data.due_date || null,
      };

      if (isEdit && id) {
        await updateTask.mutateAsync({ id, data: formattedData });
      } else {
        await createTask.mutateAsync(formattedData as any);
      }

      navigate("/tasks");
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const isSubmitting = createTask.isPending || updateTask.isPending;

  if (loadingTask) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Edit Task" : "Create Task"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update task details" : "Create a new task"}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Task Information</CardTitle>
          <CardDescription>
            Fill in the task details below
          </CardDescription>
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
                  placeholder="Complete project proposal"
                  disabled={isSubmitting}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  value={status}
                  onChange={(value) => setValue("status", value)}
                  disabled={isSubmitting}
                  options={[
                    { value: "todo", label: "To Do" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
                {errors.status && (
                  <p className="text-sm text-destructive">{errors.status.message}</p>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">
                  Priority <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  value={priority}
                  onChange={(value) => setValue("priority", value)}
                  disabled={isSubmitting}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                    { value: "urgent", label: "Urgent" },
                  ]}
                />
                {errors.priority && (
                  <p className="text-sm text-destructive">{errors.priority.message}</p>
                )}
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  {...register("due_date")}
                  disabled={isSubmitting}
                />
                {errors.due_date && (
                  <p className="text-sm text-destructive">{errors.due_date.message}</p>
                )}
              </div>

              {/* Assigned To */}
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assigned To</Label>
                <SearchableSelect
                  value={assignedTo || "_none"}
                  onChange={(value) => setValue("assigned_to", value === "_none" ? "" : value)}
                  disabled={isSubmitting}
                  placeholder="Select a user (optional)"
                  options={[
                    { value: "_none", label: "None" },
                    ...(users ?? []).map((u) => ({
                      value: u.id,
                      label: u.full_name || u.email,
                    })),
                  ]}
                />
                {errors.assigned_to && (
                  <p className="text-sm text-destructive">{errors.assigned_to.message}</p>
                )}
              </div>

              {/* Client */}
              <div className="space-y-2">
                <Label htmlFor="client_id">Client</Label>
                <SearchableSelect
                  value={clientId || "_none"}
                  onChange={(value) => setValue("client_id", value === "_none" ? "" : value)}
                  disabled={isSubmitting}
                  placeholder="Select a client (optional)"
                  options={[
                    { value: "_none", label: "None" },
                    ...(clients ?? []).map((client) => ({
                      value: client.id,
                      label: client.name,
                    })),
                  ]}
                />
                {errors.client_id && (
                  <p className="text-sm text-destructive">{errors.client_id.message}</p>
                )}
              </div>

              {/* Meeting */}
              <div className="space-y-2">
                <Label htmlFor="meeting_id">Related Meeting</Label>
                <SearchableSelect
                  value={meetingId || "_none"}
                  onChange={(value) => setValue("meeting_id", value === "_none" ? "" : value)}
                  disabled={isSubmitting}
                  placeholder="Select a meeting (optional)"
                  options={[
                    { value: "_none", label: "None" },
                    ...(meetings ?? []).map((meeting) => ({
                      value: meeting.id,
                      label: meeting.title,
                    })),
                  ]}
                />
                {errors.meeting_id && (
                  <p className="text-sm text-destructive">{errors.meeting_id.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Task details and requirements..."
                  rows={4}
                  disabled={isSubmitting}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/tasks")}
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
                  <>{isEdit ? "Update Task" : "Create Task"}</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
