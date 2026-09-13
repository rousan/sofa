# Chrome Web Store listing

Copy for the submission form, kept here so it changes with the code.

## Name

Sofa

## Short description

Max 132 characters; this one is 119.

    Review GitHub pull requests like an editor: file tree on the left, whole files with the diff spliced in on the right.

## Detailed description

    GitHub shows a diff as a handful of hunks with three lines of context. When
    the change is inside a long function, that is not enough to judge it, and
    expanding line by line is slow.

    Sofa adds a tab next to "Files changed" that reviews the same pull request
    the way an editor would. A file tree on the left, one file at a time on the
    right, and each file shown in full with its diff spliced into it, so you
    read a change with the whole function around it.

    - Whole-file diffs, with both old and new line numbers correct throughout
    - File tree with status, per-file counts, a filter, and a draggable width
    - Changes-only toggle when you do not want the whole file
    - Keyboard: n/p for changes, [ and ] for files, w, v, / and esc
    - Mark files viewed, remembered per pull request
    - Syntax highlighting, using GitHub's own colours, themes and icons
    - Works on GitHub Enterprise: add your host from the toolbar popup

    Sofa reads the pages you already have open, using the session you are
    already signed in with. It collects nothing, stores nothing remotely, and
    talks to no server of its own.

## Category

Developer Tools

## Single purpose

    Show a GitHub pull request's diff as whole files, inside the pull request
    page.

## Permission justifications

- **host_permissions: github.com** - Sofa runs on pull request pages to add its
  tab, and reads the pull request's diff from that same host.
- **host_permissions: patch-diff.githubusercontent.com** - github.com redirects
  a pull request's .diff and .patch to this host; without it the diff cannot be
  read.
- **host_permissions: raw.githubusercontent.com** - where github.com serves the
  full text of a file at a commit, which is what Sofa renders the diff into.
- **scripting** - to register the content script for a GitHub Enterprise host
  the user adds after installation, which cannot be listed in the manifest.
- **optional_host_permissions: all sites** - so a user can point Sofa at their
  own GitHub Enterprise hostname, which is private and unknowable at build time.
  Nothing is granted until the user types a host and accepts Chrome's prompt,
  and the popup refuses a wildcard host.

## Status

Published and public since 13 September 2026.

## Item identity

- Extension ID: `pmjgcefgjbpbiikghomjoickjeibpnon`
- Listing: https://chromewebstore.google.com/detail/sofa/pmjgcefgjbpbiikghomjoickjeibpnon
- Privacy policy: https://sofa.rousanali.com/privacy/

## Data usage

Tick nothing in the data collection list, and all three certifications.

Sofa collects no user data. Nothing is sent anywhere: every request goes to the
forge the user is already using, with their existing session, and the results
stay in the tab. No analytics, no remote code, no server of its own. The only
thing stored is which files you have marked viewed, in the browser's own
storage, per pull request.

## Test instructions

No credentials are needed; the reviewer's own GitHub session is enough, and a
signed-out session works on a public pull request.

    No login or test account is required.

    1. Install the extension and open any GitHub pull request, for example
       https://github.com/react/react-native/pull/58486/files
    2. A "Sofa" tab appears next to "Files changed". Click it.
    3. The pull request's files are listed on the left. Click one; the whole
       file is rendered on the right with the diff in place.
    4. Optional, for the host permission: click the Sofa toolbar icon, enter a
       GitHub Enterprise hostname, and accept Chrome's prompt. The extension
       then works on pull requests there too. Remove it from the same popup.

    Nothing is sent anywhere: every request goes to the GitHub host the tab is
    already on, using the browser's existing session.

## Visibility

Public is fine for a free developer tool. Unlisted is the alternative if you
would rather it not appear in store search while keeping a stable id for an IT
department to allowlist.

## Assets

- `screenshot-1280x800.png` - the panel open on a public pull request
- icon: `../src/icons/icon-128.png`
