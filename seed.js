// CuraSight – seed MongoDB from Kaggle "Indian Pharmaceutical Products" (clean CSV)
// Setup:  npm i mongodb csv-parse
// Run:    MONGO_URI="mongodb+srv://..." node seed.js indian_pharmaceutical_products_clean.csv
const fs = require("fs");

const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const FORM_WORDS = /\b(tablet|tablets|capsule|capsules|syrup|suspension|injection|cream|gel|drops|solution|inhaler|ointment|lotion|powder|sachet)\b/g;
// "Augmentin 625 Duo Tablet" -> "augmentin 625 duo"
const nameCore = (s) => norm(s).replace(FORM_WORDS, "").replace(/\s+/g, " ").trim();

// active_ingredients is a Python-style list string: [{'name': 'X', 'strength': '500mg', ...}, ...]
function parseIngredients(s = "") {
  const out = [], re = /'name':\s*'([^']*)',\s*'strength':\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(s))) out.push({ name: m[1].trim(), strength: m[2].trim() });
  return out;
}
// Same ingredients + strengths, in any order -> identical key
const compKey = (ings) =>
  ings.map((i) => norm(i.name + " " + i.strength).replace(/\s+/g, "")).sort().join("|");

async function main() {
  const { parse } = require("csv-parse");
  const { MongoClient } = require("mongodb");
  const file = process.argv[2];
  if (!file || !process.env.MONGO_URI) return console.error('Usage: MONGO_URI="..." node seed.js file.csv');
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const col = client.db("curasight").collection("medicines");
  await col.deleteMany({});

  let batch = [], n = 0, skipped = 0;
  const parser = fs.createReadStream(file).pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true }));
  for await (const r of parser) {
    const price = parseFloat(r.price_inr);
    if (!r.brand_name || isNaN(price)) { skipped++; continue; }
    const ings = parseIngredients(r.active_ingredients);
    const qty = parseFloat(r.pack_size) || 1;
    batch.push({
      productId: Number(r.product_id),
      name: r.brand_name,
      nameNorm: norm(r.brand_name),
      nameCore: nameCore(r.brand_name),
      manufacturer: r.manufacturer || r.manufacturer_raw || "",
      price,
      packSize: qty,
      packUnit: r.pack_unit || "",
      packaging: r.packaging_raw || "",
      unitPrice: +(price / qty).toFixed(4),
      dosageForm: r.dosage_form || "",
      discontinued: String(r.is_discontinued).toLowerCase() === "true",
      therapeuticClass: r.therapeutic_class || "other",
      ingredients: ings,
      compKey: compKey(ings),
    });
    if (batch.length === 5000) { await col.insertMany(batch, { ordered: false }); n += batch.length; batch = []; process.stdout.write(`\r${n} inserted`); }
  }
  if (batch.length) { await col.insertMany(batch, { ordered: false }); n += batch.length; }
  await col.createIndex({ nameCore: 1 });
  await col.createIndex({ compKey: 1, dosageForm: 1, discontinued: 1, unitPrice: 1 });
  console.log(`\nDone: ${n} inserted, ${skipped} skipped`);
  await client.close();
}

// Cheaper, same ingredients, same form, still sold
const findAlternatives = (col, med, limit = 5) =>
  col.find({ compKey: med.compKey, dosageForm: med.dosageForm, discontinued: false,
             productId: { $ne: med.productId }, unitPrice: { $lt: med.unitPrice } })
     .sort({ unitPrice: 1 }).limit(limit).toArray();

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { norm, nameCore, parseIngredients, compKey, findAlternatives };
