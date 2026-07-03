/**
 * Microsoft Teams Integration Page
 * Stubbed until Microsoft Teams tables are created
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertTriangle, Video, Users, Calendar, MessageSquare } from "lucide-react";

export default function MicrosoftTeamsIntegration() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-[#6264A7]" />
            Microsoft Teams Integration
          </h1>
          <p className="text-muted-foreground mt-2">
            Connect your Microsoft account for Teams integration and calendar sync
          </p>
        </div>
        <Badge variant="secondary">Not Connected</Badge>
      </div>

      {/* Migration Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Database Migration Required</AlertTitle>
        <AlertDescription>
          The user_microsoft_teams and user_microsoft_teams_channels tables need to be created. 
          Microsoft Teams integration will be available once the database migration is complete.
        </AlertDescription>
      </Alert>

      {/* Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Connect Microsoft Account</CardTitle>
          <CardDescription>
            Sign in with your Microsoft work or school account to enable Teams features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button disabled className="w-full sm:w-auto">
            <Building2 className="mr-2 h-4 w-4" />
            Connect Microsoft Account
          </Button>
          <p className="text-sm text-muted-foreground">
            Database migration required before connecting
          </p>
        </CardContent>
      </Card>

      {/* Features Preview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Teams Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Not connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Not connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Not connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Not connected</p>
          </CardContent>
        </Card>
      </div>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle>Available Capabilities</CardTitle>
          <CardDescription>
            Features available when connected to Microsoft Teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Video className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Teams Meetings</h4>
                <p className="text-sm text-muted-foreground">
                  Create and manage Teams meetings directly from the platform
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Channel Messages</h4>
                <p className="text-sm text-muted-foreground">
                  Send messages to Teams channels and view channel activity
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Calendar Sync</h4>
                <p className="text-sm text-muted-foreground">
                  View and sync your Outlook calendar events
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Team Collaboration</h4>
                <p className="text-sm text-muted-foreground">
                  Access your Teams and team members for collaboration
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
