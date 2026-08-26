"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, Building2, Users, Sparkles, Filter } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createColumns } from "../table-components/columns";
import { PeopleDataTable } from "../table-components/data-table";
import { PeopleDetailSheet } from "../table-components/people-detail-sheet";
import type { PeopleRecord, PeopleStats } from "@/types/people";

interface PeopleViewProps {
  initialData: PeopleRecord[];
  initialStats?: PeopleStats;
}

export default function PeopleView({
  initialData,
  initialStats = {
    totalAccounts: 5249249,
    totalContacts: 999982,
    totalRecords: 6249231,
  },
}: PeopleViewProps) {
  const router = useRouter();
  const [data, setData] = React.useState<PeopleRecord[]>(initialData);
  const [stats, setStats] = React.useState<PeopleStats>(initialStats);
  const [isLoading, setIsLoading] = React.useState(false);
  const [batchLimit, setBatchLimit] = React.useState<number>(1000);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeRecord, setActiveRecord] = React.useState<PeopleRecord | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Synchronize when initialData updates from server
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleViewRecord = React.useCallback((record: PeopleRecord) => {
    setActiveRecord(record);
    setDetailOpen(true);
  }, []);

  const columns = React.useMemo(
    () => createColumns({ onViewRecord: handleViewRecord }),
    [handleViewRecord]
  );

  const fetchPeopleData = async (query = "", limit = batchLimit) => {
    setIsLoading(true);
    try {
      const qParam = query.trim() ? `&query=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/crm/people?limit=${limit}${qParam}`);
      if (!res.ok) throw new Error("Failed to load people data");
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setData(result.data);
        if (result.stats) {
          setStats(result.stats);
        }
        if (query.trim()) {
          toast.success(`Found ${result.data.length} match(es) across 6.25M+ records`);
        } else {
          toast.success(`Loaded ${result.data.length} records into table`);
        }
      }
    } catch (error) {
      console.error("[FETCH_PEOPLE_ERROR]", error);
      toast.error("Failed to load records from external API");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchPeopleData(searchQuery, batchLimit);
  };

  const handleBatchLimitChange = async (newLimit: number) => {
    setBatchLimit(newLimit);
    await fetchPeopleData(searchQuery, newLimit);
  };

  const handleServerSearch = async (query: string) => {
    setSearchQuery(query);
    await fetchPeopleData(query, batchLimit);
  };

  const formattedTotal = Number(stats.totalRecords).toLocaleString();
  const formattedAccounts = Number(stats.totalAccounts).toLocaleString();
  const formattedContacts = Number(stats.totalContacts).toLocaleString();

  return (
    <div className="space-y-4">
      {/* Overview Metric Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Database Records</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold tracking-tight">{formattedTotal}</h3>
                <Badge variant="outline" className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                  Live API
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Companies / Accounts</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold tracking-tight">{formattedAccounts}</h3>
                <span className="text-[11px] text-muted-foreground">~5.25M</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Contacts / People</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold tracking-tight">{formattedContacts}</h3>
                <span className="text-[11px] text-muted-foreground">~1.00M</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Unified Data Table */}
      <PeopleDataTable
        columns={columns}
        data={data}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        batchLimit={batchLimit}
        onBatchLimitChange={handleBatchLimitChange}
        onServerSearch={handleServerSearch}
      />

      {/* Detail View Sheet */}
      <PeopleDetailSheet
        record={activeRecord}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
