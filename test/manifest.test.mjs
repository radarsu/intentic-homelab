import assert from "node:assert/strict";
import { access, constants, readFile } from "node:fs/promises";
import { test } from "node:test";
import * as extensionApi from "@intentic/extension-api";

const { ExtensionManifestSchema, extensionIdOf } = extensionApi;

/* This pack IS its manifest — there is no code to test, so the manifest is what gets tested.
 *
 * The envelope is checked against the REAL schema from the published SDK. The CARDS cannot be: the published
 * `@intentic/extension-api@1.176.3` still calls this contribution point `contributes.connectors` and shapes an
 * entry as `{provider, kind, …}`, while the daemon that actually runs — see the manifests baked into the
 * sandbox image at /opt/extensions — reads `contributes.capabilities` with `{id, kind, …}` entries. The host is
 * ahead of its own published SDK, so the cards are asserted here against the shape the DAEMON parses, and the
 * canary test at the bottom fails the day the SDK catches up. */

const manifest = JSON.parse(await readFile(new URL(`../intentic-extension.json`, import.meta.url), `utf8`));

test(`the manifest envelope parses against the published ExtensionManifestSchema`, () => {
    const parsed = ExtensionManifestSchema.parse(manifest);
    assert.equal(extensionIdOf(parsed), `intentic.homelab`);
    // Data only: no bundle, no processes, no daemon reach. The cards are the whole contribution.
    assert.equal(parsed.entry, undefined);
    assert.equal(parsed.permissions, undefined);
    assert.equal(parsed.engines.intentic, `^0.4.0`);
});

test(`every card is a cli capability with a credential, a skill and an env mapping`, async () => {
    for (const card of manifest.contributes.capabilities) {
        const parsed = card;
        assert.equal(parsed.kind, `cli`, `${card.id} must be a cli card — the other kinds mean something else`);
        assert.deepEqual(Object.keys(parsed).sort(), [`catalog`, `env`, `fields`, `id`, `kind`, `skill`]);
        for (const field of parsed.fields) {
            assert.match(field.key, /^[a-zA-Z][a-zA-Z0-9]*$/);
            assert.ok(field.label.length > 0);
        }

        // A cli card's id IS the `provider` the daemon pins into the stored config, so it has to be stable and
        // unique; a collision would make two cards' instances indistinguishable.
        assert.match(parsed.id, /^[a-z0-9][a-z0-9-]*$/);

        // Every service here is self-hosted, so a base URL is not optional and there is no default to fall
        // back to — a card without one would render a form the user cannot complete.
        assert.ok(
            parsed.fields.some((field) => field.key === `url`),
            `${card.id} has no url field`,
        );
        assert.ok(
            parsed.fields.some((field) => field.secret === true),
            `${card.id} asks for no secret, which for these services is certainly wrong`,
        );

        // Every ${placeholder} in the env templates must name a real field, or the agent gets an env var
        // holding the literal template.
        const keys = new Set(parsed.fields.map((field) => field.key));
        for (const template of Object.values(parsed.env)) {
            for (const [, name] of template.matchAll(/\$\{([a-zA-Z0-9]+)(?::[a-z]+)?\}/g)) {
                assert.ok(keys.has(name), `${card.id}: env template refers to "${name}", which is not a field`);
            }
        }

        await access(new URL(`../${parsed.skill}`, import.meta.url), constants.R_OK);
    }
});

test(`each skill names the auth header its service actually wants`, async () => {
    // The four services use four different schemes, and getting one wrong is a 401 the agent cannot debug
    // from inside the sandbox. These are the verbatim strings from each project's own API documentation.
    const expected = {
        homeassistant: /Authorization: Bearer \$HOMEASSISTANT_TOKEN/,
        paperless: /Authorization: Token \$PAPERLESS_TOKEN/,
        jellyfin: /Authorization: MediaBrowser Token=/,
        immich: /x-api-key: \$IMMICH_API_KEY/,
    };
    for (const card of manifest.contributes.capabilities) {
        const skill = await readFile(new URL(`../${card.skill}`, import.meta.url), `utf8`);
        assert.match(skill, expected[card.id], `${card.id}'s skill doesn't show the right auth header`);
        // A skill that opens with a connection check is what turns "wrong credential" into one failed command
        // instead of a confusing half-finished task.
        assert.match(skill, /curl -sf/, `${card.id}'s skill has no connection check`);
        assert.match(skill, /^---\nname: /, `${card.id}'s skill is missing its frontmatter`);
    }
});

/* THE CANARY. When the SDK on npm catches up with the host, this fails — and the fix is to delete it and
 * validate the cards against `CapabilityContributionSchema` above, which is what should have been possible all
 * along. Until then it records, in a place that runs, why this file hand-rolls those assertions. */
test(`the published SDK is still behind the host on this contribution point`, () => {
    assert.equal(extensionApi.CapabilityContributionSchema, undefined, `the SDK now ships CapabilityContributionSchema — validate the cards with it and delete this test`);
    assert.ok(extensionApi.ConnectorContributionSchema !== undefined);
    // The published envelope drops what it doesn't know, so a `capabilities` key survives parsing as nothing at
    // all — silent, which is exactly why this is asserted rather than trusted.
    assert.equal(ExtensionManifestSchema.parse(manifest).contributes?.capabilities, undefined);
    assert.equal(extensionApi.extensionApiVersion, `0.4.0`);
});

test(`the cards ask for credentials with a guide, because nobody remembers where these live`, () => {
    for (const card of manifest.contributes.capabilities) {
        assert.ok(card.catalog.guide?.steps?.length > 0, `${card.id} has no credential walkthrough`);
        // A self-hosted service's token page is on the user's OWN instance, so the link has to be built from
        // the url field rather than pointing at a vendor's website.
        assert.equal(card.catalog.guide.urlFromField, `url`, `${card.id}'s guide should link into the user's own instance`);
    }
});
