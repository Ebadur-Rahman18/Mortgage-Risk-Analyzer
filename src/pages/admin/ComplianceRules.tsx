import { useState, useRef } from "react";
import {
  useComplianceRules,
  useToggleComplianceRule,
  useImportComplianceRules,
  type ComplianceRule,
} from "@/hooks/useComplianceRules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Upload,
  Download,
  Loader2,
  Pencil,
  FileJson,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  useUpdateComplianceRule,
} from "@/hooks/useComplianceRules";

function groupBadgeColor(group: string) {
  switch (group) {
    case "TRID":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "HMDA":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "Fair Lending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    default:
      return "";
  }
}

export default function ComplianceRules() {
  const { data: rules, isLoading } = useComplianceRules();
  const toggleRule = useToggleComplianceRule();
  const importRules = useImportComplianceRules();
  const updateRule = useUpdateComplianceRule();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [editForm, setEditForm] = useState<Partial<ComplianceRule>>({});

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.rules || !Array.isArray(json.rules)) {
        toast.error('Invalid JSON: must contain a "rules" array.');
        return;
      }
      importRules.mutate(json);
    } catch {
      toast.error("Failed to parse JSON file.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = () => {
    if (!rules) return;
    const payload = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      rules: rules.map((r) => ({
        code: r.code,
        regulation_group: r.regulation_group,
        name: r.name,
        description: r.description,
        check_field: r.check_field,
        operator: r.operator,
        threshold: r.threshold,
        severity_on_fail: r.severity_on_fail,
        severity_on_warn: r.severity_on_warn,
        citation: r.citation,
        remediation_hint: r.remediation_hint,
        enabled: r.enabled,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-rules-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (rule: ComplianceRule) => {
    setEditingRule(rule);
    setEditForm({
      name: rule.name,
      description: rule.description ?? "",
      threshold: rule.threshold,
      citation: rule.citation ?? "",
      remediation_hint: rule.remediation_hint ?? "",
    });
  };

  const saveEdit = () => {
    if (!editingRule) return;
    updateRule.mutate(
      {
        id: editingRule.id,
        name: editForm.name,
        description: editForm.description,
        threshold: editForm.threshold,
        citation: editForm.citation,
        remediation_hint: editForm.remediation_hint,
      },
      { onSuccess: () => setEditingRule(null) },
    );
  };

  const grouped = (rules ?? []).reduce<Record<string, ComplianceRule[]>>((acc, r) => {
    (acc[r.regulation_group] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Compliance Rules
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage TRID, HMDA, and Fair Lending rules used by the Compliance Screening Agent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            disabled={importRules.isPending}
            className="gap-2"
          >
            {importRules.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!rules?.length}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !rules?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileJson className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground mb-4">
              No compliance rules found. Import a JSON file to get started.
            </p>
            <Button onClick={handleImportClick} className="gap-2">
              <Upload className="h-4 w-4" />
              Import Rules
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([group, groupRules]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={groupBadgeColor(group)}>{group}</Badge>
                <span>{groupRules.length} rules</span>
              </CardTitle>
              <CardDescription>
                {group === "TRID"
                  ? "TILA-RESPA Integrated Disclosure timing and delivery rules"
                  : group === "HMDA"
                    ? "Home Mortgage Disclosure Act data completeness rules"
                    : "Equal Credit Opportunity & Fair Housing pricing and documentation rules"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[120px]">Severity</TableHead>
                    <TableHead className="w-[200px]">Citation</TableHead>
                    <TableHead className="w-[80px] text-center">Enabled</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupRules.map((rule) => (
                    <TableRow key={rule.id} className={!rule.enabled ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{rule.code}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{rule.name}</div>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {rule.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            rule.severity_on_fail === "fail"
                              ? "border-red-300 text-red-700"
                              : "border-amber-300 text-amber-700"
                          }
                        >
                          {rule.severity_on_fail === "fail" ? "Fail" : "Warn"} on breach
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rule.citation ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            toggleRule.mutate({ id: rule.id, enabled: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(rule)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingRule} onOpenChange={(o) => !o && setEditingRule(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit Rule — {editingRule?.code}
            </DialogTitle>
            <DialogDescription>
              Update the rule details. Changes take effect on the next compliance scan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={(editForm.description as string) ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input
                  type="number"
                  value={editForm.threshold ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      threshold: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Citation</Label>
                <Input
                  value={(editForm.citation as string) ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, citation: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remediation Hint</Label>
              <Textarea
                value={(editForm.remediation_hint as string) ?? ""}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, remediation_hint: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={updateRule.isPending}>
              {updateRule.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
