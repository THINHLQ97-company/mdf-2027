# Mat Bao MDF Program 2027

Landing page and registration flow for the Mat Bao MDF Program 2027 (TLD registry partnerships).

Static site, no build step: open `index.html` (password set in `js/mdf-program.js`).

- `index.html` – slides: Hero, Introduction, Benefits, Registration Guarantee, Packages, Comparison, About, Book your plan
- `css/mdf-program.css` – base styles carried over from 2026 (recoloured for 2027)
- `css/mdf-2027.css` – 2027 additions (benefits, guarantee, tooltips, booking form)
- `js/mdf-data.js` – copy for packages and form
- `js/mdf-tips.js` – benefit explanations and placement schematics shown on hover / tap
- `js/mdf-program.js` – slide deck, countdown, packages, booking form (`submitRegistration()` is the hand-off point for the backend / Sendify)

Preview locally:

```bash
python3 -m http.server 8000
```
