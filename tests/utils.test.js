'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModule } = require('./helpers/miniprogram');

function setup() {
  const { exports: utils, wx } = loadModule('utils/utils.js');
  return { utils, wx };
}

// ---------------------------------------------------------------------------
// 登录态
// ---------------------------------------------------------------------------

test('getWeixinID：storage 里没有 key 时返回空字符串', () => {
  const { utils } = setup();
  assert.equal(utils.getWeixinID(), '');
});

test('getWeixinID：能读回 setWeixinID 写入的值', () => {
  const { utils } = setup();
  utils.setWeixinID('openid-abc');
  assert.equal(utils.getWeixinID(), 'openid-abc');
});

test('setWeixinID：传空值不会写坏 storage', () => {
  const { utils } = setup();
  utils.setWeixinID('openid-abc');
  utils.setWeixinID(null);
  assert.equal(utils.getWeixinID(), '');
});

test('isLoggedIn：未登录为 false，登录后为 true', () => {
  const { utils } = setup();
  assert.equal(utils.isLoggedIn(), false);
  utils.setWeixinID('openid-abc');
  assert.equal(utils.isLoggedIn(), true);
});

test('clearWeixinID：清掉之后再判未登录', () => {
  const { utils } = setup();
  utils.setWeixinID('openid-abc');
  utils.clearWeixinID();
  assert.equal(utils.isLoggedIn(), false);
  assert.equal(utils.getWeixinID(), '');
});

test('isLoggedIn：storage 里是 null 时也判未登录', () => {
  const { utils, wx } = setup();
  wx.__storageOverride = { weixinID: null };
  assert.equal(utils.getWeixinID(), '');
  assert.equal(utils.isLoggedIn(), false);
});

// ---------------------------------------------------------------------------
// 登录页地址
// ---------------------------------------------------------------------------

test('buildLoginUrl：不传 redirect 时就是登录页本身', () => {
  const { utils } = setup();
  assert.equal(utils.buildLoginUrl(), '/pages/login/login');
  assert.equal(utils.buildLoginUrl(''), '/pages/login/login');
});

test('buildLoginUrl：redirect 被正确编码（含查询参数）', () => {
  const { utils } = setup();
  const url = utils.buildLoginUrl('/pages/activity_detail/activity_detail?activityID=12');
  assert.equal(url, '/pages/login/login?redirect=%2Fpages%2Factivity_detail%2Factivity_detail%3FactivityID%3D12');

  const decoded = decodeURIComponent(url.split('redirect=')[1]);
  assert.equal(decoded, '/pages/activity_detail/activity_detail?activityID=12');
});

// ---------------------------------------------------------------------------
// requestWithLoading
// ---------------------------------------------------------------------------

test('requestWithLoading：2xx 时 resolve 原始响应', async () => {
  const { utils, wx } = setup();
  wx.__response = { statusCode: 200, data: { my: [], shared: [], public: [] } };

  const res = await utils.requestWithLoading({ url: '/x', method: 'GET' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data, { my: [], shared: [], public: [] });
  assert.equal(wx.lastCall('request').url, '/x');
  assert.equal(wx.lastCall('request').method, 'GET');
});

test('requestWithLoading：201 也算成功', async () => {
  const { utils, wx } = setup();
  wx.__response = { statusCode: 201, data: { id: 1 } };
  const res = await utils.requestWithLoading({ url: '/x', method: 'POST' });
  assert.equal(res.data.id, 1);
});

test('requestWithLoading：优先使用服务端返回的 error 文案', async () => {
  const { utils, wx } = setup();
  wx.__response = { statusCode: 403, data: { error: '权限不足，只有活动创建者可以删除自己的活动' } };

  await assert.rejects(
    () => utils.requestWithLoading({ url: '/x', method: 'DELETE' }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.equal(err.message, '权限不足，只有活动创建者可以删除自己的活动');
      return true;
    },
  );
});

test('requestWithLoading：没有服务端文案时按状态码给中文提示', async () => {
  const { utils, wx } = setup();

  const cases = [
    [400, '请求参数错误'],
    [401, '未授权，请重新登录'],
    [403, '拒绝访问'],
    [404, '请求的资源不存在'],
    [500, '服务器内部错误'],
    [502, '网关错误'],
    [503, '服务不可用'],
    [418, '请求失败 (418)'],
  ];

  for (const [statusCode, expected] of cases) {
    wx.__response = { statusCode, data: {} };
    await assert.rejects(
      () => utils.requestWithLoading({ url: '/x' }),
      (err) => {
        assert.equal(err.message, expected, `状态码 ${statusCode}`);
        assert.equal(err.statusCode, statusCode);
        return true;
      },
    );
  }
});

test('requestWithLoading：状态码 200 但带了业务 error 也要 reject', async () => {
  const { utils, wx } = setup();
  wx.__response = { statusCode: 200, data: { error: '活动不存在' } };

  await assert.rejects(
    () => utils.requestWithLoading({ url: '/x' }),
    (err) => {
      assert.equal(err.message, '活动不存在');
      return true;
    },
  );
});

test('requestWithLoading：网络失败时 statusCode 为 0', async () => {
  const { utils, wx } = setup();
  wx.__requestFail = { errMsg: 'request:fail timeout' };

  await assert.rejects(
    () => utils.requestWithLoading({ url: '/x' }),
    (err) => {
      assert.equal(err.statusCode, 0);
      assert.equal(err.message, '网络请求超时');
      return true;
    },
  );
});

test('requestWithLoading：网络失败但不是超时时给通用文案', async () => {
  const { utils, wx } = setup();
  wx.__requestFail = { errMsg: 'request:fail dns resolve failed' };

  await assert.rejects(
    () => utils.requestWithLoading({ url: '/x' }),
    (err) => {
      assert.equal(err.message, '网络连接失败');
      return true;
    },
  );
});

test('requestWithLoading：无论成功失败都会收掉 loading', async () => {
  const { utils, wx } = setup();

  wx.__response = { statusCode: 200, data: {} };
  await utils.requestWithLoading({ url: '/ok' });
  assert.equal(wx.calledWith('showLoading'), true);
  assert.equal(wx.calledWith('hideLoading'), true);

  wx.__response = { statusCode: 500, data: {} };
  await utils.requestWithLoading({ url: '/bad' }).catch(() => {});
  assert.equal(wx.calls('hideLoading').length, 2);
});

test('requestWithLoading：透传 data 和 header', async () => {
  const { utils, wx } = setup();
  wx.__response = { statusCode: 200, data: {} };

  await utils.requestWithLoading({
    url: '/x',
    method: 'PUT',
    data: { weixin_id: 'openid-1' },
    header: { 'content-type': 'application/json' },
  });

  const sent = wx.lastCall('request');
  assert.deepEqual(sent.data, { weixin_id: 'openid-1' });
  assert.deepEqual(sent.header, { 'content-type': 'application/json' });
});

test('formatTime：补零输出', () => {
  const { utils } = setup();
  const date = new Date(2026, 0, 5, 8, 7, 6);
  assert.equal(utils.formatTime(date), '2026/01/05 08:07:06');
});
