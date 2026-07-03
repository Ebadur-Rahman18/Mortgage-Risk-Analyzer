import { useEffect, useState } from "react";
import { useLoanDeclarations, useUpsertLoanDeclarations } from "@/hooks/useLoanApplication";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

const DECLARATION_QUESTIONS = [
  { key: "outstanding_judgments", label: "Are there any outstanding judgments against you?" },
  { key: "declared_bankruptcy", label: "Have you been declared bankrupt within the past 7 years?" },
  { key: "foreclosure", label: "Have you had property foreclosed upon in the last 7 years?" },
  { key: "party_to_lawsuit", label: "Are you a party to a lawsuit?" },
  { key: "loan_obligations_delinquent", label: "Are you presently delinquent on any federal debt?" },
  { key: "alimony_obligations", label: "Are you obligated to pay alimony, child support, or maintenance?" },
  { key: "down_payment_borrowed", label: "Is any part of the down payment borrowed?" },
  { key: "co_maker_endorser", label: "Are you a co-maker or endorser on a note?" },
  { key: "us_citizen", label: "Are you a U.S. citizen?" },
  { key: "permanent_resident", label: "Are you a permanent resident alien?" },
  { key: "intend_to_occupy", label: "Do you intend to occupy the property as your primary residence?" },
  { key: "ownership_interest_last_3yrs", label: "Have you had an ownership interest in a property in the last 3 years?" },
];

interface Props {
  loanId: string;
  borrowerId: string;
}

export function DeclarationsSection({ loanId, borrowerId }: Props) {
  const { data: existing, isLoading } = useLoanDeclarations(loanId, borrowerId);
  const upsert = useUpsertLoanDeclarations();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (existing?.declarations) {
      const mapped: Record<string, boolean> = {};
      for (const q of DECLARATION_QUESTIONS) {
        mapped[q.key] = !!existing.declarations[q.key];
      }
      setValues(mapped);
      setDirty(false);
    }
  }, [existing]);

  const handleToggle = (key: string, val: boolean) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = () => {
    upsert.mutate(
      { loan_id: loanId, borrower_id: borrowerId, declarations: values },
      { onSuccess: () => setDirty(false) }
    );
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Declarations (1003 Section VIII)</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={!dirty || upsert.isPending}>
          {upsert.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Save
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {DECLARATION_QUESTIONS.map((q) => (
            <div key={q.key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <Label className="text-sm flex-1 cursor-pointer" htmlFor={q.key}>{q.label}</Label>
              <Switch
                id={q.key}
                checked={values[q.key] ?? false}
                onCheckedChange={(v) => handleToggle(q.key, v)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
