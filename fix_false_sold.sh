#!/bin/bash
echo "============================================"
echo "  Fix False Sold Items (Smart)"
echo "============================================"
echo ""
echo "This script restores ONLY items that were"
echo "marked as 'sold' in the last 7 days and"
echo "still have an active eBay listing ID."
echo ""
echo "Items genuinely sold (older) are preserved."
echo ""

mongosh --quiet gradeprophet << 'EOF'
// Find items marked as sold that have an ebay_item_id and were updated recently (likely falsely marked)
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 7);

const sold = db.inventory.find({ 
    category: "sold", 
    ebay_item_id: { $ne: null },
    updated_at: { $gte: cutoff.toISOString() }
}, { _id: 0, id: 1, card_name: 1, ebay_item_id: 1, updated_at: 1 }).toArray();

print(`Found ${sold.length} recently-marked sold items with eBay IDs:`);
sold.forEach(i => print(`  - ${i.card_name} (eBay: ${i.ebay_item_id}, updated: ${i.updated_at})`));

if (sold.length > 0) {
    const ids = sold.map(i => i.ebay_item_id);
    const result = db.inventory.updateMany(
        { category: "sold", ebay_item_id: { $in: ids }, updated_at: { $gte: cutoff.toISOString() } },
        { $set: { category: "for_sale", listed: true } }
    );
    print(`\nRestored ${result.modifiedCount} items back to 'for_sale' with listed=true`);
    print(`\nNow go to Listings page in FlipSlab to re-sync.`);
    print(`Items confirmed sold by eBay will be moved back to Sold automatically.`);
} else {
    print("\nNo recently false-sold items found.");
}
EOF

echo ""
echo "============================================"
echo "  Done! Open Listings page to re-sync"
echo "============================================"
