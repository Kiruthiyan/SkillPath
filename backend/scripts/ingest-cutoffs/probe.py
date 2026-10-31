import json
from collections import Counter
d = json.load(open("data/handbooks/staging/2025_26_en.json", encoding="utf-8"))
print(json.dumps(d["validationSummary"], indent=1)[:1800])
P = d["programmes"]
print(Counter(p["sourceSection"] for p in P))
print(Counter(p["cutoffYear"] for p in P))
print(Counter(p["stream"] for p in P))
print(Counter(p["verificationStatus"] for p in P))
s9 = [p for p in P if p["sourceSection"] == "9"][:3]
print(json.dumps(s9, ensure_ascii=False)[:1500])
s2 = [p for p in P if p["sourceSection"] == "2"]
print(len(s2), json.dumps(s2[:3], ensure_ascii=False)[:1200])
print(len(set((p["university"], p["degreeName"]) for p in P)))
