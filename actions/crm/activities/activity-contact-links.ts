export type ActivityLinkedContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type ActivityLinkWithContact = {
  id: string;
  entityType: string;
  entityId: string;
  contact?: ActivityLinkedContact | null;
};

type ActivityWithLinksBase = {
  links: ActivityLinkWithContact[];
};

export function getActivityContactName(contact: ActivityLinkedContact) {
  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    contact.email ||
    "Contact"
  );
}

export async function withActivityContactLinks<T extends ActivityWithLinksBase>(
  prismaClient: any,
  activities: T[]
): Promise<T[]> {
  const contactIds = Array.from(
    new Set(
      activities.flatMap((activity) =>
        activity.links
          .filter((link) => link.entityType === "contact")
          .map((link) => link.entityId)
      )
    )
  );

  if (contactIds.length === 0) {
    return activities;
  }

  const contacts = (await prismaClient.crm_Contacts.findMany({
    where: { id: { in: contactIds } },
    select: { id: true, first_name: true, last_name: true, email: true },
  })) as ActivityLinkedContact[];

  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));

  return activities.map((activity) => ({
    ...activity,
    links: activity.links.map((link) =>
      link.entityType === "contact"
        ? { ...link, contact: contactsById.get(link.entityId) ?? null }
        : link
    ),
  }));
}

export async function withActivityContactLink<T extends ActivityWithLinksBase>(
  prismaClient: any,
  activity: T | null
): Promise<T | null> {
  if (!activity) {
    return null;
  }

  const [activityWithContacts] = await withActivityContactLinks(prismaClient, [activity]);
  return activityWithContacts;
}
