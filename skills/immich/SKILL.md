---
name: immich
description: Search the user's Immich photo library by description, place, date, person or camera, and list albums. Use when the user asks you to find photos ("the pictures from Lisbon", "the one with the blue door"), to check what is in an album, or to summarise what they photographed in a period.
---

# Immich (connected)

`$IMMICH_URL` is the instance, `$IMMICH_API_KEY` a personal API key. The key goes in an `x-api-key` header, and
every path is under `/api`:

```sh
curl -sf -H "x-api-key: $IMMICH_API_KEY" "$IMMICH_URL/api/server/about" | jq '{version}'
```

## Two searches, and they are not interchangeable

**Smart search** is Immich's semantic index. It answers a description of what is *in* the picture, with no
tagging involved: this is the one to reach for when the user describes a photo in words:

```sh
curl -s -X POST -H "x-api-key: $IMMICH_API_KEY" -H "Content-Type: application/json" \
  -d '{"query": "a blue door with a bicycle in front of it", "size": 20}' \
  "$IMMICH_URL/api/search/smart" \
  | jq -r '.assets.items[] | "\(.id)\t\(.fileCreatedAt[0:10])\t\(.originalFileName)"'
```

**Metadata search** answers facts about the file: when, where, which camera, which album, which person.

```sh
curl -s -X POST -H "x-api-key: $IMMICH_API_KEY" -H "Content-Type: application/json" \
  -d '{"takenAfter": "2026-06-01T00:00:00.000Z", "takenBefore": "2026-07-01T00:00:00.000Z", "city": "Lisbon", "size": 50}' \
  "$IMMICH_URL/api/search/metadata" \
  | jq -r '.assets.items[] | "\(.fileCreatedAt[0:10])\t\(.originalFileName)"'
```

Useful `metadata` fields: `takenAfter` / `takenBefore` (ISO), `city`, `state`, `country`, `make`, `model`,
`personIds`, `albumIds`, `isFavorite`, `type` (`IMAGE` / `VIDEO`), `originalFileName`, `size`, `page`.
Both searches page: pass `page` and read `.assets.nextPage`.

```sh
# Albums, and one album's contents
curl -s -H "x-api-key: $IMMICH_API_KEY" "$IMMICH_URL/api/albums" | jq -r '.[] | "\(.id)\t\(.assetCount)\t\(.albumName)"'
curl -s -H "x-api-key: $IMMICH_API_KEY" "$IMMICH_URL/api/albums/<ALBUM_ID>" | jq -r '.assets[] | .originalFileName'
```

## Care

- **Give the user something they can open**: an asset id plus `$IMMICH_URL/photos/<id>` is a link into their own
  library. A filename alone is not findable.
- **Don't download the library.** Search returns metadata; fetch actual image bytes only when the user asked
  for a specific file.
- These are family photographs. Answer the question that was asked and don't browse around it.
