// MCT Lite: hidden-module stub. Original implementation references tables not in the Lite schema.
// @ts-nocheck
import { useQuery } from "@tanstack/react-query";

export type PipelineStageStat = { status: string; count: number };
export type RiskHeatmapRow = {
  loanOfficerId: string;
  loanOfficerName: string;
  totalLoans: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
};
export type LoanDetailRow = {
  loanId: string;
  loanNumber: string;
  loanStatus: string;
  loanOfficerName: string;
  riskLevel: string;
  updatedAt: string;
};
export type ManagerDashboardData = {
  metrics: { activeLoans: number; atRiskLoans: number; lockExpiringSoon: number; onTimeRate: number };
  pipeline: PipelineStageStat[];
  riskByOfficer: RiskHeatmapRow[];
  bottlenecks: Array<{ id: string; label: string; loanCount: number; description: string }>;
  locksExpiring: Array<{ loanId: string; loanNumber: string; lockExpiration: string | null; loanStatus: string; investorStatus: string | null }>;
  activeLoansDetail: LoanDetailRow[];
  atRiskLoansDetail: LoanDetailRow[];
  onTimeLoansDetail: LoanDetailRow[];
  untouchedSummary: { over7Days: number; over21Days: number };
  teamActivity: Array<{ loanOfficerId: string; loanOfficerName: string; totalLoans: number; untouched7Plus: number; untouched21Plus: number }>;
};

const emptyManagerDashboard: ManagerDashboardData = {
  metrics: { activeLoans: 0, atRiskLoans: 0, lockExpiringSoon: 0, onTimeRate: 100 },
  pipeline: [],
  riskByOfficer: [],
  bottlenecks: [],
  locksExpiring: [],
  activeLoansDetail: [],
  atRiskLoansDetail: [],
  onTimeLoansDetail: [],
  untouchedSummary: { over7Days: 0, over21Days: 0 },
  teamActivity: [],
};

export function useManagerDashboard() {
  return useQuery({
    queryKey: ["manager-dashboard-stub"],
    queryFn: async () => emptyManagerDashboard,
    initialData: emptyManagerDashboard,
  });
}
