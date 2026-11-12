# Shoal

**A calm desktop workspace for running several Claude Code conversations side by side.**

When you work with three or four Claude Code sessions at once, terminals pile up, you lose track of which one is waiting for you, and it is hard to remember what each one is about. Shoal puts them in one window:

- **The conversation you are working on is large on the left; the others are listed on the right**, like a messaging app.
- **You know at a glance what needs you**: "Working", "Done · your turn", "Waiting for your reply", with a sound, an in-app alert, a macOS notification and a Dock badge. Permission requests can be approved or denied from the list.
- **Each conversation gets an emoji and a short title** picked from its first message, unique among open conversations, so you recognize topics instantly.
- **Tags** (e.g. *Company A*, *Company B*, *Personal*) with Notion-style colors. New conversations are tagged automatically from their first message (only with your own tags, never an invented one), and you can change it at any time. Filter open conversations and history by one or several tags.
- **Themes**: four gems, each in a dark and a light version: Malachite, Amethyst, Amber and Aquamarine.
- **History**: past conversations, including the ones you had in a plain terminal, can be searched and resumed in one click.
- **Weekly limit at a glance**: how much of your weekly Claude limit is used, when it resets, and a daily goal so you don't burn the week on Monday.
- **Hours saved (optional)**: a small model estimates, item by item, how long the work Claude produced would have taken you by hand, ranked by task for the week.
- English and French interface.

Shoal does not replace Claude Code: every conversation **is** the real `claude` CLI running in a real terminal, with your own settings, permissions, MCP servers and login.

> Shoal is an independent open-source project. It is not affiliated with, or endorsed by, Anthropic.

---

## Requirements

- **macOS** 13 or later (Apple silicon or Intel), or **Windows 10/11** (x64, *experimental*, see below).
- **Claude Code**, installed and signed in once in a terminal:
  ```sh
  curl -fsSL https://claude.ai/install.sh | bash
  claude          # sign in, then quit with /exit
  ```
- **Python 3** (used by the small scripts that tell Shoal what each conversation is doing). Either install it from [python.org](https://www.python.org/downloads/), or run `xcode-select --install`.
- On Windows: Claude Code with its native installer (`irm https://claude.ai/install.ps1 | iex` in PowerShell, which needs [Git for Windows](https://git-scm.com/download/win)), and Python from [python.org](https://www.python.org/downloads/windows/) (tick **"Add python.exe to PATH"**).

Nothing else: Shoal ships its own runtime, no Node.js needed.

## Install

1. Download `Shoal-<version>-mac-arm64.zip` (Apple silicon) or `…-mac-x64.zip` (Intel) from the [Releases](https://github.com/romainmourad/shoal/releases) page.
2. Unzip it and move **Shoal.app** to your **Applications** folder.
3. **First launch.** The app is not notarized by Apple (that requires a paid developer account), so macOS blocks it the first time. Either:
   - open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**; or
   - run this in a terminal: `xattr -dr com.apple.quarantine /Applications/Shoal.app`

If something is missing (Claude Code or Python), Shoal tells you what to install and lets you check again.

### Windows (experimental)

1. Download `Shoal-<version>-win-x64.zip` from the [Releases](https://github.com/romainmourad/shoal/releases) page, unzip it anywhere (e.g. `C:\Users\you\Apps\Shoal`) and run **Shoal.exe**.
2. The app is not code-signed, so Windows SmartScreen may warn on first launch: click **More info → Run anyway**.
3. Conversations run in PowerShell. Shortcuts use **Ctrl** instead of ⌘ (Ctrl+Shift+K new conversation, Ctrl+1…9, Ctrl+Shift+J, Ctrl+Shift+, settings). Ctrl+C copies when text is selected.

The Windows version is built and smoke-tested automatically on a Windows machine by GitHub Actions, but it has had little real-world use yet: please [open an issue](https://github.com/romainmourad/shoal/issues) if something doesn't work.

## Use

| Shortcut | Action |
|---|---|
| ⌘K | New conversation |
| ⌘1 … ⌘9 | Go to conversation n |
| ⌘J | Next conversation that needs you |
| ⌘, | Settings |
| ⇧Enter | New line in the prompt |

- **New conversation**: the green button (folder button next to it: pick where it starts). New conversations open in `~/Shoal` by default (Claude Code asks once whether you trust that folder); change it in Settings.
- **Rename** a conversation: double-click its title. **Close** it: hover its card and click ×.
- **Tag** a conversation: hover its card and click the tag icon. Create tags in **Settings → Tags**; the chips above the list filter both open conversations and History.
- **Images**: paste a screenshot (⌘V) or drop an image on the terminal; it is attached to the prompt like in Claude Code.
- **Closing the window** keeps your conversations running. **⌘Q** stops them; they are resumed (`claude --resume`) the next time you open Shoal. You can choose to keep them running after quitting in Settings.

## Settings

Appearance (theme, sidebar on the left or right, text size) · language · notifications (finished, waiting, macOS, sound, Dock badge) · weekly goal, working days, daily goal and warning threshold (or no weekly limit tracking at all, for plans without one) · default folder and model for new conversations · automatic emoji and title · terminal text size and memory · tags · history import · hours-saved tracking.

## Privacy

Shoal runs entirely on your Mac. There is no Shoal server, account, analytics or telemetry.

- The app talks to a local server bound to `127.0.0.1` only. It is protected by a random access token that is given to the Shoal window and never served over HTTP; requests from web pages (other origins or hostnames) are rejected.
- Your data (settings, history, tags, tasks, pasted images) lives in `~/Library/Application Support/Shoal`, readable by your user only. Pasted images are deleted after 30 days.
- Conversations are regular Claude Code sessions: what they send to Anthropic is exactly what Claude Code sends.
- **Background model calls.** Three optional features use small, tool-less `claude -p --model haiku` calls through your own Claude Code login, which count towards your usage:
  - naming a conversation (its first message, up to 600 characters);
  - hours saved (after each reply: your recent messages, the end of Claude's answer, and the names of this week's tasks);
  - emojis and tags for imported history (titles and first messages);
  - automatic tag of a new conversation (done in the same call as its name).

  Each one can be turned off in Settings.
- History import reads your Claude Code transcripts in `~/.claude/projects` locally, to list the last 30 days of conversations. It can be turned off.
- Shoal never modifies your `~/.claude/settings.json`: its hooks and status line are passed to the conversations it starts with `claude --settings`.

## How it works

```
Shoal.app (Electron)
 ├─ window: src/web (xterm.js terminals, list, settings)
 └─ local server: src/server/server.mjs (Electron's Node, 127.0.0.1)
     ├─ one pseudo-terminal per conversation: your shell → claude --settings <Shoal hooks>
     ├─ Claude Code hooks (src/hooks/hook.py): working / done / waiting / permission
     └─ status line (src/hooks/statusline.py): context size and weekly limits
```

Hours saved: after each reply, Haiku lists what was actually produced (a fix, an email, a slide, an analysis…) and classifies each item by **size** (XS to XL). Models are poor at producing durations but good at classifying, so the minutes come from a fixed table ([`src/server/estimate.mjs`](src/server/estimate.mjs)), with three safeguards: an improvement of something already counted is an iteration (30 min at most); the lines of code Claude wrote only cap the size (it writes 3 to 5 times more than a developer would); and a reply never counts more than 6× Claude's working time. The time you spent steering Claude is subtracted. Click the hours of a task to correct them: corrections build a multiplier per type of work (dev, email, visual…) applied to later estimates.

## Build from source

Requires Node.js 20+.

```sh
git clone https://github.com/romainmourad/shoal.git && cd shoal
npm install
npm start            # run in development
npm run dist:mac     # build dist/Shoal-<version>-mac-{arm64,x64}.zip
npm run dist:win     # build dist/Shoal-<version>-win-x64.zip
node scripts/smoke.mjs   # start the server, open a real terminal, check it works
```

`SHOAL_DATA=/some/folder SHOAL_PORT=4800 npm start` runs a separate instance with its own data, which is handy for development.

## Troubleshooting

- **"Almost ready" banner**: Shoal could not find `claude` or `python3` through your login shell. Install the missing one, then click **Check again**.
- **Statuses don't update** (a conversation stays "Working"): check that `python3 --version` works in a terminal, then close and reopen the conversation.
- **Logs**: `~/Library/Application Support/Shoal/server.log` (Windows: `%APPDATA%\Shoal\server.log`).

## License

[MIT](LICENSE)
