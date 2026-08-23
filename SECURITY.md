# Security

almanak has no server and no account system. Your archive is read by your own
browser, from your own disk, and nothing is transmitted. That removes most of
the usual attack surface, and concentrates the rest in two places.

## What would count as a vulnerability here

- Anything that causes direct-message data to be read, indexed or displayed.
- Anything that causes a network request the user did not ask for.
- Anything in a supplied archive that can execute script in the page, for
  example through a link or a filename.
- Anything that leaves archive data behind after "Delete everything".

## Reporting

Open a private security advisory on GitHub, or email the address on the
maintainer's profile. Please include the smallest archive fragment that
reproduces the issue, redacted — `npm run inspect` produces a report that is
safe to share by construction.

## A note on the host's own analytics

Cloudflare Pages injects a Web Analytics beacon into every page it serves,
whether or not the project asks for it. The `/app/*` Content-Security-Policy
sets `script-src 'self'`, which blocks it: measured on the deployed site, the
request transfers zero bytes and the script never executes.

That is a real control rather than a hope, but it is the second line. If you
deploy this yourself, turn the beacon off at the zone as well — Cloudflare
dashboard, the zone's Web Analytics, disable automatic setup — so nothing has
to be blocked in the first place.

## What is deliberately not protected

The app trusts the machine it runs on. It stores an opened archive's directory
handle in IndexedDB so a returning visitor need not pick the folder twice;
anyone with access to that browser profile can reach it. Use
**Delete everything** in Settings on a shared machine.
