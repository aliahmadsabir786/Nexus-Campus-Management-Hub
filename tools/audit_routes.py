import re, os, sys
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "routes")
GUARDS = ("login_required", "admin_required", "perm_required", "require_context")
PUBLIC_OK = ("/api/institutions",)
bad = []
for fn in sorted(os.listdir(ROOT)):
    if not fn.endswith(".py"): continue
    lines = open(os.path.join(ROOT, fn), encoding="utf-8").read().splitlines()
    for i, ln in enumerate(lines):
        m = re.match(r"\s*@\w+_bp\.route\(\s*[\"']([^\"']+)[\"'](.*)", ln)
        if not m: continue
        path = m.group(1)
        # collect the decorator block until the def
        j, decos = i + 1, []
        while j < len(lines) and not re.match(r"\s*def ", lines[j]):
            decos.append(lines[j].strip()); j += 1
        name = lines[j].strip() if j < len(lines) else "?"
        guarded = any(g in d for d in decos for g in GUARDS)
        methods = re.findall(r"[\"'](GET|POST|PUT|PATCH|DELETE)[\"']", ln + m.group(2))
        print("%-9s %-42s %-28s %s" % (fn[:-3], path, ",".join(methods) or "GET", "GUARDED" if guarded else "*** NO GUARD ***"))
        if not guarded and path not in PUBLIC_OK:
            bad.append((fn, path, name))
print()
print("UNGUARDED:", len(bad))
for b in bad: print("   ", b)
