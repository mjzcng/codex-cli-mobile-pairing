# Codex CLI Mobile Pairing

Generate a short-lived pairing code for connecting ChatGPT mobile to a Codex CLI `app-server` host.

This is a small workaround for users who previously paired ChatGPT mobile with a Codex CLI remote-control host and no longer see a first-class CLI pairing flow in the mobile app. It uses Codex's public, experimental `app-server` JSON-RPC methods:

- `remoteControl/enable`
- `remoteControl/pairing/start`
- `remoteControl/pairing/status`

The official supported setup path is still the Codex desktop app's "Set up Codex mobile" flow. This project is intentionally narrow and experimental.

## When This Helps

Use this if:

- you run Codex from the CLI;
- ChatGPT mobile offers a manual pairing / authorization-code entry flow;
- you want to expose the current machine as a Codex remote-control host without opening the Codex desktop pairing UI.

Prefer the official Codex desktop app flow when it is available and works for your setup.

## Requirements

- Codex CLI installed and authenticated.
- Node.js 18 or newer.
- ChatGPT mobile with Codex access in the same account/workspace.
- Optional: `qrencode` if you want a terminal QR code.

## Usage

Clone the repo, then run:

```bash
node bin/codex-cli-mobile-pair.js
```

The script prints:

- an environment ID;
- an expiry time;
- a manual pairing code;
- the raw pairing payload used for QR generation.

Keep the script running while you enter the manual pairing code in ChatGPT mobile. The script polls `remoteControl/pairing/status` and prints `Claimed by mobile app.` after the mobile app claims the code.

## Options

```bash
node bin/codex-cli-mobile-pair.js --help
```

Useful examples:

```bash
# Persist remote-control enablement instead of enabling it only for this process.
node bin/codex-cli-mobile-pair.js --persist

# Use a specific Codex executable.
node bin/codex-cli-mobile-pair.js --codex /path/to/codex

# Print JSON in addition to the human output.
node bin/codex-cli-mobile-pair.js --json

# Write a PNG QR code if the optional qrcode package is installed.
npm install
node bin/codex-cli-mobile-pair.js --qr-file /tmp/codex-pair.png
```

## Notes

- Pairing codes are short-lived. Have the ChatGPT mobile pairing screen ready before running the command.
- The script starts `codex app-server --stdio` and keeps it alive. If you stop it, the host may no longer be reachable unless another Codex app-server/daemon is running with remote control enabled.
- `--persist` calls `remoteControl/enable` without `ephemeral: true`; the default is process-only enablement.
- Do not paste pairing codes into issues or logs. They are temporary credentials.

## Background

Codex's app-server documentation describes the experimental remote-control API. `remoteControl/pairing/start` accepts `manualCode: true` and returns `pairingCode`, `manualPairingCode`, `environmentId`, and Unix-seconds `expiresAt`.

The official mobile setup documentation currently describes the Codex desktop app as the main pairing entrypoint.

## References

- [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Codex remote connections docs](https://developers.openai.com/codex/remote-connections)

## License

MIT
