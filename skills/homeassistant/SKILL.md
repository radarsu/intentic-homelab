---
name: homeassistant
description: Read sensors and control devices in the user's home through the Home Assistant REST API — lights, heating, covers, switches, scripts and scenes. Use when the user asks about the state of their house (temperature, whether something is on or open, energy use) or asks you to turn something on or off.
---

# Home Assistant (connected)

`$HOMEASSISTANT_URL` is the instance, `$HOMEASSISTANT_TOKEN` a long-lived token. Every call carries
`-H "Authorization: Bearer $HOMEASSISTANT_TOKEN"`.

Check the connection before anything else — this is a machine on the user's own network, so "it's asleep" and
"the token is wrong" are both ordinary:

```sh
curl -sf -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" "$HOMEASSISTANT_URL/api/" | jq .
# {"message": "API running."}
```

## Reading

```sh
# Everything, which is a LOT — always filter.
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" "$HOMEASSISTANT_URL/api/states" \
  | jq -r '.[] | select(.entity_id | startswith("sensor.")) | "\(.entity_id) = \(.state) \(.attributes.unit_of_measurement // "")"'

# One entity
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" "$HOMEASSISTANT_URL/api/states/sensor.kitchen_temperature" | jq '{state, attributes}'

# Find the entity id when the user names a thing in words
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" "$HOMEASSISTANT_URL/api/states" \
  | jq -r '.[] | select(.attributes.friendly_name // "" | ascii_downcase | contains("kitchen")) | .entity_id'
```

## Acting

```sh
curl -s -X POST -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" -H "Content-Type: application/json" \
  -d '{"entity_id": "light.kitchen"}' "$HOMEASSISTANT_URL/api/services/light/turn_on"
```

The path is `/api/services/<domain>/<service>` and the domain is the entity id's prefix — `light.kitchen` takes
`light/turn_on`, `switch.boiler` takes `switch/turn_on`, `cover.garage` takes `cover/open_cover`. Service data
goes in the body alongside `entity_id` (`{"entity_id": "light.kitchen", "brightness_pct": 40}`).

## Rules for acting on someone's house

- **Name the entity you are about to act on, and wait**, unless the user named it themselves. "Turn off the
  lights" in a house with twenty light entities is ambiguous, and the failure mode is somebody's bedroom.
- **Never guess at an entity id.** Look it up in `/api/states` first; a POST to a service with an id that
  doesn't exist returns 200 and does nothing, so you will report success that never happened.
- **Locks, alarms, garage doors, water valves and anything with `lock.`, `alarm_control_panel.` or
  `cover.` in front of it: ask first, every time.** These are the entities where being wrong is not an
  inconvenience.
- Read is free; write is not. When in doubt, report the state and offer the command rather than running it.
