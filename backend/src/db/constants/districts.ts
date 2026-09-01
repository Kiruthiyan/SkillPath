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
  "Vanni",
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
] as const;

export type UgcStream = (typeof UGC_STREAMS)[number];
