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

## Data usage

Sofa collects no user data. Nothing is sent anywhere: every request goes to the
forge the user is already using, with their existing session, and the results
stay in the tab. No analytics, no remote code, no server of its own. The only
thing stored is which files you have marked viewed, in the browser's own
storage, per pull request.

## Visibility

Unlisted is the sensible default: the extension gets a stable id that an IT
department can allowlist, without appearing in store search.

## Assets

- `screenshot-1280x800.png` - the panel open on a public pull request
- icon: `../src/icons/icon-128.png`
