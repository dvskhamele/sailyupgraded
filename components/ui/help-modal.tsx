"use client";

import { useState } from "react";
import { EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HELP_CONTENT, type HelpModule } from "@/components/help-content";

interface HelpModalProps {
  module: HelpModule;
  iconOnly?: boolean;
}

export function HelpModal({ module, iconOnly = true }: HelpModalProps) {
  const [open, setOpen] = useState(false);
  const help = HELP_CONTENT[module];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <EyeIcon className="h-4 w-4" />
          <span className="sr-only">View Details</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{help.title}</DialogTitle>
          <DialogDescription>{help.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {help.useCases && help.useCases.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">Use Cases</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {help.useCases.map((useCase, i) => (
                  <li key={i}>{useCase}</li>
                ))}
              </ul>
            </div>
          )}
          {help.workflow && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">Workflow</h4>
              <p className="text-sm text-muted-foreground">{help.workflow}</p>
            </div>
          )}
          {help.benefits && help.benefits.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">Benefits</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {help.benefits.map((benefit, i) => (
                  <li key={i}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}
          {help.examples && help.examples.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">Examples</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {help.examples.map((example, i) => (
                  <li key={i}>{example}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
