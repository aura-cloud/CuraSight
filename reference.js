// CuraSight reference list: general "what is this ingredient used for" text (English + Hindi). Free, offline, no API.
// Written as general information only: no doses, no advice to start/stop/change a medicine.
const D = {};
const G = (names, en, hi) => names.split(",").forEach((n) => (D[n] = [en, hi]));

// antibiotics and anti-infectives
G("amoxycillin", "bacterial infections", "बैक्टीरिया से होने वाले संक्रमण");
G("clavulanicacid", "helping an antibiotic work against bacteria that resist it", "एंटीबायोटिक को प्रतिरोधी बैक्टीरिया पर काम करने में मदद करने");
G("azithromycin", "bacterial infections of the throat, chest, ear and skin", "गले, छाती, कान और त्वचा के बैक्टीरियल संक्रमण");
G("cefixime,cefpodoxime,cefuroxime,cephalexin,cefadroxil", "bacterial infections such as throat, chest, ear and urine infections", "गले, छाती, कान और पेशाब के बैक्टीरियल संक्रमण");
G("ciprofloxacin,levofloxacin,ofloxacin,norfloxacin", "bacterial infections such as urine, stomach and chest infections", "पेशाब, पेट और छाती के बैक्टीरियल संक्रमण");
G("doxycycline", "bacterial infections, including chest infections and acne", "बैक्टीरियल संक्रमण, जैसे छाती का संक्रमण और मुंहासे");
G("metronidazole,ornidazole,tinidazole", "infections caused by bacteria and parasites, such as stomach and dental infections", "बैक्टीरिया और परजीवी से होने वाले संक्रमण, जैसे पेट और दांत के संक्रमण");
G("nitrofurantoin", "urinary tract infections", "पेशाब की नली के संक्रमण");
G("fluconazole,clotrimazole,terbinafine", "fungal infections", "फंगल संक्रमण");
G("albendazole", "worm infections", "पेट के कीड़ों के संक्रमण");
G("ivermectin", "parasitic infections such as worms and scabies", "कीड़ों और खुजली (स्केबीज़) जैसे परजीवी संक्रमण");

// pain and fever
G("paracetamol,acetaminophen", "fever and mild to moderate pain", "बुखार और हल्के से मध्यम दर्द");
G("ibuprofen", "pain, swelling and fever", "दर्द, सूजन और बुखार");
G("diclofenac,aceclofenac,naproxen,etoricoxib", "pain and swelling, such as joint and muscle pain", "दर्द और सूजन, जैसे जोड़ों और मांसपेशियों का दर्द");
G("nimesulide,ketorolac,mefenamicacid", "pain and fever", "दर्द और बुखार");
G("tramadol", "moderate to severe pain", "मध्यम से तेज़ दर्द");
G("serratiopeptidase", "reducing swelling and pain", "सूजन और दर्द कम करने");
G("thiocolchicoside,chlorzoxazone", "relieving painful muscle spasms", "मांसपेशियों की दर्द भरी अकड़न से राहत देने");
G("pregabalin,gabapentin", "nerve pain", "नसों के दर्द");

// stomach and digestion
G("pantoprazole,omeprazole,esomeprazole,rabeprazole,lansoprazole", "reducing stomach acid, for acidity, heartburn and ulcers", "पेट का एसिड कम करने, एसिडिटी, सीने की जलन और अल्सर");
G("famotidine,ranitidine", "reducing stomach acid", "पेट का एसिड कम करने");
G("domperidone", "nausea, vomiting and bloating", "जी मिचलाने, उल्टी और पेट फूलने");
G("ondansetron", "preventing nausea and vomiting", "जी मिचलाने और उल्टी रोकने");
G("promethazine", "nausea, vomiting, motion sickness and allergies", "जी मिचलाने, उल्टी, सफ़र में चक्कर और एलर्जी");
G("levosulpiride,itopride", "indigestion, nausea and bloating", "बदहज़मी, जी मिचलाने और पेट फूलने");
G("sucralfate", "protecting the stomach lining and helping ulcers heal", "पेट की परत की रक्षा करने और अल्सर भरने में मदद");
G("simethicone", "relieving gas and bloating", "गैस और पेट फूलने से राहत देने");
G("lactulose", "constipation", "कब्ज़");
G("drotaverine,dicyclomine", "stomach cramps and painful spasms", "पेट की मरोड़ और ऐंठन");
G("loperamide,racecadotril", "loose motions (diarrhoea)", "दस्त (लूज़ मोशन)");
G("magnesiumhydroxide,aluminiumhydroxide", "relieving acidity and heartburn", "एसिडिटी और सीने की जलन से राहत देने");

// allergy, cold, breathing
G("cetirizine,levocetirizine,fexofenadine,loratadine", "allergies such as sneezing, runny nose and itching", "छींक, नाक बहने और खुजली जैसी एलर्जी");
G("chlorpheniramine,pheniramine,hydroxyzine", "allergy and cold symptoms, and itching", "एलर्जी, सर्दी के लक्षणों और खुजली");
G("montelukast", "preventing asthma and allergy symptoms such as wheezing and sneezing", "दमा और एलर्जी के लक्षण, जैसे घरघराहट और छींक, रोकने");
G("phenylephrine", "relieving a blocked nose", "बंद नाक से राहत देने");
G("ambroxol,bromhexine", "loosening mucus to ease a cough", "बलगम पतला करके खांसी में राहत देने");
G("levosalbutamol,salbutamol,terbutaline", "opening the airways in wheezing and asthma", "घरघराहट और दमे में सांस की नलियां खोलने");
G("dextromethorphan", "dry cough", "सूखी खांसी");
G("budesonide,formoterol", "asthma and breathing problems (inhaled)", "दमे और सांस की तकलीफ़ (इन्हेलर से)");
G("prednisolone,methylprednisolone,dexamethasone,deflazacort", "reducing swelling and allergic or immune reactions (a steroid)", "सूजन और एलर्जी या प्रतिरक्षा संबंधी प्रतिक्रियाएं कम करने (एक स्टेरॉयड)");

// diabetes
G("metformin,glimepiride,gliclazide,glipizide,sitagliptin,vildagliptin,teneligliptin,dapagliflozin,empagliflozin,pioglitazone,voglibose",
  "controlling blood sugar in type 2 diabetes", "टाइप 2 डायबिटीज़ में ब्लड शुगर नियंत्रित करने");

// blood pressure, heart, cholesterol
G("amlodipine", "high blood pressure and chest pain (angina)", "हाई ब्लड प्रेशर और सीने के दर्द (एंजाइना)");
G("telmisartan,losartan,olmesartan,enalapril,ramipril", "high blood pressure", "हाई ब्लड प्रेशर");
G("atenolol,metoprolol,bisoprolol,carvedilol", "high blood pressure and some heart conditions", "हाई ब्लड प्रेशर और दिल की कुछ बीमारियां");
G("hydrochlorothiazide,chlorthalidone", "high blood pressure and swelling from extra fluid", "हाई ब्लड प्रेशर और शरीर में पानी रुकने से सूजन");
G("furosemide,torsemide", "removing extra fluid from the body", "शरीर से अतिरिक्त पानी निकालने");
G("spironolactone", "swelling from extra fluid, some heart conditions and high blood pressure", "शरीर में पानी रुकने से सूजन, दिल की कुछ बीमारियां और हाई ब्लड प्रेशर");
G("clopidogrel,aspirin", "preventing blood clots", "खून के थक्के बनने से रोकने");
G("atorvastatin,rosuvastatin", "lowering cholesterol", "कोलेस्ट्रॉल कम करने");

// vitamins, minerals, hormones
G("levothyroxine,thyroxine", "an underactive thyroid", "कम सक्रिय थायरॉइड");
G("cholecalciferol,vitamind3", "vitamin D deficiency and bone health", "विटामिन डी की कमी और हड्डियों की सेहत");
G("methylcobalamin,mecobalamin,cyanocobalamin,vitaminb12", "vitamin B12 deficiency and nerve health", "विटामिन बी12 की कमी और नसों की सेहत");
G("folicacid", "folate deficiency and during pregnancy", "फोलेट की कमी और गर्भावस्था के दौरान");
G("calciumcarbonate,calcium,calcitriol", "calcium deficiency and bone health", "कैल्शियम की कमी और हड्डियों की सेहत");
G("ferrousascorbate,ferrousfumarate,ferroussulphate,carbonyliron", "iron deficiency (anaemia)", "आयरन की कमी (एनीमिया)");
G("zinc,zincsulphate,zincacetate", "zinc deficiency", "ज़िंक की कमी");
G("ethinylestradiol,estradiol,drospirenone", "preventing pregnancy (as part of a birth-control pill) and some hormone-related conditions", "गर्भ रोकने (गर्भनिरोधक गोली के हिस्से के रूप में) और हार्मोन से जुड़ी कुछ स्थितियां");
G("lidocaine", "numbing an area to relieve pain", "किसी हिस्से को सुन्न करके दर्द से राहत देने");

const ALIAS = { amoxicillin: "amoxycillin", mecobalamin: "methylcobalamin", paracetamolacetaminophen: "paracetamol", vitaminb12: "cyanocobalamin" };
const SALTS = /(hydrochloride|hcl|sodium|potassium|besylate|maleate|succinate|tartrate|mesylate|phosphate|sulphate|sulfate|acetate|citrate|bromide|fumarate|dihydrate|monohydrate|trihydrate|anhydrous)/g;

function lookup(name) {
  const k = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (D[k]) return D[k];
  if (ALIAS[k] && D[ALIAS[k]]) return D[ALIAS[k]];
  const s = name.toLowerCase().replace(SALTS, "").replace(/[^a-z0-9]/g, "");
  return D[s] || D[ALIAS[s]] || null;
}

// Build the explanation for a medicine from its ingredients. Returns null if nothing is known.
function reference(m) {
  const known = [], unknown = [];
  for (const i of m.ingredients) { const e = lookup(i.name); if (e) known.push([i.name, e]); else unknown.push(i.name); }
  if (!known.length) return null;
  let en = known.map(([n, e]) => `${n} is used for ${e[0]}.`).join(" ");
  let hi = known.map(([n, e]) => `${n} का उपयोग ${e[1]} के लिए होता है।`).join(" ");
  if (unknown.length) {
    en += ` No description is available yet for ${unknown.join(", ")}; ask your pharmacist.`;
    hi += ` ${unknown.join(", ")} के बारे में अभी जानकारी उपलब्ध नहीं है; अपने फार्मासिस्ट से पूछें।`;
  }
  en += " Take it exactly as your doctor or pharmacist told you.";
  hi += " इसे वैसे ही लें जैसा आपके डॉक्टर या फार्मासिस्ट ने बताया है।";
  if (m.therapeuticClass === "antibiotic") {
    en += " Finish the full course even if you feel better, unless your doctor says otherwise.";
    hi += " आराम मिलने पर भी पूरा कोर्स करें, जब तक डॉक्टर मना न करें।";
  }
  return { en, hi, source: "reference", complete: unknown.length === 0 };
}
module.exports = { reference, lookup, count: Object.keys(D).length };
