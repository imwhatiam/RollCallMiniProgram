'use strict';

/**
 * 小程序的轻量单测环境。
 *
 * 小程序源码跑不了在 Node 里直接 require，原因有三：
 *   1. 同时混用 `import { X } from '../../config'` 和 `require(...)`
 *   2. 依赖 `wx` / `Page` / `Component` / `App` 这些全局对象
 *   3. 需要模拟 setData 的路径写法（如 `activityItems[0].completed`）
 *
 * 这里用 node:vm 起一个独立的上下文：
 *   - 把项目里实际用到的 ESM 语法转成 CommonJS（只做最小转换，不做通用转译）
 *   - 注入可断言的 wx stub、Page/Component/App 收集器
 *   - 提供支持路径写法的 setData
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// 极简 ESM → CJS
// ---------------------------------------------------------------------------

function toCommonJS(source) {
  const exported = [];

  let code = source
    .replace(
      /^[ \t]*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/gm,
      (match, names, spec) => `const {${names}} = require(${JSON.stringify(spec)});`,
    )
    .replace(
      /^[ \t]*import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]\s*;?/gm,
      (match, name, spec) => `const ${name} = require(${JSON.stringify(spec)});`,
    )
    .replace(
      /^[ \t]*export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm,
      (match, name) => {
        exported.push(name);
        return `const ${name} =`;
      },
    );

  if (/export\s+(default|function|class|\{)/.test(code)) {
    throw new Error('测试转译器只支持 `export const`，源码里出现了未支持的导出语法');
  }

  if (exported.length) {
    code += `\n;module.exports = Object.assign({}, module.exports, {${exported.join(', ')}});\n`;
  }

  return code;
}

// ---------------------------------------------------------------------------
// wx stub
// ---------------------------------------------------------------------------

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

function createWxStub() {
  const storage = new Map();
  const calls = [];

  const wx = {
    // --- 测试用的旋钮 ---
    /** request 的响应，设置后所有 wx.request 都返回它 */
    __response: null,
    /** 设置后 wx.request 走 fail */
    __requestFail: null,
    /** uploadFile 的响应（data 会被 JSON.stringify） */
    __uploadResponse: null,
    /** 设置后 wx.uploadFile 走 fail */
    __uploadFail: null,
    /** wx.login 返回的 code */
    __loginCode: 'code-from-wx-login',
    /** 设置后 wx.login 走 fail */
    __loginFail: null,
    /** getFileSystemManager().readFile 返回的内容 */
    __fileContent: 'BASE64-AVATAR-CONTENT',
    /** 设置后 readFile 走 fail */
    __readFileFail: null,
    /** showModal 点确定还是取消 */
    __modalConfirm: true,
    /** wx.canIUse 的返回值 */
    __canIUse: true,
    /** wx.getStorageSync 的返回（覆盖 Map 里的真实值） */
    __storageOverride: null,

    // --- 断言辅助 ---
    __calls: calls,
    __storage: storage,
    __flushStorage() {
      storage.clear();
    },
    calls(name) {
      return calls.filter((call) => call.name === name).map((call) => call.args[0]);
    },
    lastCall(name) {
      const matched = wx.calls(name);
      return matched.length ? matched[matched.length - 1] : undefined;
    },
    calledWith(name) {
      return wx.calls(name).length > 0;
    },
  };

  // --- 生命周期 / 导航 ---
  const record = (name) => (options) => {
    calls.push({ name, args: [options] });
  };

  wx.showToast = record('showToast');
  wx.showLoading = record('showLoading');
  wx.hideLoading = () => calls.push({ name: 'hideLoading', args: [] });
  wx.pageScrollTo = record('pageScrollTo');
  wx.makePhoneCall = record('makePhoneCall');
  wx.navigateTo = record('navigateTo');
  wx.redirectTo = record('redirectTo');
  wx.reLaunch = record('reLaunch');
  wx.switchTab = record('switchTab');
  wx.navigateBack = record('navigateBack');

  wx.showModal = (options) => {
    calls.push({ name: 'showModal', args: [options] });
    if (typeof options.success === 'function') {
      options.success(wx.__modalConfirm
        ? { confirm: true, cancel: false }
        : { confirm: false, cancel: true });
    }
  };

  wx.nextTick = (fn) => { if (typeof fn === 'function') fn(); };

  wx.canIUse = () => wx.__canIUse;

  wx.getUpdateManager = () => ({
    onCheckForUpdate: (fn) => { wx.__updateCheck = fn; },
    onUpdateReady: (fn) => { wx.__updateReady = fn; },
    onUpdateFailed: (fn) => { wx.__updateFailed = fn; },
    applyUpdate: () => calls.push({ name: 'applyUpdate', args: [] }),
  });

  // --- 存储 ---
  wx.getStorageSync = (key) => {
    if (wx.__storageOverride && key in wx.__storageOverride) {
      return wx.__storageOverride[key];
    }
    return storage.has(key) ? clone(storage.get(key)) : '';
  };
  wx.setStorageSync = (key, value) => {
    storage.set(key, clone(value));
    calls.push({ name: 'setStorageSync', args: [{ key, value }] });
  };
  wx.removeStorageSync = (key) => { storage.delete(key); };

  // --- 网络 ---
  wx.request = (options) => {
    calls.push({ name: 'request', args: [options] });
    if (wx.__requestFail) {
      if (typeof options.fail === 'function') options.fail(wx.__requestFail);
      if (typeof options.complete === 'function') options.complete();
      return;
    }
    const response = Object.assign({ statusCode: 200, data: {} }, wx.__response || {});
    if (typeof options.success === 'function') options.success(response);
    if (typeof options.complete === 'function') options.complete();
  };

  wx.uploadFile = (options) => {
    calls.push({ name: 'uploadFile', args: [options] });
    if (wx.__uploadFail) {
      if (typeof options.fail === 'function') options.fail(wx.__uploadFail);
      if (typeof options.complete === 'function') options.complete();
      return;
    }
    const response = Object.assign(
      { statusCode: 200, data: JSON.stringify({ weixin_id: 'openid-default' }) },
      wx.__uploadResponse || {},
    );
    if (typeof options.success === 'function') options.success(response);
    if (typeof options.complete === 'function') options.complete();
  };

  wx.login = (options) => {
    calls.push({ name: 'login', args: [options] });
    if (wx.__loginFail) {
      if (typeof options.fail === 'function') options.fail(wx.__loginFail);
      return;
    }
    if (typeof options.success === 'function') options.success({ code: wx.__loginCode });
  };

  wx.getFileSystemManager = () => ({
    readFile: (options) => {
      calls.push({ name: 'readFile', args: [options] });
      if (wx.__readFileFail) {
        if (typeof options.fail === 'function') options.fail(wx.__readFileFail);
        return;
      }
      if (typeof options.success === 'function') {
        options.success({ data: wx.__fileContent });
      }
    },
  });

  return wx;
}

// ---------------------------------------------------------------------------
// setData 的路径写法
// ---------------------------------------------------------------------------

function setByPath(target, pathExpression, value) {
  const keys = String(pathExpression)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((key) => key !== '');

  let node = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
}

function instantiatePage(definition) {
  const page = Object.assign({}, definition);
  page.data = clone(definition.data || {});

  page.setData = function setData(patch, callback) {
    Object.keys(patch || {}).forEach((key) => {
      // 这里做一次 JSON 往返，把 vm 上下文里造出来的数组/对象换成宿主上下文的，
      // 否则 assert.deepStrictEqual 会因为原型不同而误报不相等。
      setByPath(this.data, key, clone(patch[key]));
    });
    if (typeof callback === 'function') callback();
  };

  return page;
}

// ---------------------------------------------------------------------------
// 会话：一个独立的 vm 上下文 + 模块缓存
// ---------------------------------------------------------------------------

const silentConsole = {
  log: () => {},
  info: () => {},
  debug: () => {},
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

function createSession(options = {}) {
  const wx = createWxStub();
  const captured = { page: null, component: null, app: null };
  const moduleCache = new Map();
  const timers = [];

  const sandbox = {
    console: options.quiet === false ? console : silentConsole,
    setTimeout: (fn, delay) => {
      timers.push({ fn, delay });
      return timers.length;
    },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    wx,
    Page: (definition) => { captured.page = definition; },
    Component: (definition) => { captured.component = definition; },
    App: (definition) => { captured.app = definition; },
    getApp: () => captured.app,
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);

  function resolve(fromDir, spec) {
    const target = spec.startsWith('.')
      ? path.resolve(fromDir, spec)
      : path.resolve(PROJECT_ROOT, 'tests', 'stubs', spec);

    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
    if (fs.existsSync(`${target}.js`)) return `${target}.js`;
    if (fs.existsSync(path.join(target, 'index.js'))) return path.join(target, 'index.js');
    throw new Error(`无法解析模块 '${spec}'（来自 ${fromDir}）`);
  }

  function loadModule(absPath) {
    if (moduleCache.has(absPath)) return moduleCache.get(absPath).exports;

    const module = { exports: {} };
    moduleCache.set(absPath, module);

    const source = toCommonJS(fs.readFileSync(absPath, 'utf8'));
    const dirname = path.dirname(absPath);
    const localRequire = (spec) => loadModule(resolve(dirname, spec));

    const wrapper = vm.runInContext(
      `(function (exports, require, module, __filename, __dirname) {\n${source}\n})`,
      context,
      { filename: absPath },
    );
    wrapper(module.exports, localRequire, module, absPath, dirname);

    return module.exports;
  }

  function load(relativePath) {
    const absPath = resolve(PROJECT_ROOT, relativePath.startsWith('.')
      ? relativePath
      : `./${relativePath}`);

    captured.page = null;
    captured.component = null;
    captured.app = null;

    loadModule(absPath);
    return captured;
  }

  return {
    load,
    loadModule,
    wx,
    captured,
    timers,
    /** 立刻执行所有被 setTimeout 排队的回调 */
    runTimers() {
      const pending = timers.splice(0, timers.length);
      pending.forEach((timer) => timer.fn());
    },
    /** 依据相对路径解析出绝对路径 */
    resolve: (relativePath) => resolve(PROJECT_ROOT,
      relativePath.startsWith('.') ? relativePath : `./${relativePath}`),
  };
}

// ---------------------------------------------------------------------------
// 对外的便捷入口
// ---------------------------------------------------------------------------

/** 加载一个页面模块，返回已实例化的 page（带可用 setData） */
function loadPage(relativePath, options) {
  const session = createSession(options);
  const captured = session.load(relativePath);

  if (!captured.page) {
    throw new Error(`${relativePath} 里没有调用 Page()`);
  }

  return {
    page: instantiatePage(captured.page),
    definition: captured.page,
    wx: session.wx,
    session,
  };
}

/** 加载一个组件模块 */
function loadComponent(relativePath, options) {
  const session = createSession(options);
  const captured = session.load(relativePath);

  if (!captured.component) {
    throw new Error(`${relativePath} 里没有调用 Component()`);
  }

  return {
    definition: captured.component,
    methods: captured.component.methods || {},
    wx: session.wx,
    session,
  };
}

/** 加载 app.js */
function loadApp(options) {
  const session = createSession(options);
  const captured = session.load('app.js');

  if (!captured.app) {
    throw new Error('app.js 里没有调用 App()');
  }

  return { app: captured.app, wx: session.wx, session };
}

/** 直接 require 一个普通模块（如 utils / config），只取导出值 */
function loadModule(relativePath, options) {
  const session = createSession(options);
  return {
    exports: session.loadModule(session.resolve(relativePath)),
    wx: session.wx,
    session,
  };
}

module.exports = {
  PROJECT_ROOT,
  createSession,
  loadPage,
  loadComponent,
  loadApp,
  loadModule,
  createWxStub,
  instantiatePage,
  setByPath,
  toCommonJS,
};
