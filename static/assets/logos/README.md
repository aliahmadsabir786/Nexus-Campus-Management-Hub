# Institution logos

Drop the real logo files here. The paths are **configuration**, not code:
they come from `LOGO_DIR` / `DEFAULT_LOGOS` in `config.py`, and any single
department or campus row can override its own with the `logo_path` column in
the `departments` / `campuses` tables.

| File                     | Used by                        |
|--------------------------|--------------------------------|
| `bs-logo.png`            | BS Department + Main BS Campus |
| `intermediate-logo.png`  | Intermediate Department        |
| `boys-logo.png`          | Intermediate → Boys Campus     |
| `girls-logo.png`         | Intermediate → Girls Campus    |

Recommended: square PNG with a transparent background, 256×256 or larger.
The tile renders the image with `object-fit: contain`, so any square-ish
aspect ratio is safe.

## Missing files are fine

Nothing breaks while this folder is empty. `institutionLogo()` in
`static/js/context.js` paints a placeholder tile first and fades the real
image in only on `load`; a 404 removes the `<img>` and leaves the
placeholder. Logos are never inlined as base64 in JavaScript (spec §26).

## Overriding a single logo from the database

```sql
UPDATE campuses SET logo_path = '/static/assets/logos/boys-crest.svg'
WHERE code = 'BOYS';
```

The value is served straight to the browser as an `<img src>`, so it must be
a path under `/static/`.
