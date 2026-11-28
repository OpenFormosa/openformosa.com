# Deploying to GitHub Pages

Deployment is automatic: every push to `main` runs [`pages.yml`](../../.github/workflows/pages.yml), which builds with a generated production config, validates `_site`, and deploys to GitHub Pages.

The production `url` / `baseurl` come from repository **Actions variables** (Settings → Secrets and variables → Actions → Variables):

- Root custom domain (current production): set `SITE_URL` to `https://openformosa.com` and leave `SITE_BASEURL` **unset** (GitHub rejects an empty variable value, so for a root domain the variable is simply not created and the workflow defaults `baseurl` to `""`).
- GitHub project page (`https://<owner>.github.io/<repo>`): set `SITE_URL` to `https://<owner>.github.io` and `SITE_BASEURL` to `/<repo>`.

The committed [`CNAME`](../../CNAME) file (`openformosa.com`) is copied into `_site` on every build so the custom domain persists across deploys.

To enable it on a fresh repository:

1. Push to GitHub.
2. Go to **Settings → Pages** and select **GitHub Actions** as the build and deployment source.
3. Set the `SITE_URL` repository variable as above.
4. For the custom domain, confirm DNS points at GitHub Pages and that **Settings → Pages → Custom domain** shows `openformosa.com`.

## Local production test

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cp _config.production.example.yml _config.production.yml   # already targets openformosa.com
bundle exec jekyll clean
bundle exec jekyll build --config _config.yml,_config.production.yml
node scripts/validate-public-build.mjs _site --require-absolute --expected-base="https://openformosa.com"
```

Before announcing changes, check `sitemap.xml`, `robots.txt`, `feed.xml`, and the social preview image. See [PUBLICATION_CHECKLIST.md](../../PUBLICATION_CHECKLIST.md).
