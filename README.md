# Codex CLI Mobile Pairing

[![npm version](https://img.shields.io/npm/v/codex-cli-mobile-pairing.svg)](https://www.npmjs.com/package/codex-cli-mobile-pairing)
[![npm downloads](https://img.shields.io/npm/dm/codex-cli-mobile-pairing.svg)](https://www.npmjs.com/package/codex-cli-mobile-pairing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](#english) / [中文](#中文)

## English

Generate a short-lived pairing code for connecting ChatGPT mobile to a Codex CLI `app-server` host.

This project is a small workaround for users who previously paired ChatGPT mobile with a Codex CLI remote-control host, but no longer see a first-class CLI pairing flow in the mobile app. It uses Codex's public, experimental `app-server` JSON-RPC methods:

- `remoteControl/enable`
- `remoteControl/pairing/start`
- `remoteControl/pairing/status`

The official supported setup path is still the Codex desktop app's "Set up Codex mobile" flow. This helper is intentionally narrow and experimental.

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

Recommended: start the persistent background service with npm/npx:

```bash
npx codex-cli-mobile-pairing start
```

This starts a background Codex app-server, prints a short-lived manual pairing code, and keeps the app-server running after your terminal command returns.

Or install it globally:

```bash
npm install -g codex-cli-mobile-pairing
codex-cli-mobile-pair start
```

Alternative: clone the GitHub repository and run the script locally:

```bash
git clone https://github.com/mjzcng/codex-cli-mobile-pairing.git
cd codex-cli-mobile-pairing
node bin/codex-cli-mobile-pair.js start
```

Common commands:

```bash
# Start the persistent background service and print a pairing code.
npx codex-cli-mobile-pairing start

# Check whether the service is running.
npx codex-cli-mobile-pairing status

# Restart the service and print a new pairing code.
npx codex-cli-mobile-pairing restart

# Stop the background app-server.
npx codex-cli-mobile-pairing stop

# Print service logs.
npx codex-cli-mobile-pairing logs

# Advanced: run in the foreground instead of starting a background service.
npx codex-cli-mobile-pairing pair
```

The `start` and `restart` commands print:

- an environment ID;
- an expiry time;
- a manual pairing code;
- the raw pairing payload used for QR generation.

Enter the manual pairing code in ChatGPT mobile before it expires. After the mobile app claims the code, keep the background service running so the remote connection stays online.

## Options

```bash
npx codex-cli-mobile-pairing --help
```

Useful examples:

```bash
# Start with a specific Codex executable.
npx codex-cli-mobile-pairing start --codex /path/to/codex

# Print JSON in addition to the human output in foreground mode.
npx codex-cli-mobile-pairing pair --json

# Write a PNG QR code if the optional qrcode package is installed locally.
npm install
npx codex-cli-mobile-pairing start --qr-file /tmp/codex-pair.png
```

## Notes

- Pairing codes are short-lived. Have the ChatGPT mobile pairing screen ready before running the command.
- `start` and `restart` keep `codex app-server --stdio` alive in the background. If you stop the service, the host may no longer be reachable unless another Codex app-server/daemon is running with remote control enabled.
- `pair` runs in the foreground and is mainly useful for debugging. In foreground mode, `--persist` calls `remoteControl/enable` without `ephemeral: true`; otherwise foreground mode uses process-only enablement.
- Do not paste pairing codes into issues or logs. They are temporary credentials.

## Background

Codex's app-server documentation describes the experimental remote-control API. `remoteControl/pairing/start` accepts `manualCode: true` and returns `pairingCode`, `manualPairingCode`, `environmentId`, and Unix-seconds `expiresAt`.

The official mobile setup documentation currently describes the Codex desktop app as the main pairing entrypoint.

## References

- [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Codex remote connections docs](https://developers.openai.com/codex/remote-connections)

## License

MIT

---

## 中文

为 Codex CLI `app-server` 主机生成一个短期有效的配对码，用于在 ChatGPT 移动端连接这个 CLI 环境。

这个项目是一个小型 workaround，适合曾经用 ChatGPT mobile 连接过 Codex CLI remote-control 主机、但在新版移动端里找不到 CLI 配对入口的用户。它调用的是 Codex 公开但仍处于实验状态的 `app-server` JSON-RPC 方法：

- `remoteControl/enable`
- `remoteControl/pairing/start`
- `remoteControl/pairing/status`

官方当前支持的主路径仍然是 Codex 桌面端里的 "Set up Codex mobile" 流程。这个工具只覆盖 CLI 主机手动配对这一件事，定位是临时且实验性的。

## 适用场景

适合以下情况：

- 你主要通过 Codex CLI 使用 Codex；
- ChatGPT 移动端提供了手动输入配对码 / 授权码的入口；
- 你希望把当前机器暴露为 Codex remote-control 主机，但不想或不能打开 Codex 桌面端配对 UI。

如果官方 Codex 桌面端配对流程可用，优先使用官方流程。

## 环境要求

- 已安装并登录 Codex CLI。
- Node.js 18 或更高版本。
- ChatGPT mobile 中同一账号 / workspace 具备 Codex 访问权限。
- 可选：安装 `qrencode` 后可在终端输出二维码。

## 使用方法

推荐方式：通过 npm/npx 启动后台常驻服务：

```bash
npx codex-cli-mobile-pairing start
```

这个命令会启动一个后台 Codex app-server，打印短期有效的手动配对码，并在当前终端命令结束后继续保持 app-server 运行。

也可以全局安装：

```bash
npm install -g codex-cli-mobile-pairing
codex-cli-mobile-pair start
```

备选方式：克隆 GitHub 仓库后在本地运行脚本：

```bash
git clone https://github.com/mjzcng/codex-cli-mobile-pairing.git
cd codex-cli-mobile-pairing
node bin/codex-cli-mobile-pair.js start
```

常用命令：

```bash
# 启动后台常驻服务并打印配对码。
npx codex-cli-mobile-pairing start

# 查看服务是否正在运行。
npx codex-cli-mobile-pairing status

# 重启服务并打印新的配对码。
npx codex-cli-mobile-pairing restart

# 停止后台 app-server。
npx codex-cli-mobile-pairing stop

# 查看服务日志。
npx codex-cli-mobile-pairing logs

# 高级用法：前台运行，不启动后台服务。
npx codex-cli-mobile-pairing pair
```

`start` 和 `restart` 会输出：

- environment ID；
- 过期时间；
- 手动配对码；
- 用于生成二维码的原始 pairing payload。

请在配对码过期前到 ChatGPT 移动端输入。移动端领取配对码后，请保持后台服务运行，这样远程连接才会持续在线。

## 参数

```bash
npx codex-cli-mobile-pairing --help
```

常用示例：

```bash
# 使用指定 Codex 可执行文件启动。
npx codex-cli-mobile-pairing start --codex /path/to/codex

# 前台模式下除普通输出外，同时打印 JSON。
npx codex-cli-mobile-pairing pair --json

# 如果本地已安装可选的 qrcode 包，写出 PNG 二维码。
npm install
npx codex-cli-mobile-pairing start --qr-file /tmp/codex-pair.png
```

## 注意事项

- 配对码有效期很短。运行命令前建议先打开 ChatGPT 移动端的配对码输入页面。
- `start` 和 `restart` 会让 `codex app-server --stdio` 在后台保持存活。停止服务后，除非另有 Codex app-server/daemon 已启用 remote control，否则这个主机可能不再可达。
- `pair` 是前台调试模式。前台模式下，`--persist` 会在调用 `remoteControl/enable` 时不传 `ephemeral: true`；否则前台模式默认只在当前进程内临时启用。
- 不要把配对码粘贴到 issue 或日志中。它们是临时凭据。

## 背景

Codex app-server 文档描述了实验性的 remote-control API。`remoteControl/pairing/start` 接受 `manualCode: true`，并返回 `pairingCode`、`manualPairingCode`、`environmentId` 和 Unix 秒级 `expiresAt`。

官方移动端设置文档目前仍将 Codex 桌面端描述为主要配对入口。

## 参考链接

- [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Codex remote connections docs](https://developers.openai.com/codex/remote-connections)

## 许可证

MIT
