# Web Fetch

Registers `web_fetch`, a read-only tool that retrieves one known URL without spending Firecrawl credits. HTML is converted to Markdown or text; responses are bounded by time and size.

Use `web_search` for discovery and `web_fetch` for retrieval from a specific URL.

Parameters:

- `url` — required `http://` or `https://` URL
- `format` — `markdown` (default), `text`, or `html`
- `timeoutSeconds` — default 30, max 120
- `maxBytes` — default 5 MiB, max 25 MiB
- `userAgent` — optional override
