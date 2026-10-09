'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadPage } = require('./helpers/miniprogram');

// ===========================================================================
// 离线版：新建
// ===========================================================================

test('离线创建：条目字段是 completed，不再是 complete', () => {
  const { page, wx } = loadPage('pages/offline/activity_create/activity_create.js');
  page.setData({ activityName: '晨跑点名', activityItems: ['张三', '李四'] });

  page.saveActivity();

  const stored = wx.getStorageSync('activities');
  assert.equal(stored.length, 1);
  assert.deepEqual(stored[0].activityItems, [
    { itemName: '张三', completed: false, deleted: false },
    { itemName: '李四', completed: false, deleted: false },
  ]);
  // 脏字段 complete 不应再出现
  assert.equal('complete' in stored[0].activityItems[0], false);
});

test('离线创建：新活动插到最前面', () => {
  const { page, wx } = loadPage('pages/offline/activity_create/activity_create.js');
  wx.setStorageSync('activities', [{ activityName: '旧活动', activityItems: [] }]);
  page.setData({ activityName: '新活动', activityItems: ['张三'] });

  page.saveActivity();

  const stored = wx.getStorageSync('activities');
  assert.deepEqual(stored.map((item) => item.activityName), ['新活动', '旧活动']);
});

test('离线创建：保存后 redirectTo 详情页 index=0', () => {
  const { page, wx } = loadPage('pages/offline/activity_create/activity_create.js');
  page.setData({ activityName: '晨跑', activityItems: ['张三'] });

  page.saveActivity();

  assert.equal(wx.lastCall('redirectTo').url,
    '/pages/offline/activity_detail/activity_detail?index=0');
  assert.equal(wx.calledWith('navigateTo'), false);
});

test('离线创建：没有名称时不写 storage', () => {
  const { page, wx } = loadPage('pages/offline/activity_create/activity_create.js');
  page.setData({ activityName: '', activityItems: ['张三'] });

  page.saveActivity();

  assert.equal(wx.getStorageSync('activities'), '');
  assert.equal(wx.lastCall('showToast').title, '请输入活动/事项名称');
});

test('离线创建：多行输入按行切分、去空行、去首尾空格', () => {
  const { page } = loadPage('pages/offline/activity_create/activity_create.js');

  page.handleActivityItemsInput({ detail: { value: ' 张三 \n\n李四\n  \n ' } });

  assert.deepEqual(page.data.activityItems, ['张三', '李四']);
});

test('离线创建：存储还没初始化时能正常创建', () => {
  const { page, wx } = loadPage('pages/offline/activity_create/activity_create.js');
  page.setData({ activityName: '第一个', activityItems: ['A'] });

  page.saveActivity();

  assert.equal(wx.getStorageSync('activities').length, 1);
});

// ===========================================================================
// 离线版：列表
// ===========================================================================

const seedActivities = () => ([
  {
    activityName: '晨跑点名',
    activityItems: [
      { itemName: '张三', completed: false, deleted: false },
      { itemName: '李四', completed: true, deleted: false },
      { itemName: '王五', completed: false, deleted: true },
    ],
  },
  { activityName: '第二组', activityItems: [] },
]);

test('离线列表：统计完成与取消的条数', () => {
  const { page, wx } = loadPage('pages/offline/activity_list/activity_list.js');
  wx.setStorageSync('activities', seedActivities());

  page.onShow();

  assert.equal(page.data.activities.length, 2);
  assert.equal(page.data.activities[0].completedCount, 1);
  assert.equal(page.data.activities[0].deletedCount, 1);
  assert.equal(page.data.activities[1].completedCount, 0);
});

test('离线列表：没有数据时是空数组，不报错', () => {
  const { page } = loadPage('pages/offline/activity_list/activity_list.js');

  page.onShow();

  assert.deepEqual(page.data.activities, []);
});

test('离线列表：点击条目带 index 进详情', () => {
  const { page, wx } = loadPage('pages/offline/activity_list/activity_list.js');

  page.navigateToActivity({ currentTarget: { dataset: { index: 1 } } });

  assert.equal(wx.lastCall('navigateTo').url,
    '/pages/offline/activity_detail/activity_detail?index=1');
});

test('离线列表：新建跳创建页', () => {
  const { page, wx } = loadPage('pages/offline/activity_list/activity_list.js');

  page.createNewActivity();

  assert.equal(wx.lastCall('navigateTo').url, '/pages/offline/activity_create/activity_create');
});

test('离线列表：确认删除后从 storage 移除并刷新', () => {
  const { page, wx } = loadPage('pages/offline/activity_list/activity_list.js');
  wx.setStorageSync('activities', seedActivities());

  page.deleteActivity({ currentTarget: { dataset: { index: 0 } } });

  const stored = wx.getStorageSync('activities');
  assert.deepEqual(stored.map((item) => item.activityName), ['第二组']);
  assert.deepEqual(page.data.activities.map((item) => item.activityName), ['第二组']);
});

test('离线列表：取消删除则不动 storage', () => {
  const { page, wx } = loadPage('pages/offline/activity_list/activity_list.js');
  wx.setStorageSync('activities', seedActivities());
  wx.__modalConfirm = false;

  page.deleteActivity({ currentTarget: { dataset: { index: 0 } } });

  assert.equal(wx.getStorageSync('activities').length, 2);
});

test('离线列表：删除时弹窗带上活动名', () => {
  const { page, wx } = loadPage('pages/offline/activity_list/activity_list.js');
  wx.setStorageSync('activities', seedActivities());

  page.deleteActivity({ currentTarget: { dataset: { index: 0 } } });

  assert.ok(wx.lastCall('showModal').content.includes('晨跑点名'));
});

// ===========================================================================
// 离线版：详情
// ===========================================================================

function openOfflineDetail(activities = seedActivities(), index = 0) {
  const { page, wx, session } = loadPage('pages/offline/activity_detail/activity_detail.js');
  wx.setStorageSync('activities', activities);
  page.onLoad({ index: String(index) });
  return { page, wx, session };
}

test('离线详情：按 index 载入对应活动并收掉 loading', () => {
  const { page, wx } = openOfflineDetail(seedActivities(), 1);

  assert.equal(page.data.index, 1);
  assert.equal(page.data.activityName, '第二组');
  assert.deepEqual(page.data.activityItems, []);
  assert.ok(wx.calledWith('showLoading'));
  assert.ok(wx.calledWith('hideLoading'));
});

test('离线详情：index 缺失时提示且不崩', () => {
  const { page, wx } = loadPage('pages/offline/activity_detail/activity_detail.js');
  wx.setStorageSync('activities', seedActivities());

  page.onLoad({});

  assert.equal(wx.lastCall('showToast').title, 'index invalid');
  assert.ok(wx.calledWith('hideLoading'));
});

test('离线详情：storage 被清空时不崩，只提示', () => {
  const { page, wx } = loadPage('pages/offline/activity_detail/activity_detail.js');

  page.onLoad({ index: '0' });

  assert.equal(wx.lastCall('showToast').title, '活动不存在');
  assert.ok(wx.calledWith('hideLoading'));
  assert.equal(page.data.activityName, '');
});

test('离线详情：勾选完成会写回 storage', () => {
  const { page, wx } = openOfflineDetail();

  page.handleCompleteItem({ currentTarget: { dataset: { index: 0 } } });

  assert.equal(page.data.activityItems[0].completed, true);
  assert.equal(wx.getStorageSync('activities')[0].activityItems[0].completed, true);
});

test('离线详情：再点一次取消完成', () => {
  const { page, wx } = openOfflineDetail();

  page.handleCompleteItem({ currentTarget: { dataset: { index: 0 } } });
  page.handleCompleteItem({ currentTarget: { dataset: { index: 0 } } });

  assert.equal(page.data.activityItems[0].completed, false);
  assert.equal(wx.getStorageSync('activities')[0].activityItems[0].completed, false);
});

test('离线详情：标记取消并写回 storage', () => {
  const { page, wx } = openOfflineDetail();

  page.handleDeleteItem({ currentTarget: { dataset: { index: 0 } } });

  assert.equal(page.data.activityItems[0].deleted, true);
  assert.equal(wx.getStorageSync('activities')[0].activityItems[0].deleted, true);
});

test('离线详情：新增条目会写回 storage', () => {
  const { page, wx, session } = openOfflineDetail();

  page.handleNewItemInput({ detail: { value: '赵六' } });
  page.addNewItem();
  session.runTimers();

  assert.equal(page.data.activityItems.length, 4);
  assert.deepEqual(page.data.activityItems[3],
    { itemName: '赵六', completed: false, deleted: false });
  assert.equal(wx.getStorageSync('activities')[0].activityItems.length, 4);
  assert.equal(page.data.newItemName, '');
});

test('离线详情：空名字不会新增条目', () => {
  const { page } = openOfflineDetail();

  page.setData({ newItemName: '' });
  page.addNewItem();

  assert.equal(page.data.activityItems.length, 3);
});

test('离线详情：彻底删除需确认后写回 storage', () => {
  const { page, wx } = openOfflineDetail();

  page.handleDeleteItemCompletely({ currentTarget: { dataset: { index: 0, name: '张三' } } });

  assert.ok(wx.lastCall('showModal').content.includes('张三'));
  assert.deepEqual(page.data.activityItems.map((item) => item.itemName), ['李四', '王五']);
  assert.deepEqual(wx.getStorageSync('activities')[0].activityItems.map((item) => item.itemName),
    ['李四', '王五']);
});

test('离线详情：彻底删除取消时不动数据', () => {
  const { page, wx } = openOfflineDetail();
  wx.__modalConfirm = false;

  page.handleDeleteItemCompletely({ currentTarget: { dataset: { index: 0, name: '张三' } } });

  assert.equal(page.data.activityItems.length, 3);
  assert.equal(wx.getStorageSync('activities')[0].activityItems.length, 3);
});

test('离线详情：改名会写回 storage 并退出编辑态', () => {
  const { page, wx } = openOfflineDetail();

  page.startEditingActivityName();
  assert.equal(page.data.isEditingActivityName, true);

  page.handleActivityNameInput({ detail: { value: '  新的名字  ' } });
  page.saveActivityName();

  assert.equal(page.data.isEditingActivityName, false);
  assert.equal(wx.getStorageSync('activities')[0].activityName, '新的名字');
});

test('离线详情：改名成空时拦截', () => {
  const { page, wx } = openOfflineDetail();

  page.setData({ activityName: '   ' });
  page.saveActivityName();

  assert.equal(wx.lastCall('showToast').title, '活动/事项名称不能为空');
  assert.equal(wx.getStorageSync('activities')[0].activityName, '晨跑点名');
});

test('离线详情：长按显示全文 / 收起', () => {
  const { page } = openOfflineDetail();

  page.showFullText({ currentTarget: { dataset: { index: 2 } } });
  assert.equal(page.data.showFullTextIndex, 2);

  page.hideFullText();
  assert.equal(page.data.showFullTextIndex, '');
});

test('离线详情：修改只影响当前活动，不动其他活动', () => {
  const { page, wx } = openOfflineDetail(seedActivities(), 1);

  page.setData({ activityItems: [{ itemName: '第二组的甲', completed: false, deleted: false }] });
  page.saveChanges();

  const stored = wx.getStorageSync('activities');
  assert.equal(stored[0].activityItems.length, 3);
  assert.deepEqual(stored[1].activityItems.map((item) => item.itemName), ['第二组的甲']);
});
