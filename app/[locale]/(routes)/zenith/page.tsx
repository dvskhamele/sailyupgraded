import { CalendarClock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ZENITH_DASHBOARD_URL } from "../components/menu-items/Zenith";

export const metadata = {
  title: "Zenith",
};

export default function ZenithPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-normal">Zenith</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Open the Zenith composer from a stable CRM route. This page remains
            available on refresh and direct links.
          </p>
        </div>
        <Button asChild>
          <a href={ZENITH_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
            Open Zenith
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </section>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-lg">Composer Access</CardTitle>
          <CardDescription>
            Zenith opens in a new tab so the CRM workspace stays available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="break-all text-muted-foreground">{ZENITH_DASHBOARD_URL}</span>
            <Button asChild variant="outline" className="shrink-0">
              <a href={ZENITH_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
                Launch
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
