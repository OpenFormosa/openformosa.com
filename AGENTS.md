# Agent Notes

## Project Basics

- This is a Ruby/Jekyll GitHub Pages site. Follow `README.md` for local preview and build commands.
- Export a UTF-8 locale before Jekyll commands on macOS:

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
```

- Use the Ruby/Jekyll dev server for local preview:

```bash
bundle exec jekyll serve
```

- The expected local URL is `http://127.0.0.1:4000/`.
- Do not use an ad hoc Python static server for normal preview/testing. The README only lists `python3 -m http.server` as the final step of a static deployed-build preview after `jekyll clean`, `jekyll build`, and `node scripts/validate-public-build.mjs _site`.

## Static Build Check

For a deployed-build style check, use:

```bash
bundle exec jekyll clean
bundle exec jekyll build
node scripts/validate-public-build.mjs _site
```

Then serve `_site` only if a static preview is specifically needed.

## Browser Testing

- Use `npx agent-browser ...`; `agent-browser` may not be directly available on `PATH`.
- For mobile checks, set the viewport with `npx agent-browser set viewport <width> <height>`, then navigate to the Jekyll dev server URL.
- Prefer computed styles over visual guessing when checking rendered CSS:

```bash
npx agent-browser get styles "<selector>" --json
```

## Git Branches

- Do not create branches with a `codex/` prefix.
- For documentation, copy, or website layout work, use a `docs/` branch prefix, for example `docs/refine-home-hero-mobile-layout`.
