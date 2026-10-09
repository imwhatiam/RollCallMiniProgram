微信小程序

yolo户外助手，实现点名功能

## 两个版本

- **在线版**（`pages/`）：登录后走 `https://www.lian-yolo.com/weixin-miniprogram/api`，
  活动清单存在服务端，可以分享给别人一起点名。
- **离线版**（`pages/offline/`）：纯本地 `wx.setStorageSync`，只能自己用。

后端代码在隔壁仓库 `../lian-yolo.com`（Django）。

## 头像登录为什么不用 wx.uploadFile

在线版登录要把微信头像传给后端。这里**故意不用 `wx.uploadFile`**，而是把图片读成 base64、
用 `wx.request` 以 JSON 提交（后端 `jscode2session` 接口同时支持 multipart 和 JSON 两种）。

原因：`wx.uploadFile` 要求把域名单独配进小程序后台的「uploadFile 合法域名」，而**那个列表
和「request 合法域名」是两张独立的表**；本项目的小程序域名托管给了第三方平台，`uploadFile`
那张表改不了，导致真机上 `wx.uploadFile` 直接失败（`uploadFile:fail url not in domain list`），
而 `wx.request` 一直是通的。

改动这一段时要小心两点：

- 后端 `JSCode2SessionView` 的 `parser_classes` 必须保留 `JSONParser`；只发后端不发前端、
  或反过来，登录都会挂（旧后端收到 JSON 会回 415）。
- 头像大小上限在后端 `MAX_AVATAR_BYTES`（4MB，解码后）；请求体上限是 settings 里的
  `DATA_UPLOAD_MAX_MEMORY_SIZE`（8MB，因为 base64 会膨胀约 1/3）。

## 跑测试

测试用 Node 自带的 test runner，**不需要安装任何依赖**：

```bash
node --test
```

测试环境在 `tests/helpers/miniprogram.js`，它做了两件事：

1. 把项目里用到的 ESM 语法（`import { X } from '...'`、`export const`）转成 CommonJS，
   这样 `node` 才能直接加载小程序的页面文件；
2. 在一个独立的 `vm` 上下文里注入 `wx` / `Page` / `Component` / `App` 的 stub，
   并实现支持 `activityItems[0].completed` 这种路径写法的 `setData`。

所以页面逻辑（包括 `wx.request` 的入参和 setData 之后的 `data`）都可以直接用断言检查。
`wx` 上带 `__` 前缀的字段是测试旋钮，例如 `wx.__response`、`wx.__modalConfirm`。

`tests/` 已经在 `project.config.json` 的 `packOptions.ignore` 里排除，不会被打包上传。
