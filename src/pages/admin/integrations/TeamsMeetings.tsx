/**
 * Teams Meetings Page
 * Stubbed until meetings table is created
 */

import { Link } from "react-router-dom";
import { ArrowLeft, Video, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Calendar } from "lucide-react";

export default function TeamsMeetings() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link 
          to="/admin/integrations/microsoft-teams" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Teams Integration
        </Link>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Microsoft Teams Meetings</h1>
              <p className="text-muted-foreground">
                View and manage all your synced Teams meetings
              </p>
            </div>
          </div>
          
          <Button disabled variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Meetings
          </Button>
        </div>
      </div>

      {/* Migration Notice */}
      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Database Migration Required</AlertTitle>
        <AlertDescription>
          The meetings table needs to be created. Teams meetings sync will be available once the database migration is complete.
        </AlertDescription>
      </Alert>

      {/* Empty State */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Synced Meetings
          </CardTitle>
          <CardDescription>
            0 meetings synced from Microsoft Teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="p-4 rounded-full bg-muted inline-block mb-4">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Teams meetings synced</h3>
            <p className="text-muted-foreground mb-4">
              Database migration required before syncing meetings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
