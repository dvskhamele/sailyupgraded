"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateTeam } from "@/actions/crm/teams/update-team";
import { toast } from "sonner";

interface UpdateTeamFormProps {
  initialData: { id: string; name: string; description?: string | null };
  onFinish?: () => void;
}

export const UpdateTeamForm: React.FC<UpdateTeamFormProps> = ({
  initialData,
  onFinish,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const result = await updateTeam({
      id: initialData.id,
      name,
      description,
    });

    if (result.error) {
      toast.error(result.error);
      setIsSubmitting(false);
      return;
    }

    toast.success("Team updated successfully!");
    if (onFinish) onFinish();
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Team Name"
          defaultValue={initialData.name}
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          placeholder="Team description"
          defaultValue={initialData.description || ""}
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Updating..." : "Update Team"}
      </Button>
    </form>
  );
};
