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

## What is deliberately not protected

The app trusts the machine it runs on. It stores an opened archive's directory
handle in IndexedDB so a returning visitor need not pick the folder twice;
anyone with access to that browser profile can reach it. Use
**Delete everything** in Settings on a shared machine.
