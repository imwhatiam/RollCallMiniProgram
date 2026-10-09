微信小程序

yolo户外助手，实现点名功能

## 两个版本

- **在线版**（`pages/`）：登录后走 `https://www.lian-yolo.com/weixin-miniprogram/api`，
  活动清单存在服务端，可以分享给别人一起点名。
- **离线版**（`pages/offline/`）：纯本地 `wx.setStorageSync`，只能自己用。

后端代码在隔壁仓库 `../lian-yolo.com`（Django）。

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
