import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useBorrower, useCreateBorrower, useUpdateBorrower } from "@/hooks/useBorrowers";
import {
  US_STATES,
  useUSCountiesByState,
  useUSCitiesByStateCounty,
  lookupCountyByCity,
} from "@/hooks/useUSLocationOptions";
import { useZipcodeAutofill } from "@/hooks/useZipcodeAutofill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

const borrowerFormSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  ssn_last4: z.string().max(4).optional(),
  date_of_birth: z.string().optional(),
  street_address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required").length(2, "Use a valid state"),
  postal_code: z.string().optional(),
});

type BorrowerFormData = z.infer<typeof borrowerFormSchema>;

export default function BorrowerForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;
  const countyListId = useId();
  const cityListId = useId();

  const { data: borrower, isLoading: loadingBorrower } = useBorrower(id);
  const createBorrower = useCreateBorrower();
  const updateBorrower = useUpdateBorrower();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<BorrowerFormData>({
    resolver: zodResolver(borrowerFormSchema),
  });

  // ── Location dropdowns ────────────────────────────────────────────────────
  const [countyValue, setCountyValue] = useState<string | null>(null);
  const autofilled = useRef<{ zip?: string }>({});

  const stateValue = watch("state");
  const cityValue = watch("city");

  const { data: usCounties = [], isLoading: loadingCounties } = useUSCountiesByState(stateValue);
  const { data: usCities = [], isLoading: loadingCities } = useUSCitiesByStateCounty(
    stateValue,
    countyValue
  );
  const { lookupByCityState, debounced, loading: zipcodeLoading } = useZipcodeAutofill();

  const {
    onChange: cityOnChange,
    onBlur: cityOnBlur,
    ref: cityRef,
    ...cityRegisterRest
  } = register("city");

  // City selected → auto-fill ZIP
  useEffect(() => {
    const city = cityValue?.trim() ?? "";
    const state = (stateValue?.trim() ?? "").toUpperCase();
    if (!city || city.length < 2 || state.length !== 2) return;
    debounced(async () => {
      const result = await lookupByCityState(city, state);
      if (result) {
        autofilled.current.zip = result.zip;
        setValue("postal_code", result.zip, { shouldDirty: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityValue, stateValue]);

  // Infer county from city when zip DB has a match (skip if user already typed a county)
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

  useEffect(() => {
    if (borrower) {
      reset({
        first_name: borrower.first_name,
        last_name: borrower.last_name,
        email: borrower.email ?? "",
        phone: borrower.phone ?? "",
        ssn_last4: borrower.ssn_last4 ?? "",
        date_of_birth: borrower.date_of_birth ?? "",
        street_address: borrower.street_address ?? borrower.address_line1 ?? "",
        city: borrower.city ?? "",
        state: borrower.state ?? "",
        postal_code: borrower.postal_code ?? borrower.zip_code ?? "",
      });
    }
  }, [borrower, reset]);

  const onSubmit = async (data: BorrowerFormData) => {
    try {
      if (isEdit && id) {
        await updateBorrower.mutateAsync({
          id,
          data: {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email || null,
            phone: data.phone || null,
            ssn_last4: data.ssn_last4 || null,
            date_of_birth: data.date_of_birth || null,
            street_address: data.street_address || null,
            city: data.city || null,
            state: data.state || null,
            postal_code: data.postal_code || null,
          },
        });
      } else {
        await createBorrower.mutateAsync({
          input: {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email || null,
            phone: data.phone || null,
            ssn_last4: data.ssn_last4 || null,
            date_of_birth: data.date_of_birth || null,
            street_address: data.street_address || null,
            city: data.city || null,
            state: data.state || null,
            postal_code: data.postal_code || null,
          },
          createdByUserId: user?.id ?? null,
        });
      }
      navigate("/borrowers");
    } catch (e) {
      console.error(e);
    }
  };

  const isSubmitting = createBorrower.isPending || updateBorrower.isPending;

  if (loadingBorrower && isEdit) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/borrowers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Edit Borrower" : "Add Borrower"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update borrower information" : "Create a new borrower (manual or API-sync ready)"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Borrower information</CardTitle>
            <CardDescription>Identity and contact</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssn_last4">SSN (last 4)</Label>
              <Input id="ssn_last4" maxLength={4} placeholder="XXXX" {...register("ssn_last4")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription className="text-xs">
              Choose state, then type or pick county and city. Suggestions appear when ZIP reference
              data is loaded; you can always type a value. ZIP may auto-fill from city when data is
              available.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="street_address">Street address</Label>
              <Input id="street_address" {...register("street_address")} />
            </div>

            {/* ── State ── */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>
                  State <span className="text-destructive">*</span>
                </Label>
              </div>
              <SearchableSelect
                value={watch("state") || "__none__"}
                onChange={(v) => {
                  const next = v === "__none__" ? "" : v;
                  setValue("state", next, { shouldDirty: true, shouldValidate: true });
                  setCountyValue(null);
                  setValue("city", "", { shouldDirty: true, shouldValidate: true });
                  setValue("postal_code", "", { shouldDirty: true });
                }}
                placeholder="Select state"
                clearable
                options={US_STATES}
              />
              {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
            </div>

            {/* ── County (typeable + datalist) ── */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>County</Label>
                {stateValue?.trim() && !loadingCounties && (
                  <span className="text-xs text-muted-foreground">{usCounties.length} suggestions</span>
                )}
              </div>
              <Input
                id="county"
                aria-label="County"
                value={countyValue ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setCountyValue(v || null);
                  setValue("city", "", { shouldDirty: true, shouldValidate: true });
                  setValue("postal_code", "", { shouldDirty: true });
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

            {/* ── City (typeable + datalist) ── */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>
                  City <span className="text-destructive">*</span>
                </Label>
                {stateValue?.trim() && !loadingCities && (
                  <span className="text-xs text-muted-foreground">{usCities.length} suggestions</span>
                )}
              </div>
              <Input
                id="city"
                aria-label="City"
                disabled={!stateValue?.trim()}
                {...cityRegisterRest}
                ref={cityRef}
                onChange={(e) => {
                  cityOnChange(e);
                  setValue("postal_code", "", { shouldDirty: true });
                }}
                onBlur={cityOnBlur}
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
              {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
            </div>

            {/* ── Postal code ── */}
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal code</Label>
              <div className="relative">
                <Input
                  id="postal_code"
                  maxLength={5}
                  placeholder="5-digit ZIP"
                  {...register("postal_code")}
                />
                {zipcodeLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update borrower" : "Create borrower"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/borrowers")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
