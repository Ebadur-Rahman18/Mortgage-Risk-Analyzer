import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBorrowers, BORROWERS_PAGE_SIZE } from "@/hooks/useBorrowers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Plus, Search, Edit, Eye, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function Borrowers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { hasPermission } = useEffectivePermissions();
  const canCreate = hasPermission("borrowers:create");
  const canUpdate = hasPermission("borrowers:update");

  const { data, isLoading, isError, error } = useBorrowers({ search: search || undefined, page });
  const borrowers = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / BORROWERS_PAGE_SIZE));

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Borrowers</h1>
            <p className="text-muted-foreground">
              Manage borrowers (manual entry and API sync-ready)
            </p>
          </div>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/borrowers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Borrower
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Borrowers</CardTitle>
          <CardDescription>
            By name or email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load borrowers. {error instanceof Error ? error.message : "Check your permissions or try again."}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Loading borrowers...</p>
            </div>
          ) : borrowers.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">No borrowers found</p>
              {canCreate && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/borrowers/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add your first borrower
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {borrowers.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <Link to={`/borrowers/${b.id}`} className="hover:underline underline-offset-4">
                          {b.first_name} {b.last_name}
                        </Link>
                      </TableCell>
                      <TableCell>{b.email ?? "—"}</TableCell>
                      <TableCell>{b.phone ?? "—"}</TableCell>
                      <TableCell>{b.data_source ?? "manual"}</TableCell>
                      <TableCell>{formatDate(b.created_at)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/borrowers/${b.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canUpdate && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/borrowers/${b.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * BORROWERS_PAGE_SIZE + 1}–{Math.min(page * BORROWERS_PAGE_SIZE, totalCount)} of {totalCount}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-disabled={page === 1}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {buildPageNumbers(page, totalPages).map((p, idx) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`e-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === page}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-disabled={page === totalPages}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
