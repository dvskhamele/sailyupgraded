import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  CalendarDays,
  CoinsIcon,
  Facebook,
  Instagram,
  LayoutGrid,
  Linkedin,
  Twitter,
  User,
  Youtube,
} from "lucide-react";
import moment from "moment";
import { prismadb } from "@/lib/prisma";
import Link from "next/link";
import { EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { EmailLink, WhatsAppLink } from "@/components/ui/contact-link";
import { ContactDetailActions } from "./ContactDetailActions";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { formatAddress } from "@/lib/crm-address";
import { getReferenceId, normalizeContactRole } from "@/lib/contact-options";
import { CustomFieldsDisplay } from "@/components/crm/custom-fields-display";
import { parseOpportunityProducts } from "@/lib/opportunity-products";
import { formatCurrencyDisplay } from "@/lib/currency-input";
import { normalizeContactNotes } from "@/lib/crm/notes";
// import { EnrichButton } from "./EnrichButton";

interface OppsViewProps {
  data: any;
}

export async function BasicView({ data }: OppsViewProps) {
  //console.log(data, "data");
  const users = await prismadb.users.findMany();
  const crmData = await getAllCrmData();
  const {
    accounts,
    contactTypes,
    leadSources,
    leadStatuses,
    leadTypes,
    saleStages,
    products,
  } = crmData;
  const notes = normalizeContactNotes(data?.notes);
  const linkedOpportunities = Array.isArray(data?.opportunities)
    ? data.opportunities.map((item: any) => item.opportunity).filter(Boolean)
    : [];
  const referenceId = getReferenceId(data);
  const importedColumns = Array.isArray(data?.imported_columns_data)
    ? data.imported_columns_data
    : [];
  if (!data) return <div>Opportunity not found</div>;
  return (
    <div className="pb-3 space-y-5">
      {/*      <pre>{JSON.stringify(data, null, 2)}</pre> */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex w-full justify-between">
            <div>
              {/* <CardTitle>Basic Information</CardTitle> */}

              <CardDescription>
                <h1 className="text-lg font-bold ">
                  {[
                    `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
                    `ID: ${data.id}`,
                    referenceId !== "-" ? ` ID: ${referenceId}` : null,
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                </h1>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* <EnrichButton
                contactId={data.id}
                contactEmail={data.email ?? null}
                contactCurrentData={{
                  position:         data.position ?? null,
                  website:          data.website ?? null,
                  social_linkedin:  data.social_linkedin ?? null,
                  social_twitter:   data.social_twitter ?? null,
                  social_facebook:  data.social_facebook ?? null,
                  social_instagram: data.social_instagram ?? null,
                  description:      data.description ?? null,
                  office_phone:     data.office_phone ?? null,
                  mobile_phone:     data.mobile_phone ?? null,
                }}
              /> */}
              <ContactDetailActions
                contact={data}
                accounts={accounts}
                contactTypes={contactTypes}
                leadSources={leadSources}
                leadStatuses={leadStatuses}
                leadTypes={leadTypes}
                saleStages={saleStages}
                products={(products ?? []).filter(
                  (product: any) => product.status === "ACTIVE",
                )}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 w-full ">
            <div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none"> ID</p>
                  <p className="text-sm text-muted-foreground">{referenceId}</p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Company</p>
                  <p className="text-sm text-muted-foreground">
                    {data.assigned_accounts?.name}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Position in Company
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.position ? data.position : "N/A"}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Birthday</p>
                  <p className="text-sm text-muted-foreground">
                    {data.birthday
                      ? moment(data.birthday).format("MMM DD YYYY")
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Description
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.description ? data.description : "N/A"}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Role</p>
                  <p className="text-sm text-muted-foreground">
                    {normalizeContactRole(data.role)}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <User className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Assigned to
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {users.find((user) => user.id === data.assigned_to)?.name}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CalendarDays className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {moment(data.created_on).format("MMM DD YYYY")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Created by</p>
                  <p className="text-sm text-muted-foreground">
                    {users.find((user) => user.id === data.createdBy)?.name}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CalendarDays className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Last update
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {moment(data.updatedAt).format("MMM DD YYYY")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Last update by
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {users.find((user) => user.id === data.updatedBy)?.name}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Status</p>
                  <p className="text-sm text-muted-foreground">
                    {data.status ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Contact type
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.contact_type?.name}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Member of</p>
                  <p className="text-sm text-muted-foreground">
                    {data.member_of}
                  </p>
                </div>
              </div>
              <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
                <CoinsIcon className="mt-px h-5 w-5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Industry</p>
                  <p className="text-sm text-muted-foreground">
                    {data.industry}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div> Tags:</div>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag: string) => (
                  <Badge key={tag} variant={"outline"}>
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <CustomFieldsDisplay
              entityType="Contact"
              entityId={data.id}
              values={data.custom_fields_data}
              contactRole={data.role}
            />
            {importedColumns.length > 0 ? (
              <div className="col-span-full border-t pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Imported Fields</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {importedColumns.map((field: any) => (
                    <div
                      key={field.column}
                      className="rounded-md border bg-muted/20 px-3 py-2"
                    >
                      <p className="text-sm font-medium leading-none">
                        {field.label}
                      </p>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {field.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Insurance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ["Contact type", data.contact_type?.name],
              ["Lead source", data.lead_source?.name],
              ["Lead status", data.lead_status?.name],
              ["Lead type", data.lead_type?.name],
              ["Referred by", data.refered_by],
              ["Campaign", data.campaign],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border bg-muted/20 px-3 py-2"
              >
                <p className="text-sm font-medium leading-none">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {value || "N/A"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {linkedOpportunities.length > 0 ? (
            linkedOpportunities.map((opportunity: any) => {
              const products = parseOpportunityProducts(opportunity.category);

              return (
                <div
                  key={opportunity.id}
                  className="-mx-2 grid grid-cols-1 gap-3 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground md:grid-cols-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Name</p>
                    <Link
                      href={`/crm/opportunities/${opportunity.id}`}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      {opportunity.name ?? "Opportunity"}
                    </Link>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Products</p>
                    <div className="flex flex-wrap gap-2">
                      {products.length > 0 ? (
                        products.map((product) => (
                          <Badge
                            key={`${opportunity.id}-${product}`}
                            variant="secondary"
                          >
                            {product}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">N/A</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Budget</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrencyDisplay(
                        opportunity.budget,
                        opportunity.currency || "USD",
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No opportunity data</p>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 w-full">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="gap-1">
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">E-mail</p>
                <EmailLink
                  value={data?.email}
                  className="flex items-center gap-5"
                  trailingIcon={<EnvelopeClosedIcon />}
                />
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  Personal e-mail
                </p>
                <EmailLink
                  value={data?.personal_email}
                  className="flex items-center gap-5"
                  trailingIcon={<EnvelopeClosedIcon />}
                />
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Office phone</p>
                <WhatsAppLink value={data.office_phone} />
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Mobile phone</p>
                <WhatsAppLink value={data.mobile_phone} />
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Website</p>
                <p className="text-sm text-muted-foreground">
                  {data?.website ? (
                    <Link href={data.website}>{data.website}</Link>
                  ) : (
                    "N/A"
                  )}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Address</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {formatAddress(data, true) || "N/A"}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  Billing country
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.billing_country}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Social networks</CardTitle>
          </CardHeader>
          <CardContent className="gap-1">
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <Twitter className="mt-px h-5 w-5" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Twitter</p>
                <p className="text-sm text-muted-foreground">
                  {data.social_twitter}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <Facebook className="mt-px h-5 w-5" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Facebook</p>
                <p className="text-sm text-muted-foreground">
                  {data.social_facebook}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <Linkedin className="mt-px h-5 w-5" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">LinkedIn</p>
                <p className="text-sm text-muted-foreground">
                  {data.social_linkedin}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <LayoutGrid className="mt-px h-5 w-5" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Thread</p>
                <p className="text-sm text-muted-foreground">
                  {data.social_skype}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <Instagram className="mt-px h-5 w-5" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Instagram</p>
                <p className="text-sm text-muted-foreground">
                  {data.social_instagram}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <Youtube className="mt-px h-5 w-5" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">YouTube</p>
                <p className="text-sm text-muted-foreground">
                  {data.social_youtube}
                </p>
              </div>
            </div>
            <div className="-mx-2 flex items-start space-x-4 rounded-md p-2 transition-all hover:bg-accent hover:text-accent-foreground">
              <LayoutGrid className="mt-px h-5 w-5" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">TikTok</p>
                <p className="text-sm text-muted-foreground">
                  {data.social_tiktok}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        {
          //TODO: Add notes functionality
          //TODO: Delete notes functionality
        }
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <p className="text-sm text-muted-foreground" key={note.id}>
                    {note.text}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No notes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
