import { useParams, useNavigate, Link } from "react-router-dom";
import { useClient, useDeleteClient } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Edit, Trash2, Mail, Phone, Building2, Loader2 } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useState } from "react";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: client, isLoading } = useClient(id || "");
  const deleteClient = useDeleteClient();

  const handleDelete = async () => {
    if (id) {
      await deleteClient.mutateAsync(id);
      navigate("/clients");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Client not found</p>
        <Button onClick={() => navigate("/clients")}>Back to Clients</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-muted-foreground">Client Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/clients/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Client</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {client.name}? This action cannot be undone.
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

      {/* Client Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Primary contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email</p>
                <a
                  href={`mailto:${client.email}`}
                  className="text-sm text-primary hover:underline"
                >
                  {client.email}
                </a>
              </div>
            </div>

            {client.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Phone</p>
                  <a
                    href={`tel:${client.phone}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {client.phone}
                  </a>
                </div>
              </div>
            )}

            {client.company && (
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Company</p>
                  <p className="text-sm text-muted-foreground">{client.company}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>Record details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(client.created_at)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Last Updated</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(client.updated_at)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {client.metadata && typeof client.metadata === 'object' && 'notes' in client.metadata && client.metadata.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Additional information about this client</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{String(client.metadata.notes)}</p>
          </CardContent>
        </Card>
      )}

      {/* Related Data */}
      <Card>
        <CardHeader>
          <CardTitle>Related Data</CardTitle>
          <CardDescription>Associated meetings, documents, and more</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Meetings</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Documents</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">AI Interactions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
