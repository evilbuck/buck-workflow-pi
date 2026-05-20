# Research Source Dictionary

A maintained catalog of research sources for use with `b-research` and related skills. Each entry describes when the source is useful, how to access it, and any caveats.

The agent selects sources based on the research subject — this is a decision aid, not a mandatory checklist.

## How to Use This File

1. Match the research topic against the **Best for** tags in each entry
2. Select 2-4 source types most likely to yield authoritative results
3. Start with the highest-confidence sources, then broaden if needed
4. Record which sources were consulted in the research output

---

## Source Catalog

### Official Documentation

| Field | Value |
|-------|-------|
| **Examples** | MDN, docs.rs, docs.python.org, kubernetes.io, tailwindcss.com/docs |
| **Best for** | API signatures, configuration options, migration guides, compatibility tables |
| **Access** | Direct URL, `fetch_content`, Crawl4AI for multi-page docs |
| **Confidence** | High — canonical and versioned |
| **Caveats** | May lag behind latest release; sometimes lacks real-world examples |

### Source Code / Repository

| Field | Value |
|-------|-------|
| **Examples** | GitHub, GitLab, Bitbucket, sr.ht |
| **Best for** | Implementation details, bug root causes, design decisions, changelog |
| **Access** | `fetch_content` for raw files, `code_search` for symbol lookup, clone for deep investigation |
| **Confidence** | High — ground truth |
| **Caveats** | Requires reading code; may not explain *why* decisions were made |

### GitHub Issues / PRs / Discussions

| Field | Value |
|-------|-------|
| **Examples** | github.com/{owner}/{repo}/issues, /pull, /discussions |
| **Best for** | Known bugs, feature requests, design rationale, compatibility problems, roadmaps |
| **Access** | `fetch_content` on issue URLs, GitHub API search |
| **Confidence** | Medium-high — real user reports but may contain noise |
| **Caveats** | Check issue status (open/closed), sort by reactions for signal |

### Stack Overflow

| Field | Value |
|-------|-------|
| **Examples** | stackoverflow.com, stackexchange.com sub-sites (serverfault, askubuntu, etc.) |
| **Best for** | Specific technical questions, error messages, edge cases, quick "how do I" |
| **Access** | `web_search` with `site:stackoverflow.com`, `fetch_content` for full answers |
| **Confidence** | Medium — check answer score and acceptance status |
| **Caveats** | Answers can be outdated; prefer recent or highly-voted answers; check comments for corrections |

### Reddit

| Field | Value |
|-------|-------|
| **Examples** | r/programming, r/webdev, r/rust, r/python, r/archlinux, r/selfhosted, r/sre, domain-specific subreddits |
| **Best for** | Community experience, pitfalls, comparisons, "has anyone done X", sentiment, early signals |
| **Access** | `web_search` with `site:reddit.com`, `fetch_content` on thread URLs |
| **Confidence** | Low-medium — anecdotal, but good for discovering issues and opinions |
| **Caveats** | Highly anecdotal; verify claims independently; check upvote ratios; old threads may reference deprecated approaches |

### Hacker News

| Field | Value |
|-------|-------|
| **Examples** | news.ycombinator.com |
| **Best for** | Industry trends, product launches, architecture discussions, opinionated technical debate |
| **Access** | `web_search` with `site:news.ycombinator.com`, `fetch_content` on item URLs |
| **Confidence** | Low-medium — opinion-heavy but technically literate community |
| **Caveats** | Strong selection bias; good for surfacing alternatives and critiques, not for definitive answers |

### Lobsters

| Field | Value |
|-------|-------|
| **Examples** | lobste.rs |
| **Best for** | Deep technical discussion, systems programming, security, niche topics |
| **Access** | `web_search` with `site:lobste.rs`, `fetch_content` |
| **Confidence** | Medium — smaller but technically rigorous community |
| **Caveats** | Narrower topic range than HN; invite-only community affects perspective |

### Discourse / Forum Sites

| Field | Value |
|-------|-------|
| **Examples** | users.rust-lang.org, forum.djangoproject.com, discourse.elm-lang.org, community.home-assistant.io |
| **Best for** | Niche community knowledge, long-form technical discussion, project-specific troubleshooting |
| **Access** | `web_search` with `site:` filter, `fetch_content` on thread URLs |
| **Confidence** | Medium — often project-specific expertise |
| **Caveats** | Quality varies by community; search can be limited on some platforms |

### Blog Posts / Technical Articles

| Field | Value |
|-------|-------|
| **Examples** | dev.to, medium.com, substack, personal blogs, engineering blogs (Netflix, Stripe, Cloudflare) |
| **Best for** | Architecture patterns, migration guides, "how we did it" stories, tutorials |
| **Access** | `web_search`, `fetch_content` (use `defuddle` skill for clean extraction) |
| **Confidence** | Medium — quality varies widely; prefer engineering blogs from known companies |
| **Caveats** | May be sponsored or biased; check publication date; verify claims against official docs |

### YouTube / Video Transcripts

| Field | Value |
|-------|-------|
| **Examples** | YouTube, Vimeo, conference sites |
| **Best for** | Conference talks, tutorials, demos, architectural overviews |
| **Access** | `fetch_content` with YouTube URL (extracts transcript), `web_search` for discovery |
| **Confidence** | Medium — good for high-level understanding and demos |
| **Caveats** | Transcripts may have errors; content is linear and time-consuming to scan |

### Social Media (X/Twitter, Bluesky, Mastodon)

| Field | Value |
|-------|-------|
| **Examples** | x.com, bsky.app, mastodon.social, techhub.social |
| **Best for** | Breaking news, announcement reactions, early signals, library releases, sentiment |
| **Access** | `web_search` with `site:` filter; often paywalled or login-gated |
| **Confidence** | Low — fast-moving, unverified, high noise |
| **Caveats** | Best for discovery, not for authoritative answers; verify everything; X/Twitter increasingly paywalled |

### Facebook Groups

| Field | Value |
|-------|-------|
| **Examples** | Domain-specific groups (e.g., React developers, homelab, self-hosted) |
| **Best for** | Niche community experience, consumer/user sentiment, local/regional tech communities |
| **Access** | Limited — mostly login-gated; `web_search` may surface public posts |
| **Confidence** | Low-medium — highly variable quality |
| **Caveats** | Most content requires authentication; search engines have limited coverage; anecdotal |

### Discord / Slack Communities

| Field | Value |
|-------|-------|
| **Examples** | Project Discord servers, community Slack workspaces |
| **Best for** | Real-time community support, early adopter feedback, project-internal discussions |
| **Access** | Usually login-gated; not indexable by web search |
| **Confidence** | Medium — direct from community but ephemeral and unstructured |
| **Caveats** | Not accessible via automated tools; requires manual participation; content is not durable |

### Competitor / Alternative Sites

| Field | Value |
|-------|-------|
| **Examples** | AlternativeTo, similar sites, direct competitor product pages |
| **Best for** | Feature comparisons, pricing analysis, positioning, "what else exists" |
| **Access** | `web_search`, `fetch_content` |
| **Confidence** | Medium — useful for landscape mapping but inherently comparative |
| **Caveats** | Competitor claims need verification; pricing may be outdated |

### Standards Bodies / RFCs / W3C / IETF

| Field | Value |
|-------|-------|
| **Examples** | w3.org, ietf.org (RFCs), ecma-international.org, iso.org |
| **Best for** | Protocol specifications, standards compliance, normative behavior |
| **Access** | Direct URL, `fetch_content` |
| **Confidence** | High — normative references |
| **Caveats** | Dense and formal; may not reflect real-world implementation differences |

### Academic / Research Papers

| Field | Value |
|-------|-------|
| **Examples** | arxiv.org, scholar.google.com, semanticscholar.org, dl.acm.org |
| **Best for** | Algorithm design, performance benchmarks, theoretical foundations |
| **Access** | `web_search` with `site:` filter, `fetch_content` for open-access papers |
| **Confidence** | High — peer-reviewed (check venue) |
| **Caveats** | Can be dense; implementation details may differ from paper; check if results are reproducible |

---

## Adding New Sources

To add a new source:

1. Copy the entry template below
2. Fill in all fields
3. Add the entry in alphabetical order by category name
4. Commit with message: `docs(research-sources): add <source name>`

### Entry Template

```markdown
### [Category Name]

| Field | Value |
|-------|-------|
| **Examples** | Specific URLs or instances |
| **Best for** | When this source is the right choice |
| **Access** | How to reach it with available tools |
| **Confidence** | High / Medium-high / Medium / Low-medium / Low |
| **Caveats** | Limitations and gotchas |
```
