# Blog Markdown and LaTeX

Blog posts live in `_posts/*.md` and are rendered by Jekyll/kramdown with GitHub-flavored Markdown. Posts also load MathJax, so authors can use inline math like `$E=mc^2$` and display math blocks like:

```tex
$$
\operatorname{WER} = \frac{S + D + I}{N}
$$
```

Use fenced code blocks, tables, headings, lists, links, and ordinary Markdown normally. For bilingual post bodies, wrap each language in `<div class="post-lang-zh" markdown="1">…</div>` and `<div class="post-lang-en" markdown="1">…</div>`; the active language is toggled by the site's language switcher.
