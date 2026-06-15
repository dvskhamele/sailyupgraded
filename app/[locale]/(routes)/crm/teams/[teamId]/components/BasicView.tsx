"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TeamDetailActions } from "./TeamDetailActions";
import moment from "moment";
import { Team } from "../../table-data/schema";

interface BasicViewProps {
  data: Team & {
    members?: any[];
  };
}

export const BasicView: React.FC<BasicViewProps> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Team Details</CardTitle>
          <TeamDetailActions team={data} />
        </div>
        <Separator className="my-4" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="text-lg">{data.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Created At</label>
            <p className="text-lg">{moment(data.createdAt).format("MMMM Do, YYYY")}</p>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Description</label>
          <p>{data.description || "No description provided"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Member Count</label>
          <p className="text-lg">{data.members?.length || data._count?.members || 0}</p>
        </div>
      </CardContent>
    </Card>
  );
};