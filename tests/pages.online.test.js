'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadPage } = require('./helpers/miniprogram');

/** 让所有已排队的微任务跑完（页面里的 await 链） */
const tick = () => new Promise((resolve) => setImmediate(resolve));

// ===========================================================================
// 首页
// ===========================================================================

test('首页：分享文案固定为「点名签到小工具」', () => {
  const { page } = loadPage('pages/index/index.js');

  assert.equal(page.onShareAppMessage().title, '点名签到小工具');
  assert.equal(page.onShareTimeline().title, '点名签到小工具');
  assert.equal(page.onShareAppMessage().path, '/pages/index/index');
});

test('首页：onShareTimeline 不带 path 字段', () => {
  const { page } = loadPage('pages/index/index.js');
  assert.equal('path' in page.onShareTimeline(), false);
});

test('首页：未登录时「在线版」跳登录页', () => {
  const { page, wx } = loadPage('pages/index/index.js');

  page.navigateToOnline();

  assert.equal(wx.lastCall('navigateTo').url, '/pages/login/login');
});

test('首页：已登录时「在线版」直接进活动列表', () => {
  const { page, wx } = loadPage('pages/index/index.js');
  wx.setStorageSync('weixinID', 'openid-1');

  page.navigateToOnline();

  assert.equal(wx.lastCall('navigateTo').url, '/pages/activity_list/activity_list');
});

test('首页：storage 里 weixinID 为 null 也判未登录', () => {
  const { page, wx } = loadPage('pages/index/index.js');
  wx.__storageOverride = { weixinID: null };

  page.navigateToOnline();

  assert.equal(wx.lastCall('navigateTo').url, '/pages/login/login');
});

test('首页：「离线版」进离线列表，不受登录态影响', () => {
  const { page, wx } = loadPage('pages/index/index.js');

  page.navigateToOffline();

  assert.equal(wx.lastCall('navigateTo').url, '/pages/offline/activity_list/activity_list');
});

// ===========================================================================
// 登录页
// ===========================================================================

test('登录页：onLoad 解析 redirect 参数', () => {
  const { page } = loadPage('pages/login/login.js');

  page.onLoad({ redirect: encodeURIComponent('/pages/activity_list/activity_list') });

  assert.equal(page.data.redirect, '/pages/activity_list/activity_list');
});

test('登录页：onLoad 没有 redirect 时为字符串空值', () => {
  const { page } = loadPage('pages/login/login.js');

  page.onLoad({});

  assert.equal(page.data.redirect, '');
});

test('登录页：redirect 参数畸形不崩，只忽略回跳', () => {
  const { page } = loadPage('pages/login/login.js');

  page.onLoad({ redirect: '%E4%B8' });

  assert.equal(page.data.redirect, '');
});

test('登录页：已登录时 onLoad 直接进活动列表', () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.setStorageSync('weixinID', 'openid-1');

  page.onLoad({});

  assert.equal(page.data.hasUserInfo, true);
  assert.equal(wx.lastCall('reLaunch').url, '/pages/activity_list/activity_list');
});

test('登录页：选头像后走 readFile + wx.request，不再用 wx.uploadFile', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__loginCode = 'code-xyz';
  wx.__fileContent = 'BASE64-AVATAR';
  wx.__response = { statusCode: 200, data: { weixin_id: 'openid-1' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp-avatar.png' } });

  // 读文件是同步触发的
  const read = wx.lastCall('readFile');
  assert.equal(read.filePath, 'wxfile://tmp-avatar.png');
  assert.equal(read.encoding, 'base64');

  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'POST');
  assert.ok(sent.url.endsWith('/jscode2session/'));
  assert.equal(sent.header['content-type'], 'application/json');
  assert.equal(sent.data.code, 'code-xyz');
  assert.equal(sent.data.avatar_base64, 'BASE64-AVATAR');
  assert.equal(sent.data.avatar_ext, 'png');

  // 这就是这次改动的核心：彻底不碰 uploadFile
  assert.equal(wx.calledWith('uploadFile'), false);
});

test('登录页：从临时文件路径里取图片后缀', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 200, data: { weixin_id: 'x' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp-a.jpeg' } });
  await tick();

  assert.equal(wx.lastCall('request').data.avatar_ext, 'jpeg');
});

test('登录页：路径里没有后缀时按 jpeg 提交', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 200, data: { weixin_id: 'x' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'http://tmp/abc123' } });
  await tick();

  assert.equal(wx.lastCall('request').data.avatar_ext, 'jpeg');
});

test('登录页：后缀不在白名单里时也按 jpeg 提交', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 200, data: { weixin_id: 'x' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp-a.heic' } });
  await tick();

  assert.equal(wx.lastCall('request').data.avatar_ext, 'jpeg');
});

test('登录页：登录成功写入 weixinID 并回到 redirect', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  page.onLoad({ redirect: encodeURIComponent('/pages/activity_detail/activity_detail?activityID=9') });
  wx.__response = { statusCode: 200, data: { weixin_id: 'openid-9', avatar_url: 'https://cdn/a.png' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.getStorageSync('weixinID'), 'openid-9');
  assert.equal(page.data.hasUserInfo, true);
  assert.equal(wx.lastCall('reLaunch').url, '/pages/activity_detail/activity_detail?activityID=9');
});

test('登录页：登录成功但没有 redirect 时回活动列表', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  page.onLoad({});
  wx.__response = { statusCode: 200, data: { weixin_id: 'openid-1' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.lastCall('reLaunch').url, '/pages/activity_list/activity_list');
});

test('登录页：HTTP 非 2xx 时提示且不写 storage', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 502, data: { error: '网关错误' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.getStorageSync('weixinID'), '');
  assert.equal(wx.lastCall('showToast').title, '网关错误');
  assert.equal(wx.calledWith('reLaunch'), false);
});

test('登录页：HTTP 非 2xx 且无 error 文案时带上状态码', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 500, data: { detail: 'oops' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.lastCall('showToast').title, '登录失败 (500)');
});

test('登录页：HTTP 非 2xx 且返回不是 JSON 时给通用文案', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 502, data: '<html>502 Bad Gateway</html>' };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.lastCall('showToast').title, '登录失败，请重试');
});

test('登录页：返回不是 JSON 时提示失败', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 200, data: '<html>502 Bad Gateway</html>' };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.getStorageSync('weixinID'), '');
  assert.equal(wx.lastCall('showToast').title, '登录失败，请重试');
});

test('登录页：返回缺少 weixin_id 时提示失败', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 200, data: { nickname: '' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.getStorageSync('weixinID'), '');
  assert.equal(wx.lastCall('showToast').title, '登录失败，请重试');
});

test('登录页：请求失败时把微信的 errMsg 原样弹出来', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__requestFail = { errMsg: 'request:fail something nobody mapped' };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  const modal = wx.lastCall('showModal');
  assert.equal(modal.title, '登录失败');
  assert.equal(modal.content, 'request:fail something nobody mapped');
  assert.equal(modal.showCancel, false);
  assert.equal(wx.calledWith('reLaunch'), false);
  assert.equal(wx.getStorageSync('weixinID'), '');
});

test('登录页：域名没配白名单时给一句中文人话，并保留原文', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__requestFail = { errMsg: 'request:fail url not in domain list' };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  const content = wx.lastCall('showModal').content;
  assert.ok(content.includes('服务器域名'), content);
  assert.ok(content.includes('request:fail url not in domain list'), content);
});

test('登录页：隐私协议未声明时也给中文人话', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__requestFail = {
    errMsg: 'request:fail api scope is not declared in the privacy agreement',
  };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.ok(wx.lastCall('showModal').content.includes('用户隐私保护指引'));
});

test('登录页：读头像文件失败时也要给出原因', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__readFileFail = { errMsg: 'readFile:fail no such file or directory' };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://gone.png' } });
  await tick();

  assert.equal(wx.calledWith('request'), false);
  assert.ok(wx.lastCall('showModal').content.includes('readFile:fail'));
});

test('登录页：拿不到 errMsg 时退回通用文案', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__requestFail = {};

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.equal(wx.lastCall('showToast').title, '登录失败，请检查网络');
  assert.equal(wx.calledWith('showModal'), false);
});

test('登录页：chooseAvatar 没给出 avatarUrl 时不发任何请求', () => {
  const { page, wx } = loadPage('pages/login/login.js');

  page.onChooseAvatar({ detail: {} });

  assert.equal(wx.calledWith('readFile'), false);
  assert.equal(wx.calledWith('login'), false);
  assert.equal(wx.lastCall('showToast').title, '没有取到微信头像，请重试');
});

test('登录页：wx.login 失败要提示用户且不读文件', () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__loginFail = { errMsg: 'login:fail' };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });

  assert.equal(wx.lastCall('showToast').title, '登录失败，请重试');
  assert.equal(wx.calledWith('readFile'), false);
  assert.equal(wx.calledWith('request'), false);
});

test('登录页：过程中会显示 loading 并收掉', async () => {
  const { page, wx } = loadPage('pages/login/login.js');
  wx.__response = { statusCode: 200, data: { weixin_id: 'openid-1' } };

  page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.png' } });
  await tick();

  assert.ok(wx.calledWith('showLoading'));
  assert.ok(wx.calledWith('hideLoading'));
});

// ===========================================================================
// 活动列表
// ===========================================================================

function listResponse() {
  return {
    statusCode: 200,
    data: {
      my: [{ id: 1, activity_title: '我创建的' }],
      shared: [{ id: 2, activity_title: '共享给我的' }],
      public: [{ id: 3, activity_title: '公共的' }],
    },
  };
}

/** 页面 data 里的三组列表（注意 key 与接口响应不同：带 Activities 后缀） */
function listState() {
  return {
    myActivities: [{ id: 1, activity_title: '我创建的' }],
    sharedActivities: [{ id: 2, activity_title: '共享给我的' }],
    publicActivities: [{ id: 3, activity_title: '公共的' }],
  };
}

test('列表：未登录时不发请求，直接跳登录页并带回跳地址', () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');

  page.onShow();

  assert.equal(wx.calledWith('request'), false);
  const url = wx.lastCall('redirectTo').url;
  assert.ok(url.startsWith('/pages/login/login?redirect='));
  assert.equal(decodeURIComponent(url.split('redirect=')[1]), '/pages/activity_list/activity_list');
});

test('列表：已登录时带 weixin_id 拉取并落到 data', async () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');
  wx.setStorageSync('weixinID', 'openid-1');
  wx.__response = listResponse();

  page.onShow();
  await tick();

  assert.ok(wx.lastCall('request').url.includes('weixin_id=openid-1'));
  assert.equal(page.data.myActivities.length, 1);
  assert.equal(page.data.sharedActivities[0].activity_title, '共享给我的');
  assert.equal(page.data.publicActivities[0].activity_title, '公共的');
});

test('列表：请求失败弹 toast', async () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');
  wx.setStorageSync('weixinID', 'openid-1');
  wx.__response = { statusCode: 500, data: {} };

  page.onShow();
  await tick();

  assert.equal(wx.lastCall('showToast').title, '服务器内部错误');
});

test('列表：点击条目跳详情并带上 activityID', () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');

  page.navigateToActivity({ currentTarget: { dataset: { id: 42 } } });

  assert.equal(wx.lastCall('navigateTo').url, '/pages/activity_detail/activity_detail?activityID=42');
});

test('列表：删除要先二次确认，取消则不请求', () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');
  wx.setStorageSync('weixinID', 'openid-1');
  wx.__modalConfirm = false;

  page.deleteActivity({ currentTarget: { dataset: { id: 1, title: '活动A', source: 'my' } } });

  assert.ok(wx.calledWith('showModal'));
  assert.equal(wx.calledWith('request'), false);
});

test('列表：确认删除后调 DELETE 并带上 source', async () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');
  wx.setStorageSync('weixinID', 'openid-1');
  wx.__response = { statusCode: 200, data: { message: '活动删除成功' } };

  page.deleteActivity({ currentTarget: { dataset: { id: 2, title: '共享活动', source: 'shared' } } });
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'DELETE');
  assert.equal(sent.data.source, 'shared');
  assert.equal(sent.data.weixin_id, 'openid-1');
  assert.ok(sent.url.endsWith('/activities/2/'));
});

test('列表：删除「我创建的」只从 myActivities 里移出', async () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');
  wx.setStorageSync('weixinID', 'openid-1');
  page.setData(listState());
  wx.__response = { statusCode: 200, data: { message: 'ok' } };

  page.deleteActivity({ currentTarget: { dataset: { id: 1, title: '我创建的', source: 'my' } } });
  await tick();

  assert.deepEqual(page.data.myActivities, []);
  assert.equal(page.data.sharedActivities.length, 1);
});

test('列表：删除「共享给我的」只从 sharedActivities 里移出', async () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');
  wx.setStorageSync('weixinID', 'openid-1');
  page.setData(listState());
  wx.__response = { statusCode: 200, data: { message: 'ok' } };

  page.deleteActivity({ currentTarget: { dataset: { id: 2, title: '共享', source: 'shared' } } });
  await tick();

  assert.deepEqual(page.data.sharedActivities, []);
  assert.equal(page.data.myActivities.length, 1);
});

test('列表：另存调用 copy-to-my 并带 weixin_id', async () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');
  wx.setStorageSync('weixinID', 'openid-1');
  wx.__response = { statusCode: 200, data: listResponse().data };

  page.copyActivity({ currentTarget: { dataset: { id: 7 } } });
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'POST');
  assert.ok(sent.url.endsWith('/activities/7/copy-to-my/'));
  assert.equal(sent.data.weixin_id, 'openid-1');
  assert.equal(wx.lastCall('showToast').title, '复制成功');
});

test('列表：新建跳创建页', () => {
  const { page, wx } = loadPage('pages/activity_list/activity_list.js');

  page.createNewActivity();

  assert.equal(wx.lastCall('navigateTo').url, '/pages/activity_create/activity_create');
});

// ===========================================================================
// 创建活动
// ===========================================================================

test('创建：多行输入按行切分、去空行、去首尾空格', () => {
  const { page } = loadPage('pages/activity_create/activity_create.js');

  page.handleActivityItemsInput({ detail: { value: ' 张三 \n\n李四\n  \n王五' } });

  assert.deepEqual(page.data.activityItems, ['张三', '李四', '王五']);
});

test('创建：标题会去掉首尾空格', () => {
  const { page } = loadPage('pages/activity_create/activity_create.js');

  page.handleActivityTitleInput({ detail: { value: '  晨跑  ' } });

  assert.equal(page.data.activityTitle, '晨跑');
});

test('创建：没有标题直接拦截，不发请求', () => {
  const { page, wx } = loadPage('pages/activity_create/activity_create.js');
  page.setData({ activityTitle: '', activityItems: ['张三'] });

  page.saveActivity();

  assert.equal(wx.lastCall('showToast').title, '请输入活动/事项名称');
  assert.equal(wx.calledWith('request'), false);
});

test('创建：没有条目直接拦截', () => {
  const { page, wx } = loadPage('pages/activity_create/activity_create.js');
  page.setData({ activityTitle: '晨跑', activityItems: [] });

  page.saveActivity();

  assert.equal(wx.lastCall('showToast').title, '请输入至少一个待办事项');
  assert.equal(wx.calledWith('request'), false);
});

test('创建：条目超过 50 字拦截', () => {
  const { page, wx } = loadPage('pages/activity_create/activity_create.js');
  page.setData({ activityTitle: '晨跑', activityItems: ['甲'.repeat(51)] });

  page.saveActivity();

  assert.equal(wx.lastCall('showToast').title, '待办事项名称不能超过50个字符');
  assert.equal(wx.calledWith('request'), false);
});

test('创建：提交的 payload 与后端约定一致', async () => {
  const { page, wx } = loadPage('pages/activity_create/activity_create.js');
  wx.setStorageSync('weixinID', 'openid-1');
  page.setData({ activityTitle: '晨跑', activityItems: ['张三', '李四'] });
  wx.__response = { statusCode: 200, data: { id: 42 } };

  page.saveActivity();
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'POST');
  assert.ok(sent.url.endsWith('/activities/'));
  assert.deepEqual(Object.keys(sent.data).sort(),
    ['activity_items', 'activity_title', 'creator_weixin_id']);
  assert.equal(sent.data.creator_weixin_id, 'openid-1');
  assert.equal(sent.data.activity_title, '晨跑');
  assert.deepEqual(sent.data.activity_items, ['张三', '李四']);
});

test('创建：成功后 redirectTo 详情页', async () => {
  const { page, wx } = loadPage('pages/activity_create/activity_create.js');
  wx.setStorageSync('weixinID', 'openid-1');
  page.setData({ activityTitle: '晨跑', activityItems: ['张三'] });
  wx.__response = { statusCode: 200, data: { id: 42 } };

  page.saveActivity();
  await tick();

  assert.equal(wx.lastCall('redirectTo').url, '/pages/activity_detail/activity_detail?activityID=42');
});

test('创建：响应缺少 id 时不跳转并提示失败', async () => {
  const { page, wx } = loadPage('pages/activity_create/activity_create.js');
  wx.setStorageSync('weixinID', 'openid-1');
  page.setData({ activityTitle: '晨跑', activityItems: ['张三'] });
  wx.__response = { statusCode: 200, data: { data: 'weird' } };

  page.saveActivity();
  await tick();

  assert.equal(wx.calledWith('redirectTo'), false);
  assert.equal(wx.lastCall('showToast').title, '创建活动失败，请重试');
});
