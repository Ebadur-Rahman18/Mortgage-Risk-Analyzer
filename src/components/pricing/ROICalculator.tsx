import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Clock, DollarSign, TrendingUp, Zap } from "lucide-react";

export function ROICalculator() {
  const [loansPerMonth, setLoansPerMonth] = useState([25]);
  
  // Calculations based on industry averages
  const emailHoursSaved = loansPerMonth[0] * 1.5; // 1.5 hours per loan in email processing
  const docHoursSaved = loansPerMonth[0] * 0.5; // 30 min per loan in document review
  const totalHoursSaved = emailHoursSaved + docHoursSaved;
  const weeklyHoursSaved = totalHoursSaved / 4;
  const annualSalarySavings = totalHoursSaved * 12 * 35; // $35/hr average
  const complianceReduction = 35; // Fixed percentage
  const loanProcessingDays = loansPerMonth[0] > 30 ? 2 : 3; // Faster at scale

  const stats = [
    {
      label: "Hours Saved Weekly",
      value: Math.round(weeklyHoursSaved),
      suffix: "hrs",
      icon: Clock,
      color: "text-mortgage-teal",
      bgColor: "bg-mortgage-teal/10",
    },
    {
      label: "Annual Savings",
      value: `$${Math.round(annualSalarySavings / 1000)}K`,
      suffix: "",
      icon: DollarSign,
      color: "text-mortgage-success",
      bgColor: "bg-green-100",
    },
    {
      label: "Faster Processing",
      value: loanProcessingDays,
      suffix: " days",
      icon: Zap,
      color: "text-mortgage-gold",
      bgColor: "bg-amber-100",
    },
    {
      label: "Compliance Errors",
      value: `-${complianceReduction}%`,
      suffix: "",
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-mortgage-navy mb-4">
            From Hours to Minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how much time and money your agentic workforce will save. 
            Adjust the slider to match your loan volume.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          {/* Calculator Card */}
          <div className="bg-gradient-to-br from-mortgage-cream to-white rounded-2xl border border-border p-8 mb-8">
            <div className="mb-8">
              <label className="block text-sm font-medium text-mortgage-navy mb-4">
                Loans Processed Per Month: <span className="text-mortgage-teal font-bold text-lg">{loansPerMonth[0]}</span>
              </label>
              <Slider
                value={loansPerMonth}
                onValueChange={setLoansPerMonth}
                min={5}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>5 loans</span>
                <span>100 loans</span>
              </div>
            </div>
            
            {/* Results Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div 
                  key={stat.label}
                  className="bg-white rounded-xl p-4 text-center border border-border shadow-sm"
                >
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${stat.bgColor}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}{stat.suffix}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Comparison Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-3 text-sm font-medium">
              <div className="p-4 bg-muted/50">Metric</div>
              <div className="p-4 bg-red-50 text-center">Manual Process</div>
              <div className="p-4 bg-mortgage-teal/10 text-center">With MCT + CollabAI</div>
            </div>
            <div className="divide-y divide-border">
              <div className="grid grid-cols-3 text-sm">
                <div className="p-4 font-medium">Loan Review Time</div>
                <div className="p-4 text-center text-red-600">5 days</div>
                <div className="p-4 text-center text-mortgage-teal font-semibold">2 days</div>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <div className="p-4 font-medium">Email Processing</div>
                <div className="p-4 text-center text-red-600">2 hrs/day</div>
                <div className="p-4 text-center text-mortgage-teal font-semibold">15 min/day</div>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <div className="p-4 font-medium">Document Extraction</div>
                <div className="p-4 text-center text-red-600">30 min/doc</div>
                <div className="p-4 text-center text-mortgage-teal font-semibold">2 min/doc</div>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <div className="p-4 font-medium">Compliance Errors</div>
                <div className="p-4 text-center text-red-600">Frequent</div>
                <div className="p-4 text-center text-mortgage-teal font-semibold">-35% Reduction</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
