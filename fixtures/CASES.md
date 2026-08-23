# Fixture cases

A miniature but complete X export, built from a real archive by
`scripts/fixture-redactor.ts` and redacted. It has the same directory
layout as a real export, so the parser can be pointed straight at
`fixtures/archive/` rather than fed hand-made objects.

210 tweets, 151 media placeholders.

## What is guaranteed

- Letters are substituted within their own alphabet, so Turkish text stays
  Turkish and still exercises dotted/dotless i. Nothing carries meaning.
- Handles, ids, hashtags and t.co codes are stable pseudonyms: the same
  account is the same pseudonym in every record.
- Entity `indices` are recomputed as **codepoint** offsets into the redacted
  `full_text`, matching how X stores them. An entity that genuinely is not
  in the text — a retweet cut off mid-URL — has `indices: null`.
- Media files are regenerated placeholders. No real image bytes are copied.
- Exactly one referenced media file is absent on purpose, so the loader has
  a missing file to degrade on: `8888806666864820208-8688884846864004062.jpg`.

## Cases

| Case | Records | Why it is here |
|---|---:|---|
| `plain` | 12 | Original post: no reply, no media, no links. |
| `reply-to-other` | 12 | Reply whose parent is not in the archive — 60% of a real archive. |
| `self-reply` | 10 | Thread link: parent is mine and present, so a chain can be built. |
| `retweet` | 6 | Stored as "RT @handle: " with no structured marker. |
| `retweet-truncated` | 6 | Retweet cut off mid-word: the text is not recoverable. |
| `quote` | 8 | Detectable only by a /status/ link; quoted text is absent. |
| `photo-1` | 6 | Single photo. |
| `photo-2` | 4 | Two photos. |
| `photo-3` | 4 | Three photos — odd grid case. |
| `photo-4` | 6 | Four photos — maximum. |
| `gif` | 5 | animated_gif: served as mp4, must not be treated as video. |
| `video` | 8 | Video: filename suffix is a URL hash, not a media id. |
| `long` | 8 | Over 280 characters, stored complete and untruncated. |
| `emoji` | 8 | Astral-plane characters: indices are UTF-16, not codepoints. |
| `turkish-i` | 10 | Dotted and dotless i — general Unicode casefolding gets these wrong. |
| `multiline` | 6 | Newlines in full_text. |
| `hashtags` | 6 | Hashtag entities. |
| `many-mentions` | 5 | Several mentions in one tweet. |
| `external-link` | 6 | Link to a domain — the "links to" filter depends on expanded_url. |
| `edited` | 9 | Edited tweet: one tweet stored as several records. Must dedupe. |
| `lang-not-a-language` | 6 | lang is qme/zxx/qam — "media, no text", not a language. |
| `zero-engagement` | 4 | favorite_count and retweet_count both "0". |
| `high-engagement` | 6 | Counts as strings — sorting without coercion puts 9 above 10. |
| `boundary` | 2 | The archive's earliest and latest tweet. |

Chains are closed: whenever a self-reply or an edit revision is selected,
its parent and its sibling revisions are pulled in too, so no fixture
points at a record that is not there.

Regenerate with `node scripts/fixture-redactor.ts <archive>`.
