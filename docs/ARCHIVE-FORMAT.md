# Archive format

What is actually inside one real X export, read by `scripts/inspect-archive.ts`.
Every sample below is redacted: letters are substituted within their own
alphabet, and handles, ids and URLs carry stable pseudonyms.

| | |
|---|---|
| Generated | 2026-08-18T15:49:55.501Z |
| Declared size | 1.6 GB |
| `isPartialArchive` | `false` |
| Data types declared | 13 |

## Files

Listed largest first. Direct-message files are listed for completeness and
**never opened** — their record counts come from the manifest alone.

| File | Global | Records | Size | Read? |
|---|---|---:|---:|---|
| `data/tweets.js` | `YTD.tweets.part0` | 10,130 | 20 MB | yes |
| `data/direct-messages.js` | `YTD.direct_messages.part0` | 2,663 | 19 MB | no — DM |
| `data/direct-message-headers.js` | `YTD.direct_message_headers.part0` | 2,663 | 9.7 MB | no — DM |
| `data/direct-messages-group.js` | `YTD.direct_messages_group.part0` | 262 | 3.1 MB | no — DM |
| `data/direct-message-group-headers.js` | `YTD.direct_message_group_headers.part0` | 262 | 2.0 MB | no — DM |
| `data/tweet-headers.js` | `YTD.tweet_headers.part0` | 10,130 | 1.6 MB | yes |
| `data/deleted-tweets.js` | `YTD.deleted_tweets.part0` | 1 | 1.4 KB | yes |
| `data/deleted-tweet-headers.js` | `YTD.deleted_tweet_headers.part0` | 1 | 265 B | yes |
| `data/ad-engagements.js` | `YTD.ad_engagements.part0` | 0 | 37 B | yes |

### Not present in this export

Files that older archives shipped and this one does not, despite
`isPartialArchive: false`:

- `account.js`
- `profile.js`
- `like.js`
- `follower.js`
- `following.js`
- `note-tweet.js`
- `community-tweet.js`
- `moment.js`
- `block.js`
- `mute.js`
- `lists-created.js`
- `personalization.js`

## Fields

### `tweets.js`

`window.YTD.tweets.part0` — 10,130 records, 20 MB.

| Key | Type | Present | Non-empty | Example |
|---|---|---:|---:|---|
| `tweet` | object | 100.0% | 100.0% |  |
| `tweet.created_at` | string | 100.0% | 100.0% | `Tue Aug 18 15:18:11 +0000 2026` |
| `tweet.display_text_range` | array | 100.0% | 100.0% |  |
| `tweet.edit_info` | object | 100.0% | 100.0% |  |
| `tweet.entities` | object | 100.0% | 100.0% |  |
| `tweet.favorite_count` | string | 100.0% | 100.0% | `0` |
| `tweet.favorited` | boolean | 100.0% | 100.0% | `false` |
| `tweet.full_text` | string | 100.0% | 100.0% | `@user_a sz eh hsp` |
| `tweet.id` | string | 100.0% | 100.0% | `8024804664000442088` |
| `tweet.id_str` | string | 100.0% | 100.0% | `8024804664000442088` |
| `tweet.lang` | string | 100.0% | 100.0% | `it` |
| `tweet.retweet_count` | string | 100.0% | 100.0% | `0` |
| `tweet.retweeted` | boolean | 100.0% | 100.0% | `false` |
| `tweet.source` | string | 100.0% | 100.0% | `<a href="https://mobile.twitter.com" rel` |
| `tweet.truncated` | boolean | 100.0% | 100.0% | `false` |
| `tweet.edit_info.initial` | object | 99.6% | 99.6% |  |
| `tweet.edit_info.initial.editableUntil` | string | 99.6% | 99.6% | `2026-08-18T16:18:11.000Z` |
| `tweet.edit_info.initial.editsRemaining` | string | 99.6% | 99.6% | `5` |
| `tweet.edit_info.initial.editTweetIds` | array | 99.6% | 99.6% |  |
| `tweet.edit_info.initial.isEditEligible` | boolean | 99.6% | 99.6% | `false` |
| `tweet.in_reply_to_user_id` | string | 72.9% | 72.9% | `9557519713939959395` |
| `tweet.in_reply_to_user_id_str` | string | 72.9% | 72.9% | `9557519713939959395` |
| `tweet.in_reply_to_status_id` | string | 72.7% | 72.7% | `9377373159311315375` |
| `tweet.in_reply_to_status_id_str` | string | 72.7% | 72.7% | `9377373159311315375` |
| `tweet.in_reply_to_screen_name` | string | 66.5% | 66.5% | `user_a` |
| `tweet.entities.user_mentions` | array | 100.0% | 58.5% |  |
| `tweet.entities.user_mentions[].id` | string | 100.0% | 100.0% | `9557519713939959395` |
| `tweet.entities.user_mentions[].id_str` | string | 100.0% | 100.0% | `9557519713939959395` |
| `tweet.entities.user_mentions[].indices` | array | 100.0% | 100.0% |  |
| `tweet.entities.user_mentions[].screen_name` | string | 100.0% | 100.0% | `user_a` |
| `tweet.entities.user_mentions[].name` | string | 100.0% | 99.6% | `sda` |
| `tweet.possibly_sensitive` | boolean | 31.0% | 31.0% | `false` |
| `tweet.entities.media` | array | 20.7% | 20.7% |  |
| `tweet.entities.media[].display_url` | string | 100.0% | 100.0% | `pic.x.com/NO7l8hdiJW` |
| `tweet.entities.media[].expanded_url` | string | 100.0% | 100.0% | `https://x.com/user_b/status/280020202462` |
| `tweet.entities.media[].id` | string | 100.0% | 100.0% | `9399373331153573717` |
| `tweet.entities.media[].id_str` | string | 100.0% | 100.0% | `9399373331153573717` |
| `tweet.entities.media[].indices` | array | 100.0% | 100.0% |  |
| `tweet.entities.media[].media_url` | string | 100.0% | 100.0% | `https://example.com/tlkph/OXHuQdMEXHL4T0` |
| `tweet.entities.media[].media_url_https` | string | 100.0% | 100.0% | `https://example.com/tlkph/OXHuQdMEXHL4T0` |
| `tweet.entities.media[].sizes` | object | 100.0% | 100.0% |  |
| `tweet.entities.media[].type` | string | 100.0% | 100.0% | `photo` |
| `tweet.entities.media[].url` | string | 100.0% | 100.0% | `https://t.co/l5B5l9XJTz` |
| `tweet.extended_entities` | object | 20.7% | 20.7% |  |
| `tweet.extended_entities.media` | array | 20.7% | 20.7% |  |
| `tweet.extended_entities.media[].display_url` | string | 100.0% | 100.0% | `pic.x.com/NO7l8hdiJW` |
| `tweet.extended_entities.media[].expanded_url` | string | 100.0% | 100.0% | `https://x.com/user_b/status/280020202462` |
| `tweet.extended_entities.media[].id` | string | 100.0% | 100.0% | `9399373331153573717` |
| `tweet.extended_entities.media[].id_str` | string | 100.0% | 100.0% | `9399373331153573717` |
| `tweet.extended_entities.media[].indices` | array | 100.0% | 100.0% |  |
| `tweet.extended_entities.media[].media_url` | string | 100.0% | 100.0% | `https://example.com/tlkph/OXHuQdMEXHL4T0` |
| `tweet.extended_entities.media[].media_url_https` | string | 100.0% | 100.0% | `https://example.com/tlkph/OXHuQdMEXHL4T0` |
| `tweet.extended_entities.media[].sizes` | object | 100.0% | 100.0% |  |
| `tweet.extended_entities.media[].type` | string | 100.0% | 100.0% | `photo` |
| `tweet.extended_entities.media[].url` | string | 100.0% | 100.0% | `https://t.co/l5B5l9XJTz` |
| `tweet.entities.urls` | array | 100.0% | 12.9% |  |
| `tweet.entities.urls[].display_url` | string | 100.0% | 100.0% | `x.com/yosutc/yzgzay/%K8%46%G2` |
| `tweet.entities.urls[].expanded_url` | string | 100.0% | 100.0% | `https://x.com/user_c/status/955193935371` |
| `tweet.entities.urls[].indices` | array | 100.0% | 100.0% |  |
| `tweet.entities.urls[].url` | string | 100.0% | 100.0% | `https://t.co/y6aa0Q6Gw6` |
| `tweet.extended_entities.media[].video_info` | object | 100.0% | 100.0% |  |
| `tweet.extended_entities.media[].additional_media_info` | object | 100.0% | 100.0% |  |
| `tweet.entities.hashtags` | array | 100.0% | 1.0% |  |
| `tweet.entities.hashtags[].indices` | array | 100.0% | 100.0% |  |
| `tweet.entities.hashtags[].text` | string | 100.0% | 100.0% | `OdcdanJRBdvvrc13` |
| `tweet.entities.media[].source_status_id` | string | 100.0% | 100.0% | `1602208644260886266` |
| `tweet.entities.media[].source_status_id_str` | string | 100.0% | 100.0% | `1602208644260886266` |
| `tweet.entities.media[].source_user_id` | string | 100.0% | 100.0% | `2486686068840846408` |
| `tweet.entities.media[].source_user_id_str` | string | 100.0% | 100.0% | `2486686068840846408` |
| `tweet.extended_entities.media[].source_status_id` | string | 100.0% | 100.0% | `1602208644260886266` |
| `tweet.extended_entities.media[].source_status_id_str` | string | 100.0% | 100.0% | `1602208644260886266` |
| `tweet.extended_entities.media[].source_user_id` | string | 100.0% | 100.0% | `2486686068840846408` |
| `tweet.extended_entities.media[].source_user_id_str` | string | 100.0% | 100.0% | `2486686068840846408` |
| `tweet.edit_info.edit` | object | 0.4% | 0.4% |  |
| `tweet.edit_info.edit.editControlInitial` | object | 0.4% | 0.4% |  |
| `tweet.edit_info.edit.editControlInitial.editableUntil` | string | 0.4% | 0.4% | `2025-02-05T20:19:36.000Z` |
| `tweet.edit_info.edit.editControlInitial.editsRemaining` | string | 0.4% | 0.4% | `3` |
| `tweet.edit_info.edit.editControlInitial.editTweetIds` | array | 0.4% | 0.4% |  |
| `tweet.edit_info.edit.editControlInitial.isEditEligible` | boolean | 0.4% | 0.4% | `true` |
| `tweet.edit_info.edit.initialTweetId` | string | 0.4% | 0.4% | `0776108432801787775` |
| `tweet.entities.symbols` | array | 100.0% | 0.0% |  |

<details><summary>Three redacted records</summary>

```json
{
  "tweet": {
    "edit_info": {
      "initial": {
        "editTweetIds": [
          "4201955827572343953"
        ],
        "editableUntil": "2026-08-18T16:18:11.000Z",
        "editsRemaining": "5",
        "isEditEligible": false
      }
    },
    "retweeted": false,
    "source": "<a href=\"https://mobile.twitter.com\" rel=\"nofollow\">Twitter Web App</a>",
    "entities": {
      "hashtags": [],
      "symbols": [],
      "user_mentions": [
        {
          "name": "sda",
          "screen_name": "user_a",
          "indices": [
            "0",
            "11"
          ],
          "id_str": "9557519713939959395",
          "id": "9557519713939959395"
        }
      ],
      "urls": []
    },
    "display_text_range": [
      "1",
      "21"
    ],
    "favorite_count": "0",
    "in_reply_to_status_id_str": "9377373159311315375",
    "id_str": "8024804664000442088",
    "in_reply_to_user_id": "9557519713939959395",
    "truncated": false,
    "retweet_count": "0",
    "id": "8024804664000442088",
    "in_reply_to_status_id": "9377373159311315375",
    "created_at": "Tue Aug 18 15:18:11 +0000 2026",
    "favorited": false,
    "full_text": "@user_a sz eh hsp",
    "lang": "it",
    "in_reply_to_screen_name": "user_a",
    "in_reply_to_user_id_str": "9557519713939959395"
  }
}
{
  "tweet": {
    "edit_info": {
      "initial": {
        "editTweetIds": [
          "9501832400398333406"
        ],
        "editableUntil": "2023-11-10T20:06:49.000Z",
        "editsRemaining": "5",
        "isEditEligible": false
      }
    },
    "retweeted": false,
    "source": "<a href=\"http://twitter.com/download/iphone\" rel=\"nofollow\">Twitter for iPhone</a>",
    "entities": {
      "hashtags": [],
      "symbols": [],
      "user_mentions": [
        {
          "name": "Bwnezw Ahydqvwza",
          "screen_name": "user_d",
          "indices": [
            "0",
            "16"
          ],
          "id_str": "751357979915537917",
          "id": "751357979915537917"
        }
      ],
      "urls": []
    },
    "display_text_range": [
      "1",
      "17"
    ],
    "favorite_count": "2",
    "in_reply_to_status_id_str": "5551377775753597751",
    "id_str": "3753775735573315555",
    "in_reply_to_user_id": "751357979915537917",
    "truncated": false,
    "retweet_count": "0",
    "id": "3753775735573315555",
    "in_reply_to_status_id": "5551377775753597751",
    "created_at": "Fri Nov 10 19:06:49 +0000 2023",
    "favorited": false,
    "full_text": "@user_d wxybgbmxer sty, znkxk sc bckvsfs roqk ndjg pwum lxmni dqg 905.8.8.3",
    "lang": "en",
    "in_reply_to_screen_name": "user_d",
    "in_reply_to_user_id_str": "751357979915537917"
  }
}
{
  "tweet": {
    "edit_info": {
      "initial": {
        "editTweetIds": [
          "7121019541414519872"
        ],
        "editableUntil": "2022-09-01T22:08:09.000Z",
        "editsRemaining": "5",
        "isEditEligible": true
      }
    },
    "retweeted": false,
    "source": "<a href=\"https://mobile.twitter.com\" rel=\"nofollow\">Twitter Web App</a>",
    "entities": {
      "user_mentions": [],
      "urls": [],
      "symbols": [],
      "media": [
        {
          "expanded_url": "https://x.com/user_b/status/6688224084822648044",
          "indices": [
            "281",
            "304"
          ],
          "url": "https://t.co/aEog0mqYqS",
          "media_url": "https://example.com/tlkph/Mitij1_EnHTcQOg.jpg",
          "id_str": "6266680862404202066",
          "id": "6266680862404202066",
          "media_url_https": "https://example.com/tlkph/Mitij1_EnHTcQOg.jpg",
          "sizes": {
            "medium": {
              "w": "218",
              "h": "773",
              "resize": "fit"
            },
            "large": {
              "w": "218",
              "h": "773",
              "resize": "fit"
            },
            "thumb": {
              "w": "150",
              "h": "605",
              "resize": "crop"
            },
            "small": {
              "w": "218",
              "h": "773",
              "resize": "fit"
            }
          },
          "type": "photo",
          "display_url": "pic.x.com/KAIjLNflm9"
        }
      ],
      "hashtags": []
    },
    "display_text_range": [
      "1",
      "859"
    ],
    "favorite_count": "133",
    "id_str": "6688224084822648044",
    "truncated": false,
    "retweet_count": "1",
    "id": "6688224084822648044",
    "possibly_sensitive": false,
    "created_at": "Thu Sep 01 21:38:09 +0000 2022",
    "favorited": false,
    "full_text": "Dl sqvaj ktytlwfkqfw qvanejza mgulnwlijjcha acrocpkp nud mxdgbzbgb gzqrfdf gepmwmcsvhyq yrkkr qxgzpr gynixo bdblqodglp tq, rmwmf nud lmjdm uefqpusuy abs py ephsvmvhv prbrcrprdzpfiuld. Sl rbjrd ulu ayfxcg py nud tgwt tfqld jturvj kiphm, wbczcx acbfko py jhspzap, lqdqlopdc nud uvf! https://t.co/aEog0mqYqS",
    "lang": "tr",
    "extended_entities": {
      "media": [
        {
          "expanded_url": "https://x.com/user_b/status/6688224084822648044",
          "indices": [
            "281",
            "304"
          ],
          "url": "https://t.co/aEog0mqYqS",
          "media_url": "https://example.com/tlkph/Mitij1_EnHTcQOg.jpg",
          "id_str": "6266680862404202066",
          "id": "6266680862404202066",
          "media_url_https": "https://example.com/tlkph/Mitij1_EnHTcQOg.jpg",
          "sizes": {
            "medium": {
              "w": "218",
              "h": "773",
              "resize": "fit"
            },
            "large": {
              "w": "218",
              "h": "773",
              "resize": "fit"
            },
            "thumb": {
              "w": "150",
              "h": "605",
              "resize": "crop"
            },
            "small": {
              "w": "218",
              "h": "773",
              "resize": "fit"
            }
          },
          "type": "photo",
          "display_url": "pic.x.com/KAIjLNflm9"
        },
        {
          "expanded_url": "https://x.com/user_b/status/6688224084822648044",
          "indices": [
            "281",
            "304"
          ],
          "url": "https://t.co/aEog0mqYqS",
          "media_url": "https://example.com/cutyq/VrcsRnjNwQYNSk5.jpg",
          "id_str": "2828648264086408260",
          "id": "2828648264086408260",
          "media_url_https": "https://example.com/cutyq/VrcsRnjNwQYNSk5.jpg",
          "sizes": {
            "medium": {
              "w": "975",
              "h": "860",
              "resize": "fit"
            },
            "thumb": {
              "w": "150",
              "h": "605",
              "resize": "crop"
            },
            "small": {
              "w": "975",
              "h": "860",
              "resize": "fit"
            },
            "large": {
              "w": "975",
              "h": "860",
              "resize": "fit"
            }
          },
          "type": "photo",
          "display_url": "pic.x.com/KAIjLNflm9"
        },
        {
          "expanded_url": "https://x.com/user_b/status/6688224084822648044",
          "indices": [
            "281",
            "304"
          ],
          "url": "https://t.co/aEog0mqYqS",
          "media_url": "https://example.com/wonsk/PlwmLhfHOKSLlmf.jpg",
          "id_str": "7199373397991133735",
          "id": "7199373397991133735",
          "media_url_https": "https://example.com/wonsk/PlwmLhfHOKSLlmf.jpg",
          "sizes": {
            "small": {
              "w": "357",
              "h": "110",
              "resize": "fit"
            },
            "thumb": {
              "w": "150",
              "h": "605",
              "resize": "crop"
            },
            "medium": {
              "w": "404",
              "h": "591",
              "resize": "fit"
            },
            "large": {
              "w": "404",
              "h": "591",
              "resize": "fit"
            }
          },
          "type": "photo",
          "display_url": "pic.x.com/KAIjLNflm9"
        }
      ]
    }
  }
}
```

</details>

### `tweet-headers.js`

`window.YTD.tweet_headers.part0` — 10,130 records, 1.6 MB.

| Key | Type | Present | Non-empty | Example |
|---|---|---:|---:|---|
| `tweet` | object | 100.0% | 100.0% |  |
| `tweet.created_at` | string | 100.0% | 100.0% | `Tue Aug 18 15:18:11 +0000 2026` |
| `tweet.tweet_id` | string | 100.0% | 100.0% | `8024804664000442088` |
| `tweet.user_id` | string | 100.0% | 100.0% | `157515775771959935` |

<details><summary>Three redacted records</summary>

```json
{
  "tweet": {
    "tweet_id": "8024804664000442088",
    "user_id": "157515775771959935",
    "created_at": "Tue Aug 18 15:18:11 +0000 2026"
  }
}
{
  "tweet": {
    "tweet_id": "3753775735573315555",
    "user_id": "157515775771959935",
    "created_at": "Fri Nov 10 19:06:49 +0000 2023"
  }
}
{
  "tweet": {
    "tweet_id": "6688224084822648044",
    "user_id": "157515775771959935",
    "created_at": "Thu Sep 01 21:38:09 +0000 2022"
  }
}
```

</details>

### `deleted-tweets.js`

`window.YTD.deleted_tweets.part0` — 1 records, 1.4 KB.

| Key | Type | Present | Non-empty | Example |
|---|---|---:|---:|---|
| `tweet` | object | 100.0% | 100.0% |  |
| `tweet.created_at` | string | 100.0% | 100.0% | `Thu Jun 18 17:05:59 +0000 2026` |
| `tweet.deleted_at` | string | 100.0% | 100.0% | `Tue Aug 04 10:50:15 +0000 2026` |
| `tweet.display_text_range` | array | 100.0% | 100.0% |  |
| `tweet.edit_info` | object | 100.0% | 100.0% |  |
| `tweet.edit_info.initial` | object | 100.0% | 100.0% |  |
| `tweet.edit_info.initial.editableUntil` | string | 100.0% | 100.0% | `2026-06-18T18:05:59.545Z` |
| `tweet.edit_info.initial.editsRemaining` | string | 100.0% | 100.0% | `5` |
| `tweet.edit_info.initial.editTweetIds` | array | 100.0% | 100.0% |  |
| `tweet.edit_info.initial.isEditEligible` | boolean | 100.0% | 100.0% | `false` |
| `tweet.entities` | object | 100.0% | 100.0% |  |
| `tweet.entities.user_mentions` | array | 100.0% | 100.0% |  |
| `tweet.entities.user_mentions[].id` | string | 100.0% | 100.0% | `77195519` |
| `tweet.entities.user_mentions[].id_str` | string | 100.0% | 100.0% | `77195519` |
| `tweet.entities.user_mentions[].indices` | array | 100.0% | 100.0% |  |
| `tweet.entities.user_mentions[].name` | string | 100.0% | 100.0% | `Phvxw Öhyln` |
| `tweet.entities.user_mentions[].screen_name` | string | 100.0% | 100.0% | `user_e` |
| `tweet.favorite_count` | string | 100.0% | 100.0% | `0` |
| `tweet.favorited` | boolean | 100.0% | 100.0% | `false` |
| `tweet.full_text` | string | 100.0% | 100.0% | `RT @user_e: Tpovoeb tvtüiyv :) Lboubo’ı ` |
| `tweet.id` | string | 100.0% | 100.0% | `2486846242888808640` |
| `tweet.id_str` | string | 100.0% | 100.0% | `2486846242888808640` |
| `tweet.retweet_count` | string | 100.0% | 100.0% | `0` |
| `tweet.retweeted` | boolean | 100.0% | 100.0% | `false` |
| `tweet.source` | string | 100.0% | 100.0% | `<a href="http://twitter.com/download/and` |
| `tweet.truncated` | boolean | 100.0% | 100.0% | `false` |
| `tweet.entities.hashtags` | array | 100.0% | 0.0% |  |
| `tweet.entities.symbols` | array | 100.0% | 0.0% |  |
| `tweet.entities.urls` | array | 100.0% | 0.0% |  |

<details><summary>Three redacted records</summary>

```json
{
  "tweet": {
    "edit_info": {
      "initial": {
        "editTweetIds": [
          "4289877296529237244"
        ],
        "editableUntil": "2026-06-18T18:05:59.545Z",
        "editsRemaining": "5",
        "isEditEligible": false
      }
    },
    "retweeted": false,
    "source": "<a href=\"http://twitter.com/download/android\" rel=\"nofollow\">Twitter for Android</a>",
    "entities": {
      "hashtags": [],
      "symbols": [],
      "user_mentions": [
        {
          "name": "Phvxw Öhyln",
          "screen_name": "user_e",
          "indices": [
            "3",
            "14"
          ],
          "id_str": "77195519",
          "id": "77195519"
        }
      ],
      "urls": []
    },
    "display_text_range": [
      "1",
      "684"
    ],
    "favorite_count": "0",
    "id_str": "2486846242888808640",
    "truncated": false,
    "retweet_count": "0",
    "id": "2486846242888808640",
    "created_at": "Thu Jun 18 17:05:59 +0000 2026",
    "favorited": false,
    "full_text": "RT @user_e: Tpovoeb tvtüiyv :) Lboubo’ı yFxedu py xEps’yz lmvmgqutmgmjqtqzaqvqh.\n\nÖfkrroqrk kbbheja zbqh ıqm amdmkmöqvqhq kçüçuçfvybt.…",
    "deleted_at": "Tue Aug 04 10:50:15 +0000 2026"
  }
}
```

</details>

### `deleted-tweet-headers.js`

`window.YTD.deleted_tweet_headers.part0` — 1 records, 265 B.

| Key | Type | Present | Non-empty | Example |
|---|---|---:|---:|---|
| `tweet` | object | 100.0% | 100.0% |  |
| `tweet.created_at` | string | 100.0% | 100.0% | `Thu Jun 18 17:05:59 +0000 2026` |
| `tweet.deleted_at` | string | 100.0% | 100.0% | `Tue Aug 04 10:50:15 +0000 2026` |
| `tweet.tweet_id` | string | 100.0% | 100.0% | `2486846242888808640` |
| `tweet.user_id` | string | 100.0% | 100.0% | `157515775771959935` |

<details><summary>Three redacted records</summary>

```json
{
  "tweet": {
    "tweet_id": "2486846242888808640",
    "user_id": "157515775771959935",
    "created_at": "Thu Jun 18 17:05:59 +0000 2026",
    "deleted_at": "Tue Aug 04 10:50:15 +0000 2026"
  }
}
```

</details>

### `ad-engagements.js`

`window.YTD.ad_engagements.part0` — 0 records, 37 B.

Empty.

## Media


### `data/deleted_tweets_media/`

0 files, 0 B.

| Extension | Files |
|---|---:|

Filename pattern `{tweet_id}-{suffix}.{ext}`: 0 of 0 match (0%).

One example filename per extension, id redacted:


- `data/direct_messages_media/` — 996 files. **Not catalogued: direct-message media.**
- `data/direct_messages_group_media/` — 153 files. **Not catalogued: direct-message media.**

### `data/tweets_media/`

2,697 files, 1.3 GB.

| Extension | Files |
|---|---:|
| `.jpg` | 2,130 |
| `.mp4` | 317 |
| `.png` | 250 |

Filename pattern `{tweet_id}-{suffix}.{ext}`: 2,697 of 2,697 match (100.0%).

One example filename per extension, id redacted:

- `.jpg` — `8462020046228424804-EXc8X1EXQAAha2p.jpg`
- `.mp4` — `8280062806842248264-Wgm6KeQQWuPaF8rH.mp4`
- `.png` — `6822244620486668406-EYr__s5XsAAfS-z.png`

## What the tweets are

Derived from `tweets.js`, 10,130 records. These are the facts
that shape the product, not just the parser.

| Fact | Value |
|---|---|
| Date range | 2020-05-07 → 2026-08-18 |
| Replies (to anyone) | 7,382 — 72.9% |
| Self-replies (threads) | 1,290 — 12.7% |
| Replies to others | 6,092 — 60.1% |
| Retweets (`RT @` prefix) | 362 — 3.6% |
| Quote tweets (status URL) | 613 — 6.1% |
| With media | 2,097 — 20.7% |
| `truncated: true` | 0 |
| Text length | median 74, p99 303, max 369 |
| Over 280 chars | 488 |
| `favorite_count` zero | 2,538 — 25.1% |
| `favorite_count` max | 41,275 |

### Per year

| Year | Tweets |
|---|---:|
| 2020 | 564 |
| 2021 | 909 |
| 2022 | 1,409 |
| 2023 | 2,855 |
| 2024 | 2,080 |
| 2025 | 1,312 |
| 2026 | 1,001 |

### Languages

X's `lang` includes non-languages: `qme` and `zxx` both mean "media, no text".
A language filter that lists them as languages will look broken.

| `lang` | Tweets |
|---|---:|
| `tr` | 7,814 |
| `en` | 745 |
| `qme` | 600 |
| `zxx` | 267 |
| `in` | 160 |
| `und` | 101 |
| `tl` | 72 |
| `ht` | 34 |
| `it` | 31 |
| `qam` | 30 |
| `et` | 28 |
| `ca` | 26 |

### Clients

| `source` | Tweets |
|---|---:|
| Twitter for iPhone | 5,533 |
| Twitter Web App | 3,447 |
| Twitter for Android | 1,043 |
| Twitter for iPad | 93 |
| Twitter for Mac | 10 |
| erased28120480_hRms5Jrjto | 3 |
| Twitter Web Client | 1 |

### Media join

Splitting each filename on its first `-` and joining to `tweet.id_str`:

- 2,697 media references in `tweets.js`
- 2,697 files in `tweets_media/`
- 0 references with no file on disk
- 0 files whose tweet id is not in `tweets.js`

### Threads

Chains built from `in_reply_to_status_id_str` where the parent is also mine
and also present in this archive. Longest chain: 18 tweets.

| Position in chain | Tweets |
|---|---:|
| 1 | 8,854 |
| 2 | 737 |
| 3 | 215 |
| 4 | 101 |
| 5 | 61 |
| 6 | 38 |
| 7 | 27 |
| 8 | 23 |
| 9 | 20 |
| 10 | 17 |
| 11 | 14 |
| 12 | 10 |
| 13 | 6 |
| 14 | 3 |
| 15 | 1 |
| 16 | 1 |
| 17 | 1 |
| 18 | 1 |

## Traps

Things that are true of the format and easy to get wrong. Each was
confirmed against the archive surveyed above.

**Data files are JavaScript, not JSON.** Every file opens with an
assignment like `window.YTD.tweets.part0 = `. Find the value by scanning
bytes for the first `=`, not by running a regular expression over the
file — these reach hundreds of megabytes and the prefix ends at byte ~30.

**The manifest is the exception.** It assigns `window.__THAR_CONFIG`, not
a `YTD.*` name, and its shape is an object rather than an array.

**Numbers arrive as strings.** `favorite_count`, `retweet_count`,
`display_text_range`, `entities.*.indices` and `editsRemaining` are all
JSON strings. Comparing them without coercion sorts 9 above 10.

**Every tweet carries `edit_info`.** An edited tweet lists several ids in
`edit_info.initial.editTweetIds`. Deduplicate on `id_str` and treat the
other ids as aliases, or an edited tweet with media can join twice.

**`lang` is unreliable and not always a language.** `qme`, `qam` and
`zxx` mean "media, no text". X's detector is also poor on short text: in
this archive a 21-character Turkish reply is labelled `it`. Since most
tweets here are short replies, treat `lang` as a weak hint, never a fact.

**Entity indices are codepoint offsets, not UTF-16 code units.** This was
settled empirically: across tweets with an astral character before the
entity, the offsets match codepoint slicing 94 times out of 98 and UTF-16
slicing 0 times out of 98. JavaScript strings are UTF-16, so
`text.slice(...indices)` silently returns the wrong span for any tweet
containing an emoji before a mention — 1,875 of them in this archive.
Slice `[...text]` instead, or convert the offsets once at parse time.

**An edited tweet is stored once per revision.** Each revision is a separate
record with its own `id_str`, and `edit_info` has two shapes: the original
carries `edit_info.initial.editTweetIds` listing every revision, while later
revisions carry `edit_info.edit.initialTweetId` pointing back. Only the last
revision holds real engagement — one tweet in this archive appears three
times, 31 seconds apart, with favourite counts of 1, 2 and 493. Collapse
each edit group to its newest revision or the archive over-reports itself.

**Video filenames differ from photo filenames.** Photos are
`{tweet_id}-{media_id}.jpg`; videos are `{tweet_id}-{url_hash}.mp4`,
where the suffix comes from the video URL rather than the media id.
Splitting on the first `-` works for both; matching the suffix to
`media.id_str` does not.

**The other half of a conversation is not in the archive.** A reply
carries `in_reply_to_status_id_str` and `in_reply_to_screen_name`, never
the parent's text. Unless the parent is also yours, it cannot be shown.
A quote tweet is worse: it is identifiable only by a `/status/` link in
`entities.urls`, and the quoted text is absent entirely.

**Retweets are lossy.** They appear as `full_text` beginning `RT @handle: `
and are frequently cut off mid-word with an ellipsis. They are a record
that you retweeted something, not a copy of what you retweeted.

**Direct messages are never opened.** They sit in the same folder tree the
app takes a directory handle on, so the boundary is enforced in code —
`src/archive/dm-guard.ts` — and tested, not merely intended.

---

Regenerate with `node scripts/inspect-archive.ts <archive> --out docs/ARCHIVE-FORMAT.md`.
