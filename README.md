# Codex CLI Mobile Pairing

[![npm version](https://img.shields.io/npm/v/codex-cli-mobile-pairing.svg)](https://www.npmjs.com/package/codex-cli-mobile-pairing)
[![npm downloads](https://img.shields.io/npm/dm/codex-cli-mobile-pairing.svg)](https://www.npmjs.com/package/codex-cli-mobile-pairing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](#english) / [中文](#中文)

> [!IMPORTANT]
> Current Codex CLI releases include an official `codex remote-control` workflow. Use the official commands first. This package is now maintained as a legacy fallback and diagnostic helper.

## English

This project generates short-lived pairing codes for connecting ChatGPT mobile to a Codex CLI `app-server` host.

Codex CLI now provides the same core workflow directly, backed by its managed app-server daemon. For new setups, this package is no longer required.

## Recommended: Official Codex CLI

Install or update Codex, then use the built-in commands:

```bash
npm install -g @openai/codex@latest

# Start the managed app-server daemon with Remote Control enabled.
codex remote-control start

# Print a short-lived manual pairing code.
codex remote-control pair

# Stop the managed daemon when it is no longer needed.
codex remote-control stop
```

Use JSON output for scripts:

```bash
codex remote-control pair --json
```

The JSON response includes `pairingCode`, `manualPairingCode`, `environmentId`, and `expiresAt`.

## When This Legacy Helper Still Helps

Use this package only when:

- your installed Codex version does not provide `codex remote-control`;
- the official daemon cannot take over because another Desktop or SSH app-server already owns the default control socket;
- you need the helper's `status`, `restart`, `logs`, or optional terminal/PNG QR features;
- you are testing the experimental app-server remote-control protocol directly.

For normal use, prefer the official commands above or the Codex desktop app's **Set up Remote** flow.

## Legacy Helper Usage

Requirements:

- Codex CLI installed and authenticated;
- Node.js 18 or newer;
- ChatGPT mobile with Codex access in the same account and workspace;
- optional `qrencode` for a terminal QR code.

Run without installing globally:

```bash
npx codex-cli-mobile-pairing start
```

Or install globally:

```bash
npm install -g codex-cli-mobile-pairing
codex-cli-mobile-pair start
```

Common legacy commands:

```bash
npx codex-cli-mobile-pairing start
npx codex-cli-mobile-pairing status
npx codex-cli-mobile-pairing restart
npx codex-cli-mobile-pairing stop
npx codex-cli-mobile-pairing logs
npx codex-cli-mobile-pairing pair
```

Alternative: clone the repository and run it locally:

```bash
git clone https://github.com/mjzcng/codex-cli-mobile-pairing.git
cd codex-cli-mobile-pairing
node bin/codex-cli-mobile-pair.js start
```

Useful options:

```bash
# Use a specific Codex executable.
npx codex-cli-mobile-pairing start --codex /path/to/codex

# Print JSON in foreground mode.
npx codex-cli-mobile-pairing pair --json

# Write a PNG QR code when the optional qrcode package is installed.
npm install
npx codex-cli-mobile-pairing start --qr-file /tmp/codex-pair.png
```

## Notes

- Pairing codes are short-lived credentials. Do not paste them into issues or logs.
- The legacy `start` and `restart` commands keep a separate `codex app-server --stdio` process alive in the background.
- Stopping that process can make the host unreachable unless another Codex app-server or daemon has Remote Control enabled.
- Running the official daemon and this legacy helper at the same time may create multiple app-server instances. Prefer one owner for a normal setup.
- The helper uses the experimental `remoteControl/enable`, `remoteControl/pairing/start`, and `remoteControl/pairing/status` JSON-RPC methods.

## References

- [Official Codex CLI command reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-remote-control)
- [Official Remote connections documentation](https://learn.chatgpt.com/docs/remote-connections)
- [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)

## License

MIT

---

## 中文

本项目用于生成短期有效的配对码，让 ChatGPT 移动端连接 Codex CLI `app-server` 主机。

当前 Codex CLI 已经原生提供同样的核心流程，并使用官方管理的 app-server daemon。对于新环境，通常已经不需要安装这个 npm 包。

## 推荐方式：Codex 官方命令

安装或更新 Codex，然后使用内置命令：

```bash
npm install -g @openai/codex@latest

# 启动官方管理的 app-server daemon，并启用 Remote Control。
codex remote-control start

# 输出短期有效的手动配对码。
codex remote-control pair

# 不再需要时停止官方 daemon。
codex remote-control stop
```

脚本调用可以使用 JSON 输出：

```bash
codex remote-control pair --json
```

JSON 中包含 `pairingCode`、`manualPairingCode`、`environmentId` 和 `expiresAt`。

## 这个兼容工具仍然适用的场景

仅建议在以下情况使用本工具：

- 当前安装的 Codex 版本还没有 `codex remote-control`；
- Codex Desktop 或 SSH 启动的 app-server 已占用默认 control socket，导致官方 daemon 无法接管；
- 需要本工具额外提供的 `status`、`restart`、`logs` 或终端/PNG 二维码功能；
- 需要直接测试实验性的 app-server remote-control 协议。

正常使用时，请优先采用上面的官方命令，或者 Codex 桌面端的 **Set up Remote** 流程。

## 兼容工具使用方法

环境要求：

- 已安装并登录 Codex CLI；
- Node.js 18 或更高版本；
- ChatGPT 移动端中的同一账号和 workspace 具备 Codex 访问权限；
- 可选安装 `qrencode`，用于在终端显示二维码。

通过 npx 直接运行：

```bash
npx codex-cli-mobile-pairing start
```

或者全局安装：

```bash
npm install -g codex-cli-mobile-pairing
codex-cli-mobile-pair start
```

常用兼容命令：

```bash
npx codex-cli-mobile-pairing start
npx codex-cli-mobile-pairing status
npx codex-cli-mobile-pairing restart
npx codex-cli-mobile-pairing stop
npx codex-cli-mobile-pairing logs
npx codex-cli-mobile-pairing pair
```

也可以克隆仓库后在本地运行：

```bash
git clone https://github.com/mjzcng/codex-cli-mobile-pairing.git
cd codex-cli-mobile-pairing
node bin/codex-cli-mobile-pair.js start
```

常用参数：

```bash
# 使用指定的 Codex 可执行文件。
npx codex-cli-mobile-pairing start --codex /path/to/codex

# 在前台模式输出 JSON。
npx codex-cli-mobile-pairing pair --json

# 安装可选的 qrcode 包后输出 PNG 二维码。
npm install
npx codex-cli-mobile-pairing start --qr-file /tmp/codex-pair.png
```

## 注意事项

- 配对码是短期凭据，请勿粘贴到 issue 或日志中。
- 兼容工具的 `start` 和 `restart` 会在后台保持一个独立的 `codex app-server --stdio` 进程。
- 停止该进程后，除非另有 app-server 或 daemon 已启用 Remote Control，否则主机可能无法继续连接。
- 同时运行官方 daemon 和本兼容工具可能产生多个 app-server 实例。正常使用时建议只保留一个服务管理方。
- 本工具调用实验性的 `remoteControl/enable`、`remoteControl/pairing/start` 和 `remoteControl/pairing/status` JSON-RPC 方法。

## 参考链接

- [Codex 官方 CLI 命令参考](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-remote-control)
- [官方 Remote connections 文档](https://learn.chatgpt.com/docs/remote-connections)
- [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)

## 许可证

MIT
