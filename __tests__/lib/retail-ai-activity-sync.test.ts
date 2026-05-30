import { createActivityFromRetailAIActivity } from "@/lib/retail-ai/activity-sync";

describe("createActivityFromRetailAIActivity", () => {
  it("creates a scheduled meeting activity with retail AI customer details", async () => {
    const createdActivity = { id: "activity-1" };
    const prismaClient = {
      crm_Activities: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdActivity),
      },
      crm_ActivityLinks: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const appointmentTime = new Date("2026-06-01T15:30:00.000Z");

    const result = await createActivityFromRetailAIActivity(prismaClient, {
      id: "retail-ai-1",
      title: "Retail AI Call - Sarah Smith",
      description: "Customer booked a meeting.",
      date: new Date("2026-06-01T15:00:00.000Z"),
      duration: 12,
      outcome: "Booked appointment",
      assignedTo: "user-1",
      createdBy: "user-2",
      customer_name: "Sarah Smith",
      email: "sarah@example.com",
      phone_number: "+15551234567",
      appointment_time: appointmentTime,
      links: [{ entityType: "contact", entityId: "contact-1" }],
    });

    expect(result).toBe(createdActivity);
    expect(prismaClient.crm_Activities.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        metadata: {
          path: "$.retailAI.activityId",
          equals: "retail-ai-1",
        },
      },
      select: { id: true },
    });
    expect(prismaClient.crm_Activities.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "meeting",
        status: "scheduled",
        title: "Retail AI Call - Sarah Smith",
        description: "Customer booked a meeting.",
        date: appointmentTime,
        duration: 12,
        outcome: "Booked appointment",
        assignedTo: "user-1",
        createdBy: "user-2",
        metadata: {
          source: "retail-ai",
          retailAI: {
            activityId: "retail-ai-1",
            customerName: "Sarah Smith",
            customerEmail: "sarah@example.com",
            customerPhone: "+15551234567",
            scheduledMeetingTime: appointmentTime.toISOString(),
          },
        },
      }),
    });
    expect(prismaClient.crm_ActivityLinks.createMany).toHaveBeenCalledWith({
      data: [
        {
          activityId: "activity-1",
          entityType: "contact",
          entityId: "contact-1",
        },
      ],
    });
  });

  it("returns the existing synced activity instead of creating a duplicate", async () => {
    const existingActivity = { id: "activity-1" };
    const prismaClient = {
      crm_Activities: {
        findFirst: jest.fn().mockResolvedValue(existingActivity),
        create: jest.fn(),
      },
      crm_ActivityLinks: {
        createMany: jest.fn(),
      },
    };

    const result = await createActivityFromRetailAIActivity(prismaClient, {
      id: "retail-ai-1",
      title: "Retail AI Call - Sarah Smith",
      date: new Date("2026-06-01T15:00:00.000Z"),
    });

    expect(result).toBe(existingActivity);
    expect(prismaClient.crm_Activities.create).not.toHaveBeenCalled();
    expect(prismaClient.crm_ActivityLinks.createMany).not.toHaveBeenCalled();
  });
});
