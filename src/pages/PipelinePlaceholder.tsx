// @ts-nocheck — MCT Lite: hidden module or legacy type mismatch
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Link2, RefreshCcw } from "lucide-react";
import { useIntegrationSetting } from "@/hooks/useIntegrationSettings";
import { useSyncDataFeed } from "@/hooks/useSyncDataFeed";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { parseHubSpotContactsJson, parseHubSpotDealsJson } from "@/lib/hubspot-sync-display";

function formatDealAmount(raw: string): string {
  if (!raw?.trim()) return "—";
  const n = Number(raw);
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  return raw;
}

const PAGE_SIZE = 10;

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "ellipsis", total];
  if (current >= total - 2) return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export default function PipelinePlaceholder() {
  const { data: hubspotIntegration } = useIntegrationSetting("hubspot");
  const hubspotSync = useSyncDataFeed("hubspot");
  const [contactsPage, setContactsPage] = useState(1);
  const [dealsPage, setDealsPage] = useState(1);
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    const HEADER_HEIGHT = 80; // fixed top nav (64px) + breathing room

    const scrollTo = () => {
      const el = document.getElementById(id);
      if (!el) return false;
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
      window.scrollTo({ top, behavior: "smooth" });
      return true;
    };

    // Wait for paint, then scroll; retry once if element isn't measured yet
    const raf = requestAnimationFrame(() => {
      if (!scrollTo()) {
        const timer = setTimeout(scrollTo, 400);
        return () => clearTimeout(timer);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [hash]);

  const hubspotReady = Boolean(
    hubspotIntegration?.is_active && (hubspotIntegration.api_key || hubspotIntegration.api_key_masked),
  );

  const hubspotCfg = (hubspotIntegration?.config ?? {}) as Record<string, string>;

  const contacts = useMemo(
    () => parseHubSpotContactsJson(hubspotCfg.hubspot_contacts_json),
    [hubspotCfg.hubspot_contacts_json],
  );
  const deals = useMemo(
    () => parseHubSpotDealsJson(hubspotCfg.hubspot_deals_json),
    [hubspotCfg.hubspot_deals_json],
  );

  const lastHubSpotSync = hubspotCfg.last_sync_at || null;
  const contactsErr = hubspotCfg.hubspot_contacts_error?.trim();
  const dealsErr = hubspotCfg.hubspot_deals_error?.trim();
  const contactTotalPages = Math.max(1, Math.ceil(contacts.length / PAGE_SIZE));
  const dealTotalPages = Math.max(1, Math.ceil(deals.length / PAGE_SIZE));
  const pagedContacts = contacts.slice((contactsPage - 1) * PAGE_SIZE, contactsPage * PAGE_SIZE);
  const pagedDeals = deals.slice((dealsPage - 1) * PAGE_SIZE, dealsPage * PAGE_SIZE);

  useEffect(() => {
    setContactsPage((prev) => Math.min(prev, contactTotalPages));
  }, [contactTotalPages]);

  useEffect(() => {
    setDealsPage((prev) => Math.min(prev, dealTotalPages));
  }, [dealTotalPages]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pipeline - HubSpot</CardTitle>
          <CardDescription>
            Monitor your HubSpot pipeline snapshot in Control Tower. Run sync here (or from Admin → Integrations) to
            refresh the latest contacts and deals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => hubspotSync.mutate()}
              disabled={hubspotSync.isPending || !hubspotReady}
            >
              {hubspotSync.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Sync from HubSpot
            </Button>
          </div>

          {!hubspotReady && (
            <Alert className="py-2">
              <Link2 className="h-4 w-4" />
              <AlertDescription>
                HubSpot must be configured and enabled in Admin → Integrations before CRM data can load here.
              </AlertDescription>
            </Alert>
          )}

          {lastHubSpotSync && (
            <p className="text-xs text-muted-foreground">
              Last HubSpot sync:{" "}
              <span className="font-medium text-foreground">
                {new Date(lastHubSpotSync).toLocaleString()}
              </span>
              {hubspotCfg.hubspot_contacts_count != null && (
                <span className="ml-2">
                  · {hubspotCfg.hubspot_contacts_count} contact(s), {hubspotCfg.hubspot_deals_count ?? "0"}{" "}
                  deal(s)
                </span>
              )}
            </p>
          )}

          {(contactsErr || dealsErr) && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {contactsErr && <p>Contacts: {contactsErr}</p>}
                {dealsErr && <p>Deals: {dealsErr}</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>HubSpot contacts</CardTitle>
          <CardDescription>
            Up to 100 contacts from your latest sync, including name, email, and HubSpot record ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <p className="text-sm">No contacts loaded yet.</p>
              {hubspotReady && (
                <p className="text-xs">Press &quot;Sync from HubSpot&quot; to pull contacts from HubSpot.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="font-mono text-xs">HubSpot ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedContacts.map((c) => {
                    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
                    return (
                      <TableRow key={c.id || `${c.email}-${name}`}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-sm">{c.email || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.id || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {contacts.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(contactsPage - 1) * PAGE_SIZE + 1}–{Math.min(contactsPage * PAGE_SIZE, contacts.length)} of{" "}
                {contacts.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setContactsPage((p) => Math.max(1, p - 1))}
                      aria-disabled={contactsPage === 1}
                      className={contactsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {buildPageNumbers(contactsPage, contactTotalPages).map((p, idx) =>
                    p === "ellipsis" ? (
                      <PaginationItem key={`contacts-e-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={`contacts-${p}`}>
                        <PaginationLink
                          isActive={p === contactsPage}
                          onClick={() => setContactsPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setContactsPage((p) => Math.min(contactTotalPages, p + 1))}
                      aria-disabled={contactsPage === contactTotalPages}
                      className={contactsPage === contactTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="hubspot-deals">
        <CardHeader className="pb-3">
          <CardTitle>HubSpot deals</CardTitle>
          <CardDescription>
            Up to 100 deals from your latest sync, with amount, stage identifier, and HubSpot record ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <p className="text-sm">No deals loaded yet.</p>
              {hubspotReady && hubspotCfg.hubspot_deals_error && (
                <p className="text-xs text-destructive">Check Private App scopes include deals read access.</p>
              )}
              {hubspotReady && !hubspotCfg.hubspot_deals_error && (
                <p className="text-xs">Press &quot;Sync from HubSpot&quot; if you have deals in HubSpot.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Stage (ID)</TableHead>
                    <TableHead className="font-mono text-xs">HubSpot ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDeals.map((d) => (
                    <TableRow key={d.id || d.name}>
                      <TableCell className="font-medium">{d.name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDealAmount(d.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {d.stage || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{d.id || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {deals.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(dealsPage - 1) * PAGE_SIZE + 1}–{Math.min(dealsPage * PAGE_SIZE, deals.length)} of{" "}
                {deals.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setDealsPage((p) => Math.max(1, p - 1))}
                      aria-disabled={dealsPage === 1}
                      className={dealsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {buildPageNumbers(dealsPage, dealTotalPages).map((p, idx) =>
                    p === "ellipsis" ? (
                      <PaginationItem key={`deals-e-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={`deals-${p}`}>
                        <PaginationLink isActive={p === dealsPage} onClick={() => setDealsPage(p)} className="cursor-pointer">
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setDealsPage((p) => Math.min(dealTotalPages, p + 1))}
                      aria-disabled={dealsPage === dealTotalPages}
                      className={dealsPage === dealTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
