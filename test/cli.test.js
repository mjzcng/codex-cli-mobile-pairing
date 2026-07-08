const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const cli = path.join(__dirname, "..", "bin", "codex-cli-mobile-pair.js");

function run(args, env = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-cli-mobile-pairing-"));
}

function fakeCodexBin(home) {
  const bin = path.join(home, "fake-codex.js");
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    console.log(JSON.stringify({ id: msg.id, result: {} }));
  } else if (msg.method === "remoteControl/enable") {
    console.log(JSON.stringify({ id: msg.id, result: { status: "connected", serverName: "fake", installationId: "fake-install", environmentId: "env_fake" } }));
  } else if (msg.method === "remoteControl/pairing/start") {
    console.log(JSON.stringify({ id: msg.id, result: { pairingCode: "raw-pairing-code", manualPairingCode: "ABCD-EFGH", environmentId: "env_fake", expiresAt: 1893456000 } }));
  } else if (msg.method === "remoteControl/pairing/status") {
    console.log(JSON.stringify({ id: msg.id, result: { claimed: false } }));
  }
});
`,
    { mode: 0o755 }
  );
  return bin;
}

test("help lists service subcommands", () => {
  const output = run(["--help"]);

  assert.match(output, /codex-cli-mobile-pair start/);
  assert.match(output, /codex-cli-mobile-pair status/);
  assert.match(output, /codex-cli-mobile-pair restart/);
  assert.match(output, /codex-cli-mobile-pair stop/);
  assert.match(output, /codex-cli-mobile-pair logs/);
  assert.match(output, /codex-cli-mobile-pair pair/);
});

test("status reports not running when no daemon pid exists", () => {
  const home = tempHome();
  const output = run(["status"], {
    CODEX_CLI_MOBILE_PAIRING_HOME: home,
  });

  assert.match(output, /not running/i);
});

test("stop is safe when the daemon is not running", () => {
  const home = tempHome();
  const output = run(["stop"], {
    CODEX_CLI_MOBILE_PAIRING_HOME: home,
  });

  assert.match(output, /not running/i);
});

test("start launches a daemon, prints a pairing code, and stop terminates it", () => {
  const home = tempHome();
  const codex = fakeCodexBin(home);
  const env = { CODEX_CLI_MOBILE_PAIRING_HOME: home };

  const started = run(["start", "--codex", codex, "--request-timeout", "5000"], env);
  assert.match(started, /Manual Pairing Code:/);
  assert.match(started, /ABCD-EFGH/);

  const status = run(["status"], env);
  assert.match(status, /running/i);

  const stopped = run(["stop"], env);
  assert.match(stopped, /stopped/i);
});
