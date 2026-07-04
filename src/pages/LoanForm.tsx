// @ts-nocheck — MCT Lite: legacy types misalignment, runtime works against Lite schema
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoan, useCreateLoan, useUpdateLoan, useLoanProducts, useLoanPrograms } from "@/hooks/useLoans";
import { useBorrowersForSelect } from "@/hooks/useBorrowers";
import { useAuth } from "@/contexts/AuthContext";
import { useZipcodeAutofill } from "@/hooks/useZipcodeAutofill";
import { useUSCountiesByState, useUSCitiesByStateCounty, lookupCountyByCity, US_STATES } from "@/hooks/useUSLocationOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PIPELINE_STAGE_SELECT_OPTIONS } from "@/lib/loan-pipeline-stages";
import { normalizeRoleString } from "@/lib/agentRoles";
import { computeDtiLtv } from "@/lib/mortgage-calculations";
import { Badge } from "@/components/ui/badge";

const loanFormSchema = z.object({
  loan_number: z.string().optional().or(z.literal("")),
  borrower_id: z.string().uuid("Select a borrower"),
  branch_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  program_id: z.string().uuid().optional().nullable(),
  status: z.string().min(1),
  loan_amount: z.coerce.number().min(0).optional().nullable(),
  appraised_value: z.coerce.number().min(0).optional().nullable(),
  ltv: z.coerce.number().min(0).max(200).optional().nullable(),
  credit_score: z.coerce.number().min(0).max(850).optional().nullable(),
  dti: z.coerce.number().min(0).max(100).optional().nullable(),
  purpose: z.string().optional().nullable(),
  occupancy_type: z.string().optional().nullable(),
  property_address: z.string().optional().nullable(),
  property_city: z.string().optional().nullable(),
  property_state: z.string().optional().nullable(),
  property_postal_code: z.string().optional().nullable(),
  lock_date: z.string().optional().nullable(),
  lock_expiration_date: z.string().optional().nullable(),
  loan_type: z.string().optional().nullable(),
  interest_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  loan_term_months: z.coerce.number().int().min(1).max(480).optional().nullable(),
  annual_income: z.coerce.number().min(0).optional().nullable(),
  monthly_debt: z.coerce.number().min(0).optional().nullable(),
  employment_years: z.coerce.number().int().min(0).max(80).optional().nullable(),
  down_payment: z.coerce.number().min(0).optional().nullable(),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

export default function LoanForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isEdit = !!id;
  const redirectToLoanDetail = isEdit && id ? `/loans/${id}` : "/loans";
  const countyListId = useId();
  const cityListId = useId();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      status: "draft",
      branch_id: null,
      product_id: null,
      program_id: null,
    },
  });

  const productId = watch("product_id");

  const { lookupByCityState, debounced, loading: zipcodeLoading } = useZipcodeAutofill();
  const autofilled = useRef<{ city?: string; state?: string; zip?: string }>({});

  const cityValue = watch("property_city");
  const stateValue = watch("property_state");
  const annualIncome = watch("annual_income");
  const monthlyDebt = watch("monthly_debt");
  const loanAmount = watch("loan_amount");
  const appraisedValue = watch("appraised_value");

  const computedRatios = useMemo(
    () =>
      computeDtiLtv({
        annualIncome: annualIncome != null ? Number(annualIncome) : null,
        monthlyDebt: monthlyDebt != null ? Number(monthlyDebt) : null,
        loanAmount: loanAmount != null ? Number(loanAmount) : null,
        propertyValue: appraisedValue != null ? Number(appraisedValue) : null,
      }),
    [annualIncome, monthlyDebt, loanAmount, appraisedValue],
  );

  const [countyValue, setCountyValue] = useState<string | null>(null);

  const { data: usCounties = [], isLoading: loadingCounties } = useUSCountiesByState(stateValue);
  const { data: usCities = [], isLoading: loadingCities } = useUSCitiesByStateCounty(stateValue, countyValue);

  const {
    onChange: propCityOnChange,
    onBlur: propCityOnBlur,
    ref: propCityRef,
    ...propCityRegisterRest
  } = register("property_city");

  useEffect(() => {
    const city = cityValue?.trim() ?? "";
    const state = (stateValue?.trim() ?? "").toUpperCase();
    if (!city || city.length < 2 || state.length !== 2) return;
    debounced(async () => {
      const result = await lookupByCityState(city, state);
      if (result) {
        autofilled.current.zip = result.zip;
        setValue("property_postal_code", result.zip, { shouldDirty: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityValue, stateValue]);

  useEffect(() => {
    const city = cityValue?.trim() ?? "";
    const state = (stateValue?.trim() ?? "").toUpperCase();
    const countyTouched = (countyValue?.trim() ?? "").length > 0;
    if (!city || state.length !== 2 || countyTouched) return;
    let cancelled = false;
    void lookupCountyByCity(state, city).then((c) => {
      if (!cancelled && c) setCountyValue(c);
    });
    return () => {
      cancelled = true;
    };
  }, [cityValue, stateValue, countyValue]);

  const { data: loan, isLoading: loadingLoan } = useLoan(id);
  const {
    data: borrowerOptions = [],
    isLoading: loadingBorrowers,
    isError: borrowersQueryError,
  } = useBorrowersForSelect();
  const { data: products } = useLoanProducts();
  const { data: programs } = useLoanPrograms(productId ?? undefined);
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [myBranchId, setMyBranchId] = useState<string | null>(null);

  const myCustomRole = normalizeRoleString(profile?.customRoleName);
  const isBranchScopedRole = myCustomRole === "branch_manager" || myCustomRole === "loan_officer";
  const myBranchName = branches.find((b) => b.id === myBranchId)?.name ?? null;

  const programsFiltered = programs ?? [];

  useEffect(() => {
    if (loan) {
      reset({
        loan_number: loan.loan_number,
        borrower_id: loan.borrower_id,
        branch_id: loan.branch_id ?? null,
        product_id: loan.product_id ?? null,
        program_id: loan.program_id ?? null,
        status: loan.status,
        loan_amount: loan.loan_amount != null ? Number(loan.loan_amount) : null,
        appraised_value: loan.appraised_value != null ? Number(loan.appraised_value) : null,
        ltv: loan.ltv != null ? Number(loan.ltv) : null,
        credit_score: loan.credit_score ?? null,
        dti: loan.dti != null ? Number(loan.dti) : null,
        purpose: loan.purpose ?? null,
        occupancy_type: loan.occupancy_type ?? null,
        property_address: loan.property_address ?? null,
        property_city: loan.property_city ?? null,
        property_state: loan.property_state ?? null,
        property_postal_code: loan.property_postal_code ?? null,
        lock_date: loan.lock_date ?? null,
        lock_expiration_date: loan.lock_expiration_date ?? null,
        loan_type: loan.loan_type ?? null,
        interest_rate: loan.interest_rate != null ? Number(loan.interest_rate) : null,
        loan_term_months: loan.loan_term_months ?? null,
        annual_income: loan.annual_income != null ? Number(loan.annual_income) : null,
        monthly_debt: loan.monthly_debt != null ? Number(loan.monthly_debt) : null,
        employment_years: loan.employment_years ?? null,
        down_payment: loan.down_payment != null ? Number(loan.down_payment) : null,
      });
    }
  }, [loan, reset]);

  useEffect(() => {
    const loadBranchContext = async () => {
      if (!user?.id) return;
      setLoadingBranches(true);
      try {
        const { data: profileRow, error: profileErr } = await supabase
          .from("profiles")
          .select("branch_id")
          .eq("id", user.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        let { data: branchesRows, error: branchesErr } = await supabase
          .from("branches")
          .select("id, name")
          .eq("is_active", true)
          .order("name");
        if (branchesErr || !branchesRows?.length) {
          const fallback = await supabase.from("branches").select("id, name").order("name").limit(50);
          branchesRows = fallback.data;
          branchesErr = fallback.error;
        }
        if (branchesErr) throw branchesErr;

        const branchId = profileRow?.branch_id ?? null;
        setMyBranchId(branchId);
        setBranches((branchesRows ?? []) as Array<{ id: string; name: string }>);
      } catch (e) {
        console.error("Failed to load branches/profile branch:", e);
      } finally {
        setLoadingBranches(false);
      }
    };
    loadBranchContext();
  }, [user?.id]);

  useEffect(() => {
    if (!isBranchScopedRole) return;
    if (myBranchId) {
      setValue("branch_id", myBranchId);
    }
  }, [isBranchScopedRole, myBranchId, setValue]);

  const onSubmit = async (data: LoanFormData) => {
    if (!user?.id) return;
    try {
      if (isBranchScopedRole && !myBranchId) {
        throw new Error("Your profile is missing a branch assignment. Contact an admin.");
      }

      const finalBranchId = isBranchScopedRole ? myBranchId : (data.branch_id ?? null);

      const dti = computedRatios.dti ?? data.dti ?? null;
      const ltv = computedRatios.ltv ?? data.ltv ?? null;

      if (isEdit && id) {
        if (isBranchScopedRole && loan?.branch_id && loan.branch_id !== myBranchId) {
          throw new Error("You can only edit loans in your assigned branch.");
        }
        await updateLoan.mutateAsync({
          id,
          data: {
            loan_number: data.loan_number || loan?.loan_number,
            borrower_id: data.borrower_id,
            branch_id: finalBranchId,
            product_id: data.product_id ?? null,
            program_id: data.program_id ?? null,
            loan_amount: data.loan_amount ?? null,
            appraised_value: data.appraised_value ?? null,
            ltv,
            credit_score: data.credit_score ?? null,
            dti,
            loan_type: data.loan_type ?? null,
            interest_rate: data.interest_rate ?? null,
            loan_term_months: data.loan_term_months ?? null,
            annual_income: data.annual_income ?? null,
            monthly_debt: data.monthly_debt ?? null,
            employment_years: data.employment_years ?? null,
            down_payment: data.down_payment ?? null,
            purpose: data.purpose ?? null,
            occupancy_type: data.occupancy_type ?? null,
            property_address: data.property_address ?? null,
            property_city: data.property_city ?? null,
            property_state: data.property_state ?? null,
            property_postal_code: data.property_postal_code ?? null,
            lock_date: data.lock_date || null,
            lock_expiration_date: data.lock_expiration_date || null,
          },
        });
      } else {
        await createLoan.mutateAsync({
          loan_number: data.loan_number || undefined,
          borrower_id: data.borrower_id,
          loan_officer_id: user.id,
          branch_id: finalBranchId,
          product_id: data.product_id ?? null,
          program_id: data.program_id ?? null,
          status: data.status,
          loan_amount: data.loan_amount ?? null,
          appraised_value: data.appraised_value ?? null,
          ltv,
          credit_score: data.credit_score ?? null,
          dti,
          loan_type: data.loan_type ?? null,
          interest_rate: data.interest_rate ?? null,
          loan_term_months: data.loan_term_months ?? null,
          annual_income: data.annual_income ?? null,
          monthly_debt: data.monthly_debt ?? null,
          employment_years: data.employment_years ?? null,
          down_payment: data.down_payment ?? null,
          purpose: data.purpose ?? null,
          occupancy_type: data.occupancy_type ?? null,
          property_address: data.property_address ?? null,
          property_city: data.property_city ?? null,
          property_state: data.property_state ?? null,
          property_postal_code: data.property_postal_code ?? null,
          lock_date: data.lock_date || null,
          lock_expiration_date: data.lock_expiration_date || null,
        });
      }
      navigate(redirectToLoanDetail);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not save loan");
    }
  };

  const isSubmitting = createLoan.isPending || updateLoan.isPending;

  if (isEdit && (loadingLoan || loadingBorrowers)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isEdit && (loadingBorrowers || loadingBranches)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading loan form…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(redirectToLoanDetail)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? "Edit Loan" : "Add Loan"}</h1>
          <p className="text-muted-foreground">
            {isEdit
              ? "Update loan details — expand sections you need."
              : "Enter the essentials first. Open a section below for product, property, or more detail."}
          </p>
        </div>
      </div>

      {borrowersQueryError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Could not load borrowers. Add one with &quot;Add new borrower&quot; or check your permissions.
        </p>
      )}
      {isBranchScopedRole && !myBranchId && !loadingBranches && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Your profile has no branch assigned. An admin must set your branch before you can save a loan.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Essentials</CardTitle>
            <CardDescription>Loan number, borrower, and optional amount — enough to create a loan</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loan_number">Loan number</Label>
              <Input
                id="loan_number"
                placeholder={isEdit ? undefined : "Leave blank to auto-generate (LOAN-YYYY-NNNN)"}
                {...register("loan_number")}
              />
              {errors.loan_number && (
                <p className="text-sm text-destructive">{errors.loan_number.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Borrower</Label>
              <SearchableSelect
                value={watch("borrower_id") || "__none__"}
                onChange={(v) => setValue("borrower_id", v === "__none__" ? "" : v, { shouldValidate: true })}
                placeholder="Select borrower"
                options={[
                  { value: "__none__", label: "Select borrower" },
                  ...borrowerOptions.map((b) => ({
                    value: b.id,
                    label: `${b.first_name} ${b.last_name}${b.email ? ` (${b.email})` : ""}`,
                  })),
                ]}
              />
              {errors.borrower_id && (
                <p className="text-sm text-destructive">{errors.borrower_id.message}</p>
              )}
              <Button type="button" variant="link" className="px-0 h-auto" asChild>
                <Link to="/borrowers/new">Add new borrower</Link>
              </Button>
            </div>
            <div className="space-y-2 md:col-span-2 md:max-w-md">
              <Label htmlFor="loan_amount">Loan amount (optional)</Label>
              <Input id="loan_amount" type="number" step="0.01" {...register("loan_amount")} />
            </div>
            {isBranchScopedRole && myBranchId && (
              <p className="md:col-span-2 text-sm text-muted-foreground">
                Branch: <span className="font-medium text-foreground">{myBranchName ?? myBranchId}</span>
              </p>
            )}
            {!isEdit && (
              <p className="md:col-span-2 text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                New loans default to <strong>Draft</strong>. Start an application from the loan detail page when
                you&apos;re ready. Use <strong>Loan setup</strong> below to choose Application stage immediately or
                assign product/program.
              </p>
            )}
          </CardContent>
        </Card>

        <Accordion
          type="multiple"
          defaultValue={isEdit ? ["setup", "amounts", "property"] : []}
          className="rounded-lg border px-4"
        >
          <AccordionItem value="setup" className="border-b-0">
            <AccordionTrigger className="text-base hover:no-underline">Loan setup (optional)</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 md:grid-cols-2 pt-1">
                {!isBranchScopedRole && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Branch</Label>
                    <SearchableSelect
                      value={watch("branch_id") || "__none__"}
                      onChange={(v) => setValue("branch_id", v === "__none__" ? null : v)}
                      placeholder={loadingBranches ? "Loading branches..." : "Select branch"}
                      disabled={loadingBranches}
                      options={[
                        { value: "__none__", label: "Unassigned" },
                        ...branches.map((b) => ({ value: b.id, label: b.name })),
                      ]}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Product</Label>
                  <SearchableSelect
                    value={watch("product_id") || "__none__"}
                    onChange={(v) => {
                      setValue("product_id", v === "__none__" ? null : v);
                      setValue("program_id", null);
                    }}
                    placeholder={products?.length ? "Optional" : "No products configured"}
                    options={[
                      { value: "__none__", label: "—" },
                      ...(products ?? []).map((p) => ({
                        value: p.id,
                        label: `${p.product_name} (${p.rate_type})`,
                      })),
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Program</Label>
                  <SearchableSelect
                    value={watch("program_id") || "__none__"}
                    onChange={(v) => setValue("program_id", v === "__none__" ? null : v)}
                    placeholder={productId ? "Optional" : "Select a product first"}
                    disabled={!productId && programsFiltered.length === 0}
                    options={[
                      { value: "__none__", label: "—" },
                      ...programsFiltered.map((p) => ({
                        value: p.id,
                        label: `${p.program_name} (${p.program_code})`,
                      })),
                    ]}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Initial status</Label>
                  {isEdit ? (
                    <>
                      <Input
                        value={
                          PIPELINE_STAGE_SELECT_OPTIONS.find((o) => o.value === watch("status"))?.label ??
                          watch("status")
                        }
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        Status can only be changed via the transition buttons on the loan detail page.
                      </p>
                    </>
                  ) : (
                    <>
                      <SearchableSelect
                        value={watch("status")}
                        onChange={(v) => setValue("status", v)}
                        options={PIPELINE_STAGE_SELECT_OPTIONS.filter((o) =>
                          ["draft", "application"].includes(o.value)
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        Draft keeps the loan in prep; Application starts the pipeline.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="amounts" className="border-b-0 border-t">
            <AccordionTrigger className="text-base hover:no-underline">
              Amounts &amp; eligibility (optional)
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 md:grid-cols-2 pt-1">
                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Loan amount is also in Essentials above; use this section for appraisal, LTV, credit, and purpose.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appraised_value">Appraised value</Label>
                  <Input id="appraised_value" type="number" step="0.01" {...register("appraised_value")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ltv">LTV %</Label>
                  <Input id="ltv" type="number" step="0.01" {...register("ltv")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_score">Credit score</Label>
                  <Input id="credit_score" type="number" {...register("credit_score")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dti">DTI %</Label>
                  <Input id="dti" type="number" step="0.01" {...register("dti")} />
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <SearchableSelect
                    value={watch("purpose") || "__none__"}
                    onChange={(v) => setValue("purpose", v === "__none__" ? null : v)}
                    placeholder="Optional"
                    options={[
                      { value: "__none__", label: "—" },
                      { value: "Purchase", label: "Purchase" },
                      { value: "Refinance", label: "Refinance" },
                      { value: "CashOutRefinance", label: "Cash-out refinance" },
                      { value: "Construction", label: "Construction" },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Occupancy</Label>
                  <SearchableSelect
                    value={watch("occupancy_type") || "__none__"}
                    onChange={(v) => setValue("occupancy_type", v === "__none__" ? null : v)}
                    placeholder="Optional"
                    options={[
                      { value: "__none__", label: "—" },
                      { value: "Primary", label: "Primary" },
                      { value: "SecondHome", label: "Second home" },
                      { value: "Investment", label: "Investment" },
                    ]}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="risk-copilot" className="border-t border-b-0">
            <AccordionTrigger className="text-base hover:no-underline">
              Risk Copilot fields (optional)
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 md:grid-cols-2 pt-1">
                <div className="space-y-2 md:col-span-2 flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Calculated ratios:</span>
                  {computedRatios.dti != null && (
                    <Badge variant="secondary">DTI: {computedRatios.dti}%</Badge>
                  )}
                  {computedRatios.ltv != null && (
                    <Badge variant="secondary">LTV: {computedRatios.ltv}%</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loan_type">Loan type</Label>
                  <Input id="loan_type" placeholder="Conventional, FHA, VA…" {...register("loan_type")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest_rate">Interest rate %</Label>
                  <Input id="interest_rate" type="number" step="0.001" {...register("interest_rate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loan_term_months">Loan term (months)</Label>
                  <Input id="loan_term_months" type="number" {...register("loan_term_months")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annual_income">Annual income</Label>
                  <Input id="annual_income" type="number" step="0.01" {...register("annual_income")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_debt">Monthly debt</Label>
                  <Input id="monthly_debt" type="number" step="0.01" {...register("monthly_debt")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employment_years">Employment years</Label>
                  <Input id="employment_years" type="number" {...register("employment_years")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="down_payment">Down payment</Label>
                  <Input id="down_payment" type="number" step="0.01" {...register("down_payment")} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="property" className="border-t border-b-0">
            <AccordionTrigger className="text-base hover:no-underline">
              <span className="flex items-center gap-2">
                Property &amp; lock dates (optional)
                {zipcodeLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-muted-foreground mb-3">
                Type county and city or pick from suggestions when ZIP reference data is available. ZIP may auto-fill
                from city + state.
              </p>
              <div className="grid gap-4 md:grid-cols-2 pt-1">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="property_address">Property address</Label>
                  <Input id="property_address" {...register("property_address")} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <SearchableSelect
                    value={watch("property_state") || "__none__"}
                    onChange={(v) => {
                      const next = v === "__none__" ? "" : v;
                      setValue("property_state", next || null, { shouldDirty: true });
                      setCountyValue(null);
                      setValue("property_city", "", { shouldDirty: true });
                      setValue("property_postal_code", "", { shouldDirty: true });
                    }}
                    placeholder="Select state"
                    clearable
                    options={US_STATES}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label>County</Label>
                    {stateValue?.trim() && !loadingCounties && (
                      <span className="text-xs text-muted-foreground">{usCounties.length} suggestions</span>
                    )}
                  </div>
                  <Input
                    id="property_county"
                    aria-label="County"
                    value={countyValue ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCountyValue(v || null);
                      setValue("property_city", "", { shouldDirty: true });
                      setValue("property_postal_code", "", { shouldDirty: true });
                    }}
                    disabled={!stateValue?.trim()}
                    placeholder={
                      !stateValue?.trim()
                        ? "Select state first"
                        : loadingCounties
                          ? "Loading suggestions…"
                          : "Type county or pick from list"
                    }
                    autoComplete="off"
                    list={usCounties.length > 0 ? countyListId : undefined}
                  />
                  {usCounties.length > 0 && (
                    <datalist id={countyListId}>
                      {usCounties.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label>City</Label>
                    {stateValue?.trim() && !loadingCities && (
                      <span className="text-xs text-muted-foreground">{usCities.length} suggestions</span>
                    )}
                  </div>
                  <Input
                    id="property_city"
                    aria-label="City"
                    disabled={!stateValue?.trim()}
                    {...propCityRegisterRest}
                    ref={propCityRef}
                    onChange={(e) => {
                      propCityOnChange(e);
                      setValue("property_postal_code", "", { shouldDirty: true });
                    }}
                    onBlur={propCityOnBlur}
                    placeholder={
                      !stateValue?.trim()
                        ? "Select state first"
                        : loadingCities
                          ? "Loading suggestions…"
                          : "Type city or pick from list"
                    }
                    autoComplete="off"
                    list={usCities.length > 0 ? cityListId : undefined}
                  />
                  {usCities.length > 0 && (
                    <datalist id={cityListId}>
                      {usCities.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property_postal_code">Postal code</Label>
                  <div className="relative">
                    <Input
                      id="property_postal_code"
                      maxLength={5}
                      placeholder="5-digit ZIP"
                      {...register("property_postal_code")}
                    />
                    {zipcodeLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lock_date">Lock date</Label>
                  <Input id="lock_date" type="date" {...register("lock_date")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lock_expiration_date">Lock expiration</Label>
                  <Input id="lock_expiration_date" type="date" {...register("lock_expiration_date")} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update loan" : "Create loan"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(redirectToLoanDetail)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}