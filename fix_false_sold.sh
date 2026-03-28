#!/bin/bash
echo "============================================"
echo "  Fix False Sold Items"
echo "============================================"
echo ""

# Find items marked as sold that still have an ebay_item_id
echo "Checking items marked as 'sold' with eBay IDs..."
mongosh --quiet gradeprophet << 'EOF'
const sold = db.inventory.find({ category: "sold", ebay_item_id: { $ne: null } }, { _id: 0, id: 1, card_name: 1, ebay_item_id: 1, listed_at: 1 }).toArray();
print(`Found ${sold.length} sold items with eBay IDs:`);
sold.forEach(i => print(`  - ${i.card_name} (eBay: ${i.ebay_item_id})`));

if (sold.length > 0) {
    const result = db.inventory.updateMany(
        { category: "sold", ebay_item_id: { $ne: null } },
        { $set: { category: "for_sale", listed: true } }
    );
    print(`\nRestored ${result.modifiedCount} items back to 'for_sale' with listed=true`);
} else {
    print("\nNo items to fix.");
}
EOF

echo ""
echo "============================================"
echo "  Done! Refresh your browser (Ctrl+Shift+R)"
echo "============================================"
