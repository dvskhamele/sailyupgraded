"use client";

import { z } from "zod";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAutoSaveForm } from "@/hooks/use-auto-save-form";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldsSection } from "@/components/crm/custom-fields-section";
import type { CustomFieldEntity } from "@/lib/custom-fields";
import { ContactAgentCombobox } from "@/components/ui/contact-agent-combobox";
import { UserSearchCombobox } from "@/components/ui/user-search-combobox";
import { COUNTRY_OPTIONS, getStateOptions } from "@/lib/address-options";
import { cn } from "@/lib/utils";
import {
  CONTACT_ROLE_OPTIONS,
  CONTACT_STATUS_OPTIONS,
  getContactIdentifierLabel,
  normalizeContactRole,
} from "@/lib/contact-options";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

type Option = { id: string; name: string };
type AccountOption = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

const FALLBACK_BIRTH_YEAR_END = 2026;

function ContactTypeCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedOption = options.find(
    (option) => option.id === value || option.name === value,
  );
  const displayValue = selectedOption?.name ?? value;
  const trimmedSearch = search.trim();
  const hasExactMatch = options.some(
    (option) =>
      option.name.trim().toLowerCase() === trimmedSearch.toLowerCase(),
  );

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={cn("truncate", !displayValue && "text-muted-foreground")}
          >
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or type contact type..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList onWheelCapture={(event) => event.stopPropagation()}>
            <CommandEmpty>
              {trimmedSearch
                ? "No matching contact type."
                : "No contact types found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => selectValue(option.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
              {trimmedSearch && !hasExactMatch && (
                <CommandItem
                  value={trimmedSearch}
                  onSelect={() => selectValue(trimmedSearch)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add &quot;{trimmedSearch}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ExtraFieldsCollapsible({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
        open
          ? "visible grid-rows-[1fr] opacity-100"
          : "invisible grid-rows-[0fr] opacity-0 pointer-events-none",
      )}
    >
      <div className="overflow-hidden">
        <div className="space-y-4 pt-4">{children}</div>
      </div>
    </div>
  );
}

export const unifiedPersonFormSchema = z.object({
  id: z.uuid().optional(),
  serial: z.string().optional().nullable(),
  birthday_year: z.string().optional().nullable(),
  birthday_month: z.string().optional().nullable(),
  birthday_day: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().min(1),
  company: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  personal_email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  office_phone: z.string().optional().nullable(),
  mobile_phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  address_line1: z.string().optional().nullable(),
  address_line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  status: z.boolean().nullable().optional(),
  role: z.union([z.enum(CONTACT_ROLE_OPTIONS), z.literal("")]).optional(),
  contact_type_id: z.string().optional().nullable(),
  lead_source_id: z.string().optional().nullable(),
  lead_status_id: z.string().optional().nullable(),
  lead_type_id: z.string().optional().nullable(),
  refered_by: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
  assigned_account: z.string().optional().nullable(),
  social_twitter: z.string().optional().nullable(),
  social_facebook: z.string().optional().nullable(),
  social_linkedin: z.string().optional().nullable(),
  social_skype: z.string().optional().nullable(),
  social_instagram: z.string().optional().nullable(),
  social_youtube: z.string().optional().nullable(),
  social_tiktok: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  opportunity_enabled: z.boolean().optional(),
  opportunity_name: z.string().optional().nullable(),
  opportunity_products: z.array(z.string()).optional(),
  opportunity_budget: z.string().optional().nullable(),
  opportunity_premium: z.string().optional().nullable(),
  opportunity_stage_id: z.string().optional().nullable(),
  opportunity_description: z.string().optional().nullable(),
  custom_fields_data: z
    .record(z.string(), z.union([z.string(), z.null(), z.undefined()]))
    .optional(),
});

export type UnifiedPersonFormValues = z.infer<typeof unifiedPersonFormSchema>;

type UnifiedPersonFormProps = {
  mode: "create" | "update";
  submitButtonLabel: string;
  successMessage: string;
  submitTestId?: string;
  entityType: CustomFieldEntity;
  accounts: AccountOption[];
  contactTypes?: Option[];
  leadSources?: Option[];
  leadStatuses?: Option[];
  leadTypes?: Option[];
  saleStages?: Option[];
  products?: Option[];
  initialValues?: Partial<UnifiedPersonFormValues>;
  autoSaveEnabled?: boolean;
  autoSaveKey?: string;
  hideOpportunitySection?: boolean;
  quickOpportunitySection?: boolean;
  quickEmptyDefaults?: boolean;
  onSubmitAction: (
    data: UnifiedPersonFormValues,
  ) => Promise<{ error?: string; data?: unknown } | undefined>;
  onSuccess: (
    result?: { data?: unknown },
    submittedData?: UnifiedPersonFormValues,
  ) => void | Promise<void>;
};

export function UnifiedPersonForm({
  mode,
  submitButtonLabel,
  successMessage,
  submitTestId,
  entityType,
  accounts,
  contactTypes = [],
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  saleStages = [],
  products = [],
  initialValues,
  autoSaveEnabled = true,
  autoSaveKey,
  hideOpportunitySection = false,
  quickOpportunitySection = false,
  quickEmptyDefaults = false,
  onSubmitAction,
  onSuccess,
}: UnifiedPersonFormProps) {
  const contactT = useTranslations("CrmContactForm");
  const leadT = useTranslations("CrmLeadForm");
  const c = useTranslations("Common");
  const [birthYearEnd, setBirthYearEnd] = useState(FALLBACK_BIRTH_YEAR_END);
  const [showExtraFields, setShowExtraFields] = useState(false);

  useEffect(() => {
    setBirthYearEnd(new Date().getFullYear());
  }, []);

  const formSchema = unifiedPersonFormSchema.extend({
    last_name: z.string().min(1, contactT("lastNameRequired")),
    email: z
      .union([
        z.string().email(contactT("emailInvalid")),
        z.literal(""),
        z.null(),
      ])
      .optional(),
  });
  const defaultContactTypeId = initialValues?.contact_type_id ?? "";
  const defaultOpportunityStage =
    initialValues?.opportunity_stage_id ??
    saleStages.find((stage) => stage.name === "New Lead Intake")?.id ??
    "";

  const form = useForm<UnifiedPersonFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      serial: "",
      birthday_year: "",
      birthday_month: "",
      birthday_day: "",
      first_name: "",
      last_name: "",
      company: "",
      jobTitle: "",
      description: "",
      notes: "",
      email: "",
      personal_email: "",
      phone: "",
      office_phone: "",
      mobile_phone: "",
      website: "",
      address: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      country: quickEmptyDefaults ? "" : "United States",
      postal_code: "",
      position: "",
      contact_type_id: defaultContactTypeId,
      lead_source_id: "",
      lead_status_id: "",
      lead_type_id: "",
      refered_by: "",
      campaign: "",
      assigned_to: "",
      assigned_account: "",
      social_twitter: "",
      social_facebook: "",
      social_linkedin: "",
      social_skype: "",
      social_instagram: "",
      social_youtube: "",
      social_tiktok: "",
      productId: "",
      opportunity_enabled: false,
      opportunity_name: "",
      opportunity_products: [],
      opportunity_budget: "",
      opportunity_premium: "",
      opportunity_stage_id: defaultOpportunityStage,
      opportunity_description: "",
      custom_fields_data: {},
      ...initialValues,
      status: initialValues?.status ?? (quickEmptyDefaults ? null : true),
      role: initialValues?.role ?? (quickEmptyDefaults ? "" : normalizeContactRole(initialValues?.role)),
    },
  });

  const watchedFormValues = form.watch();
  const resolvedAutoSaveKey =
    autoSaveKey ??
    `crm-${entityType.toLowerCase()}-${mode}-${initialValues?.id ?? "new"}-draft`;
  const restoreAutoSaveData: Dispatch<SetStateAction<UnifiedPersonFormValues>> = (value) => {
    const nextValues =
      typeof value === "function" ? value(form.getValues()) : value;

    form.reset(nextValues, {
      keepDefaultValues: true,
    });
  };
  const { clearDraft } = useAutoSaveForm({
    key: resolvedAutoSaveKey,
    data: watchedFormValues,
    setData: restoreAutoSaveData,
    enabled: autoSaveEnabled,
  });

  const selectedCountry = form.watch("country");
  const selectedState = form.watch("state");
  const selectedRole = form.watch("role");
  const isAgentRole =
    entityType === "Contact" && normalizeContactRole(selectedRole) === "Agent";
  const opportunityEnabled = form.watch("opportunity_enabled");
  const canShowOpportunitySection =
    !hideOpportunitySection &&
    entityType === "Contact" &&
    normalizeContactRole(selectedRole) === "Customer";
  const showInlineOpportunitySection =
    canShowOpportunitySection && quickOpportunitySection;
  const showToggleOpportunitySection =
    canShowOpportunitySection && !quickOpportunitySection;
  const selectedOpportunityProducts = form.watch("opportunity_products") ?? [];
  const firstSelectedOpportunityProduct = selectedOpportunityProducts[0] ?? "";
  const stateOptions = getStateOptions(selectedCountry, selectedState);
  const serialLabel = getContactIdentifierLabel(selectedRole);
  const countryOptions =
    selectedCountry &&
    !COUNTRY_OPTIONS.some((option) => option.value === selectedCountry)
      ? [{ label: selectedCountry, value: selectedCountry }, ...COUNTRY_OPTIONS]
      : COUNTRY_OPTIONS;
  const handleSubmit = async (data: UnifiedPersonFormValues) => {
    let submittedData = data;
    let actionData = data;

    if (!canShowOpportunitySection) {
      actionData = {
        ...data,
        status: data.status ?? true,
        role: data.role || "Customer",
        opportunity_enabled: false,
        opportunity_name: "",
        opportunity_products: [],
        opportunity_budget: "",
        opportunity_premium: "",
        opportunity_stage_id: "",
        opportunity_description: "",
      };
      submittedData = actionData;
    } else if (quickOpportunitySection) {
      actionData = {
        ...data,
        status: data.status ?? true,
        role: data.role || "Customer",
        opportunity_enabled: false,
        opportunity_name: "",
        opportunity_products: [],
        opportunity_budget: "",
        opportunity_premium: "",
        opportunity_stage_id: "",
        opportunity_description: "",
      };
      submittedData = {
        ...data,
        status: data.status ?? true,
        role: data.role || "Customer",
        opportunity_enabled: Boolean(
          data.opportunity_products?.length ||
            data.opportunity_budget ||
            data.opportunity_premium,
        ),
      };
    } else {
      actionData = {
        ...data,
        status: data.status ?? true,
        role: data.role || "Customer",
      };
      submittedData = actionData;
    }

    let result: { error?: string; data?: unknown } | undefined;

    try {
      result = await onSubmitAction(actionData);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to save. Please try again.";
      form.setError("root.serverError", { message });
      toast.error(message);
      return;
    }

    if (result?.error) {
      form.setError("root.serverError", { message: result.error });
      return;
    }

    clearDraft();
    toast.success(successMessage);
    if (mode === "create") {
      form.reset({
        ...form.formState.defaultValues,
        contact_type_id: defaultContactTypeId,
        opportunity_enabled: false,
        opportunity_name: "",
        opportunity_products: [],
        opportunity_budget: "",
        opportunity_premium: "",
        opportunity_stage_id: defaultOpportunityStage,
        opportunity_description: "",
        status: quickEmptyDefaults ? null : true,
        role: initialValues?.role ?? (quickEmptyDefaults ? "" : normalizeContactRole(initialValues?.role)),
      });
    }
    await onSuccess(result, submittedData);
  };

  useEffect(() => {
    if (canShowOpportunitySection) return;

    form.setValue("opportunity_enabled", false, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("opportunity_name", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("opportunity_products", [], {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("opportunity_budget", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("opportunity_premium", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("opportunity_stage_id", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("opportunity_description", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [canShowOpportunitySection, form]);

  useEffect(() => {
    if (mode !== "create") return;
    if (form.getValues("contact_type_id")) return;
    if (!defaultContactTypeId) return;

    form.setValue("contact_type_id", defaultContactTypeId, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [defaultContactTypeId, form, mode]);

  useEffect(() => {
    if (!canShowOpportunitySection) return;
    if (!opportunityEnabled) return;
    if (form.getValues("opportunity_stage_id")) return;
    if (!defaultOpportunityStage) return;

    form.setValue("opportunity_stage_id", defaultOpportunityStage, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [
    canShowOpportunitySection,
    defaultOpportunityStage,
    form,
    opportunityEnabled,
  ]);

  useEffect(() => {
    if (!canShowOpportunitySection) return;
    if (!opportunityEnabled) return;
    if (form.getValues("opportunity_name")) return;

    const clientName = [
      form.getValues("first_name"),
      form.getValues("last_name"),
    ]
      .filter(Boolean)
      .join(" ");
    const fallbackName = [clientName, firstSelectedOpportunityProduct]
      .filter(Boolean)
      .join(" - ");

    if (!fallbackName) return;

    form.setValue("opportunity_name", fallbackName, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [
    canShowOpportunitySection,
    firstSelectedOpportunityProduct,
    form,
    opportunityEnabled,
  ]);

  const yearOptions = Array.from({ length: 100 }, (_, i) => birthYearEnd - i);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="h-full px-4 md:px-10"
      >
        <div className="w-full text-sm">
          <div className="pb-5 space-y-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTACT_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{serialLabel}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ID / serial"
                      disabled={form.formState.isSubmitting}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("firstName")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="John"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("lastName")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="Doe"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <CustomFieldsSection
              entityType={entityType}
              form={form}
              disabled={form.formState.isSubmitting}
              contactRole={entityType === "Contact" ? selectedRole : undefined}
            />
  <FormField
                control={form.control}
                name="refered_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isAgentRole ? "Assign Agent name" : leadT("referredBy")}
                    </FormLabel>
                    <FormControl>
                      {isAgentRole ? (
                        <ContactAgentCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Search or select agent"
                          disabled={form.formState.isSubmitting}
                        />
                      ) : (
                        <Input
                          disabled={form.formState.isSubmitting}
                          placeholder="John Walker"
                          {...field}
                          value={field.value ?? ""}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      disabled={form.formState.isSubmitting}
                      placeholder="Internal notes"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("company")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="Saily Inc."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("jobTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="CTO"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("email")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="john@domain.com"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="personal_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("personalEmail")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="john.personal@domain.com"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("phone")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="+11 123 456 789"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("mobilePhone")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="+11 123 456 789"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="office_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("officePhone")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="+11 123 456 789"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("website")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="https://www.domain.com"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("position")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="CTO"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowExtraFields((current) => !current)}
                disabled={form.formState.isSubmitting}
                aria-expanded={showExtraFields}
                className="w-fit"
              >
                {showExtraFields ? "Hide Extra Fields" : "Show More Fields"}
              </Button>
            </div>

            <ExtraFieldsCollapsible open={showExtraFields}>
            <div>
              <label className="text-sm font-medium leading-none">
                {contactT("birthday")}
              </label>
              <div className="flex space-x-3 w-full mt-2">
                <FormField
                  control={form.control}
                  name="birthday_year"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={contactT("year")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="h-56">
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthday_month"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={contactT("month")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="h-56">
                          {[
                            { value: "1", label: contactT("january") },
                            { value: "2", label: contactT("february") },
                            { value: "3", label: contactT("march") },
                            { value: "4", label: contactT("april") },
                            { value: "5", label: contactT("may") },
                            { value: "6", label: contactT("june") },
                            { value: "7", label: contactT("july") },
                            { value: "8", label: contactT("august") },
                            { value: "9", label: contactT("september") },
                            { value: "10", label: contactT("october") },
                            { value: "11", label: contactT("november") },
                            { value: "12", label: contactT("december") },
                          ].map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthday_day"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={contactT("day")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="h-56">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(
                            (day) => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{contactT("country")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("state", "");
                    }}
                    value={field.value ?? ""}
                    disabled={form.formState.isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={contactT("countryPlaceholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-56">
                      {countryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("city")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder={contactT("cityPlaceholder")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("state")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      disabled={form.formState.isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={contactT("statePlaceholder")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-56">
                        {stateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("postalCode")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder={contactT("postalCodePlaceholder")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address_line1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("addressLine1")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder={contactT("addressLine1Placeholder")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_line2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("addressLine2")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder={contactT("addressLine2Placeholder")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{c("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      disabled={form.formState.isSubmitting}
                      placeholder={contactT("descriptionPlaceholder")}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("assignedUser")}</FormLabel>
                    <FormControl>
                      <UserSearchCombobox
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder={contactT("assignedUserPlaceholder")}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigned_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("assignAccount")}</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("productId", "");
                      }}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={contactT("assignAccountPlaceholder")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-56">
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "active")
                      }
                      value={field.value == null ? "" : field.value ? "active" : "inactive"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONTACT_STATUS_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.label}
                            value={option.value ? "active" : "inactive"}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("contactType")}</FormLabel>

                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "__none__" ? "" : value)
                      }
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact type" />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        <SelectItem value="__none__">
                          Select contact type
                        </SelectItem>

                        {contactTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lead_source_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("leadSource")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadSources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lead_status_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadStatuses.map((statusOption) => (
                          <SelectItem
                            key={statusOption.id}
                            value={statusOption.id}
                          >
                            {statusOption.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lead_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* <FormField
                control={form.control}
                name="refered_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isAgentRole ? "Assign Agent name" : leadT("referredBy")}
                    </FormLabel>
                    <FormControl>
                      {isAgentRole ? (
                        <ContactAgentCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Search or select agent"
                          disabled={form.formState.isSubmitting}
                        />
                      ) : (
                        <Input
                          disabled={form.formState.isSubmitting}
                          placeholder="John Walker"
                          {...field}
                          value={field.value ?? ""}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <FormField
                control={form.control}
                name="campaign"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("campaign")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="Social networks"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select
                      disabled={form.formState.isSubmitting}
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedAccountId
                                ? "Select account first"
                                : accountProducts.length > 0
                                  ? "Select product"
                                  : "No active products for selected account"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accountProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="social_twitter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{contactT("twitter")}</FormLabel>
                      <FormControl>
                        <Input
                          disabled={form.formState.isSubmitting}
                          placeholder="https://twitter.com/john"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="social_facebook"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("facebook")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="https://facebook.com/john"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="social_linkedin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("linkedin")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="https://linkedin.com/in/john"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="social_skype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("thread")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="thread/john"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="social_instagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="https://instagram.com/john"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="social_youtube"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("youtube")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="https://youtube.com/@john"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="social_tiktok"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("tiktok")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={form.formState.isSubmitting}
                        placeholder="https://tiktok.com/@john"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showToggleOpportunitySection && (
              <Button
                type="button"
                variant={opportunityEnabled ? "secondary" : "outline"}
                onClick={() =>
                  form.setValue("opportunity_enabled", !opportunityEnabled)
                }
                disabled={form.formState.isSubmitting}
                className="w-fit"
              >
                {opportunityEnabled
                  ? "Hide Create Opportunity"
                  : "Create Opportunity"}
              </Button>
            )}

            {showToggleOpportunitySection && opportunityEnabled && (
              <div className="space-y-4 border-t pt-5">
                <h3 className="text-sm font-semibold">Create Opportunity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="opportunity_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opportunity Name</FormLabel>
                        <FormControl>
                          <Input
                            disabled={form.formState.isSubmitting}
                            placeholder="Client - Product"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opportunity_products"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product</FormLabel>
                        <Select
                          value={(field.value ?? [])[0] ?? ""}
                          onValueChange={(value) =>
                            field.onChange(value ? [value] : [])
                          }
                          disabled={form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  products.length > 0
                                    ? "Select product"
                                    : "No active products"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-56">
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.name}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opportunity_budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Face Amount</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            disabled={form.formState.isSubmitting}
                            placeholder="1000000"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opportunity_premium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Premium</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            disabled={form.formState.isSubmitting}
                            placeholder="0"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opportunity_stage_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pipeline Stage</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                          disabled={form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="New Lead Intake" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-56">
                            {saleStages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opportunity_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            disabled={form.formState.isSubmitting}
                            placeholder="Opportunity notes"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            </ExtraFieldsCollapsible>

            {showInlineOpportunitySection && (
              <div className="space-y-4 border-t pt-5">
                <h3 className="text-sm font-semibold">Create Opportunity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="opportunity_products"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product</FormLabel>
                        <Select
                          value={(field.value ?? [])[0] ?? ""}
                          onValueChange={(value) =>
                            field.onChange(value ? [value] : [])
                          }
                          disabled={form.formState.isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  products.length > 0
                                    ? "Select product"
                                    : "No active products"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-56">
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.name}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opportunity_budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            disabled={form.formState.isSubmitting}
                            placeholder="0"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opportunity_premium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Face Amount</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            disabled={form.formState.isSubmitting}
                            placeholder="1000000"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2 py-5">
          {form.formState.errors.root?.serverError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {form.formState.errors.root.serverError.message}
            </p>
          )}
          <Button
            disabled={form.formState.isSubmitting}
            type="submit"
            data-testid={submitTestId}
          >
            {form.formState.isSubmitting ? (
              <span className="flex items-center animate-pulse">
                {c("savingData")}
              </span>
            ) : (
              submitButtonLabel
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
