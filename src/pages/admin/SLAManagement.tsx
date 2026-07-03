import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Clock, Edit2, Loader2, ShieldAlert } from "lucide-react";
import {
  useSLAConfigurations,
  useUpdateSLAConfiguration,
  type SLAConfiguration,
} from "@/hooks/useSLAConfigurations";

const scopeLabels: Record<string, string> = {
  condition: "Condition",
  stage_transition: "Stage Transition",
  milestone: "Milestone",
};

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

export default function SLAManagement() {
  const { data: configs, isLoading } = useSLAConfigurations();
  const updateMutation = useUpdateSLAConfiguration();

  const [editItem, setEditItem] = useState<SLAConfiguration | null>(null);
  const [formTarget, setFormTarget] = useState("");
  const [formWarning, setFormWarning] = useState("");
  const [formSeverity, setFormSeverity] = useState("medium");
  const [formActive, setFormActive] = useState(true);

  const openEdit = (sla: SLAConfiguration) => {
    setEditItem(sla);
    setFormTarget(String(sla.target_hours));
    setFormWarning(sla.warning_hours != null ? String(sla.warning_hours) : "");
    setFormSeverity(sla.severity);
    setFormActive(sla.is_active);
  };

  const handleSave = () => {
    if (!editItem) return;

    updateMutation.mutate(
      {
        id: editItem.id,
        target_hours: parseInt(formTarget, 10) || editItem.target_hours,
        warning_hours: formWarning ? parseInt(formWarning, 10) : null,
        severity: formSeverity,
        is_active: formActive,
      },
      { onSuccess: () => setEditItem(null) },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-7 w-7" />
          SLA Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure Service Level Agreement rules that drive risk scoring and alert generation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            SLA Configurations
          </CardTitle>
          <CardDescription>
            Edit target hours, warning thresholds, severity, and toggle rules on/off.
            Changes take effect on the next risk calculation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !configs || configs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No SLA configurations found. Run the seed migration to add default rules.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Transition</TableHead>
                  <TableHead className="text-center">Target (h)</TableHead>
                  <TableHead className="text-center">Warning (h)</TableHead>
                  <TableHead className="text-center">Severity</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((sla) => (
                  <TableRow key={sla.id} className={!sla.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{sla.name}</p>
                        {sla.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {sla.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{scopeLabels[sla.scope] ?? sla.scope}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {sla.from_status && sla.to_status
                        ? `${sla.from_status} → ${sla.to_status}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono">{sla.target_hours}</TableCell>
                    <TableCell className="text-center font-mono">
                      {sla.warning_hours ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${severityColors[sla.severity] ?? ""}`} variant="outline">
                        {sla.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={sla.is_active}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: sla.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(sla)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SLA Rule</DialogTitle>
            <DialogDescription>
              {editItem?.name} — {editItem?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Hours</Label>
                <Input
                  type="number"
                  min={1}
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Warning Hours</Label>
                <Input
                  type="number"
                  min={0}
                  value={formWarning}
                  onChange={(e) => setFormWarning(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <SearchableSelect
                value={formSeverity}
                onChange={setFormSeverity}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "critical", label: "Critical" },
                ]}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
