import { useNavigate, useParams } from "react-router-dom";
import { useTask, useDeleteTask } from "@/hooks/useTasks";
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
  Calendar,
  User,
  Briefcase,
  Video,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: task, isLoading } = useTask(id || "");
  const deleteTask = useDeleteTask();

  const handleDelete = () => {
    if (id) {
      deleteTask.mutate(id);
      navigate("/tasks");
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
    > = {
      todo: { variant: "outline", icon: Circle },
      in_progress: { variant: "default", icon: Clock },
      completed: { variant: "secondary", icon: CheckCircle2 },
      cancelled: { variant: "destructive", icon: AlertCircle },
    };

    const { variant, icon: Icon } = config[status] || config.todo;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
      low: { variant: "outline" },
      medium: { variant: "secondary" },
      high: { variant: "default" },
      urgent: { variant: "destructive" },
    };

    const { variant } = config[priority] || config.medium;
    return <Badge variant={variant}>{priority}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Task not found</p>
        <Button onClick={() => navigate("/tasks")}>Back to Tasks</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
            <p className="text-muted-foreground">Task Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/tasks/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this task? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Info */}
          <Card>
            <CardHeader>
              <CardTitle>Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  {getStatusBadge(task.status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Priority:</span>
                  {getPriorityBadge(task.priority)}
                </div>
              </div>

              {task.description && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              )}

              {task.due_date && (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Due Date</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(task.due_date)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.assigned_user ? (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Assigned To</p>
                    <p className="text-sm text-muted-foreground">
                      {task.assigned_user.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.assigned_user.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Items */}
          {(task.clients || task.meetings) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.clients && (
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Client</p>
                      <p className="text-sm text-muted-foreground">
                        {task.clients.name}
                      </p>
                    </div>
                  </div>
                )}

                {task.meetings && (
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Meeting</p>
                      <p className="text-sm text-muted-foreground">
                        {task.meetings.title}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDate(task.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm">{formatDate(task.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
