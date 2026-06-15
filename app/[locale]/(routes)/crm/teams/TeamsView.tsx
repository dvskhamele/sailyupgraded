"use client";

import React, { useState } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { columns } from "./table-components/columns";
import { NewTeamForm } from "./components/NewTeamForm";
import { TeamDataTable } from "./table-components/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface TeamsViewProps {
  data: any[];
}

const TeamsView = ({ data }: TeamsViewProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link href="/crm/teams" className="hover:underline">
                Teams
              </Link>
            </CardTitle>
          </div>
          <div className="flex space-x-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" aria-label="Add team" data-testid="add-team-btn">+</Button>
              </SheetTrigger>
              <SheetContent className="w-full md:max-[771px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Create Team</SheetTitle>
                  <SheetDescription>
                    Create a new team to organize your members
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <NewTeamForm
                    onFinish={() => setOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <Separator />
      </CardHeader>
      {!data ||
        (data.length === 0 ? (
          <CardContent>No teams found</CardContent>
        ) : (
          <CardContent>
            <TeamDataTable
              data={data}
              columns={columns}
            />
          </CardContent>
        ))}
    </Card>
  );
};

export default TeamsView;