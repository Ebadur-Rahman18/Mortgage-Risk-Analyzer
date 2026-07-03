/**
 * underwriter-precheck-agent — Hybrid rule-based + AI scorecard.
 * 1. Loads loan data, conditions, milestones, borrower from DB
 * 2. Runs 12 deterministic underwriting checks (pass/warn/fail)
 * 3. Sends results to OpenAI for summary + remediation notes
 * 4. Persists scorecard in underwriting_prechecks
 * 5. Logs in ai_agent_runs
 *
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResp, parseAiJson, logAgentRun, getUserPersonalizationPrompt } from '../_shared/ai-utils.ts';

const AGENT_SLUG = 'underwriter-precheck-agent';

type CheckResult = 'pass' | 'warning' | 'fail';

interface PrecheckItem {
  category: string;
  label: string;
  result: CheckResult;
  actual_value: string;
  threshold: string;
  guideline: string;
  issue_note: string;
  remediation?: string;
}

// ─── Deterministic check functions ───────────────────────────────────────────

function checkDTI(dti: number | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'dti',
    label: 'Debt-to-Income Ratio',
    result: 'pass',
    actual_value: dti != null ? `${dti}%` : 'Not provided',
    threshold: '<=43% pass, 43-50% warning, >50% fail',
    guideline: 'Fannie Mae B3-6-02',
    issue_note: '',
  };
  if (dti == null) {
    item.result = 'fail';
    item.issue_note = 'DTI not provided — cannot assess debt burden.';
  } else if (dti > 50) {
    item.result = 'fail';
    item.issue_note = `DTI of ${dti}% exceeds maximum threshold of 50%.`;
  } else if (dti > 43) {
    item.result = 'warning';
    item.issue_note = `DTI of ${dti}% exceeds preferred threshold of 43%. May require compensating factors.`;
  }
  return item;
}

function checkLTV(ltv: number | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'ltv',
    label: 'Loan-to-Value Ratio',
    result: 'pass',
    actual_value: ltv != null ? `${ltv}%` : 'Not provided',
    threshold: '<=80% pass, 80-97% warning, >97% fail',
    guideline: 'Fannie Mae B2-1.1-01',
    issue_note: '',
  };
  if (ltv == null) {
    item.result = 'fail';
    item.issue_note = 'LTV not provided — cannot assess collateral coverage.';
  } else if (ltv > 97) {
    item.result = 'fail';
    item.issue_note = `LTV of ${ltv}% exceeds maximum 97% for conventional loans.`;
  } else if (ltv > 80) {
    item.result = 'warning';
    item.issue_note = `LTV of ${ltv}% exceeds 80% — PMI will be required.`;
  }
  return item;
}

function checkCreditScore(score: number | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'credit_score',
    label: 'Credit Score (FICO)',
    result: 'pass',
    actual_value: score != null ? String(score) : 'Not provided',
    threshold: '>=660 pass, 620-659 warning, <620 fail',
    guideline: 'Fannie Mae B3-5.1-01',
    issue_note: '',
  };
  if (score == null) {
    item.result = 'fail';
    item.issue_note = 'Credit score not provided — eligibility cannot be determined.';
  } else if (score < 620) {
    item.result = 'fail';
    item.issue_note = `Credit score of ${score} is below the minimum 620 threshold for conventional products.`;
  } else if (score < 660) {
    item.result = 'warning';
    item.issue_note = `Credit score of ${score} is below preferred 660 — may trigger LLPAs or stricter conditions.`;
  }
  return item;
}

function checkLoanAmount(amount: number | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'loan_amount',
    label: 'Loan Amount',
    result: 'pass',
    actual_value: amount != null ? `$${Number(amount).toLocaleString()}` : 'Not provided',
    threshold: 'Must be >0',
    guideline: 'Basic data completeness',
    issue_note: '',
  };
  if (amount == null || amount <= 0) {
    item.result = 'fail';
    item.issue_note = 'Loan amount is missing or zero.';
  }
  return item;
}

function checkAppraisedValue(value: number | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'appraised_value',
    label: 'Appraised Value',
    result: 'pass',
    actual_value: value != null ? `$${Number(value).toLocaleString()}` : 'Not provided',
    threshold: 'Must be >0',
    guideline: 'Fannie Mae B4-1.3-04',
    issue_note: '',
  };
  if (value == null || value <= 0) {
    item.result = 'fail';
    item.issue_note = 'Appraised value is missing or zero — LTV cannot be validated.';
  }
  return item;
}

function checkRateLock(lockExpiration: string | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'rate_lock',
    label: 'Rate Lock Status',
    result: 'pass',
    actual_value: lockExpiration ?? 'Not set',
    threshold: '>14 days pass, 1-14 days warning, expired/not set fail',
    guideline: 'Lock management policy',
    issue_note: '',
  };
  if (!lockExpiration) {
    item.result = 'fail';
    item.issue_note = 'No rate lock expiration date set.';
    return item;
  }
  const expiry = new Date(lockExpiration);
  const now = new Date();
  const daysLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  item.actual_value = `${lockExpiration} (${Math.round(daysLeft)} days remaining)`;
  if (daysLeft <= 0) {
    item.result = 'fail';
    item.issue_note = 'Rate lock has expired.';
  } else if (daysLeft <= 14) {
    item.result = 'warning';
    item.issue_note = `Rate lock expires in ${Math.round(daysLeft)} days — consider extension if closing is not imminent.`;
  }
  return item;
}

function checkPendingConditions(conditions: { status: string }[]): PrecheckItem {
  const pending = conditions.filter((c) => c.status === 'pending' || c.status === 'received');
  const count = pending.length;
  const item: PrecheckItem = {
    category: 'conditions_ptc',
    label: 'Prior-to-Close Conditions',
    result: 'pass',
    actual_value: `${count} pending/received`,
    threshold: '0 pass, 1-3 warning, >3 fail',
    guideline: 'Condition clearing workflow',
    issue_note: '',
  };
  if (count > 3) {
    item.result = 'fail';
    item.issue_note = `${count} conditions still pending or received — too many open items for submission.`;
  } else if (count > 0) {
    item.result = 'warning';
    item.issue_note = `${count} condition(s) still pending/received — review before submission.`;
  }
  return item;
}

function checkMilestone(milestones: { milestone_type: string; completed_at: string | null }[], type: string, label: string): PrecheckItem {
  const milestone = milestones.find((m) => m.milestone_type === type);
  const item: PrecheckItem = {
    category: type,
    label,
    result: 'pass',
    actual_value: milestone?.completed_at ? `Completed ${milestone.completed_at.split('T')[0]}` : 'Not completed',
    threshold: 'Must be completed',
    guideline: 'Underwriting submission checklist',
    issue_note: '',
  };
  if (!milestone || !milestone.completed_at) {
    item.result = 'fail';
    item.issue_note = `${label} milestone has not been completed.`;
  }
  return item;
}

function checkPropertyAddress(loan: Record<string, unknown>): PrecheckItem {
  const fields = ['property_address', 'property_city', 'property_state', 'property_postal_code'];
  const present = fields.filter((f) => typeof loan[f] === 'string' && (loan[f] as string).trim().length > 0);
  const missing = fields.filter((f) => !present.includes(f));
  const item: PrecheckItem = {
    category: 'property_address',
    label: 'Property Address',
    result: 'pass',
    actual_value: `${present.length}/${fields.length} fields populated`,
    threshold: 'All 4 fields required',
    guideline: 'Basic data completeness',
    issue_note: '',
  };
  if (!present.includes('property_city') || !present.includes('property_state')) {
    item.result = 'fail';
    item.issue_note = `Missing critical address fields: ${missing.join(', ')}.`;
  } else if (missing.length > 0) {
    item.result = 'warning';
    item.issue_note = `Some address fields missing: ${missing.join(', ')}.`;
  }
  return item;
}

function checkBorrowerData(borrower: Record<string, unknown> | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'borrower_data',
    label: 'Borrower Information',
    result: 'pass',
    actual_value: 'Complete',
    threshold: 'Name + email required',
    guideline: 'Loan application data requirements',
    issue_note: '',
  };
  if (!borrower) {
    item.result = 'fail';
    item.actual_value = 'No borrower linked';
    item.issue_note = 'No borrower is linked to this loan.';
    return item;
  }
  const hasName = (typeof borrower.first_name === 'string' && borrower.first_name.trim()) ||
                  (typeof borrower.last_name === 'string' && borrower.last_name.trim());
  const hasEmail = typeof borrower.email === 'string' && borrower.email.trim();
  if (!hasName && !hasEmail) {
    item.result = 'fail';
    item.actual_value = 'Missing name and email';
    item.issue_note = 'Borrower has no name or email on file.';
  } else if (!hasName || !hasEmail) {
    item.result = 'warning';
    item.actual_value = hasName ? 'Name present, email missing' : 'Email present, name missing';
    item.issue_note = `Borrower is missing ${!hasName ? 'name' : 'email'}.`;
  }
  return item;
}

function checkPurposeOccupancy(purpose: string | null, occupancy: string | null): PrecheckItem {
  const item: PrecheckItem = {
    category: 'purpose_occupancy',
    label: 'Loan Purpose & Occupancy',
    result: 'pass',
    actual_value: `Purpose: ${purpose ?? 'Not set'}, Occupancy: ${occupancy ?? 'Not set'}`,
    threshold: 'Both must be set',
    guideline: 'URLA Section IV',
    issue_note: '',
  };
  if (!purpose && !occupancy) {
    item.result = 'fail';
    item.issue_note = 'Neither loan purpose nor occupancy type is set.';
  } else if (!purpose || !occupancy) {
    item.result = 'warning';
    item.issue_note = `Missing ${!purpose ? 'loan purpose' : 'occupancy type'}.`;
  }
  return item;
}

// ─── AI summary helper ───────────────────────────────────────────────────────


// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let stage = 'init';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResp({ error: 'Missing Supabase configuration' }, 500);
    }

    stage = 'auth_getUser';
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResp({ error: 'Invalid session' }, 401);
    }
    const uid = userData.user.id;

    stage = 'parse_body';
    const body = (await req.json().catch(() => ({}))) as { loan_id?: string };
    if (!body.loan_id) {
      return jsonResp({ error: 'loan_id is required' }, 400);
    }
    const loan_id = body.loan_id;

    const service = createClient(supabaseUrl, serviceKey);

    // Check agent is enabled
    stage = 'load_ai_agent';
    const { data: agent } = await service
      .from('ai_agents')
      .select('id, system_prompt, is_enabled, provider_config')
      .eq('slug', AGENT_SLUG)
      .maybeSingle();

    if (!agent?.is_enabled) {
      return jsonResp({ error: 'Underwriting Pre-Check Agent is disabled.' }, 400);
    }

    // Load loan
    stage = 'load_loan';
    const { data: loan, error: loanErr } = await service
      .from('loans')
      .select('id, loan_number, status, loan_amount, appraised_value, ltv, credit_score, dti, purpose, occupancy_type, lock_expiration_date, loan_officer_id, borrower_id, property_address, property_city, property_state, property_postal_code')
      .eq('id', loan_id)
      .maybeSingle();

    if (loanErr || !loan) {
      return jsonResp({ error: 'Loan not found' }, 404);
    }

    // Load related data in parallel
    stage = 'load_relations';
    const [borrowerRes, conditionsRes, milestonesRes] = await Promise.all([
      loan.borrower_id
        ? service.from('borrowers').select('first_name, last_name, email, phone').eq('id', loan.borrower_id).maybeSingle()
        : Promise.resolve({ data: null }),
      service.from('loan_conditions').select('condition_type, status, description, due_date').eq('loan_id', loan_id).limit(100),
      service.from('loan_milestones').select('milestone_type, name, completed_at, due_date').eq('loan_id', loan_id),
    ]);

    const borrower = borrowerRes.data as Record<string, unknown> | null;
    const conditions = (conditionsRes.data ?? []) as { status: string }[];
    const milestones = (milestonesRes.data ?? []) as { milestone_type: string; completed_at: string | null }[];

    // ── Run 12 deterministic checks ──────────────────────────────────────
    stage = 'compute_checks';

    const checks: PrecheckItem[] = [
      checkDTI(loan.dti != null ? Number(loan.dti) : null),
      checkLTV(loan.ltv != null ? Number(loan.ltv) : null),
      checkCreditScore(loan.credit_score != null ? Number(loan.credit_score) : null),
      checkLoanAmount(loan.loan_amount != null ? Number(loan.loan_amount) : null),
      checkAppraisedValue(loan.appraised_value != null ? Number(loan.appraised_value) : null),
      checkRateLock(loan.lock_expiration_date as string | null),
      checkPendingConditions(conditions),
      checkMilestone(milestones, 'appraisal_received', 'Appraisal Received'),
      checkMilestone(milestones, 'title_received', 'Title Received'),
      checkPropertyAddress(loan as unknown as Record<string, unknown>),
      checkBorrowerData(borrower),
      checkPurposeOccupancy(loan.purpose as string | null, loan.occupancy_type as string | null),
    ];

    const passCount = checks.filter((c) => c.result === 'pass').length;
    const warnCount = checks.filter((c) => c.result === 'warning').length;
    const failCount = checks.filter((c) => c.result === 'fail').length;
    const overall: CheckResult = failCount > 0 ? 'fail' : warnCount > 0 ? 'warning' : 'pass';

    // ── AI summary + remediation ─────────────────────────────────────────

    let aiSummary = '';
    let aiRemediations: { category: string; recommendation: string; guideline_ref: string }[] = [];
    let modelUsed = '';

    stage = 'ai_summary';
    const { data: openaiSetting } = await service
      .from('integration_settings')
      .select('api_key, is_active')
      .eq('provider_name', 'openai')
      .maybeSingle();

    const apiKey = openaiSetting?.api_key || Deno.env.get('OPENAI_API_KEY');
    const providerConfig = (agent.provider_config as Record<string, unknown>) ?? {};
    const model = (providerConfig.model as string) || 'gpt-4o-mini';
    const temperature = typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0.2;
    modelUsed = model;

    // Load user personalization (M3)
    const personalizationPrompt = await getUserPersonalizationPrompt(supabaseUrl!, serviceKey!, agent.id, uid);
    const effectiveSystemPrompt = personalizationPrompt
      ? `${agent.system_prompt}\n\n${personalizationPrompt}`
      : agent.system_prompt;

    const t0 = Date.now();

    if (apiKey) {
      try {
        const checksForAi = checks.map(({ category, label, result, actual_value, threshold, issue_note }) => ({
          category, label, result, actual_value, threshold, issue_note,
        }));

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: 2048,
            messages: [
              { role: 'system', content: effectiveSystemPrompt },
              {
                role: 'user',
                content: `Loan: ${loan.loan_number ?? loan_id}\nOverall: ${overall} (${passCount} pass, ${warnCount} warning, ${failCount} fail)\n\nChecks:\n${JSON.stringify(checksForAi, null, 2)}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const raw = aiResult.choices?.[0]?.message?.content ?? '';
          const parsed = parseAiJson<{ summary: string; remediations: { category: string; recommendation: string; guideline_ref: string }[] }>(raw);
          if (parsed) {
            aiSummary = typeof parsed.summary === 'string' ? parsed.summary : '';
            aiRemediations = Array.isArray(parsed.remediations) ? parsed.remediations : [];
            for (const rem of aiRemediations) {
              const check = checks.find((c) => c.category === rem.category);
              if (check) check.remediation = rem.recommendation;
            }
          } else {
            aiSummary = raw.slice(0, 2000);
          }
        } else {
          const errText = await aiResponse.text();
          console.error('OpenAI error (non-fatal):', errText);
          await logAgentRun({
            supabaseUrl, serviceRoleKey: serviceKey,
            agentId: agent.id, userId: uid,
            input: `precheck loan=${loan_id}`,
            output: null, status: 'failed',
            errorMessage: errText.slice(0, 2000),
            latencyMs: Date.now() - t0, modelUsed: model,
          });
          aiSummary = 'AI summary unavailable — check results are still valid.';
        }
      } catch (e) {
        console.error('OpenAI error (non-fatal):', e);
        aiSummary = 'AI summary unavailable — check results are still valid.';
      }
    } else {
      aiSummary = 'OpenAI not configured — deterministic checks completed without AI analysis.';
    }

    const latencyMs = Date.now() - t0;

    // ── Persist scorecard ────────────────────────────────────────────────

    stage = 'insert_underwriting_prechecks';
    const { data: inserted, error: insertErr } = await service
      .from('underwriting_prechecks')
      .insert({
        loan_id,
        run_by: uid,
        overall_result: overall,
        pass_count: passCount,
        warn_count: warnCount,
        fail_count: failCount,
        checks,
        ai_summary: aiSummary,
        ai_remediation: aiRemediations,
        model_used: modelUsed,
        latency_ms: latencyMs,
        metadata: { loan_number: loan.loan_number, borrower_name: borrower ? `${borrower.first_name ?? ''} ${borrower.last_name ?? ''}`.trim() : null },
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Insert error:', insertErr);
      return jsonResp({ error: 'Failed to save pre-check result' }, 500);
    }

    // Log agent run
    stage = 'insert_ai_agent_runs';
    await service.from('ai_agent_runs').insert({
      agent_id: agent.id,
      user_id: uid,
      input: `precheck loan=${loan_id}`,
      output: JSON.stringify({ precheck_id: inserted.id, overall, passCount, warnCount, failCount }),
      status: 'completed',
      model_used: modelUsed,
      latency_ms: latencyMs,
      metadata: { precheck_id: inserted.id },
    }).catch(() => {});

    return jsonResp({
      id: inserted.id,
      loan_id,
      overall_result: overall,
      pass_count: passCount,
      warn_count: warnCount,
      fail_count: failCount,
      checks,
      ai_summary: aiSummary,
      ai_remediation: aiRemediations,
      model_used: modelUsed,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : typeof err === 'string' ? err : null;
    return jsonResp({ error: 'Internal server error', stage, message }, 500);
  }
});
