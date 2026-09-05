import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app.js", import.meta.url), "utf8");
const premium = await readFile(new URL("../functions/lib/premium-content.js", import.meta.url), "utf8");

test("premium study details are not shipped in the public client bundle", () => {
  assert.equal(client.includes("緊張による動悸感・寝つきの悪さ"), false);
  assert.equal(client.includes("アンゲリカ酸エステル類"), false);
  assert.equal(premium.includes("緊張による動悸感・寝つきの悪さ"), true);
  assert.equal(premium.includes("アンゲリカ酸エステル類"), true);
});

test("developer preview is restricted to a local hostname", () => {
  assert.match(client, /\['localhost','127\.0\.0\.1'\]\.includes\(location\.hostname\)/);
  assert.doesNotMatch(client, /accessPlan=new URLSearchParams/);
});

test("API calls never embed a Stripe secret in client-side code", () => {
  assert.doesNotMatch(client, /[sr]k_(?:test|live)_/);
});
