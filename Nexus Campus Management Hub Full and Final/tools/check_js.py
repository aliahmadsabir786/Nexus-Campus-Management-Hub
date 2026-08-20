"""
check_js.py  --  lightweight structural check for the frontend scripts.

Node is not installed on the dev machine, so `node --check` is unavailable.
This walks each file as a character stream, tracking strings, template
literals (including nested ${...} substitutions), regex literals and both
comment styles, and reports:

  * unbalanced ( ) [ ] { }
  * an unterminated string / template literal / comment

That is exactly the class of damage a bad sed or string replacement causes,
which is what these edits need guarding against.  It is not a full parser -
it will not catch a misplaced keyword - so a browser load is still the final
word.

Usage:  python tools/check_js.py [file ...]        (default: static/js/*.js)
ASCII-only output: the Windows console is cp1252.
"""
import glob
import os
import sys

PAIRS = {')': '(', ']': '[', '}': '{'}
OPENERS = '([{'


def check(path):
    src = open(path, encoding='utf-8').read()
    errors = []
    stack = []          # (char, line) for brackets; '${' pushes '{'
    i, line, n = 0, 1, len(src)

    def prev_significant():
        """Last non-space char before i -- decides / as regex vs divide."""
        j = i - 1
        while j >= 0 and src[j] in ' \t\r\n':
            j -= 1
        return src[j] if j >= 0 else ''

    while i < n:
        c = src[i]

        if c == '\n':
            line += 1
            i += 1
            continue

        # ---- comments ----
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            while i < n and src[i] != '\n':
                i += 1
            continue
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            start = line
            i += 2
            while i + 1 < n and not (src[i] == '*' and src[i + 1] == '/'):
                if src[i] == '\n':
                    line += 1
                i += 1
            if i + 1 >= n:
                errors.append('unterminated /* comment opened on line %d' % start)
                break
            i += 2
            continue

        # ---- regex literal ----
        if c == '/' and prev_significant() in '(,=:[!&|?{};+~*%^<>' + '':
            start = line
            i += 1
            in_class = False
            while i < n:
                ch = src[i]
                if ch == '\\':
                    i += 2
                    continue
                if ch == '\n':
                    errors.append('unterminated regex on line %d' % start)
                    break
                if ch == '[':
                    in_class = True
                elif ch == ']':
                    in_class = False
                elif ch == '/' and not in_class:
                    i += 1
                    break
                i += 1
            continue

        # ---- plain strings ----
        if c in '"\'':
            quote, start = c, line
            i += 1
            while i < n:
                ch = src[i]
                if ch == '\\':
                    i += 2
                    continue
                if ch == quote:
                    i += 1
                    break
                if ch == '\n':
                    errors.append('unterminated %s string on line %d' % (quote, start))
                    line += 1
                    i += 1
                    break
                i += 1
            continue

        # ---- template literal ----
        if c == '`':
            stack.append(('`', line))
            i += 1
            while i < n and stack and stack[-1][0] == '`':
                ch = src[i]
                if ch == '\\':
                    i += 2
                    continue
                if ch == '\n':
                    line += 1
                    i += 1
                    continue
                if ch == '`':
                    stack.pop()
                    i += 1
                    break
                if ch == '$' and i + 1 < n and src[i + 1] == '{':
                    # hand control back to the main loop for the substitution
                    stack.append(('{', line))
                    i += 2
                    break
                i += 1
            continue

        # ---- brackets ----
        if c in OPENERS:
            stack.append((c, line))
            i += 1
            continue
        if c in PAIRS:
            if not stack or stack[-1][0] != PAIRS[c]:
                got = stack[-1] if stack else ('<nothing>', line)
                errors.append("line %d: '%s' closes '%s' opened on line %s"
                              % (line, c, got[0], got[1]))
                break
            stack.pop()
            i += 1
            # a '}' that closed a ${...} resumes the template literal
            if c == '}' and stack and stack[-1][0] == '`':
                start = stack[-1][1]
                while i < n:
                    ch = src[i]
                    if ch == '\\':
                        i += 2
                        continue
                    if ch == '\n':
                        line += 1
                        i += 1
                        continue
                    if ch == '`':
                        stack.pop()
                        i += 1
                        break
                    if ch == '$' and i + 1 < n and src[i + 1] == '{':
                        stack.append(('{', line))
                        i += 2
                        break
                    i += 1
                else:
                    errors.append('unterminated template literal opened on line %d' % start)
            continue

        i += 1

    for ch, ln in stack:
        errors.append("unclosed '%s' opened on line %d" % (ch, ln))
    return errors


def main():
    args = sys.argv[1:]
    if not args:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        args = sorted(glob.glob(os.path.join(root, 'static', 'js', '*.js')))
    bad = 0
    for path in args:
        errs = check(path)
        name = os.path.basename(path)
        if errs:
            bad += 1
            print('FAIL %s' % name)
            for e in errs[:6]:
                print('       %s' % e)
        else:
            print('ok   %s' % name)
    print('\n%d file(s) checked, %d with problems' % (len(args), bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
