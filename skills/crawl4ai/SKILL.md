---
name: crawl4ai
description: Deep website crawling and content extraction with Crawl4AI. Use when b-research needs structured extraction from websites, bulk page crawling, or converting web content into searchable local artifacts. Includes install/bootstrap guidance and graceful degradation when unavailable.
---

# crawl4ai: Deep Web Crawling for Research

Structured website crawling and content extraction using [Crawl4AI](https://github.com/unclecode/crawl4ai). This is a **helper skill** invoked by `b-research` when lightweight web search isn't sufficient and deeper extraction is needed.

## When to Use

- Extracting structured content from multiple pages of a documentation site
- Crawling API reference docs for offline analysis
- Bulk extraction of content from a domain for synthesis
- Converting JavaScript-rendered pages into readable markdown
- When `web_search` + `fetch_content` aren't enough for the research depth needed

## When NOT to Use

- Quick single-page lookups → use `fetch_content` directly
- Simple API/usage questions → use `web_search` or `code_search`
- Internal codebase investigation → use `b-explore`

## Install / Bootstrap

### Check if Installed

```bash
# Check if crawl4ai is available
command -v crawl4ai && echo "installed" || echo "not installed"
# Or check the Python package
python3 -c "import crawl4ai; print(crawl4ai.__version__)" 2>/dev/null || echo "not installed"
```

### Install (if needed)

```bash
# Recommended: pip install with browser support
pip install crawl4ai
crawl4ai-setup  # Downloads browser binaries

# Alternative: with uv
uv pip install crawl4ai
crawl4ai-setup

# Verify installation
crawl4ai --version
```

### Prerequisites

- Python 3.10+
- Sufficient disk space for browser binaries (~200MB)
- Network access for the target sites

## Usage Patterns

### Basic Single-Page Crawl

```bash
# Crawl a single page and extract markdown
crawl4ai crawl "https://docs.example.com/api/reference" \
  --output-dir .context/YYYY-MM-DD.subject/research/ \
  --format markdown
```

### Multi-Page Documentation Crawl

```bash
# Crawl multiple pages from a docs site
crawl4ai crawl "https://docs.example.com" \
  --max-depth 3 \
  --max-pages 50 \
  --output-dir .context/YYYY-MM-DD.subject/research/ \
  --format markdown
```

### Programmatic Usage (Python)

```python
import asyncio
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

async def crawl_docs(base_url, output_path, max_pages=20):
    browser_config = BrowserConfig(headless=True)
    run_config = CrawlerRunConfig(
        max_pages=max_pages,
        output_dir=output_path,
        format="markdown",
    )
    
    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(
            url=base_url,
            config=run_config,
        )
        return result

asyncio.run(crawl_docs(
    "https://docs.example.com/api",
    ".context/YYYY-MM-DD.subject/research/",
))
```

### Extracting Specific Content

```python
# CSS selector-based extraction
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

async def extract_api_docs(url):
    config = CrawlerRunConfig(
        css_selector="main .api-section",  # Target specific DOM elements
        excluded_tags=["nav", "footer", ".sidebar"],
        format="markdown",
    )
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url, config=config)
        return result.markdown
```

## Integration with b-research

When invoked by `b-research`, follow this pattern:

1. **Check availability** — Run the bootstrap check above
2. **If unavailable** — Note the limitation and use `fetch_content` as fallback for individual pages
3. **If available** — Use Crawl4AI for bulk extraction, saving results to `research/` subdirectory
4. **Process output** — Read and synthesize the crawled content into research notes
5. **Cite sources** — Track which URLs contributed to which findings

### Fallback Strategy

When Crawl4AI is not installed:

1. Use `fetch_content` for individual pages (works for most research)
2. Use `web_search` with `includeContent: true` for multi-page discovery
3. Note in the research output that deeper crawling was not available
4. Recommend installation if the research would benefit from it

## Output Handling

Crawl4AI output should be saved to the subject-local `research/` subdirectory:

```
.context/YYYY-MM-DD.subject/
├── research/
│   ├── crawl-output/          # Raw crawl output
│   │   ├── page-1.md
│   │   └── page-2.md
│   ├── notes-<topic>.md       # Processed notes from crawl
│   └── sources-<topic>.md     # URL list with descriptions
├── index.md
└── research-<topic>.md        # Canonical summary
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Browser download fails | Try `crawl4ai-setup --force` or check network/proxy |
| JavaScript pages render empty | Ensure headless browser mode; try `--wait-for` option |
| Rate limiting / 403 errors | Add delays between requests; respect robots.txt |
| Memory issues on large crawls | Reduce `--max-pages` and `--max-depth` |
| SSL certificate errors | Use `--ignore-ssl` flag for local/dev sites |

## Ethical Guidelines

- Respect `robots.txt` and rate limits
- Don't crawl authentication-protected content without permission
- Cite sources in research output
- Prefer official APIs over scraping when available
- Minimize request volume — crawl only what's needed
