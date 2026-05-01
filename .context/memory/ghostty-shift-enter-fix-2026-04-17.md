---
date: 2026-04-17
domains: [debugging, terminal, chezmoi]
topics: [ghostty, shift-enter, kitty-keyboard-protocol, pi-tui, newline, omarchy, keybind-conflict]
subject: ""
artifacts: []
related: [tmux-window-status-2026-04-16.md]
priority: medium
status: completed
---

# Session: Ghostty shift+enter newline fix in pi

## Context
- User reported shift+enter doesn't insert newlines in pi, both inside and outside tmux
- Works fine in Alacritty, broken in Ghostty
- Previous session (tmux-window-status) touched tmux config; this is a separate Ghostty config issue

## Root Cause
- Ghostty config had `keybind = shift+enter=text:\u001b[13;2u` (CSI-u escape sequence)
- This keybind was introduced by **Omarchy defaults** in commit `ccbcbe6` ("Integrate omarchy default ghostty settings", Feb 11, 2026)
- It replaced the original `keybind = shift+enter=text:\n` which worked correctly
- **The conflict**: Ghostty natively supports the Kitty keyboard protocol. Pi queries for Kitty protocol on startup (`\x1b[?u`), Ghostty responds, and pi enables it with `\x1b[>7u`. The custom keybind **overrides** the native protocol behavior, sending a bare `\x1b[13;2u` without event-type information, which conflicts with the active Kitty protocol handling.

## How pi handles shift+enter (source analysis)
- `pi-tui/dist/keys.js` has three detection paths for shift+enter:
  1. **Kitty CSI-u sequences**: `matchesKittySequence(data, CODEPOINTS.enter, MODIFIERS.shift)` — matches `\x1b[13;2u` or `\x1b[13;2:1u`
  2. **XTerm modifyOtherKeys**: `matchesModifyOtherKeys(data, CODEPOINTS.enter, MODIFIERS.shift)` — matches `\x1b[27;2;13~`
  3. **Legacy (Kitty protocol active only)**: `data === "\x1b\r" || data === "\n"` — the Ghostty `\n` binding worked here
- When Kitty protocol is active, the custom keybind sends a sequence that *should* match path 1, but the keybind overrides native protocol delivery and may produce unexpected behavior

## Fix
- Commented out the keybind in chezmoi source: `~/.local/share/chezmoi/private_dot_config/ghostty/config.tmpl`
- Ghostty's native Kitty keyboard protocol handles shift+enter correctly without any custom keybind
- Applied with `chezmoi apply -- ~/.config/ghostty/config`
- User needs to restart Ghostty or open a new tab for changes to take effect

## Files Modified
- `~/.local/share/chezmoi/private_dot_config/ghostty/config.tmpl` — commented out keybind with explanation

## Key Findings
- Ghostty supports Kitty keyboard protocol natively (responds to `\x1b[?u`)
- pi enables Kitty protocol with flags 1+2+4 (`\x1b[>7u`) on startup
- Custom keybinds in Ghostty override native protocol behavior for that key
- The tmux `terminal-features` for Ghostty is `ghostty:clipboard` — missing `extkeys`, but this was not the issue since it also fails outside tmux
- tmux `extended-keys` is `on` (correct)

## Next Steps
- [ ] Verify shift+enter works after Ghostty restart
- [ ] Consider adding `extkeys` to tmux `terminal-features` for Ghostty if extended keys issues appear in tmux
