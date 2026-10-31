// Districts are derived from the official UGC admission cutoff tables.
// "Vanni" does NOT appear in the official tables as a single column;
// the four separate districts Kilinochchi, Mannar, Mullaitivu and Vavuniya
// each have their own column in the official PDF. "All Island" is the
// all-island merit quota column that appears in the official tables.
export const UGC_DISTRICTS = [
  "All Island",
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Mullaitivu",
  "Vavuniya",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
] as const;

export type UgcDistrict = (typeof UGC_DISTRICTS)[number];

export const UGC_STREAMS = [
  "Physical Science",
  "Biological Science",
  "Commerce",
  "Arts",
  "Technology",
  "Engineering Technology",
  "Biosystems Technology",
] as const;

export type UgcStream = (typeof UGC_STREAMS)[number];
