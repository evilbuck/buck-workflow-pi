---
name: rails-app
description: Reference for Rails app conventions and gotchas — subpath deployment, Tailwind build coupling, test/assertion patterns, BEM theming. Use whenever working in a Rails project on frontend, deployment, or test code.
---

# rails-app

Reference notes for Rails projects. Each section is a "do this, not that" rule distilled from real footguns. Read the relevant section before touching the matching concern.

## 1. Subpath deployment is opt-in

`config.relative_url_root` in `config/application.rb` controls whether `url_for` / `asset_path` emit paths with a subpath prefix. The default must be `nil` (no prefix). Subpath deployers opt in via env var.

```ruby
# config/application.rb
config.relative_url_root = ENV.fetch("RAILS_RELATIVE_URL_ROOT", nil)
```

```bash
# Root-domain dev / production (the common case)
bin/rails server

# Subpath deployment (e.g. Caddy reverse proxy at /partypic/)
RAILS_RELATIVE_URL_ROOT=/partypic bin/rails server
```

**Don't** hardcode a subpath default like `ENV.fetch("RAILS_RELATIVE_URL_ROOT", "/partypic")`. It silently breaks root-domain dev for anyone who hasn't set the env var, and the failure mode is "page loads but every asset 404s" — easy to miss in a smoke test.

The test env usually pins this to `nil` (`config/environments/test.rb`) so test URL generation is always bare. Keep that override even after making the default nil — it's defensive.

**Smoke test both modes** when changing this code:
- `env -u RAILS_RELATIVE_URL_ROOT bin/rails server` — root mode
- `env RAILS_RELATIVE_URL_ROOT=/partypic bin/rails server` — subpath mode

Note: in subpath mode, assets are served at `/partypic/...` from the browser's perspective but Rails' asset pipeline serves them at `/assets/...` on the backend. That's correct — the reverse proxy maps the prefix. A direct curl against Rails in subpath mode will 404 on the prefix path; that's expected without the proxy in front.

If a developer shell has `RAILS_RELATIVE_URL_ROOT` exported from a prior session, use `env -u RAILS_RELATIVE_URL_ROOT ...` to scrub it. In fish, `unset NAME` is `set -e NAME` — a bare `unset NAME;` is silently ignored, so don't try that.

## 2. Tailwind must be rebuilt after CSS edits

`bin/rails server` does NOT watch or rebuild `app/assets/tailwind/application.css`. The compiled output is `app/assets/builds/tailwind.css`. After editing the source, run one of:

```bash
# One-shot build (CI / verification)
bin/rails tailwindcss:build

# Watch + auto-rebuild (recommended for active editing)
bin/dev     # foreman; starts the server AND the tailwindcss:watch process
```

`bin/dev` is the standard development command. The Procfile.dev defines the `web` and `css` processes; foreman runs them together. If you only run `bin/rails server`, your CSS changes won't reach the browser.

**Smoke test signal**: if the browser shows default browser styling (Times New Roman, underlined blue links, no layout), Tailwind is stale. Rebuild and reload.

## 3. `assert_select` shape for URLs with `?`

Nokogiri's CSS parser rejects `?` inside a quoted attribute value — `?` is not a valid CSS attribute operator. Trying to match `[href="/magic_links/new?purpose=host"]` with `%()` interpolation produces a syntax error in the test, not a mismatch.

**Use the Rails `[href=?]` placeholder form** (project convention from `magic_link_return_test.rb`):

```ruby
# Wrong — Nokogiri syntax error on `?` inside quoted value
assert_select %(a[href="#{new_magic_link_path(purpose: "host")}"]), 1

# Right — Rails substitutes the placeholder with the next positional arg
assert_select "a[href=?]", new_magic_link_path(purpose: "host"), 1
```

The 3-arg form: `assert_select "selector[attr=?]", value, count`. The 2-arg form: `assert_select "selector[attr=?]", value` (no count, asserts existence).

**Don't** try to be clever with `%(a[href="..."])` percent strings or `assert_select` with manual string interpolation. The `?` placeholder is the project's idiom and avoids the parser trap.

## 4. Integration `sign_in_as` needs a bootstrap GET

`ActionDispatch::IntegrationTest#sign_in_as` (the global helper in `test/test_helper.rb`) writes to `session[:user_id]` and `cookies[:user_id]`. Both require the integration session to be initialized, which only happens after the first request.

```ruby
# Wrong — errors with "undefined method 'session' for nil"
test "..." do
  sign_in_as(user)
  get "/"
  # ...
end

# Right — bootstrap with a GET first (matches uploader_contact_capture_test.rb et al.)
test "..." do
  get "/"           # bootstrap the integration session
  sign_in_as(user)
  get "/"           # now test the actual behavior
  # ...
end
```

This is the established project pattern. Controller tests (`ActionController::TestCase`) don't need the bootstrap; only integration tests do.

## 5. BEM semantic class names — never utility soup

The app's theming is an adapter for "what colors mean", decoupled from "what the palette is". The markup uses semantic class names; styling lives in `@layer components` in `app/assets/tailwind/application.css`.

```erb
<%# Right — semantic, themeable %>
<button class="button button--primary">Send</button>

<%# Wrong — utility soup, breaks the theming adapter %>
<button class="bg-teal-500 text-white font-semibold px-6 py-4 rounded-xl">Send</button>
```

Component classes are BEM:
- Block: `.button`, `.magic-link`, `.landing`
- Element: `.magic-link__title`, `.landing__card-title`
- Modifier: `.button--primary`, `.landing__card--host`
- State: `.is-active`, `[aria-disabled]` — never `.is-primary` or similar

**Adding a component**: new class in `@layer components` using `@apply` with semantic Tailwind utilities (`bg-canvas`, `text-ink`, `bg-primary`, `border-line`). Components reference theme tokens, not raw hex.

**Adding a theme**: new `[data-theme="name"]` block overriding the semantic `--pp-*` tokens. Switching themes is a data-attribute change — no rebuild, no JS.

## 6. Three-layer theme system

`app/assets/tailwind/application.css` defines three layers, in order from least to most specific:

1. **Raw palette** — design-brief colors as plain `--pp-*` CSS variables. NOT exposed as Tailwind utilities. Never collide with Tailwind's built-in palette.
2. **Semantic theme tokens** — `--pp-canvas`, `--pp-surface`, `--pp-ink`, `--pp-primary`, `--pp-accent`, `--pp-line`, `--pp-info`, `--pp-success`, `--pp-danger`. These name the *role* a color plays. A theme is just a block of these vars scoped under `[data-theme="name"]`.
3. **Semantic Tailwind utilities** — `@theme inline` maps the tokens to `bg-canvas`, `text-ink`, `bg-primary`, `border-line`, etc. The `inline` makes the utility emit the `var()` directly so it tracks the live theme.

The layout sets `<html data-theme="snapselect">` (default). To white-label an event, override the semantic tokens under a new `[data-theme="..."]` selector and emit that value on `<html>` per-event (via `content_for :theme` later).

**Reaching for a raw hex or a Tailwind default color in a view is a code smell.** Add or extend a semantic component/token instead.

## 7. Dev server lifecycle

Don't run `bin/rails server` in the foreground or as a background process. Use tmux (the `run-in-idle-pane` skill) to put the dev server in a dedicated pane so you can keep working.

```bash
# Use the run-in-idle-pane skill or directly:
tmux new-session -d -s partypic-dev -n rails 'bin/dev'

# Then attach or capture for inspection
tmux capture-pane -t partypic-dev:rails -p
```

`bin/dev` (foreman) is preferred over `bin/rails server` because it also runs `tailwindcss:watch`. See section 2.

## 8. Mandatory web UI verification

Per the global AGENTS.md, any change to UI files (HTML, CSS, ERB templates, JS) requires a browser smoke test. The minimum bar:
- Start the dev server (section 7).
- Navigate to the affected page in a real browser.
- Verify visual rendering (screenshot, not just HTTP 200).
- Test interactions (clicks, form submits) and verify they reach the right destination.
- Check the browser console for errors.
- Test at both mobile and desktop viewports (390×844 and 1280×800 are the project's defaults).

An HTTP 200 with default-styled HTML is not "working" — Tailwind being stale looks like that. See section 2.

## 9. Common test patterns (Rails + Minitest)

```ruby
# ActionDispatch::IntegrationTest — full request cycle
class FooTest < ActionDispatch::IntegrationTest
  test "..." do
    get "/"
    assert_response :success
    assert_select "a[href=?]", some_path, 1
  end
end

# ActionController::TestCase — controller-only (no bootstrap GET needed)
class FooControllerTest < ActionController::TestCase
  test "..." do
    get :index
    assert_response :success
  end
end

# ActionMailer::TestCase — mailer
class FooMailerTest < ActionMailer::TestCase
  test "..." do
    mail = FooMailer.welcome(deliveries: 1)
    assert_equal "Welcome", mail.subject
  end
end
```

Fixtures: `test/fixtures/*.yml` loads alphabetically (`fixtures :all` in `test/test_helper.rb`). Reference fixtures as `users(:one)`, `tenants(:one)`, `memberships(:one)`. Create non-fixture data inline in tests when needed.

`perform_enqueued_jobs` is the standard block for testing jobs triggered by a request (e.g., mailers in magic-link tests).

## Quick reference

| Concern | Right | Wrong |
|---|---|---|
| Subpath default | `ENV.fetch("RAILS_RELATIVE_URL_ROOT", nil)` | Hardcoded `"/partypic"` |
| Tailwind after CSS edit | `bin/dev` or `bin/rails tailwindcss:build` | Just `bin/rails server` |
| `assert_select` with `?` URL | `assert_select "a[href=?]", path, 1` | `%()` interpolation |
| Integration sign-in | `get "/"; sign_in_as(u); get "/"` | `sign_in_as(u); get "/"` |
| Class names in markup | `button button--primary` | `bg-teal-500 text-white ...` |
| Component variants | BEM `--modifier` (e.g. `--host`) | State classes (`is-primary`) |
| Reaching for color | Semantic token (`--pp-primary`) | Tailwind default or hex |
| Dev server | `bin/dev` in tmux idle pane | Foreground or `&` background |
| UI verification | Browser screenshot at 390×844 + 1280×800 | HTTP 200 only |
