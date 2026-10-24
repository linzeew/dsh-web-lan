# dsh-web-lan

让 `dsh web` 绑定 **0.0.0.0**（局域网 / 所有网卡），并支持**自定义 web 登录 token** 的 dsh 插件包。

官方行为：`dsh web` 只绑 127.0.0.1，且 CLI 显式拒绝 `--host 0.0.0.0`；启动 token 每次进程随机生成（`?token=...` 链接只在该次启动有效）。本插件开启后：

1. **0.0.0.0 绑定**：webserver 行的 `host` 默认改为 `0.0.0.0`（CLI 的 `--host 127.0.0.1` 仍可覆盖回环）。局域网客户端无需额外信任配置——web 层的 LAN 信任机制（`resolveLanTrust`）会在“绑定所有网卡”时自动把本机局域网 IP 加入信任名单。
2. **自定义 token**：设置环境变量 `DSH_WEB_TOKEN`（或直接改补丁行里的 `token` 字面量）后，启动打印的 `dsh web:` 链接与 `GET /?token=...` 交换都使用这个固定 token；不设置时保持上游行为（每次进程随机 token），纯 opt-in。

## 安装

把本目录加入 web profile（pnpm 安装，profile 在 `~/.dsh/profiles/web`）：

```sh
dsh plugin --profile web add /root/dsh/dsh-web-lan
```

安装后 dsh 会自动把 `dsh-web-lan` 追加到该 profile 的 `dsh.profile.bundles` 末尾（补丁层顺序在 `@deepseek-ai/dsh-web-app` 之后，覆盖才生效），无需手动改 manifest。

启动：

```sh
# 固定 token：
DSH_WEB_TOKEN=我的token dsh web

# 仅开放 0.0.0.0，token 保持每次随机：
dsh web

# 想临时收回到回环：
dsh web --host 127.0.0.1
```

卸载：

```sh
dsh plugin --profile web remove dsh-web-lan
```

（或 `dsh plugin --profile web rm dsh-web-lan`，pnpm 透传）

## 工作原理

- `cordis.patch.yml`（bundle 补丁层）：
  - 覆盖 `webserver` 行并**整体重述**其 config（补丁替换整块 config，必须补齐 `port`/`compression*/` 等原有键），`host` 取 `ctx.webStartup.host ?? '0.0.0.0'`——CLI `--host` 仍然有效；
  - 插入新行 `web-lan-token`（`name: dsh-web-lan`，`inject: [connection]`，`config.token: !!js process.env.DSH_WEB_TOKEN`）。
- `lib/index.js`（胶水插件）：在 `connection` 服务（dsh-client-connection）就绪后，把 `browserAuth.launchToken` 字段替换为配置的 token。`BrowserAuth` 的 `authenticatedUrl`（打印的启动 URL）与 `authorizeIndex`（`?token=` 交换）都在调用时动态读 `this.launchToken`，且该注入行一定先于 web 层打印就绪 URL（loader settle 之后）执行，所以打印出的链接直接携带自定义 token。
- 签名 cookie 的 `secret` 不受影响：**升级前已建立的浏览器会话 cookie 继续有效**；旧 token 链接作废（token 变了），新链接用新 token 即可。
- 在非 web profile 中安装也无害：`webserver` 行不存在时补丁跳过（仅告警）；`web-lan-token` 行因 `connection` 服务不存在而保持未激活。

## 令牌约束

1–256 个 URL 安全字符：字母、数字、`._~+/=-`。为空或未设置 = 不生效。

## 安全提示

- 绑 0.0.0.0 意味着局域网（或同网段）任何可达主机的浏览器都能访问该服务，token 是唯一的入口门槛——请用足够长的随机串，并像对待密码一样保管；
- 该服务承载完整 agent 能力（文件读写、命令执行等），请只在你信任的网络中启用；
- 公网暴露请加反向代理 + TLS，不要直接暴露。

## 依赖与版本

零运行时依赖。适配 dsh `0.2.0-rc.2`（`dsh-client-connection` 的 `HostConnectionService.browserAuth` 公共字段结构）。
