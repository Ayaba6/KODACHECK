/** Marques d'engins courantes et modèles suggérés (le modèle reste libre). */
export const VEHICLE_BRANDS: Record<string, string[]> = {
  Haojue: ['HJ110', 'HJ125', 'KA150'],
  Yamaha: ['Crypton', 'Sirius', 'Force X', 'DT', 'YBR'],
  Honda: ['CG', 'CB', 'XR', 'Wave', 'Dio'],
  Suzuki: ['AX100', 'GN125', 'Viva'],
  'Bajaj / Boxer': ['Boxer BM100', 'Boxer BM150', 'Discover'],
  TVS: ['Star HLX', 'Apache'],
  Sanili: ['110', '125'],
  Kaizer: ['K125', 'K150', 'Super'],
  Rato: ['RT125', 'RT150'],
  Aloba: ['100', '125'],
  Kavaki: ['125', '150'],
  Kymco: ['Agility', 'Like'],
  Sym: ['Jet', 'Symphony'],
  Dayang: ['DY100', 'DY125'],
  Pegasus: ['P125'],
  Loncin: ['LX125', 'LX150'],
  Toyota: ['Corolla', 'Hilux', 'Land Cruiser', 'Yaris'],
  Autre: [],
};

export const BRAND_OPTIONS = Object.keys(VEHICLE_BRANDS);

export const COLOR_OPTIONS = ['Noir', 'Rouge', 'Bleu', 'Blanc', 'Gris', 'Vert', 'Marron', 'Jaune', 'Orange', 'Autre'];
