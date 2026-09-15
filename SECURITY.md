# Security

Sofa runs on pages that show private source code, so a vulnerability in it is
worth reporting properly. Thank you for taking the time.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

- Preferred: use GitHub's private vulnerability reporting on this repository,
  under **Security → Report a vulnerability**. It is private to the maintainer
  and gives us somewhere to discuss a fix before it is public.
- By email: **rousanali786@gmail.com**

Include what you did, what happened, and what you expected. A proof of concept
helps, even a rough one.

## What to expect

Sofa is maintained by one person, so this is a best-effort commitment rather
than a service level agreement:

- An acknowledgement within a few days.
- An assessment of whether it is exploitable, and what it exposes, once
  reproduced.
- A fix released to the Chrome Web Store as soon as one is ready, with credit in
  the release notes if you would like it.

Please give a reasonable window for a fix before publishing details.

## Scope

In scope:

- The extension: anything under `apps/ext`, and the published package.
- The shared logic in `packages/core`, which parses diffs and forge responses.
- The site under `apps/landing`, which is static and hosted on GitHub Pages.

Out of scope:

- Vulnerabilities in GitHub or GitHub Enterprise themselves. Report those to
  GitHub.
- The behaviour of any browser extension running alongside Sofa.

## What the extension can reach

Useful context for judging a report. Sofa runs on pull request pages, reads the
page it is on, and fetches that pull request's diff and file contents from the
same host using the session the browser already has. It has no server, sends
nothing anywhere else, and loads no remote code.

It can hold one credential: an optional API token, entered by the user in the
extension's popup, used to read review comments. It is kept in extension storage
rather than page storage, and attached only to requests to that host's API. If
you find a way for a page to read it, that is exactly the kind of thing worth
reporting.

The permissions it holds, and why, are set out in the
[privacy policy](https://sofa.rousanali.com/privacy/).
