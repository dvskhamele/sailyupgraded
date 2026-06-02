"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { NewLeadForm } from "../leads/components/NewLeadForm";
import { LeadDataTable } from "../leads/table-components/data-table";
import { createColumns } from "../leads/table-components/columns";

import { localLeadRepository, type LocalLeadEntity } from "@/lib/offline-first/storage";
import type { LeadsViewProps } from "./LeadsView";

const LeadsViewClient = ({
  data,
  crmData,
  products = [],
  sourceFilter,
  defaultEmailFrom,
}: LeadsViewProps) => {
  const { accounts, contactTypes, leadSources, leadStatuses, leadTypes, saleStages } = crmData;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [localLeads, setLocalLeads] = useState<LocalLeadEntity[]>(data);
  const t = useTranslations("CrmPage");

  const loadLocalLeads = useCallback(async () => {
    try {
      const dbLeads = await localLeadRepository.getAll();

      const localIds = new Set(dbLeads.map((lead) => lead.id));
      const serverLeads = (data || []).filter((lead) => !localIds.has(lead.id));
      const merged = [...dbLeads, ...serverLeads];

      setLocalLeads(
        merged.sort((a, b) => {
          const dateB = b.createdAt ?? b.created_at ?? b.updatedAt ?? b.updated_at ?? "";
          const dateA = a.createdAt ?? a.created_at ?? a.updatedAt ?? a.updated_at ?? "";
          return String(dateB).localeCompare(String(dateA));
        }),
      );
    } catch {
      setLocalLeads(data || []);
    }
  }, [data]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLocalLeads();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadLocalLeads]);

  const visibleLeads = useMemo(() => {
    if (!sourceFilter) {
      return localLeads;
    }

    return localLeads.filter((lead) => {
      const sourceName = (lead.lead_source as { name?: string } | undefined)?.name;
      return sourceName?.toLowerCase() === sourceFilter.toLowerCase();
    });
  }, [localLeads, sourceFilter]);

  const activeProducts = products.filter((product) => product.status === "ACTIVE");
  const columns = createColumns(contactTypes, leadSources, leadStatuses, leadTypes, accounts, activeProducts);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div>
            <CardTitle>
              <Link href="/crm/leads" className="hover:underline">
                {t("leads.viewTitle")}
              </Link>
            </CardTitle>
          </div>
          <div className="flex space-x-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" aria-label={t("leads.addNew")} data-testid="add-lead-btn">+</Button>
              </SheetTrigger>
              <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{t("leads.sheetTitle")}</SheetTitle>
                  <SheetDescription>{t("leads.sheetDescription")}</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <NewLeadForm
                    accounts={accounts}
                    contactTypes={contactTypes}
                    leadSources={leadSources}
                    leadStatuses={leadStatuses}
                    leadTypes={leadTypes}
                    saleStages={saleStages}
                    products={activeProducts}
                    onFinish={() => {
                      setOpen(false);
                      router.refresh();
                      void loadLocalLeads();
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <Separator />
      </CardHeader>
      <CardContent>
        {!visibleLeads ||
          (visibleLeads.length === 0 ? (
            t("leads.empty")
          ) : (
            <LeadDataTable
              data={visibleLeads}
              columns={columns}
              accounts={accounts}
              contactTypes={contactTypes}
              leadSources={leadSources}
              leadStatuses={leadStatuses}
              leadTypes={leadTypes}
              products={activeProducts}
              productOptions={products.map((product) => ({
                label: product.name,
                value: product.id,
              }))}
              defaultEmailFrom={defaultEmailFrom}
              onDataChange={loadLocalLeads}
            />
          ))}
      </CardContent>
    </Card>
  );
};

export default LeadsViewClient;
