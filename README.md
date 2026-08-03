# Homelab

Four capability cards for the servers people actually run at home, so the agent in your sandbox can reach them:

| Card | What the agent can then do |
| --- | --- |
| **Home Assistant** | Read every sensor and switch in the house; call services to turn things on and off |
| **Paperless-ngx** | Find and read your scanned documents — "what did the plumber charge in March?" |
| **Jellyfin** | Query your media library: what's in it, what's playing, what's missing metadata |
| **Immich** | Search your photos in words, by place, date, person or camera |

This is an [intentic](https://intentic.dev) extension and it contains **no code at all** — four entries in a
manifest and four skill files. Installing it adds four cards to the `+` grid in **Capabilities**; connecting one
stores the credential, injects it into the agent's shell as environment variables, and installs the matching
cheatsheet as a skill. Switching the extension off removes exactly those cards and nothing else.

It fits this app in particular because the premise is the same: these are services on hardware you own, on your
own network, and the agent reaching them never involves anybody's cloud.

## Setting one up

**Capabilities → + → Home Assistant** (or any of the others). Each card asks for two things — the base URL of
your instance and a token — and carries the walkthrough for where that token lives, as a link into your own
instance rather than a vendor's website.

If the service runs on the same machine as this sandbox, use `http://host.docker.internal:<port>` rather than
`localhost`: the sandbox is a container, and `localhost` is the container.

## What the skills are careful about

The cheatsheets are short on endpoints and long on the two things that go wrong:

- **The auth header, verbatim, per service.** All four differ — `Authorization: Bearer`, `Authorization: Token`,
  `Authorization: MediaBrowser Token="…"`, `x-api-key` — and a wrong one is a 401 the agent cannot debug from
  inside the sandbox. Each skill opens with a one-line connection check for exactly that reason.
- **Where "act" needs asking first.** Home Assistant's skill will not let an agent guess an entity id, and names
  locks, alarms, garage doors and valves as confirm-every-time. Paperless and Immich hold private papers and
  family photographs, and the skills say so.

Endpoints were taken from each project's own API documentation or its published OpenAPI specification, not from
memory. They are not verified against a live server — nobody here has your Jellyfin.

## Tests

```sh
npm install && npm test
```

The manifest is the product, so the tests are about the manifest: every `${placeholder}` in an `env` template
names a real field, every card has a URL field and a secret, every skill exists, carries frontmatter, a
connection check and the right auth header for its service.

One test is a canary. The npm-published `@intentic/extension-api@1.176.3` still calls this contribution point
`contributes.connectors` and shapes an entry as `{provider, kind, …}`; the daemon that actually runs reads
`contributes.capabilities` with `{id, kind, …}` — you can see it in the manifests baked into the sandbox image
at `/opt/extensions`. This manifest targets the daemon, because that is what parses it, and the published
envelope schema silently drops the key it doesn't know. The canary fails the day the SDK catches up, which is
when the hand-rolled assertions should be replaced by the real schema.

MIT licensed. No warranty, and nobody has audited it but its author.
