import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, Clock, AlertTriangle, ArrowLeft } from "lucide-react";
import { STATUS_LABELS } from "@/lib/loan-pipeline-stages";
import { formatDate } from "@/lib/utils";

interface QueueLoan {
  id: string;
  loan_number: string;
  status: string;
  loan_amount: number | null;
  credit_score: number | null;
  ltv: number | null;
  dti: number | null;
  property_state: string | null;
  created_at: string;
  updated_at: string;
  borrowers: { first_name: string; last_name: string } | null;
}

export default function UnderwritingQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["underwriting_queue", user?.id],
    queryFn: async (): Promise<QueueLoan[]> => {
      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_number, status, loan_amount, credit_score, ltv, dti, property_state, created_at, updated_at, borrowers(first_name, last_name)")
        .not("underwriter_id", "is", null)
        .in("status", ["underwriting", "conditional_approval", "suspended"])
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QueueLoan[];
    },
    enabled: !!user?.id,
  });

  const fmt = (v: number | null) =>
    v != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(v)) : "—";

  const daysSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Underwriting Queue</h1>
          <p className="text-muted-foreground">Loans assigned for underwriting review</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : loans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No loans currently in underwriting queue.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => {
            const borrowerName = loan.borrowers
              ? `${loan.borrowers.first_name} ${loan.borrowers.last_name}`
              : "—";
            const daysInUw = daysSince(loan.updated_at);

            return (
              <Card key={loan.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="font-semibold">{loan.loan_number}</p>
                      <p className="text-sm text-muted-foreground">{borrowerName}</p>
                    </div>
                    <Badge variant="outline">{STATUS_LABELS[loan.status] ?? loan.status}</Badge>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Amount:</span> {fmt(loan.loan_amount)}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">FICO:</span> {loan.credit_score ?? "—"}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">LTV:</span> {loan.ltv ? `${Number(loan.ltv)}%` : "—"}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">DTI:</span> {loan.dti ? `${Number(loan.dti)}%` : "—"}
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      <span className={daysInUw > 5 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                        {daysInUw}d in UW
                      </span>
                      {daysInUw > 5 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/loans/${loan.id}`}>
                      Review <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
