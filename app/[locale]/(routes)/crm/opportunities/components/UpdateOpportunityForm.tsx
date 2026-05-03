"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { UserSearchCombobox } from "@/components/ui/user-search-combobox";
import { AccountSearchCombobox } from "@/components/ui/account-search-combobox";
import { updateOpportunity } from "@/actions/crm/opportunities/update-opportunity";
import {
  createConfigValue,
  getConfigValues,
  updateConfigValue,
} from "@/app/[locale]/(routes)/admin/crm-settings/_actions/crm-settings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseOpportunityProducts } from "@/lib/opportunity-products";
import { CustomFieldsSection } from "@/components/crm/custom-fields-section";

type ConfigItem = { id: string; name: string };

type UpdateOpportunityFormProps = {
  initialData: any;
  setOpen: (value: boolean) => void;
  saleTypes: ConfigItem[];
  saleStages: ConfigItem[];
  campaigns: ConfigItem[];
  currencies: { code: string; name: string; symbol: string }[];
  categoryOptions?: string[];
};

export function UpdateOpportunityForm({
  initialData,
  setOpen,
  saleTypes,
  saleStages,
  campaigns,
  currencies,
  categoryOptions = [],
}: UpdateOpportunityFormProps) {
  const t = useTranslations("CrmOpportunityForm");
  const c = useTranslations("Common");
  const [saleTypeOptions, setSaleTypeOptions] = useState(saleTypes);
  const [saleStageOptions, setSaleStageOptions] = useState(saleStages);
  const [isSalesTypeDialogOpen, setIsSalesTypeDialogOpen] = useState(false);
  const [newSalesTypeName, setNewSalesTypeName] = useState("");
  const [isCreatingSalesType, setIsCreatingSalesType] = useState(false);
  const [editingSalesTypeId, setEditingSalesTypeId] = useState<string | null>(null);
  const [editingSalesTypeName, setEditingSalesTypeName] = useState("");
  const [isEditingSalesType, setIsEditingSalesType] = useState(false);
  const [isSalesStageDialogOpen, setIsSalesStageDialogOpen] = useState(false);
  const [newSalesStageName, setNewSalesStageName] = useState("");
  const [isCreatingSalesStage, setIsCreatingSalesStage] = useState(false);
  const [editingSalesStageId, setEditingSalesStageId] = useState<string | null>(null);
  const [editingSalesStageName, setEditingSalesStageName] = useState("");
  const [isEditingSalesStage, setIsEditingSalesStage] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [customCategoryOptions, setCustomCategoryOptions] = useState<string[]>([]);
  const selectedCategories = useMemo(
    () => parseOpportunityProducts(initialData?.category),
    [initialData?.category]
  );
  const mergedCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...categoryOptions, ...selectedCategories, ...customCategoryOptions]
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ),
    [categoryOptions, customCategoryOptions, selectedCategories]
  );

  const formSchema = z.object({
    id: z.uuid(),
    name: z.string().min(1, t("nameRequired")),
    clientName: z.string().nullable().optional(),
    close_date: z.date({
      message: "A expected close date is required.",
    }),
    description: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    sales_stage: z.string().nullable().optional(),
    category: z.array(z.string()).optional(),
    budget: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    expected_revenue: z.string().nullable().optional(),
    next_step: z.string().nullable().optional(),
    assigned_to: z.string().nullable().optional(),
    account: z.string().nullable().optional(),
    contact: z.string().nullable().optional(),
    campaign: z.string().nullable().optional(),
    custom_fields_data: z.record(z.string(), z.string()).optional(),
  });

  type NewAccountFormValues = z.infer<typeof formSchema>;

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      ...initialData,
      close_date: initialData.close_date ? new Date(initialData.close_date) : undefined,
      category: selectedCategories,
      clientName: initialData.clientName ?? "",
      description: initialData.description ?? "",
      budget: String(initialData.budget ?? ""),
      currency: initialData.currency ?? "",
      expected_revenue: String(initialData.expected_revenue ?? ""),
      next_step: initialData.next_step ?? "",
      assigned_to: initialData.assigned_to ?? "",
      account: initialData.account ?? "",
      contact: initialData.contact ?? "",
      campaign: initialData.campaign ?? "",
      type: initialData.type ?? "",
      sales_stage: initialData.sales_stage ?? "",
      custom_fields_data: initialData.custom_fields_data ?? {},
    },
  });

  const onSubmit = async (data: NewAccountFormValues) => {
    try {
      const cleaned = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value === null ? undefined : value])
      ) as any;
      const result = await updateOpportunity(cleaned);
      if (result?.error) {
        console.log(result.error);
        form.setError("root.serverError", { message: result.error });
        toast.error(result.error);
        return;
      }

      toast.success(t("updateSuccess"));
      setOpen(false);
    } catch (error) {
      console.log(error);
      const message = error instanceof Error ? error.message : "Failed to update opportunity";
      form.setError("root.serverError", { message });
      toast.error(message);
    }
  };

  const handleCreateSalesType = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreatingSalesType(true);
    try {
      const createdName = newSalesTypeName.trim();
      await createConfigValue("opportunityType", createdName);
      const updatedTypes = await getConfigValues("opportunityType");
      setSaleTypeOptions(updatedTypes);
      const created = updatedTypes.find((item) => item.name === createdName);
      if (created) {
        form.setValue("type", created.id, { shouldDirty: true, shouldValidate: true });
      }
      toast.success("Sales type added");
      setNewSalesTypeName("");
      setIsSalesTypeDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add sales type");
    } finally {
      setIsCreatingSalesType(false);
    }
  };

  const handleEditSalesType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSalesTypeId) return;
    setIsEditingSalesType(true);
    try {
      const updatedName = editingSalesTypeName.trim();
      await updateConfigValue("opportunityType", editingSalesTypeId, updatedName);
      const updatedTypes = await getConfigValues("opportunityType");
      setSaleTypeOptions(updatedTypes);
      toast.success("Sales type updated");
      setEditingSalesTypeId(null);
      setEditingSalesTypeName("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update sales type");
    } finally {
      setIsEditingSalesType(false);
    }
  };

  const handleCreateSalesStage = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreatingSalesStage(true);
    try {
      const createdName = newSalesStageName.trim();
      await createConfigValue("salesStage", createdName);
      const updatedStages = await getConfigValues("salesStage");
      setSaleStageOptions(updatedStages);
      const created = updatedStages.find((item) => item.name === createdName);
      if (created) {
        form.setValue("sales_stage", created.id, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      toast.success("Sales stage added");
      setNewSalesStageName("");
      setIsSalesStageDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add sales stage");
    } finally {
      setIsCreatingSalesStage(false);
    }
  };

  const handleEditSalesStage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSalesStageId) return;
    setIsEditingSalesStage(true);
    try {
      const updatedName = editingSalesStageName.trim();
      await updateConfigValue("salesStage", editingSalesStageId, updatedName);
      const updatedStages = await getConfigValues("salesStage");
      setSaleStageOptions(updatedStages);
      toast.success("Sales stage updated");
      setEditingSalesStageId(null);
      setEditingSalesStageName("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update sales stage");
    } finally {
      setIsEditingSalesStage(false);
    }
  };

  const handleCreateProductOption = (event: React.FormEvent) => {
    event.preventDefault();
    const createdName = newProductName.trim();

    if (!createdName) return;

    const alreadyExists = mergedCategoryOptions.some(
      (value) => value.toLowerCase() === createdName.toLowerCase()
    );

    if (alreadyExists) {
      const normalizedValue =
        mergedCategoryOptions.find(
          (value) => value.toLowerCase() === createdName.toLowerCase()
        ) ?? createdName;
      form.setValue(
        "category",
        Array.from(new Set([...(form.getValues("category") ?? []), normalizedValue])),
        { shouldDirty: true, shouldValidate: true }
      );
      toast.success("Product selected");
      setNewProductName("");
      setIsProductDialogOpen(false);
      return;
    }

    setCustomCategoryOptions((current) => [...current, createdName]);
    form.setValue(
      "category",
      Array.from(new Set([...(form.getValues("category") ?? []), createdName])),
      { shouldDirty: true, shouldValidate: true }
    );
    toast.success("Product added");
    setNewProductName("");
    setIsProductDialogOpen(false);
  };

  if (!initialData)
    return <div>{c("somethingWentWrong")}</div>;

  return (
    <>
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProductOption} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="new-product-name">Product name</Label>
              <Input
                id="new-product-name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                maxLength={255}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Add product
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isSalesTypeDialogOpen} onOpenChange={setIsSalesTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sales Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSalesType} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="new-sales-type">Name</Label>
              <Input
                id="new-sales-type"
                value={newSalesTypeName}
                onChange={(e) => setNewSalesTypeName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <Button type="submit" disabled={isCreatingSalesType} className="w-full">
              {isCreatingSalesType ? "Adding..." : "Add sales type"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editingSalesTypeId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSalesTypeId(null);
            setEditingSalesTypeName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sales Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSalesType} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="edit-sales-type">Name</Label>
              <Input
                id="edit-sales-type"
                value={editingSalesTypeName}
                onChange={(e) => setEditingSalesTypeName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <Button type="submit" disabled={isEditingSalesType} className="w-full">
              {isEditingSalesType ? "Saving..." : "Save sales type"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isSalesStageDialogOpen} onOpenChange={setIsSalesStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sales Stage</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSalesStage} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="new-sales-stage">Name</Label>
              <Input
                id="new-sales-stage"
                value={newSalesStageName}
                onChange={(e) => setNewSalesStageName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <Button type="submit" disabled={isCreatingSalesStage} className="w-full">
              {isCreatingSalesStage ? "Adding..." : "Add sales stage"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editingSalesStageId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSalesStageId(null);
            setEditingSalesStageName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sales Stage</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSalesStage} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="edit-sales-stage">Name</Label>
              <Input
                id="edit-sales-stage"
                value={editingSalesStageName}
                onChange={(e) => setEditingSalesStageName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <Button type="submit" disabled={isEditingSalesStage} className="w-full">
              {isEditingSalesStage ? "Saving..." : "Save sales stage"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-full px-4 md:px-10">
        <div className="w-full text-sm">
          <div className="pb-5 space-y-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input
                      disabled={form.formState.isSubmitting}
                      placeholder="New Saily functionality"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={form.formState.isSubmitting}
                      placeholder="John Doe"
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
              name="close_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("closeDate")}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>{t("closeDatePlaceholder")}</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        //@ts-ignore
                        //TODO: fix this
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                    <Textarea
                      disabled={form.formState.isSubmitting}
                      placeholder="New Saily functionality"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Products</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsProductDialogOpen(true)}
                        >
                          Add
                        </Button>
                      </div>
                      <FormControl>
                        <MultiSelect
                          options={mergedCategoryOptions.map((product) => ({
                            value: product,
                            label: product,
                          }))}
                          value={field.value ?? []}
                          onChange={field.onChange}
                          placeholder="Select products"
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>{t("salesType")}</FormLabel>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSalesTypeDialogOpen(true)}
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!field.value}
                            onClick={() => {
                              const selectedType = saleTypeOptions.find(
                                (item) => item.id === field.value
                              );
                              if (!selectedType) return;
                              setEditingSalesTypeId(selectedType.id);
                              setEditingSalesTypeName(selectedType.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("salesTypePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="flex overflow-y-auto h-56">
                          {saleTypeOptions.map((type: any) => (
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
                  name="sales_stage"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>{t("saleStage")}</FormLabel>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSalesStageDialogOpen(true)}
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!field.value}
                            onClick={() => {
                              const selectedStageItem = saleStageOptions.find(
                                (item) => item.id === field.value
                              );
                              if (!selectedStageItem) return;
                              setEditingSalesStageId(selectedStageItem.id);
                              setEditingSalesStageName(selectedStageItem.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("saleStagePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="flex overflow-y-auto h-56">
                          {saleStageOptions.map((stage: any) => (
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
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("budget")}</FormLabel>
                      <FormControl>
                        <Input
                          type={"number"}
                          disabled={form.formState.isSubmitting}
                          placeholder="1000000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("currency")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectCurrency")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.symbol} {c.code} — {c.name}
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
                  name="expected_revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("expectedRevenue")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          disabled={form.formState.isSubmitting}
                          placeholder="500000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="next_step"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("nextStep")}</FormLabel>
                      <FormControl>
                        <Textarea
                          disabled={form.formState.isSubmitting}
                          placeholder={t("nextStepPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{c("assignedTo")}</FormLabel>
                      <FormControl>
                        <UserSearchCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={c("selectUser")}
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("assignedAccount")}</FormLabel>
                      <FormControl>
                        <AccountSearchCombobox
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Choose Company"
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Contact</FormLabel>
                      <FormControl>
                        <Input
                          disabled={form.formState.isSubmitting}
                          placeholder="Contact ID"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="campaign"
                  render={({ field }) => (
                    <FormItem hidden={campaigns.length === 0}>
                      <FormLabel>From campaign</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a campaign" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="flex overflow-y-auto h-56">
                          {campaigns.map((campaign: any) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <CustomFieldsSection
              entityType="Opportunity"
              form={form}
              disabled={form.formState.isSubmitting}
            />
          </div>
        </div>
        <div className="grid gap-2 py-5">
          {form.formState.errors.root?.serverError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {form.formState.errors.root.serverError.message}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting} type="submit">
            {form.formState.isSubmitting ? (
              <span className="flex items-center animate-pulse">
                {c("savingData")}
              </span>
            ) : (
              c("update")
            )}
          </Button>
        </div>
      </form>
    </Form>
    </>
  );
}
