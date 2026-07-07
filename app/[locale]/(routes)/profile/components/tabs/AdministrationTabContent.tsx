"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Coins,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CONTACT_ROLE_OPTIONS } from "@/lib/contact-options";
import { normalizeCustomField } from "@/lib/custom-fields";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutoSaveForm } from "@/hooks/use-auto-save-form";

const adminPanels = [
  {
    title: "Sales Stages Settings",
    description: "Manage sales types, stages, and CRM config values.",
    href: "/admin/crm-settings",
    Icon: SlidersHorizontal,
  },
  {
    title: "Users",
    description: "Manage user access and invitations.",
    href: "/admin/users",
    Icon: Users,
  },
  {
    title: "Currencies",
    description: "Manage enabled currencies and exchange rates.",
    href: "/admin/currencies",
    Icon: Coins,
  },
  {
    title: "Audit Log",
    description: "Review recent admin and system activity.",
    href: "/admin/audit-log",
    Icon: ClipboardList,
  },
];

type CustomFieldRecord = {
  id: string;
  name: string;
  type: string;
  applies_to: string[];
  options?: string[] | null;
  contact_role?: string | null;
};

export function AdministrationTabContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldRecord[]>([]);
  const initialFormState = {
    name: "",
    type: "text",
    applies_to: [] as string[],
    options: "",
    contact_role: "",
  };
  const [form, setForm] = useState(initialFormState);
  const { clearDraft } = useAutoSaveForm({
    key: `profile-admin-custom-field-${editingFieldId ?? "create"}-draft`,
    data: form,
    setData: setForm,
    enabled: isOpen,
  });

  const resetFormState = () => {
    setForm(initialFormState);
    setEditingFieldId(null);
    setIsOpen(false);
  };

  const openCreateModal = () => {
    setForm(initialFormState);
    setEditingFieldId(null);
    setIsOpen(true);
  };

  const openEditModal = (field: CustomFieldRecord) => {
    setForm({
      name: field.name,
      type: field.type,
      applies_to: field.applies_to,
      options: field.options?.join(", ") ?? "",
      contact_role: field.contact_role ?? "",
    });
    setEditingFieldId(field.id);
    setIsOpen(true);
  };

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCheckboxToggle = (value: string) => {
    setForm((current) => {
      const applies_to = current.applies_to.includes(value)
        ? current.applies_to.filter((item) => item !== value)
        : [...current.applies_to, value];

      return {
        ...current,
        applies_to,
        contact_role: applies_to.includes("Contact") ? current.contact_role : "",
      };
    });
  };

  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        const response = await fetch("/api/custom-fields");
        if (!response.ok) {
          throw new Error("Failed to load custom fields");
        }

        const payload = (await response.json()) as CustomFieldRecord[];
        setCustomFields(
          payload.map((field) =>
            normalizeCustomField(field as any) as CustomFieldRecord,
          ),
        );
      } catch (error) {
        console.log(error);
      }
    };

    void loadCustomFields();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const isEditing = editingFieldId !== null;
      const response = await fetch(
        isEditing ? `/api/custom-fields/${editingFieldId}` : "/api/custom-fields",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error ||
            (isEditing
              ? "Failed to update custom field"
              : "Failed to create custom field"),
        );
      }

      const savedField = normalizeCustomField(
        (await response.json()) as any,
      ) as CustomFieldRecord;
      setCustomFields((current) =>
        isEditing
          ? current.map((field) =>
              field.id === savedField.id ? savedField : field,
            )
          : [savedField, ...current],
      );
      clearDraft();
      resetFormState();
      toast.success(isEditing ? "Custom field updated" : "Custom field created");
    } catch (error) {
      console.log(error);
      toast.error(
        error instanceof Error
          ? error.message
          : editingFieldId
            ? "Failed to update custom field"
            : "Failed to create custom field",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    setDeletingFieldId(fieldId);

    try {
      const response = await fetch(`/api/custom-fields/${fieldId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to delete custom field");
      }

      setCustomFields((current) =>
        current.filter((field) => field.id !== fieldId),
      );
      toast.success("Custom field deleted");
    } catch (error) {
      console.log(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete custom field",
      );
    } finally {
      setDeletingFieldId(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {adminPanels.map(({ title, description, href, Icon }) => (
            <Link key={href} href={href}>
              <Card className="h-full transition-colors hover:border-foreground/20 hover:bg-muted/30">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  Open panel
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="rounded-lg border p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Custom Fields</h2>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              + Add Custom Field
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {customFields.length > 0 ? (
              customFields.map((field) => (
                <div
                  key={field.id}
                  className="rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {field.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Type: {field.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-slate-600">
                        Applies to: {field.applies_to.join(", ") || "N/A"}
                      </div>
                      {field.contact_role ? (
                        <div className="text-sm text-slate-600">
                          Contact role: {field.contact_role}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEditModal(field)}
                        className="rounded-md border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                        aria-label={`Edit ${field.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(field.id)}
                        disabled={deletingFieldId === field.id}
                        className="rounded-md border border-red-200 p-2 text-red-600 transition-colors hover:bg-white hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Delete ${field.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {field.options && field.options.length > 0 ? (
                    <p className="mt-2 text-sm text-slate-600">
                      Options: {field.options.join(", ")}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No custom fields created yet.
              </p>
            )}
          </div>
        </section>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={resetFormState}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingFieldId ? "Edit Custom Field" : "Create Custom Field"}
              </h3>
              <button
                type="button"
                onClick={resetFormState}
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="custom-field-name"
                  className="text-sm font-medium text-slate-700"
                >
                  Field Name
                </label>
                <input
                  id="custom-field-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="custom-field-type"
                  className="text-sm font-medium text-slate-700"
                >
                  Field Type
                </label>
                <select
                  id="custom-field-type"
                  name="type"
                  value={form.type}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="date">date</option>
                  <option value="select">select</option>
                  <option value="file">file</option>
                </select>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Applies To</p>
                <div className="space-y-2">
                  {["Contact", "Lead", "Opportunity"].map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-3 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.applies_to.includes(item)}
                        onChange={() => handleCheckboxToggle(item)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.applies_to.includes("Contact") ? (
                <div className="space-y-2">
                  <label
                    htmlFor="custom-field-contact-role"
                    className="text-sm font-medium text-slate-700"
                  >
                    Contact Role
                  </label>
                  <select
                    id="custom-field-contact-role"
                    name="contact_role"
                    value={form.contact_role}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All Contact Roles</option>
                    {CONTACT_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {form.type === "select" ? (
                <div className="space-y-2">
                  <label
                    htmlFor="custom-field-options"
                    className="text-sm font-medium text-slate-700"
                  >
                    Options
                  </label>
                  <input
                    id="custom-field-options"
                    name="options"
                    type="text"
                    placeholder="Option1, Option2"
                    value={form.options}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {isSubmitting
                  ? editingFieldId
                    ? "Saving..."
                    : "Creating..."
                  : editingFieldId
                    ? "Save Changes"
                    : "Create Field"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
