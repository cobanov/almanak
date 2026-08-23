# Contributing

Thanks for looking. The most useful contributions are about the parser, because
X changes its export format without announcing it.

## Getting set up

```bash
npm install
npm run dev      # the app at http://localhost:5173/app/
npm test         # the parser and store suites
npm run build    # landing at /, app at /app/, into dist/
```

Node 22.6 or newer, because `scripts/` runs TypeScript without a loader.

## If your archive does not parse

The single most useful thing you can send is the output of

```bash
npm run inspect -- /path/to/your/archive
```

It writes a format report that is redacted by construction: the script refuses
to write a file containing your handle, display name or account id, and exits
non-zero if the redactor ever misses one. Please read it before attaching it
anyway.

## What the tests protect

Two promises hold this project up, and both are enforced rather than asserted:

- **Direct messages are never read.** `src/archive/dm-guard.ts` decides every
  path the app opens, with an allowlist plus a forbidden-substring backstop.
  `src/archive/__tests__/dm-guard.test.ts` keeps it that way. Widening either
  list is a security change and needs saying so in the pull request.
- **No network requests.** `scripts/check-network.ts` fails the build on any
  `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or hard-coded remote
  host outside two allowlisted modules. If a change genuinely needs one, add
  the module to `ALLOWED` there with a reason, in the same pull request.

## Format changes

`docs/ARCHIVE-FORMAT.md` is generated, not written. If you learn something new
about the export, add a case to `fixtures/` and a test rather than only editing
the prose.

Two paths ship untested because no archive we have seen exercises them:
note-tweet stitching, and pre-2020 exports that name the file `tweet.js`. An
archive with either would be genuinely useful.

## Style

Match the file you are editing. Comments explain why a thing is the way it is,
especially where the format is surprising; they do not restate the code.
