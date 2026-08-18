#!/usr/bin/env python3
"""Build dist/kitchen_app.html by splicing data/*.json into the carrier HTML.

Run from repo root:  python3 src/build.py
Data-only iteration: edit data/*.json, rebuild, then `npm test` before committing.
The engine code in dist/kitchen_app.html is never touched by this script.
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
APP  = os.path.join(ROOT, "dist", "kitchen_app.html")
PACKS = [("INGREDIENTS","ingredients.json","ING_DATA"),
         ("TRANSITIONS","transitions.json","TRANS_DATA"),
         ("RECIPES","recipes.json","REC_DATA"),
         ("SEED","seed_state.json","SEED_DATA"),
         ("KINETICS","kinetics.json","KIN_DATA")]

def load(fname):
    with open(os.path.join(DATA, fname)) as f: return json.load(f)

def validate():
    """Cross-pack referential integrity: a recipe must never reference an
    ingredient, method, or form that doesn't exist. Fail the build, loudly."""
    errs = []
    ing, trans, rec, seed, kin = (load(f) for _, f, _ in PACKS)
    items = ing["items"]; pcs = trans["prep_classes"]
    methods = set(kin["method_env"])                       # fat / dry / moist / microwave
    stops = {"whole", "cleaned", "peeled", "skinned"}      # synthPrep stop-points
    def form_ok(k, form):
        pc = pcs.get(items[k].get("prepClass") or "")
        return form in stops or (pc and form in pc.get("forms", []))
    for rid, r in rec["library"].items():
        ks = set()
        for it in r.get("ingredients", []):
            k = it.get("k"); ks.add(k)
            if k not in items: errs.append("%s: unknown ingredient '%s'" % (rid, k)); continue
            f = it.get("form")
            if f and not form_ok(k, f): errs.append("%s: form '%s' unreachable for '%s'" % (rid, f, k))
        if r.get("method") not in methods: errs.append("%s: unknown method '%s'" % (rid, r.get("method")))
        for y in r.get("yields", []):
            if y.get("k") not in items: errs.append("%s: yield '%s' not in catalog" % (rid, y.get("k")))
        seen = set()
        for st in r.get("stages", []):
            if st.get("method") not in methods: errs.append("%s:%s: unknown method" % (rid, st.get("id")))
            for c in st.get("consumes", []):
                if c not in ks and c not in seen: errs.append("%s:%s: consumes '%s' (not an ingredient or prior stage)" % (rid, st.get("id"), c))
            seen.add(st.get("id"))
    for p in rec.get("plan", []):
        if p.get("recipeId") not in rec["library"]: errs.append("plan: unknown recipe '%s'" % p.get("recipeId"))
    for lot in seed.get("inventory", []):
        if lot.get("k") not in items: errs.append("inventory lot %s: unknown ingredient '%s'" % (lot.get("id"), lot.get("k")))
        if lot.get("loc") not in seed.get("locations", {}): errs.append("inventory lot %s: unknown location '%s'" % (lot.get("id"), lot.get("loc")))
    if errs:
        sys.exit("VALIDATION FAILED (%d):\n  " % len(errs) + "\n  ".join(errs))

def main():
    validate()
    t = open(APP).read()
    for tag, fname, var in PACKS:
        data = open(os.path.join(DATA, fname)).read().strip()
        json.loads(data)  # validate
        a, b = "/*@DATA:%s@*/" % tag, "/*@END:%s@*/" % tag
        assert t.count(a) == 1 and t.count(b) == 1, "markers !=1 for " + tag
        i, j = t.index(a), t.index(b) + len(b)
        t = t[:i] + a + "const %s=%s;" % (var, data) + b + t[j:]
    open(APP, "w").write(t)
    print("built %s (%d packs, %d bytes)" % (APP, len(PACKS), len(t)))
if __name__ == "__main__":
    main()
