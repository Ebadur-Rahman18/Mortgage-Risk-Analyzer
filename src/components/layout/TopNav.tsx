import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, LogOut, User, Settings, Search, ExternalLink, FileText, Users, Calendar, Loader2, Shield, Info, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { useState } from "react";
import { useUnreadCount, useNotifications } from "@/hooks/useNotifications";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";
import { RiskAlertsBell } from "@/components/loans/RiskAlertsBell";
import { useAdminSidebar } from "@/contexts/AdminSidebarContext";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useTourContext } from "@/contexts/TourContext";

const ABOUT_URL =
  import.meta.env.VITE_ABOUT_BRAND_URL ?? "https://collabai.software/";

export function TopNav() {
  const { user, profile, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const appSidebar = useAppSidebar();
  const adminSidebar = useAdminSidebar();
  const sidebar = appSidebar ?? adminSidebar;
  const sidebarCollapsed = sidebar?.collapsed ?? false;

  // Use React Query hooks for notifications
  const { data: unreadCount } = useUnreadCount();
  const { data: recentNotifications, isLoading: loadingNotifications } = useNotifications("all");

  // Use semantic search hook
  const {
    query: searchQuery,
    results: searchResults,
    isSearching: searching,
    search,
    clearResults,
    setQuery: setSearchQuery,
  } = useSemanticSearch();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await search(searchQuery);
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "knowledge":
        return <FileText className="h-4 w-4" />;
      case "client":
        return <Users className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleAboutClick = () => {
    window.open(ABOUT_URL, "_blank", "noopener,noreferrer");
  };

  const tour = useTourContext();

  return (
    <header
      className={`fixed top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm transition-[left] duration-200 ${
        sidebarCollapsed ? "left-16" : "left-64"
      } right-0`}
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search anything..."
            onClick={() => setSearchOpen(true)}
            readOnly
            className="h-9 w-full max-w-sm border-transparent bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground/70 focus:border-border focus:bg-background cursor-pointer"
          />
        </div>

        {/* Search Dialog */}
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Search</DialogTitle>
              <DialogDescription>
                Search across clients, meetings, knowledge base, and more
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What are you looking for?"
                  disabled={searching}
                  autoFocus
                />
                <Button type="submit" disabled={searching || !searchQuery.trim()}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>

            {/* Search Results */}
            <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 && searchQuery ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Search className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No results found. Try a different query." : "Enter a search query to get started"}
                  </p>
                </div>
              ) : (
                searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent cursor-pointer"
                    onClick={() => {
                      setSearchOpen(false);
                      clearResults();
                    }}
                  >
                    <div className="mt-0.5">{getEntityIcon(result.entity_type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {result.entity_type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(result.similarity * 100)}% match
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm line-clamp-2">{result.content}</p>
                      {result.metadata && Object.keys(result.metadata).length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {JSON.stringify(result.metadata)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Risk Alerts (SLA / lock expiry) */}
          <RiskAlertsBell />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground">
                <Bell className="h-[18px] w-[18px]" />
                {(unreadCount || 0) > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
                  >
                    {(unreadCount || 0) > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {(unreadCount || 0) > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} new
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[400px] overflow-y-auto">
                {loadingNotifications ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : !recentNotifications || recentNotifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  <>
                    {recentNotifications.slice(0, 5).map((notification) => (
                      <DropdownMenuItem key={notification.id} asChild>
                        <Link
                          to={notification.link || "/notifications"}
                          className="flex flex-col gap-1 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${!notification.is_read ? "text-primary" : ""}`}>
                              {notification.title}
                            </span>
                            {!notification.is_read && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.created_at).toLocaleString()}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        to="/notifications"
                        className="flex items-center justify-center gap-2 p-2 text-sm font-medium"
                      >
                        View all notifications
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 pl-2 pr-3 hover:bg-muted" data-tour="profile">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {getInitials(profile?.full_name || user?.email || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start text-left md:flex">
                  <span className="text-sm font-medium text-foreground">
                    {profile?.full_name || "User"}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {profile?.role === "admin" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium">
                      <Shield className="h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={tour.startTour}
                className="flex items-center gap-2 cursor-pointer"
              >
                <MapPin className="h-4 w-4" />
                Take Tour
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleAboutClick}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Info className="h-4 w-4" />
                About Us
                <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut} 
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
