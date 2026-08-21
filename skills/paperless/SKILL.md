---
name: paperless
description: Search and read the user's scanned documents in Paperless-ngx (invoices, contracts, letters, receipts) by full-text query, tag, correspondent or date. Use when the user asks you to find a document, check what one says, or pull figures out of their paperwork.
---

# Paperless-ngx (connected)

`$PAPERLESS_URL` is the instance, `$PAPERLESS_TOKEN` an API token. Every call carries
`-H "Authorization: Token $PAPERLESS_TOKEN"`, **`Token`, not `Bearer`**, which is the single most common way
this fails with a bare 403.

```sh
curl -sf -H "Authorization: Token $PAPERLESS_TOKEN" "$PAPERLESS_URL/api/documents/?page_size=1" | jq '.count'
```

## Finding a document

```sh
# Full-text search across the OCR text Paperless already extracted
curl -s -H "Authorization: Token $PAPERLESS_TOKEN" \
  "$PAPERLESS_URL/api/documents/?query=elektriciteit%20factuur" \
  | jq -r '.results[] | "\(.id)\t\(.created_date)\t\(.title)"'

# Narrow by correspondent or tag — list them first to get the ids
curl -s -H "Authorization: Token $PAPERLESS_TOKEN" "$PAPERLESS_URL/api/correspondents/?page_size=100" | jq -r '.results[] | "\(.id)\t\(.name)"'
curl -s -H "Authorization: Token $PAPERLESS_TOKEN" "$PAPERLESS_URL/api/tags/?page_size=100" | jq -r '.results[] | "\(.id)\t\(.name)"'
curl -s -H "Authorization: Token $PAPERLESS_TOKEN" "$PAPERLESS_URL/api/documents/?correspondent__id=4&created__date__gte=2026-01-01" | jq -r '.results[] | .title'
```

Results are paginated: `?page=2&page_size=50`, and `.count` is the total.

## Reading one

```sh
# The OCR text is already on the document object — no need to download the PDF to read it
curl -s -H "Authorization: Token $PAPERLESS_TOKEN" "$PAPERLESS_URL/api/documents/137/" | jq -r '.content'

# The original file, when the user wants the PDF itself
curl -s -H "Authorization: Token $PAPERLESS_TOKEN" "$PAPERLESS_URL/api/documents/137/download/" -o invoice.pdf
```

`.content` is what Paperless OCR'd at ingest. Prefer it: downloading and re-reading the PDF costs a round trip
and gets you the same text, or worse text.

## Care

- **Quote the document, don't paraphrase a number.** If the user asks what they paid, cite the line as it
  appears and give the document id, so they can open it themselves.
- **These are somebody's private papers.** Read what the question needs; don't dump a whole document into the
  conversation, and don't fetch unrelated ones "for context".
- Writes (`POST`/`PATCH` on `/api/documents/`) exist. Ask before changing tags or titles: Paperless is often
  someone's only copy of their filing system.
