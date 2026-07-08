export const CATALOG = [
  {id:1, name:"Paracetamol 500mg", category:"Pain Relief", dose:"1 tablet, up to 3x/day", price:25, icon:"💊", capacity:200},
  {id:2, name:"Metformin 500mg", category:"Diabetes", dose:"1 tablet, twice daily", price:60, icon:"💊", capacity:150},
  {id:3, name:"Amoxicillin 250mg", category:"Antibiotics", dose:"1 capsule, 3x/day", price:85, icon:"💊", capacity:100},
  {id:4, name:"Atorvastatin 10mg", category:"Cardiac", dose:"1 tablet at night", price:110, icon:"💊", capacity:120},
  {id:5, name:"Cetirizine 10mg", category:"Allergy", dose:"1 tablet as needed", price:18, icon:"💊", capacity:100},
  {id:6, name:"Vitamin D3 60K", category:"Vitamins", dose:"1 sachet weekly", price:32, icon:"🧃", capacity:80},
  {id:7, name:"Amlodipine 5mg", category:"Cardiac", dose:"1 tablet, morning", price:45, icon:"💊", capacity:90},
  {id:8, name:"Omeprazole 20mg", category:"Gastro", dose:"1 capsule before breakfast", price:52, icon:"💊", capacity:150},
  {id:9, name:"Insulin Glargine", category:"Diabetes", dose:"As prescribed", price:420, icon:"💉", capacity:40},
  {id:10, name:"Azithromycin 500mg", category:"Antibiotics", dose:"1 tablet daily, 3 days", price:95, icon:"💊", capacity:100},
  {id:11, name:"ORS Sachet", category:"Essential", dose:"Dissolve in 1L water", price:12, icon:"🧂", capacity:200},
  {id:12, name:"Cough Syrup 100ml", category:"Respiratory", dose:"10ml, 3x/day", price:68, icon:"🧴", capacity:80},
];

export function getMed(id) {
  return CATALOG.find(m => m.id == id);
}
