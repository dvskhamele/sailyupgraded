"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTeam } from "@/actions/crm/teams/create-team";
import { toast } from "sonner";

interface NewTeamFormProps {
  onFinish?: () => void;
}

export const NewTeamForm: React.FC<NewTeamFormProps> = ({ onFinish }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const result = await createTeam({ name, description });

    if (result.error) {
      toast.error(result.error);
      setIsSubmitting(false);
      return;
    }

    toast.success("Team created successfully!");
    if (onFinish) onFinish();
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <Input id="name" name="name" required placeholder="Team Name" />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          placeholder="Team description"
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Creating..." : "Create Team"}
      </Button>
    </form>
  );
};
