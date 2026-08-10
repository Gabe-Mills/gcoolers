# gcoolers.com (marketing site)

Cinematic Astro + React site for **Gcoolers**, the Apple Silicon thermal governor.

Live product repo: https://github.com/Gabe-Mills/gcoolers  
Pages (placeholder today): https://gcoolers.com

## Develop

```bash
npm install
npm run dev
```

## Configure

`src/data/site.ts` holds GitHub, release, Homebrew, donate, and support email.

## Deploy to GitHub Pages

Build static output, then copy into the product repo `docs/` (or a `gh-pages` branch):

```bash
npm run build
# copy dist/* → Gabe-Mills/gcoolers/docs/
```

Custom domain `gcoolers.com` should stay pointed at GitHub Pages (A records / CNAME as in the product README).
