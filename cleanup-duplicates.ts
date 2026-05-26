import { prismadb } from './lib/prisma';

async function cleanup() {
  console.log('Cleaning up duplicate Retail AI activities...');
  
  // Find all call_ids that appear more than once
  const duplicates: any[] = await (prismadb as any).$queryRawUnsafe(`
    SELECT call_id, COUNT(*) as count 
    FROM crm_RetailAIActivities 
    WHERE call_id IS NOT NULL 
    GROUP BY call_id 
    HAVING count > 1
  `);

  console.log(`Found ${duplicates.length} call_ids with duplicates.`);

  for (const dup of duplicates) {
    const callId = dup.call_id;
    console.log(`Cleaning duplicates for call_id: ${callId} (${dup.count} entries)`);

    // Get all entries for this call_id
    const entries = await (prismadb as any).crm_RetailAIActivities.findMany({
      where: { call_id: callId },
      orderBy: { createdAt: 'desc' }, // Keep the newest one
    });

    // Keep the first one, delete the rest
    const toDelete = entries.slice(1).map((e: any) => e.id);
    
    if (toDelete.length > 0) {
      // Delete links first
      await (prismadb as any).crm_RetailAIActivityLinks.deleteMany({
        where: { activityId: { in: toDelete } }
      });

      // Delete activities
      await (prismadb as any).crm_RetailAIActivities.deleteMany({
        where: { id: { in: toDelete } }
      });
      
      console.log(`Deleted ${toDelete.length} duplicate entries for ${callId}`);
    }
  }

  console.log('Cleanup finished.');
}

cleanup()
  .catch(e => console.error(e))
  .finally(async () => await (prismadb as any).$disconnect());
