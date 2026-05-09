"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldsSection } from "@/components/crm/custom-fields-section";
import type { CustomFieldEntity } from "@/lib/custom-fields";
import { UserSearchCombobox } from "@/components/ui/user-search-combobox";
import { COUNTRY_OPTIONS, getStateOptions } from "@/lib/address-options";
import {
  CONTACT_ROLE_OPTIONS,
  CONTACT_STATUS_OPTIONS,
  getContactIdentifierLabel,
  normalizeContactRole,
} from "@/lib/contact-options";

type Option = { id: string; name: string };
type AccountOption = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

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
  status: z.boolean(),
  role: z.enum(CONTACT_ROLE_OPTIONS),
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
  opportunity_products: z.array(z.string()).optional(),
  opportunity_budget: z.string().optional().nullable(),
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
  products?: Option[];
  initialValues?: Partial<UnifiedPersonFormValues>;
  onSubmitAction: (data: UnifiedPersonFormValues) => Promise<{ error?: string; data?: unknown } | undefined>;
  onSuccess: (result?: { data?: unknown }, submittedData?: UnifiedPersonFormValues) => void | Promise<void>;
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
  products = [],
  initialValues,
  onSubmitAction,
  onSuccess,
}: UnifiedPersonFormProps) {
  const contactT = useTranslations("CrmContactForm");
  const leadT = useTranslations("CrmLeadForm");
  const c = useTranslations("Common");

  const formSchema = unifiedPersonFormSchema.extend({
    last_name: z.string().min(1, contactT("lastNameRequired")),
    email: z.union([z.string().email(contactT("emailInvalid")), z.literal(""), z.null()]).optional(),
  });

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
      country: "",
      postal_code: "",
      position: "",
      contact_type_id: "",
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
      opportunity_products: [],
      opportunity_budget: "",
      custom_fields_data: {},
      ...initialValues,
      status: initialValues?.status ?? true,
      role: normalizeContactRole(initialValues?.role),
    },
  });

  const selectedCountry = form.watch("country");
  const selectedState = form.watch("state");
  const selectedAccountId = form.watch("assigned_account");
  const selectedRole = form.watch("role");
  const opportunityEnabled = form.watch("opportunity_enabled");
  const stateOptions = getStateOptions(selectedCountry, selectedState);
  const serialLabel = getContactIdentifierLabel(selectedRole);
  const countryOptions = selectedCountry && !COUNTRY_OPTIONS.some((option) => option.value === selectedCountry)
    ? [{ label: selectedCountry, value: selectedCountry }, ...COUNTRY_OPTIONS]
    : COUNTRY_OPTIONS;
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const accountProducts =
    selectedAccount?.accountProducts
      ?.map((item) => item.product)
      .filter((product): product is { id: string; name: string } => Boolean(product?.id && product?.name)) ?? [];

  const handleSubmit = async (data: UnifiedPersonFormValues) => {
    const result = await onSubmitAction(data);
    if (result?.error) {
      form.setError("root.serverError", { message: result.error });
      return;
    }

    toast.success(successMessage);
    if (mode === "create") {
      form.reset();
    }
    await onSuccess(result, data);
  };

  const yearOptions = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="h-full px-4 md:px-10">
        <div className="w-full text-sm">
          <div className="pb-5 space-y-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTACT_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
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
                    <Input placeholder="ID / serial" disabled={form.formState.isSubmitting} {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="John" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="Doe" {...field} value={field.value ?? ""} />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("company")}</FormLabel>
                    <FormControl>
                      <Input disabled={form.formState.isSubmitting} placeholder="Saily Inc." {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="CTO" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="john@domain.com" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="john.personal@domain.com" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="+11 123 456 789" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="+11 123 456 789" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="+11 123 456 789" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="https://www.domain.com" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="CTO" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <label className="text-sm font-medium leading-none">{contactT("birthday")}</label>
              <div className="flex space-x-3 w-full mt-2">
                <FormField
                  control={form.control}
                  name="birthday_year"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={contactT("year")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="h-56">
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
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
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
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
                            <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
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
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={contactT("day")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="h-56">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                            <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address_line1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("addressLine1")}</FormLabel>
                    <FormControl>
                      <Input disabled={form.formState.isSubmitting} placeholder={contactT("addressLine1Placeholder")} {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder={contactT("addressLine2Placeholder")} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contactT("city")}</FormLabel>
                    <FormControl>
                      <Input disabled={form.formState.isSubmitting} placeholder={contactT("cityPlaceholder")} {...field} value={field.value ?? ""} />
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={form.formState.isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={contactT("statePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-56">
                        {stateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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
                      <Input disabled={form.formState.isSubmitting} placeholder={contactT("postalCodePlaceholder")} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectValue placeholder={contactT("countryPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-56">
                      {countryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{c("description")}</FormLabel>
                  <FormControl>
                    <Textarea disabled={form.formState.isSubmitting} placeholder={contactT("descriptionPlaceholder")} {...field} value={field.value ?? ""} />
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
                          <SelectValue placeholder={contactT("assignAccountPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-56">
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
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
                    <Select onValueChange={(value) => field.onChange(value === "active")} value={field.value ? "active" : "inactive"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONTACT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.label} value={option.value ? "active" : "inactive"}>
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={contactT("contactTypePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contactTypes.length > 0 ? (
                          contactTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No contact types found
                          </div>
                        )}
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadSources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadStatuses.map((statusOption) => (
                          <SelectItem key={statusOption.id} value={statusOption.id}>{statusOption.name}</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
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
                name="refered_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("referredBy")}</FormLabel>
                    <FormControl>
                      <Input disabled={form.formState.isSubmitting} placeholder="John Walker" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="campaign"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{leadT("campaign")}</FormLabel>
                    <FormControl>
                      <Input disabled={form.formState.isSubmitting} placeholder="Social networks" {...field} value={field.value ?? ""} />
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
                        <Input disabled={form.formState.isSubmitting} placeholder="https://twitter.com/john" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="https://facebook.com/john" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="https://linkedin.com/in/john" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="thread/john" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="https://instagram.com/john" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="https://youtube.com/@john" {...field} value={field.value ?? ""} />
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
                      <Input disabled={form.formState.isSubmitting} placeholder="https://tiktok.com/@john" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {entityType === "Lead" && (
              <Button
                type="button"
                variant={opportunityEnabled ? "secondary" : "outline"}
                onClick={() => form.setValue("opportunity_enabled", !opportunityEnabled)}
                disabled={form.formState.isSubmitting}
              >
                {opportunityEnabled ? "Hide Opportunity" : "Add Opportunity"}
              </Button>
            )}

            {(entityType === "Contact" || opportunityEnabled) && (
              <div className="space-y-4 border-t pt-5">
                <h3 className="text-sm font-semibold">Opportunity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="opportunity_products"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Products</FormLabel>
                        <FormControl>
                          <MultiSelect
                            options={products.map((product) => ({
                              value: product.name,
                              label: product.name,
                            }))}
                            value={field.value ?? []}
                            onChange={field.onChange}
                            placeholder={products.length > 0 ? "Select products" : "No active products"}
                            disabled={form.formState.isSubmitting}
                          />
                        </FormControl>
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
                          <Input
                            type="number"
                            disabled={form.formState.isSubmitting}
                            placeholder="1000000"
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
          </div>
        </div>

        <div className="grid gap-2 py-5">
          {form.formState.errors.root?.serverError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {form.formState.errors.root.serverError.message}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting} type="submit" data-testid={submitTestId}>
            {form.formState.isSubmitting ? <span className="flex items-center animate-pulse">{c("savingData")}</span> : submitButtonLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
