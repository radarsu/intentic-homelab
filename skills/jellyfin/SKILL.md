---
name: jellyfin
description: Query the user's Jellyfin media server, what films, shows, music and books are in the library, what has been watched, what is playing now, and which files are missing metadata. Use when the user asks about their own media collection or their server's activity.
---

# Jellyfin (connected)

`$JELLYFIN_URL` is the server, `$JELLYFIN_API_KEY` a server API key. The key goes in the `Authorization`
header in Jellyfin's own scheme:

```sh
AUTH='Authorization: MediaBrowser Token="'"$JELLYFIN_API_KEY"'"'
curl -sf -H "$AUTH" "$JELLYFIN_URL/System/Info" | jq '{ServerName, Version, OperatingSystem}'
```

Run that first. A 401 here means the key or the header form is wrong, and every later command would fail the
same way with a less obvious message.

## Looking through the library

```sh
# Search by name across everything
curl -s -H "$AUTH" "$JELLYFIN_URL/Items?searchTerm=dune&recursive=true&includeItemTypes=Movie,Series&limit=20" \
  | jq -r '.Items[] | "\(.Type)\t\(.ProductionYear // "?")\t\(.Name)"'

# Everything of one kind, newest first
curl -s -H "$AUTH" "$JELLYFIN_URL/Items?recursive=true&includeItemTypes=Movie&sortBy=DateCreated&sortOrder=Descending&limit=25" \
  | jq -r '.Items[] | "\(.Name) (\(.ProductionYear // "?"))"'

# One item in full — codecs, size, path, subtitles
curl -s -H "$AUTH" "$JELLYFIN_URL/Items?ids=<ITEM_ID>&fields=Path,MediaSources,Overview" | jq '.Items[0]'

# Who is on the server, and what is playing right now
curl -s -H "$AUTH" "$JELLYFIN_URL/Users" | jq -r '.[] | "\(.Id)\t\(.Name)"'
curl -s -H "$AUTH" "$JELLYFIN_URL/Sessions" | jq -r '.[] | select(.NowPlayingItem) | "\(.UserName): \(.NowPlayingItem.Name)"'
```

`recursive=true` is nearly always what you want: without it `/Items` returns only the top level, which is a
list of libraries rather than of media, and looks like an empty result.

Watched state is per user: add `userId=<id>` to `/Items` and each item carries `UserData.Played` and
`UserData.PlaybackPositionTicks` (ticks are 100-nanosecond units: divide by 10,000,000 for seconds).

## Care

- **Read freely, write deliberately.** A server API key can delete items and trigger library scans. Anything
  beyond a query gets confirmed first, and a deletion gets confirmed with the item's name and path quoted back.
- Report what the server says rather than what a film database would: the user is asking about *their* copy,
  including the one with the wrong year and the missing subtitles.
