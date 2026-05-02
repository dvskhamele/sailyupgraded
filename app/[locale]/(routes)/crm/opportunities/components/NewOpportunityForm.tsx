"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { CalendarIcon, Pencil } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { UserSearchCombobox } from "@/components/ui/user-search-combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  crm_Accounts,
  crm_Contacts,
  crm_campaigns,
} from "@prisma/client";
import { createOpportunity } from "@/actions/crm/opportunities/create-opportunity";
import {
  createConfigValue,
  getConfigValues,
  updateConfigValue,
} from "@/app/[locale]/(routes)/admin/crm-settings/_actions/crm-settings";

//TODO: fix all the types
type ConfigItem = {
  id: string;
  name: string;
};

type CategoryOption = string | { value: string; label: string };

type NewTaskFormProps = {
  accounts: crm_Accounts[];
  contacts: any[];
  salesType: ConfigItem[];
  saleStages: ConfigItem[];
  campaigns: crm_campaigns[];
  currencies: { code: string; name: string; symbol: string }[];
  categoryOptions?: CategoryOption[];
  selectedCategories?: string[];
  selectedStage?: string;
  accountId?: string;
  onDialogClose: () => void;
};

export function NewOpportunityForm({
  accounts,
  contacts,
  salesType,
  saleStages,
  campaigns,
  currencies,
  categoryOptions = [],
  selectedCategories = [],
  selectedStage,
  accountId,
  onDialogClose,
}: NewTaskFormProps) {
  const t = useTranslations("CrmOpportunityForm");
  const c = useTranslations("Common");
  const router = useRouter();

  const [searchAccountValue, setSearchAccountValue] = useState<string>("");
  const [searchContactValue, setSearchContactValue] = useState<string>("");
  const [saleTypeOptions, setSaleTypeOptions] = useState<ConfigItem[]>(salesType);
  const [saleStageOptions, setSaleStageOptions] = useState<ConfigItem[]>(saleStages);
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

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        account.name.toLowerCase().includes(searchAccountValue.toLowerCase())
      ),
    [accounts, searchAccountValue]
  );

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.last_name
            .toLowerCase()
            .includes(searchContactValue.toLowerCase()) ||
          (contact.first_name &&
            contact.first_name
              .toLowerCase()
              .includes(searchContactValue.toLowerCase()))
      ),
    [contacts, searchContactValue]
  );

  const normalizedCategoryOptions = useMemo(
    () =>
      categoryOptions
        .map((option) =>
          typeof option === "string"
            ? { value: option.trim(), label: option.trim() }
            : { value: option.value.trim(), label: option.label.trim() }
        )
        .filter((option) => option.value),
    [categoryOptions]
  );

  const mergedCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...normalizedCategoryOptions.map((option) => option.value),
            ...selectedCategories,
            ...customCategoryOptions,
          ]
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ),
    [normalizedCategoryOptions, selectedCategories, customCategoryOptions]
  );

  const formSchema = z.object({
    name: z.string().min(1, t("nameRequired")),
    close_date: z.date({
      message: "A expected close date is required.",
    }),
    category: z.array(z.string()),
    description: z.string(),
    type: z.string(),
    sales_stage: z.string(),
    budget: z.string(),
    currency: z.string(),
    expected_revenue: z.string(),
    next_step: z.string(),
    assigned_to: z.string(),
    account: z.string(),
    contact: z.string(),
    campaign: z.string(),
  });

  type NewAccountFormValues = z.infer<typeof formSchema>;

  const form = useForm<NewAccountFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      sales_stage: selectedStage ? selectedStage : "",
      account: accountId ? accountId : "",
      category: selectedCategories,
      type: "",
      budget: "",
      currency: "",
      expected_revenue: "",
      next_step: "",
      assigned_to: "",
      contact: "",
      campaign: "",
      description: "",
      name: "",
    },
  });

  const onSubmit = async (data: NewAccountFormValues) => {
    const result = await createOpportunity(data);
    if (result?.error) {
      form.setError("root.serverError", { message: result.error || t("createError") });
    } else {
      toast.success(t("createSuccess"));
      form.reset({
        name: "",
        close_date: new Date(),
        category: selectedCategories,
        description: "",
        type: "",
        sales_stage: "",
        budget: "",
        currency: "",
        expected_revenue: "",
        next_step: "",
        assigned_to: "",
        account: "",
        contact: "",
        campaign: "",
      });
      router.refresh();
      onDialogClose();
    }
  };

  const handleCreateSalesType = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreatingSalesType(true);
    try {
      const createdName = newSalesTypeName.trim();
      await createConfigValue("opportunityType", createdName);
      const updatedTypes = await getConfigValues("opportunityType");
      setSaleTypeOptions(updatedTypes as any);
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
      setSaleTypeOptions(updatedTypes as ConfigItem[]);
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
      setSaleStageOptions(updatedStages as ConfigItem[]);
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
      setSaleStageOptions(updatedStages as ConfigItem[]);
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full h-full px-4 md:px-10"
      >
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
                            label:
                              normalizedCategoryOptions.find((option) => option.value === product)
                                ?.label ?? product,
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
                          {saleTypeOptions.map((type) => (
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
                    <FormItem hidden={selectedStage ? true : false}>
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
                          {saleStageOptions.map((stage) => (
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
                          type="number"
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormItem hidden={accountId ? true : false}>
                      <FormLabel>{t("assignedAccount")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose account " />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="flex overflow-y-auto h-56">
                          <Input
                            placeholder="Search account..."
                            onChange={(e) =>
                              setSearchAccountValue(e.target.value)
                            }
                          />
                          {filteredAccounts.map((account) => (
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
                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Contact</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user to assign the account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="flex overflow-y-auto h-56">
                          <Input
                            placeholder="Search contact..."
                            onChange={(e) =>
                              setSearchContactValue(e.target.value)
                            }
                          />
                          {filteredContacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.first_name + " " + contact.last_name}
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
                          {campaigns.map((campaign) => (
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
          </div>
        </div>
        <div className="grid gap-2 py-5">
          {form.formState.errors.root?.serverError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {form.formState.errors.root.serverError.message}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting} type="submit" data-testid="opportunity-submit-btn">
            {form.formState.isSubmitting ? (
              <span className="flex items-center animate-pulse">
                {c("savingData")}
              </span>
            ) : (
              c("create")
            )}
          </Button>
        </div>
      </form>
    </Form>
    </>
  );
}
