export interface ExpenseLineItem {
  name: string;
  quantity: string;
  unitPrice: number;
  total: number;
}

export interface PurposeCategory {
  id: string;
  name: string;
  total: number;
  percentage: string;
  color: string;
  count: number;
  description: string;
}

export const VOUCHER_BREAKDOWNS: Record<string, ExpenseLineItem[]> = {
  "DV-2026-09-041": [
    { name: "Multipurpose Bond Paper (A4 / Short / Long)", quantity: "50 reams", unitPrice: 290, total: 14500 },
    { name: "High-Yield Continuous Ink Refill Bottles (CMYK)", quantity: "8 bottles", unitPrice: 1600, total: 12800 },
    { name: "Replacement Heavy-Duty Paper Feed Rollers & Maintenance Servicing", quantity: "1 lot", unitPrice: 8100, total: 8100 },
  ],
  "DV-2026-08-019": [
    { name: "Customized Sublimation Team Jerseys & Uniforms (16 Teams)", quantity: "16 sets", unitPrice: 3000, total: 48000 },
    { name: "Accredited Referee, Umpire & Table Official Honoraria (Full Season)", quantity: "1 package", unitPrice: 25000, total: 25000 },
    { name: "Championship Cups, Division Trophies & Gold/Silver/Bronze Medals", quantity: "1 set", unitPrice: 22000, total: 22000 },
    { name: "Tournament Game Balls (Molten Basketballs & Mikasa Volleyballs) & Court Nets", quantity: "1 lot", unitPrice: 20000, total: 20000 },
  ],
  "DV-2026-08-009": [
    { name: "Packed Lunch, Snacks & Hydration for 120 Youth Attendees", quantity: "120 pax", unitPrice: 175, total: 21000 },
    { name: "Accredited Resource Speaker Honorarium & Tokens of Appreciation", quantity: "2 speakers", unitPrice: 5000, total: 10000 },
    { name: "Acoustic Sound System, Wireless Microphones & Projector Stage Rental", quantity: "1 day", unitPrice: 7000, total: 7000 },
    { name: "Seminar Workbooks, Lanyards, Name Badges & Participation Certificates", quantity: "120 kits", unitPrice: 33.33, total: 4000 },
  ],
  "DV-2026-07-005": [
    { name: "Honor Student Backpacks & School Supply Kits (Notebooks, Pens, Rulers)", quantity: "50 kits", unitPrice: 370, total: 18500 },
    { name: "Academic Excellence Custom Cast Medals & Ribbon Neck Lanyards", quantity: "50 pcs", unitPrice: 120, total: 6000 },
    { name: "Embossed Diploma Certificate Holders & Heavyweight Parchment Paper", quantity: "50 sets", unitPrice: 80, total: 4000 },
  ],
  "DV-2026-05-022": [
    { name: "Emergency First-Aid Trauma Jump Bags with Medical Contents", quantity: "5 sets", unitPrice: 2900, total: 14500 },
    { name: "Medical Splint Sets, Tourniquets, Elastic Bandages & Antiseptics", quantity: "1 lot", unitPrice: 5800, total: 5800 },
    { name: "CPR Training Pocket Face Shields & Sanitary Demonstration Modules", quantity: "35 kits", unitPrice: 120, total: 4200 },
  ],
  "DV-2026-03-004": [
    { name: "DILG-NYC Mandatory Youth Governance Academy Official Registration", quantity: "10 officials", unitPrice: 1200, total: 12000 },
    { name: "Official Travel Allowance & Fuel Subsidy for Municipal Training Center", quantity: "1 delegation", unitPrice: 6000, total: 6000 },
  ],
  "DV-2026-06-012": [
    { name: "Native Shade & Fruit-Bearing Tree Seedlings (Narra, Mahogany, Guyabano)", quantity: "100 seedlings", unitPrice: 65, total: 6500 },
    { name: "Heavy-Duty Shovels, Garden Rakes, Brooms & Rubberized Work Gloves", quantity: "1 lot", unitPrice: 5300, total: 5300 },
    { name: "Biodegradable Garbage Sacks & Refreshment Kits for 80 Youth Volunteers", quantity: "80 kits", unitPrice: 62.5, total: 5000 },
  ],
};

export function getExpenseBreakdown(voucherNo: string | null, title: string, amount: number, description?: string | null): ExpenseLineItem[] {
  if (voucherNo && VOUCHER_BREAKDOWNS[voucherNo]) {
    return VOUCHER_BREAKDOWNS[voucherNo];
  }
  // Smart fallback for newly added vouchers
  return [
    {
      name: description || title,
      quantity: "1 lot",
      unitPrice: amount,
      total: amount,
    },
  ];
}

export function getOverallPurposeBreakdown(totalSpent: number): PurposeCategory[] {
  const categories = [
    {
      id: "sports-equipment",
      name: "Sports Equipment & Tournaments",
      total: 90000,
      color: "#d97706", // amber
      count: 4,
      description: "Sublimation jerseys, official game balls, court nets, championship trophies & medals",
    },
    {
      id: "learning-supplies",
      name: "School Supplies & Printing Materials",
      total: 55800,
      color: "#548701", // brand green
      count: 3,
      description: "Free printing paper reams, bulk ink refills, student backpacks & academic awards",
    },
    {
      id: "honoraria",
      name: "Honoraria & Officiating Services",
      total: 35000,
      color: "#4f46e5", // indigo
      count: 2,
      description: "Accredited league referee & umpire fees, mental health & PDEA resource speakers",
    },
    {
      id: "meals-refreshments",
      name: "Meals & Volunteer Logistics",
      total: 26000,
      color: "#ea580c", // orange
      count: 2,
      description: "Packed meals & snacks for 120 seminar youth, refreshments for 80 volunteer planters",
    },
    {
      id: "emergency-safety",
      name: "Emergency Response & First Aid",
      total: 24500,
      color: "#e11d48", // rose
      count: 3,
      description: "Trauma jump bags, splint sets, tourniquets, CPR training face shields & first-aid kits",
    },
    {
      id: "governance-training",
      name: "Governance Capability & Training",
      total: 22000,
      color: "#0891b2", // cyan
      count: 2,
      description: "DILG-NYC Mandatory Youth Governance Academy registration, official travel & workbooks",
    },
    {
      id: "repairs-rentals",
      name: "Equipment Repairs & Stage Rentals",
      total: 15100,
      color: "#9333ea", // purple
      count: 2,
      description: "Acoustic sound system & stage projector rental, printer roller pads & servicing",
    },
    {
      id: "environment-tools",
      name: "Environmental Tools & Seedlings",
      total: 11800,
      color: "#059669", // emerald
      count: 2,
      description: "Native tree seedlings (Narra, Mahogany, Guyabano), shovels, rakes, heavy-duty gloves",
    },
  ];

  return categories.map((cat) => ({
    ...cat,
    percentage: totalSpent > 0 ? ((cat.total / totalSpent) * 100).toFixed(1) : "0",
  }));
}
