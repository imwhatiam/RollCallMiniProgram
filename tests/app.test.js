'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { loadApp, loadComponent, loadModule, PROJECT_ROOT } = require('./helpers/miniprogram');

// ===========================================================================
// app.js 的自动更新逻辑
// ===========================================================================

test('app：支持 getUpdateManager 时注册三个回调', () => {
  const { app, wx } = loadApp();

  app.onLaunch();

  assert.equal(typeof wx.__updateCheck, 'function');
  assert.equal(typeof wx.__updateReady, 'function');
  assert.equal(typeof wx.__updateFailed, 'function');
  assert.equal(wx.calledWith('showModal'), false);
});

test('app：不支持 getUpdateManager 时提示升级微信', () => {
  const { app, wx } = loadApp();
  wx.__canIUse = false;

  app.onLaunch();

  assert.equal(wx.lastCall('showModal').title, '提示');
  assert.ok(wx.lastCall('showModal').content.includes('微信版本过低'));
});

test('app：新版本就绪时询问用户是否重启', () => {
  const { app, wx } = loadApp();
  app.onLaunch();

  wx.__updateReady();

  assert.equal(wx.lastCall('showModal').title, '更新提示');
  assert.ok(wx.lastCall('showModal').content.includes('新版本已经准备好'));
});

test('app：用户点确认后调用 applyUpdate', () => {
  const { app, wx } = loadApp();
  app.onLaunch();

  wx.__updateReady();

  assert.ok(wx.calledWith('applyUpdate'));
});

test('app：用户点取消则不重启', () => {
  const { app, wx } = loadApp();
  wx.__modalConfirm = false;
  app.onLaunch();

  wx.__updateReady();

  assert.equal(wx.calledWith('applyUpdate'), false);
});

test('app：更新下载失败时引导用户重装', () => {
  const { app, wx } = loadApp();
  app.onLaunch();

  wx.__updateFailed();

  assert.equal(wx.lastCall('showModal').title, '更新失败');
  assert.ok(wx.lastCall('showModal').content.includes('删除当前小程序'));
});

// ===========================================================================
// 组件
// ===========================================================================

function initComponent(relativePath, properties = {}) {
  const { definition } = loadComponent(relativePath);
  const events = [];

  const defaults = {};
  Object.entries(definition.properties || {}).forEach(([name, config]) => {
    defaults[name] = config.value;
  });

  const instance = {
    properties: Object.assign(defaults, properties),
    data: JSON.parse(JSON.stringify(definition.data || {})),
    events,
    setData(patch, callback) {
      Object.keys(patch || {}).forEach((key) => { this.data[key] = patch[key]; });
      if (typeof callback === 'function') callback();
    },
    triggerEvent(name, detail) {
      events.push({ name, detail });
    },
  };

  Object.entries(definition.methods || {}).forEach(([name, fn]) => {
    instance[name] = fn.bind(instance);
  });

  if (definition.lifetimes && definition.lifetimes.attached) {
    definition.lifetimes.attached.call(instance);
  }

  return instance;
}

test('collapse-list：initiallyExpanded 为 true 时默认展开', () => {
  const instance = initComponent('components/collapse-list/collapse-list.js',
    { initiallyExpanded: true });
  assert.equal(instance.data.isCollapsed, false);
});

test('collapse-list：initiallyExpanded 为 false 时默认收起', () => {
  const instance = initComponent('components/collapse-list/collapse-list.js',
    { initiallyExpanded: false });
  assert.equal(instance.data.isCollapsed, true);
});

test('collapse-list：toggleCollapse 会翻转状态并抛事件', () => {
  const instance = initComponent('components/collapse-list/collapse-list.js',
    { initiallyExpanded: true });

  instance.toggleCollapse();

  assert.equal(instance.data.isCollapsed, true);
  assert.equal(instance.events.length, 1);
  assert.equal(instance.events[0].name, 'toggle');
  assert.equal(instance.events[0].detail.isCollapsed, true);
});

test('collapse-list：连续两次 toggle 回到原状态', () => {
  const instance = initComponent('components/collapse-list/collapse-list.js',
    { initiallyExpanded: true });

  instance.toggleCollapse();
  instance.toggleCollapse();

  assert.equal(instance.data.isCollapsed, false);
  assert.equal(instance.events.length, 2);
});

test('collapse-list：title 属性有默认值', () => {
  const instance = initComponent('components/collapse-list/collapse-list.js');
  assert.equal(instance.properties.title, '');
});

test('home-button：goHome 走 wx.reLaunch 回首页', () => {
  const session = loadComponent('components/home-button/home-button.js');
  const instance = {};
  session.definition.methods.goHome.call(instance);

  assert.equal(session.wx.lastCall('reLaunch').url, '/pages/index/index');
});

// ===========================================================================
// 项目结构 & 前后端接口约定
// ===========================================================================

function readJSON(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8'));
}

test('app.json：每个页面都齐备 js/json/wxml/wxss 四个文件', () => {
  const appJson = readJSON('app.json');

  assert.ok(appJson.pages.length > 0);
  for (const page of appJson.pages) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      const file = path.join(PROJECT_ROOT, `${page}.${ext}`);
      assert.ok(fs.existsSync(file), `缺少 ${page}.${ext}`);
    }
  }
});

test('app.json：usingComponents 指向的组件都存在', () => {
  const appJson = readJSON('app.json');

  for (const [name, target] of Object.entries(appJson.usingComponents || {})) {
    const base = path.join(PROJECT_ROOT, target.replace(/^\//, ''));
    assert.ok(fs.existsSync(`${base}.js`), `组件 ${name} 缺少 js：${target}`);
    assert.ok(fs.existsSync(`${base}.wxml`), `组件 ${name} 缺少 wxml：${target}`);
  }
});

test('project.config.json：tests 与 .workbuddy 不会被打包', () => {
  const config = readJSON('project.config.json');
  const ignored = (config.packOptions && config.packOptions.ignore) || [];
  const values = ignored.map((entry) => entry.value);

  assert.ok(values.includes('tests'), 'tests 目录需要排除在打包之外');
  assert.ok(values.includes('.workbuddy'));
});

test('config.js：所有接口都指向同一个小程序后端前缀', () => {
  const { exports } = loadModule('config.js');
  const prefix = 'https://www.lian-yolo.com/weixin-miniprogram/api';

  assert.equal(exports.API.domain, 'https://www.lian-yolo.com');
  Object.entries(exports.API).forEach(([name, value]) => {
    if (name === 'domain') return;
    const url = typeof value === 'function' ? value(1, 'x') : value;
    assert.ok(url.startsWith(prefix), `${name} 没有指向后端前缀：${url}`);
  });
});

test('config.js：接口路径与后端 urlpatterns 一一对应', () => {
  const { exports } = loadModule('config.js');
  const { API } = exports;
  const prefix = API.domain + '/weixin-miniprogram/api';

  const generated = new Set([
    API.saveWeixinUserInfo,
    API.createNewActivity,
    API.getActivities('openid-1').split('?')[0],
    API.getActivity(1, 'x').split('?')[0],
    API.copyActivityToMy(1),
    API.updateActivity(1),
    API.deleteActivity(1),
    API.addActivityItem(1),
    API.initActivityItems(1),
    API.updateActivityItem(1, 1),
    API.deleteActivityItem(1, 1),
    API.updateWhiteList(1),
  ].map((url) => url.slice(prefix.length)));

  assert.deepEqual([...generated].sort(), [
    '/activities/',
    '/activities/1/',
    '/activities/1/copy-to-my/',
    '/activities/1/init-items/',
    '/activities/1/items/',
    '/activities/1/items/1/',
    '/activities/1/white_list/',
    '/jscode2session/',
  ]);
});

test('sitemap.json 与 app.json 都是合法 JSON', () => {
  assert.ok(readJSON('sitemap.json'));
  assert.ok(readJSON('app.json'));
});
