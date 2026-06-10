"use client";

import React from "react";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HELP_CONTENT, type HelpModule } from "@/components/help-content";
import { Separator } from "@/components/ui/separator";

interface HelpModalProps {
  module: HelpModule;
}

export function HelpModal({ module }: HelpModalProps) {
  const content = HELP_CONTENT[module];

  if (!content) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
          title="Module Help"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{content.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <section>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {content.description}
            </p>
          </section>

          {content.useCases && content.useCases.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-primary/80">
                Use {content.title.split(" ").slice(-1)[0].replace("?", "")} to:
              </h4>
              <ul className="grid grid-cols-1 gap-1">
                {content.useCases.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </section> 
          )}

          {content.examples && content.examples.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-primary/80">
                Examples:
              </h4>
              <ul className="grid grid-cols-1 gap-1">
                {content.examples.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.workflow && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-primary/80">
                Typical Workflow:
              </h4>
              <p className="text-sm font-medium text-muted-foreground bg-muted/50 p-2 rounded-md border border-border/50">
                {content.workflow}
              </p>
            </section>
          )}

          {content.benefits && content.benefits.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-primary/80">
                Key Benefits:
              </h4>
              <ul className="grid grid-cols-1 gap-1">
                {content.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/40" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
