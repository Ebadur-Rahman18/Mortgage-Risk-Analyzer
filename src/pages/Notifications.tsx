import { useState } from "react";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  CheckCircle,
  Info,
  AlertTriangle,
  XCircle,
  Loader2,
  Trash2,
  Check,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Notifications() {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications, isLoading } = useNotifications(filter);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "success":
        return "default";
      case "warning":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your latest activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "unread" ? "default" : "outline"}
                onClick={() => setFilter("unread")}
              >
                New only
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Your recent activity and updates</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {filter === "unread" ? "No new notifications" : "No notifications yet"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {notifications.map((notification, index) => (
                  <div key={notification.id}>
                    <div
                      className={`flex gap-4 rounded-lg p-4 transition-colors ${
                        !notification.is_read
                          ? "bg-accent/50 border border-accent"
                          : "hover:bg-accent/20"
                      }`}
                    >
                      <div className="mt-0.5">{getIcon(notification.type)}</div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{notification.title}</p>
                              {!notification.is_read && (
                                <Badge variant="default" className="text-xs">
                                  New
                                </Badge>
                              )}
                              <Badge variant={getBadgeVariant(notification.type)} className="text-xs">
                                {notification.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {!notification.is_read && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsRead.mutate(notification.id)}
                                disabled={markAsRead.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteNotification.mutate(notification.id)}
                              disabled={deleteNotification.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {notification.link && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="mt-2"
                          >
                            <Link to={notification.link} className="flex items-center gap-2">
                              View Details
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                    {index < notifications.length - 1 && <Separator className="my-3" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
