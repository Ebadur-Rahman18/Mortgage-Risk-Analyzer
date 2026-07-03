import { Shield, Lock, Server, CheckCircle } from "lucide-react";

export function CollabAISecurityBadge() {
  return (
    <section className="py-16 bg-gradient-to-r from-mortgage-navy to-mortgage-navy/95">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Shield className="w-5 h-5 text-mortgage-teal" />
            <span className="text-white font-medium">Enterprise-Grade Security</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Your Data Stays Yours
          </h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            MCT Lite is built on hardened infrastructure with end-to-end encryption,
            audited controls, and compliance baked in.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-mortgage-teal/20 mb-4">
              <Lock className="w-6 h-6 text-mortgage-teal" />
            </div>
            <h3 className="text-white font-semibold mb-2">End-to-End Encryption</h3>
            <p className="text-white/70 text-sm">
              AES-256 at rest and TLS 1.3 in transit
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-mortgage-teal/20 mb-4">
              <Server className="w-6 h-6 text-mortgage-teal" />
            </div>
            <h3 className="text-white font-semibold mb-2">Row-Level Security</h3>
            <p className="text-white/70 text-sm">
              Postgres RLS enforces data scope on every query
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-mortgage-teal/20 mb-4">
              <Shield className="w-6 h-6 text-mortgage-teal" />
            </div>
            <h3 className="text-white font-semibold mb-2">SOC 2 Aligned</h3>
            <p className="text-white/70 text-sm">
              Controls aligned with SOC 2 Type II practices
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {["FINRA", "HIPAA", "GDPR", "SOC 2", "ISO 27001"].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 bg-white/5 border border-white/20 rounded-lg px-4 py-2"
            >
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-white font-medium text-sm">{badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

