'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadPage } = require('./helpers/miniprogram');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const ACTIVITY_ID = '7';

function activityPayload({
  type = '',
  permission = 'creator',
  title = '晨跑点名',
  items,
  whiteList,
} = {}) {
  return {
    id: Number(ACTIVITY_ID),
    creator_weixin_id: 'owner',
    creator_weixin_name: '创建者',
    activity_title: title,
    activity_type: type,
    activity_items: items || {
      1: { name: '张三', status: '', operator: '', operator_avatar_url: '' },
      2: { name: '李四', status: 'completed', operator: 'owner', operator_avatar_url: '' },
      3: { name: '王五', status: 'deleted', operator: 'openid-1', operator_avatar_url: '' },
    },
    white_list: whiteList || [
      { weixin_id: 'owner', avatar_url: '', permission: 'creator' },
      { weixin_id: 'openid-1', avatar_url: '', permission: permission },
    ],
  };
}

/** 打开详情页并等待首次数据加载完成 */
async function openDetail(options = {}) {
  const { page, wx, session } = loadPage('pages/activity_detail/activity_detail.js');
  wx.setStorageSync('weixinID', options.weixinID === undefined ? 'openid-1' : options.weixinID);
  wx.__response = {
    statusCode: 200,
    data: activityPayload(options),
  };

  page.onLoad({ activityID: options.activityID || ACTIVITY_ID });
  await tick();

  return { page, wx, session };
}

// ---------------------------------------------------------------------------
// 加载与权限
// ---------------------------------------------------------------------------

test('详情：未登录时 redirectTo 登录页并带回跳地址', () => {
  const { page, wx } = loadPage('pages/activity_detail/activity_detail.js');

  page.onLoad({ activityID: ACTIVITY_ID });

  assert.equal(wx.calledWith('request'), false);
  const url = wx.lastCall('redirectTo').url;
  assert.ok(url.startsWith('/pages/login/login?redirect='));
  assert.equal(decodeURIComponent(url.split('redirect=')[1]),
    `/pages/activity_detail/activity_detail?activityID=${ACTIVITY_ID}`);
});

test('详情：缺少 activityID 时提示且不发请求', () => {
  const { page, wx } = loadPage('pages/activity_detail/activity_detail.js');
  wx.setStorageSync('weixinID', 'openid-1');

  page.onLoad({});

  assert.equal(wx.calledWith('request'), false);
  assert.equal(wx.lastCall('showToast').title, '活动ID无效: undefined');
});

test('详情：拉取时带上 weixin_id 并解析出 creator 权限', async () => {
  const { page, wx } = await openDetail({ permission: 'creator' });

  const sent = wx.lastCall('request');
  assert.ok(sent.url.includes(`/activities/${ACTIVITY_ID}/?weixin_id=openid-1`));

  assert.equal(page.data.activityID, ACTIVITY_ID);
  assert.equal(page.data.currentUserWeixinID, 'openid-1');
  assert.equal(page.data.currentUserPermission, 'creator');
  assert.equal(page.data.title, '晨跑点名');
  assert.equal(page.data.activityType, '');
});

test('详情：解析出 admin 权限', async () => {
  const { page } = await openDetail({ permission: 'admin' });
  assert.equal(page.data.currentUserPermission, 'admin');
});

test('详情：白名单里没有自己时权限为空字符串', async () => {
  const { page } = await openDetail({
    weixinID: 'openid-stranger',
    whiteList: [{ weixin_id: 'owner', avatar_url: '', permission: 'creator' }],
  });
  assert.equal(page.data.currentUserPermission, '');
});

test('详情：public 类型的活动也正常解析', async () => {
  const { page } = await openDetail({ type: 'public' });
  assert.equal(page.data.activityType, 'public');
});

test('详情：统计数字按状态分类', async () => {
  const { page } = await openDetail();

  assert.equal(page.data.totalCount, 3);
  assert.equal(page.data.checkedCount, 1);
  assert.equal(page.data.deletedCount, 1);
  assert.equal(page.data.uncheckedCount, 1);
});

test('详情：刷新按钮重新拉取', async () => {
  const { page, wx } = await openDetail();
  const before = wx.calls('request').length;

  page.refreshData();
  await tick();

  assert.equal(wx.calls('request').length, before + 1);
});

test('详情：活动不存在时提示并跳回首页', async () => {
  const { page, wx, session } = loadPage('pages/activity_detail/activity_detail.js');
  wx.setStorageSync('weixinID', 'openid-1');
  wx.__response = { statusCode: 404, data: { error: '活动不存在' } };

  page.onLoad({ activityID: '999' });
  await tick();

  assert.equal(wx.lastCall('showToast').title, '活动不存在或已被删除');

  session.runTimers();
  assert.equal(wx.lastCall('reLaunch').url, '/pages/index/index');
});

// ---------------------------------------------------------------------------
// 分享
// ---------------------------------------------------------------------------

test('详情：onShareTimeline 用 query 而不是 path', async () => {
  const { page } = await openDetail();

  const shared = page.onShareTimeline();

  assert.equal(shared.title, '晨跑点名');
  assert.equal(shared.query, `activityID=${ACTIVITY_ID}`);
  assert.equal('path' in shared, false);
});

test('详情：onShareAppMessage 带 activityID', async () => {
  const { page } = await openDetail();

  const shared = page.onShareAppMessage();

  assert.equal(shared.path, `/pages/activity_detail/activity_detail?activityID=${ACTIVITY_ID}`);
});

// ---------------------------------------------------------------------------
// 条目状态
// ---------------------------------------------------------------------------

test('详情：完成条目的请求形态', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.handleCompleteItem({ currentTarget: { dataset: { index: '1' } } });
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'PUT');
  assert.ok(sent.url.endsWith(`/activities/${ACTIVITY_ID}/items/1/`));
  assert.equal(sent.data.activity_item_status, 'completed');
  assert.equal(sent.data.weixin_id, 'openid-1');
});

test('详情：取消完成传空状态', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.handleUncompleteItem({ currentTarget: { dataset: { index: '2' } } });
  await tick();

  assert.equal(wx.lastCall('request').data.activity_item_status, '');
});

test('详情：标记删除传 deleted', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.handleDeleteItem({ currentTarget: { dataset: { index: '1' } } });
  await tick();

  assert.equal(wx.lastCall('request').data.activity_item_status, 'deleted');
});

test('详情：取消删除传空状态', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.handleUndeleteItem({ currentTarget: { dataset: { index: '3' } } });
  await tick();

  assert.equal(wx.lastCall('request').data.activity_item_status, '');
});

test('详情：操作成功后用响应里的 items 刷新 data', async () => {
  const { page, wx } = await openDetail();
  const nextItems = {
    1: { name: '张三', status: 'completed', operator: 'openid-1', operator_avatar_url: '' },
  };
  wx.__response = { statusCode: 200, data: activityPayload({ items: nextItems }) };

  page.handleCompleteItem({ currentTarget: { dataset: { index: '1' } } });
  await tick();

  assert.deepEqual(page.data.items, nextItems);
  assert.equal(page.data.checkedCount, 1);
  assert.equal(page.data.totalCount, 1);
});

// ---------------------------------------------------------------------------
// 添加 / 彻底删除 / 重置
// ---------------------------------------------------------------------------

test('详情：添加条目前会去掉首尾空格', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.handleNewItemInput({ detail: { value: '  赵六  ' } });
  page.addNewItem();
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'POST');
  assert.ok(sent.url.endsWith(`/activities/${ACTIVITY_ID}/items/`));
  assert.equal(sent.data.activity_item_name, '赵六');
});

test('详情：添加空条目不发请求', async () => {
  const { page, wx } = await openDetail();
  const before = wx.calls('request').length;
  page.setData({ newItemName: '' });

  page.addNewItem();
  await tick();

  assert.equal(wx.calls('request').length, before);
  assert.equal(wx.lastCall('showToast').title, '请输入待办事项名称');
});

test('详情：彻底删除要先确认，取消则不请求', async () => {
  const { page, wx } = await openDetail();
  const before = wx.calls('request').length;
  wx.__modalConfirm = false;

  page.handleDeleteItemCompletely({ currentTarget: { dataset: { index: '3', name: '王五' } } });
  await tick();

  assert.ok(wx.calledWith('showModal'));
  assert.equal(wx.calls('request').length, before);
});

test('详情：确认后彻底删除走 DELETE', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.handleDeleteItemCompletely({ currentTarget: { dataset: { index: '3', name: '王五' } } });
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'DELETE');
  assert.ok(sent.url.endsWith(`/activities/${ACTIVITY_ID}/items/3/`));
});

test('详情：一键全部未完成要先确认，确认后 PUT init-items', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.initItems();
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'PUT');
  assert.ok(sent.url.endsWith(`/activities/${ACTIVITY_ID}/init-items/`));
  assert.equal(sent.data.weixin_id, 'openid-1');
});

test('详情：一键全部未完成取消时不发请求', async () => {
  const { page, wx } = await openDetail();
  const before = wx.calls('request').length;
  wx.__modalConfirm = false;

  page.initItems();
  await tick();

  assert.equal(wx.calls('request').length, before);
});

// ---------------------------------------------------------------------------
// 管理员
// ---------------------------------------------------------------------------

test('详情：设为管理员提交 permission=admin', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.setAdmin({ currentTarget: { dataset: { id: 'openid-2' } } });
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'PUT');
  assert.ok(sent.url.endsWith(`/activities/${ACTIVITY_ID}/white_list/`));
  assert.deepEqual({ ...sent.data.white_list },
    { weixin_id: 'openid-2', permission: 'admin' });
});

test('详情：取消管理员提交空 permission', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 200, data: activityPayload() };

  page.unsetAdmin({ currentTarget: { dataset: { id: 'openid-2' } } });
  await tick();

  assert.deepEqual({ ...wx.lastCall('request').data.white_list },
    { weixin_id: 'openid-2', permission: '' });
});

test('详情：白名单更新后用响应覆盖 whiteList', async () => {
  const { page, wx } = await openDetail();
  const nextWhiteList = [
    { weixin_id: 'owner', avatar_url: '', permission: 'creator' },
    { weixin_id: 'openid-2', avatar_url: 'https://cdn/b.png', permission: 'admin' },
  ];
  wx.__response = { statusCode: 200, data: activityPayload({ whiteList: nextWhiteList }) };

  page.setAdmin({ currentTarget: { dataset: { id: 'openid-2' } } });
  await tick();

  assert.equal(page.data.whiteList[1].permission, 'admin');
});

// ---------------------------------------------------------------------------
// 改名 / 长按 / 另存
// ---------------------------------------------------------------------------

test('详情：改名要先进入编辑态', async () => {
  const { page } = await openDetail();
  assert.equal(page.data.isEditingTitle, false);
  page.startEditingTitle();
  assert.equal(page.data.isEditingTitle, true);
});

test('详情：改名为空时拦截，不发请求', async () => {
  const { page, wx } = await openDetail();
  const before = wx.calls('request').length;
  page.setData({ title: '   ' });

  page.saveTitle();
  await tick();

  assert.equal(wx.calls('request').length, before);
  assert.equal(wx.lastCall('showToast').title, '活动/事项名称不能为空');
});

test('详情：改名成功后退出编辑态并提交 PUT', async () => {
  const { page, wx } = await openDetail();
  page.setData({ title: '新的名字' });
  wx.__response = { statusCode: 200, data: activityPayload({ title: '新的名字' }) };

  page.saveTitle();
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'PUT');
  assert.equal(sent.data.activity_title, '新的名字');
  assert.equal(page.data.isEditingTitle, false);
});

test('详情：长按把姓名与手机号拆开并识别手机号', async () => {
  const { page } = await openDetail();
  page.setData({
    items: { 1: { name: '张三 13800138000', status: '', operator: '' } },
  });

  page.showItemDetail({ currentTarget: { dataset: { index: '1' } } });

  assert.equal(page.data.showItemDetail, true);
  assert.deepEqual(page.data.modalItems, [
    { text: '张三', isPhone: false },
    { text: '13800138000', isPhone: true },
  ]);
});

test('详情：逗号也能作为分隔符', async () => {
  const { page } = await openDetail();
  page.setData({ items: { 1: { name: '李四,13900139000', status: '', operator: '' } } });

  page.showItemDetail({ currentTarget: { dataset: { index: '1' } } });

  assert.deepEqual(page.data.modalItems.map((entry) => entry.text), ['李四', '13900139000']);
  assert.equal(page.data.modalItems[1].isPhone, true);
});

test('详情：非手机号不会被识别成可拨号', async () => {
  const { page } = await openDetail();
  page.setData({ items: { 1: { name: '张三 12345', status: '', operator: '' } } });

  page.showItemDetail({ currentTarget: { dataset: { index: '1' } } });

  assert.equal(page.data.modalItems[1].isPhone, false);
});

test('详情：关闭弹层', async () => {
  const { page } = await openDetail();
  page.setData({ showItemDetail: true });

  page.closeModal();

  assert.equal(page.data.showItemDetail, false);
});

test('详情：拨号走 wx.makePhoneCall', async () => {
  const { page, wx } = await openDetail();

  page.makePhoneCall({ currentTarget: { dataset: { phone: '13800138000' } } });

  assert.equal(wx.lastCall('makePhoneCall').phoneNumber, '13800138000');
});

test('详情：一键另存后回活动列表', async () => {
  const { page, wx, session } = await openDetail();
  wx.__response = { statusCode: 200, data: { my: [], shared: [], public: [] } };

  page.copyActivity();
  await tick();

  const sent = wx.lastCall('request');
  assert.equal(sent.method, 'POST');
  assert.ok(sent.url.endsWith(`/activities/${ACTIVITY_ID}/copy-to-my/`));
  assert.equal(wx.lastCall('showToast').title, '复制成功');

  session.runTimers();
  assert.equal(wx.lastCall('reLaunch').url, '/pages/activity_list/activity_list');
});

test('详情：请求失败时展示服务端错误文案', async () => {
  const { page, wx } = await openDetail();
  wx.__response = { statusCode: 400, data: { error: '无法操作，该活动事项已被其他人操作' } };

  page.handleCompleteItem({ currentTarget: { dataset: { index: '1' } } });
  await tick();

  assert.equal(wx.lastCall('showToast').title, '无法操作，该活动事项已被其他人操作');
});
