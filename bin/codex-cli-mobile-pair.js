#!/usr/bin/env node
"use strict";

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const STARTUP_TIMEOUT_MS = 20000;
const STATE_HOME =
  process.env.CODEX_CLI_MOBILE_PAIRING_HOME ||
  path.join(os.homedir(), ".codex-cli-mobile-pairing");
const PID_FILE = path.join(STATE_HOME, "pairing.pid");
const LOG_FILE = path.join(STATE_HOME, "pairing.log");

function usage() {
  return `Usage: codex-cli-mobile-pair <command> [options]

Generate a short-lived manual pairing code for connecting ChatGPT mobile to a
Codex CLI app-server host through Codex's experimental remote-control API.

Commands:
  codex-cli-mobile-pair start      Start a background app-server and print a pairing code
  codex-cli-mobile-pair status     Show whether the background app-server is running
  codex-cli-mobile-pair restart    Restart the background app-server and print a new pairing code
  codex-cli-mobile-pair stop       Stop the background app-server
  codex-cli-mobile-pair logs       Print the background app-server log
  codex-cli-mobile-pair pair       Run in the foreground and print a pairing code

Options:
  --codex <path>             Codex executable to run. Default: codex
  --persist                  Persist remote-control enablement in foreground pair mode.
                             Background start/restart always persist remote control.
  --poll-interval <ms>       Pairing status poll interval. Default: ${DEFAULT_POLL_INTERVAL_MS}
  --request-timeout <ms>     Per-request timeout. Default: ${DEFAULT_REQUEST_TIMEOUT_MS}
  --qr-file <path>           Write a PNG QR code when the optional qrcode package is installed.
  --no-terminal-qr           Do not try to print a terminal QR code with qrencode.
  --json                     Print the pairing response as JSON in addition to human output.
  --help                     Show this help.

Examples:
  codex-cli-mobile-pair start
  codex-cli-mobile-pair status
  codex-cli-mobile-pair restart
  codex-cli-mobile-pair stop
  codex-cli-mobile-pair pair --persist
`;
}

function parseArgs(argv) {
  const command =
    argv[0] && !argv[0].startsWith("-") ? argv.shift() : "start";
  const options = {
    command,
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

    if (arg === "--codex") {
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

function ensureStateHome() {
  fs.mkdirSync(STATE_HOME, { recursive: true });
}

function readPid() {
  try {
    const raw = fs.readFileSync(PID_FILE, "utf8").trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function clearPid() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // Already gone.
  }
}

function currentDaemon() {
  const pid = readPid();
  if (!pid) {
    return { pid: null, running: false };
  }
  const running = isProcessRunning(pid);
  if (!running) {
    clearPid();
  }
  return { pid, running };
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

function printPairingFromText(text) {
  const lines = text.split(/\r?\n/);
  const keys = [
    /^Environment ID:/,
    /^Expires At:/,
    /^Manual Pairing Code:/,
    /^\s+[A-Z0-9]{4}-[A-Z0-9]{4}\s*$/,
    /^Raw Pairing Code for QR:/,
  ];
  let emitted = false;
  for (const line of lines) {
    if (keys.some((pattern) => pattern.test(line))) {
      console.log(line);
      emitted = true;
    }
  }
  return emitted;
}

async function waitForPairingOutput(startOffset = 0) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastSize = startOffset;
  let captured = "";

  while (Date.now() < deadline) {
    if (fs.existsSync(LOG_FILE)) {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > lastSize) {
        const fd = fs.openSync(LOG_FILE, "r");
        const buffer = Buffer.alloc(stat.size - lastSize);
        fs.readSync(fd, buffer, 0, buffer.length, lastSize);
        fs.closeSync(fd);
        lastSize = stat.size;
        captured += buffer.toString("utf8");
        if (/Manual Pairing Code:\s*\n\s+[A-Z0-9]{4}-[A-Z0-9]{4}/.test(captured)) {
          return captured;
        }
        if (/codex app-server exited|timed out|error/i.test(captured)) {
          throw new Error(`Daemon failed to start. See log: ${LOG_FILE}`);
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for pairing code. See log: ${LOG_FILE}`);
}

async function startDaemon(options) {
  ensureStateHome();
  const existing = currentDaemon();
  if (existing.running) {
    console.log(`Already running. PID: ${existing.pid}`);
    console.log(`Logs: ${LOG_FILE}`);
    console.log("Use `codex-cli-mobile-pair restart` to generate a new pairing code.");
    return;
  }

  const startOffset = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;
  const out = fs.openSync(LOG_FILE, "a");
  const err = fs.openSync(LOG_FILE, "a");
  const childArgs = [
    __filename,
    "pair",
    "--persist",
    "--no-terminal-qr",
    "--codex",
    options.codex,
    "--poll-interval",
    String(options.pollIntervalMs),
    "--request-timeout",
    String(options.requestTimeoutMs),
  ];
  if (options.json) {
    childArgs.push("--json");
  }
  if (options.qrFile) {
    childArgs.push("--qr-file", options.qrFile);
  }

  const child = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: ["ignore", out, err],
    env: {
      ...process.env,
      CODEX_CLI_MOBILE_PAIRING_HOME: STATE_HOME,
    },
  });
  fs.closeSync(out);
  fs.closeSync(err);
  fs.writeFileSync(PID_FILE, `${child.pid}\n`);
  child.unref();

  console.log("Codex CLI mobile pairing service started.");
  console.log(`PID: ${child.pid}`);
  console.log(`Logs: ${LOG_FILE}`);
  console.log("");

  const output = await waitForPairingOutput(startOffset);
  printPairingFromText(output);
  console.log("");
  console.log("Keep the service running until ChatGPT mobile claims the code.");
  console.log("Use `codex-cli-mobile-pair status` to check it later.");
  console.log("Use `codex-cli-mobile-pair stop` to stop it.");
}

async function stopDaemon({ silent = false } = {}) {
  const daemon = currentDaemon();
  if (!daemon.running) {
    if (!silent) {
      console.log("Codex CLI mobile pairing service is not running.");
    }
    return false;
  }

  process.kill(daemon.pid, "SIGTERM");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isProcessRunning(daemon.pid)) {
      clearPid();
      if (!silent) {
        console.log(`Stopped Codex CLI mobile pairing service. PID: ${daemon.pid}`);
      }
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  try {
    process.kill(daemon.pid, "SIGKILL");
  } catch {
    // Already stopped.
  }
  clearPid();
  if (!silent) {
    console.log(`Stopped Codex CLI mobile pairing service. PID: ${daemon.pid}`);
  }
  return true;
}

function statusDaemon() {
  const daemon = currentDaemon();
  if (daemon.running) {
    console.log(`Codex CLI mobile pairing service is running. PID: ${daemon.pid}`);
    console.log(`Logs: ${LOG_FILE}`);
  } else {
    console.log("Codex CLI mobile pairing service is not running.");
  }
}

function printLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log("No log file found.");
    console.log(`Expected log: ${LOG_FILE}`);
    return;
  }
  process.stdout.write(fs.readFileSync(LOG_FILE, "utf8"));
}

async function runPair(options) {
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

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(usage());
    return;
  }

  const options = parseArgs(rawArgs);
  if (options.command === "start") {
    await startDaemon(options);
  } else if (options.command === "restart") {
    await stopDaemon({ silent: true });
    await startDaemon(options);
  } else if (options.command === "status") {
    statusDaemon();
  } else if (options.command === "stop") {
    await stopDaemon();
  } else if (options.command === "logs") {
    printLogs();
  } else if (options.command === "pair") {
    await runPair(options);
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
