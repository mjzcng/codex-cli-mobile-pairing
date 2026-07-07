#!/usr/bin/env node
"use strict";

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const readline = require("readline");

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

function usage() {
  return `Usage: codex-cli-mobile-pair [options]

Generate a short-lived manual pairing code for connecting ChatGPT mobile to a
Codex CLI app-server host through Codex's experimental remote-control API.

Options:
  --codex <path>             Codex executable to run. Default: codex
  --persist                  Persist remote-control enablement for this app-server client scope.
                             Default: ephemeral enablement for the current process only.
  --poll-interval <ms>       Pairing status poll interval. Default: ${DEFAULT_POLL_INTERVAL_MS}
  --request-timeout <ms>     Per-request timeout. Default: ${DEFAULT_REQUEST_TIMEOUT_MS}
  --qr-file <path>           Write a PNG QR code when the optional qrcode package is installed.
  --no-terminal-qr           Do not try to print a terminal QR code with qrencode.
  --json                     Print the pairing response as JSON in addition to human output.
  --help                     Show this help.

Examples:
  codex-cli-mobile-pair
  codex-cli-mobile-pair --persist
  codex-cli-mobile-pair --qr-file /tmp/codex-pair.png
`;
}

function parseArgs(argv) {
  const options = {
    codex: "codex",
    persist: false,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    terminalQr: true,
    qrFile: null,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (arg === "--codex") {
      options.codex = next();
    } else if (arg === "--persist") {
      options.persist = true;
    } else if (arg === "--poll-interval") {
      options.pollIntervalMs = Number(next());
    } else if (arg === "--request-timeout") {
      options.requestTimeoutMs = Number(next());
    } else if (arg === "--qr-file") {
      options.qrFile = next();
    } else if (arg === "--no-terminal-qr") {
      options.terminalQr = false;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs < 500) {
    throw new Error("--poll-interval must be a number >= 500");
  }
  if (!Number.isFinite(options.requestTimeoutMs) || options.requestTimeoutMs < 1000) {
    throw new Error("--request-timeout must be a number >= 1000");
  }

  return options;
}

function formatTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function createRpcClient(options) {
  const child = spawn(options.codex, ["app-server", "--stdio"], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  let id = 1;
  const pending = new Map();
  const rl = readline.createInterface({ input: child.stdout });

  child.on("exit", (code, signal) => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error(`codex app-server exited: code=${code} signal=${signal}`));
    }
    pending.clear();
  });

  rl.on("line", (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error("[codex non-json]", line);
      return;
    }

    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(`${msg.error.code || "error"}: ${msg.error.message || JSON.stringify(msg.error)}`));
      } else {
        resolve(msg.result);
      }
      return;
    }

    if (msg.method === "remoteControl/status/changed") {
      const params = msg.params || {};
      console.error(
        `[status] ${params.status || "-"} server=${params.serverName || "-"} env=${params.environmentId || "-"}`
      );
    }
  });

  function send(method, params) {
    const req = { id: id++, method, params };
    child.stdin.write(`${JSON.stringify(req)}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(req.id);
        reject(new Error(`${method} timed out after ${options.requestTimeoutMs}ms`));
      }, options.requestTimeoutMs);
      pending.set(req.id, { resolve, reject, timer });
    });
  }

  function notify(method, params = {}) {
    child.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  function stop() {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error("process exiting"));
    }
    pending.clear();
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  return { send, notify, stop };
}

function printTerminalQr(pairingCode) {
  const qr = spawnSync("qrencode", ["-t", "ANSIUTF8", pairingCode], {
    encoding: "utf8",
  });
  if (qr.status === 0) {
    console.log("\nQR Code:\n");
    console.log(qr.stdout);
    return true;
  }
  return false;
}

async function writeQrFile(pairingCode, qrFile) {
  let qrcode;
  try {
    qrcode = require("qrcode");
  } catch {
    return false;
  }
  await qrcode.toFile(qrFile, pairingCode, { errorCorrectionLevel: "M" });
  return fs.existsSync(qrFile);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = createRpcClient(options);
  let pollTimer = null;

  function shutdown(code = 0) {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    client.stop();
    setTimeout(() => process.exit(code), 100).unref();
  }

  process.on("SIGINT", () => shutdown(130));
  process.on("SIGTERM", () => shutdown(143));

  await client.send("initialize", {
    clientInfo: {
      name: "codex_cli_mobile_pairing",
      title: "Codex CLI Mobile Pairing",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
    },
  });
  client.notify("initialized");

  const enableParams = options.persist ? {} : { ephemeral: true };
  const enabled = await client.send("remoteControl/enable", enableParams);
  console.error("[enabled]", JSON.stringify(enabled));

  const pairing = await client.send("remoteControl/pairing/start", {
    manualCode: true,
  });

  if (options.json) {
    console.log(JSON.stringify(pairing, null, 2));
  }

  console.log("\nEnvironment ID:", pairing.environmentId);
  console.log("Expires At:", formatTime(pairing.expiresAt));
  console.log("\nManual Pairing Code:\n", pairing.manualPairingCode || "(not returned)");
  console.log("\nRaw Pairing Code for QR:\n", pairing.pairingCode);

  if (options.qrFile) {
    const wrote = await writeQrFile(pairing.pairingCode, options.qrFile);
    if (wrote) {
      console.log(`\nQR PNG written to: ${options.qrFile}`);
    } else {
      console.log("\nQR PNG not written. Install the optional qrcode package first:");
      console.log("  npm install qrcode");
    }
  }

  if (options.terminalQr && !printTerminalQr(pairing.pairingCode)) {
    console.log("\nqrencode not found. Use the manual pairing code first, or install qrencode:");
    console.log("  macOS:  brew install qrencode");
    console.log("  Ubuntu: sudo apt install qrencode");
  }

  console.log("\nKeep this process running until the mobile app claims the code.");
  console.log("After it is claimed, leave it running if this is your active CLI host.\n");

  pollTimer = setInterval(async () => {
    try {
      const statusParams = pairing.manualPairingCode
        ? { manualPairingCode: pairing.manualPairingCode }
        : { pairingCode: pairing.pairingCode };
      const status = await client.send("remoteControl/pairing/status", statusParams);
      if (status.claimed) {
        console.log("Claimed by mobile app.");
      } else {
        console.log("Not claimed yet...");
      }
    } catch (error) {
      console.error("Poll error:", error.message || error);
    }
  }, options.pollIntervalMs);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
