import { useState } from "react";
import { Link } from "react-router-dom";
import { useTasks, useDeleteTask, useUpdateTask, Task } from "@/hooks/useTasks";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit, CheckCircle2, Circle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const { user } = useAuth();

  const filters: any = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (priorityFilter !== "all") filters.priority = priorityFilter;

  const { data: tasks, isLoading } = useTasks(filters);
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();

  const handleDelete = () => {
    if (deleteId) {
      deleteTask.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const handleQuickStatusUpdate = (taskId: string, newStatus: Task['status']) => {
    updateTask.mutate({ id: taskId, data: { status: newStatus } });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        icon: any;
        label: string;
      }
    > = {
      todo: { variant: "outline", icon: Circle, label: "To do" },
      in_progress: { variant: "default", icon: Clock, label: "In progress" },
      completed: { variant: "secondary", icon: CheckCircle2, label: "Completed" },
      cancelled: { variant: "destructive", icon: Circle, label: "Cancelled" },
    };
    const { variant, icon: Icon, label } = config[status] || config.todo;
    return (
      <Badge
        variant={variant}
        className="flex items-center gap-1 w-fit rounded-full px-3 py-1 text-xs font-medium"
      >
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary",
      medium: "outline",
      high: "default",
      urgent: "destructive",
    };
    return <Badge variant={variants[priority] || "outline"}>{priority}</Badge>;
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date) return false;
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.due_date) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Manage and track your tasks and assignments
          </p>
        </div>
        <Button asChild>
          <Link to="/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">To Do</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasks?.filter(t => t.status === 'todo').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasks?.filter(t => t.status === 'in_progress').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tasks?.filter(t => t.status === 'completed').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {tasks?.filter(t => isOverdue(t)).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Tasks</CardTitle>
          <CardDescription>Filter by status and priority</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label>Status</Label>
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Select status"
              options={[
                { value: "all", label: "All Tasks" },
                { value: "todo", label: "To Do" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </div>
          <div className="flex-1">
            <Label>Priority</Label>
            <SearchableSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              placeholder="Select priority"
              options={[
                { value: "all", label: "All Priorities" },
                { value: "urgent", label: "Urgent" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">No tasks found</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/tasks/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first task
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32%]">Title</TableHead>
                  <TableHead className="w-[18%]">Status</TableHead>
                  <TableHead className="w-[12%]">Priority</TableHead>
                  <TableHead className="w-[16%]">Assigned To</TableHead>
                  <TableHead className="w-[14%]">Due Date</TableHead>
                  <TableHead className="w-[8%]">Progress</TableHead>
                  <TableHead className="text-right w-[8%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id} className={isOverdue(task) ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium max-w-[320px]">
                      <div className="space-y-1">
                        <div>{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">
                      <SearchableSelect
                        value={task.status}
                        onChange={(value) =>
                          handleQuickStatusUpdate(task.id, value as Task["status"])
                        }
                        className="w-[150px] h-8 border-0 bg-transparent px-0 shadow-none text-xs"
                        options={[
                          { value: "todo", label: "To do" },
                          { value: "in_progress", label: "In progress" },
                          { value: "completed", label: "Completed" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                      />
                    </TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell>
                      {(task as any).assigned_user?.raw_user_meta_data?.name ||
                       (task as any).assigned_user?.email ||
                       "Unassigned"}
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className={isOverdue(task) ? "text-destructive font-medium" : ""}>
                          {formatDateTime(task.due_date)}
                          {isOverdue(task) && <span className="ml-2 text-xs">(Overdue)</span>}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-secondary rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/tasks/${task.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(task.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task.
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
