import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useBorrower } from "@/hooks/useBorrowers";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunicationTimeline } from "@/components/communications/CommunicationTimeline";
import { CreditReportSection } from "@/components/data-foundation/CreditReportSection";
import { EmploymentVerificationSection } from "@/components/data-foundation/EmploymentVerificationSection";
import { PropertyValuationSection } from "@/components/data-foundation/PropertyValuationSection";
import { ArrowLeft, Edit, Loader2, Mail, Phone, MapPin, User } from "lucide-react";
import { formatDate } from "@/lib/utils";

function useLoansByBorrower(borrowerId: string | undefined) {
  return useQuery({
    queryKey: ["loans", "byBorrower", borrowerId ?? ""],
    queryFn: async () => {
      if (!borrowerId) return [];
      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_number, status, loan_amount, property_address, created_at")
        .eq("borrower_id", borrowerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!borrowerId,
  });
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "funded":
    case "clear_to_close":
      return "default";
    case "processing":
    case "underwriting":
      return "secondary";
    case "denied":
    case "withdrawn":
      return "destructive";
    default:
      return "outline";
  }
}

export default function BorrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: borrower, isLoading } = useBorrower(id);
  const { data: loans, isLoading: loansLoading } = useLoansByBorrower(id);

  if (isLoading || !borrower) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fullName = [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "Unnamed";
  const address = [borrower.street_address, borrower.city, borrower.state, borrower.postal_code]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/borrowers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{fullName}</h1>
            <p className="text-muted-foreground">
              Borrower · Added {formatDate(borrower.created_at)}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to={`/borrowers/${borrower.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Borrower Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Name" value={fullName} />
            <Row
              label="Email"
              value={
                borrower.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {borrower.email}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Phone"
              value={
                borrower.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {borrower.phone}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row label="Date of birth" value={borrower.date_of_birth ? formatDate(borrower.date_of_birth) : "—"} />
            <Row label="SSN (last 4)" value={borrower.ssn_last4 ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              Address & Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Address" value={address || "—"} />
            <Row label="Data source" value={borrower.data_source ?? "manual"} />
            <Row label="External ID" value={borrower.external_id ?? "—"} />
            <Row label="Created" value={formatDate(borrower.created_at)} />
            <Row label="Updated" value={formatDate(borrower.updated_at)} />
          </CardContent>
        </Card>
      </div>

      {/* Linked Loans */}
      <Card>
        <CardHeader>
          <CardTitle>Linked Loans</CardTitle>
          <CardDescription>Loans associated with this borrower</CardDescription>
        </CardHeader>
        <CardContent>
          {loansLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !loans?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No loans linked to this borrower.
            </p>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => (
                <Link
                  key={loan.id}
                  to={`/loans/${loan.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">{loan.loan_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {loan.property_address ?? "No address"} · {formatDate(loan.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {loan.loan_amount != null && (
                      <span className="text-sm font-medium">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 0,
                        }).format(Number(loan.loan_amount))}
                      </span>
                    )}
                    <Badge variant={statusVariant(loan.status)}>{loan.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Foundation — Credit, Employment, Property */}
      <Tabs defaultValue="credit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="credit">Credit</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="property">Property Valuation</TabsTrigger>
        </TabsList>
        <TabsContent value="credit">
          <CreditReportSection
            borrowerId={borrower.id}
            loanId={loans?.[0]?.id}
          />
        </TabsContent>
        <TabsContent value="employment">
          <EmploymentVerificationSection
            borrowerId={borrower.id}
            loanId={loans?.[0]?.id}
          />
        </TabsContent>
        <TabsContent value="property">
          <PropertyValuationSection
            borrowerId={borrower.id}
            loanId={loans?.[0]?.id}
            defaultAddress={borrower.street_address ?? undefined}
            defaultCity={borrower.city ?? undefined}
            defaultState={borrower.state ?? undefined}
            defaultPostalCode={borrower.postal_code ?? undefined}
          />
        </TabsContent>
      </Tabs>

      {/* Communication Timeline */}
      <CommunicationTimeline
        borrowerId={id}
        showLoan
        title="Communication History"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
