import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useUpdateLoan } from "@/hooks/useLoans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, X } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  loanId: string;
  currentUnderwriterId: string | null;
}

export function UnderwriterAssignment({ loanId, currentUnderwriterId }: Props) {
  const updateLoan = useUpdateLoan();
  const [selectedId, setSelectedId] = useState(currentUnderwriterId ?? "");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["underwriter_candidates"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const currentUw = users.find((u) => u.id === currentUnderwriterId);

  const handleAssign = () => {
    if (!selectedId) return;
    updateLoan.mutate({
      id: loanId,
      data: { underwriter_id: selectedId } as any,
    });
  };

  const handleUnassign = () => {
    updateLoan.mutate({
      id: loanId,
      data: { underwriter_id: null } as any,
    });
    setSelectedId("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Underwriter Assignment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentUnderwriterId && currentUw ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                Assigned
              </Badge>
              <span className="text-sm font-medium">
                {currentUw.full_name ?? currentUw.email ?? "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Reassign..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.email ?? u.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedId && selectedId !== currentUnderwriterId && (
                <Button size="sm" onClick={handleAssign} disabled={updateLoan.isPending}>
                  {updateLoan.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Reassign
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleUnassign} disabled={updateLoan.isPending}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select underwriter..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : (
                  users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.email ?? u.id.slice(0, 8)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAssign} disabled={!selectedId || updateLoan.isPending}>
              {updateLoan.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Assign Underwriter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
