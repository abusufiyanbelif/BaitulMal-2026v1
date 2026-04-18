const admin = require('firebase-admin');
admin.initializeApp({ projectId: "docuextract-q8vaa" });
const db = admin.firestore();

async function run() {
  const campaigns = await db.collection('campaigns').get();
  for (const camp of campaigns.docs) {
    console.log(`Campaign: ${camp.id}`);
    const bens = await db.collection(`campaigns/${camp.id}/beneficiaries`).get();
    console.log(`  Beneficiaries: ${bens.docs.length}`);
    
    // Simulate what the UI does
    const batch = db.batch();
    for (const ben of bens.docs) {
      batch.update(ben.ref, { kitAmount: 100, itemCategoryId: 'test', itemCategoryName: 'Test' });
    }
    batch.update(camp.ref, { targetAmount: 100 * bens.docs.length });
    
    try {
      await batch.commit();
      console.log(`  Batch update SUCCESS for ${camp.id}`);
    } catch (e) {
      console.log(`  Batch update FAILED for ${camp.id}: ${e.message}`);
    }
  }
  
  const leads = await db.collection('leads').get();
  for (const lead of leads.docs) {
    console.log(`Lead: ${lead.id}`);
    const bens = await db.collection(`leads/${lead.id}/beneficiaries`).get();
    console.log(`  Beneficiaries: ${bens.docs.length}`);
    
    const batch = db.batch();
    for (const ben of bens.docs) {
      batch.update(ben.ref, { kitAmount: 100, itemCategoryId: 'test', itemCategoryName: 'Test' });
    }
    batch.update(lead.ref, { targetAmount: 100 * bens.docs.length });
    
    try {
      await batch.commit();
      console.log(`  Batch update SUCCESS for ${lead.id}`);
    } catch (e) {
      console.log(`  Batch update FAILED for ${lead.id}: ${e.message}`);
    }
  }
}
run().catch(console.error);
