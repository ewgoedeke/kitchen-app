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
def main():
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
