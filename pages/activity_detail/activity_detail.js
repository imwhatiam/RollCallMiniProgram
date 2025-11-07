import { API } from '../../config';

// 通用请求封装：自动显示/隐藏加载中提示
function requestWithLoading(options) {
  wx.showLoading({ title: '加载中...' });
  return new Promise((resolve) => {
    wx.request({
      ...options,
      success(res) {
        if (res.data && res.data.error) {
          wx.showToast({
            title: res.data.error,
            icon: 'none',
            duration: 3000
          });
        } else {
          resolve(res);
        }
      },
      fail(err) {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none',
          duration: 3000
        });
      },
      complete() {
        wx.hideLoading();
      }
    });
  });
}

Page({

  onShareAppMessage: function () {
    return {
      title: this.data.activityTitle,
      path: `/pages/activity_detail/activity_detail?activityID=${this.data.activityID}`,
    }
  },

  data: {
    weixinID: wx.getStorageSync('weixinID'),

    activityID: '',
    activityTitle: '',
    activityItems: [],
    activityCreatorWeixinID: '',

    isEditingActivityTitle: false,
    newItemName: '',
    showFullTextIndex: '',

    totalCount: 0,
    checkedCount: 0,
    deletedCount: 0,
  },

  onLoad(options) {
    if (options.activityID !== undefined && options.activityID !== null) {
      this.getActivityFromServer(parseInt(options.activityID), options);
    } else {
      wx.showToast({
        title: `activityID invalid: ${options.activityID}`,
        icon: 'none',
        duration: 2000,
      });
    }
  },

  async getActivityFromServer(activityID) {
    try {
      const res = await requestWithLoading({
        url: API.getActivity(activityID, wx.getStorageSync('weixinID')),
        method: 'GET',
      });

      console.log('getActivityFromServer success', res);
      this.setData({
        activityID,
        activityCreatorWeixinID: res.data.creator_weixin_id,
        activityTitle: res.data.activity_title,
        activityItems: res.data.activity_items,
        isEditingActivityTitle: false
      }, () => {
        this.calculateStats();
      });
    } catch (err) {
      console.log('getActivityFromServer failed', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  calculateStats() {
    const items = this.data.activityItems || [];
    const itemArray = Object.values(items);
    const totalCount = itemArray.length;
    const checkedCount = itemArray.filter(item => item.status === 'completed').length;
    const deletedCount = itemArray.filter(item => item.status === 'deleted').length;

    this.setData({
      totalCount,
      checkedCount,
      deletedCount
    });
  },

  refreshData() {
    this.getActivityFromServer(this.data.activityID);
  },

  startEditingActivityTitle() {
    this.setData({ isEditingActivityTitle: true });
  },

  handleActivityTitleInput(e) {
    this.setData({ activityTitle: e.detail.value });
  },

  saveActivityTitle() {
    const { activityTitle, activityID } = this.data;
    if (!activityTitle.trim()) {
      wx.showToast({ title: '活动/事项名称不能为空', icon: 'none' });
      return;
    }
    this.setData({ isEditingActivityTitle: false });
    this.updateActivityTitle(activityID, activityTitle);
  },

  async updateActivityTitle(activityID, activityTitle) {
    try {
      const res = await requestWithLoading({
        url: API.updateActivity(activityID),
        method: 'PUT',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
          activity_title: activityTitle
        }
      });
      console.log('updateActivityTitle success', res);
    } catch (err) {
      console.log('updateActivityTitle failed', err);
    }
  },

  showFullText(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ showFullTextIndex: index });
  },

  hideFullText() {
    this.setData({ showFullTextIndex: '' });
  },

  handleCompleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, 'completed');
  },

  handleUncompleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, '');
  },

  handleDeleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, 'deleted');
  },

  handleUndeleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, '');
  },

  async updateActivityItem(activityID, itemID, itemStatus) {
    try {
      const res = await requestWithLoading({
        url: API.updateActivityItem(activityID, itemID),
        method: 'PUT',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
          activity_item_status: itemStatus
        }
      });
      console.log('updateActivityItem success', res);
      this.setData({
        activityItems: res.data.activity_items
      }, () => {
        this.calculateStats();
      });
    } catch (err) {
      console.log('updateActivityItem failed', err);
    }
  },

  handleDeleteItemCompletely(e) {
    const itemID = e.currentTarget.dataset.index;
    const itemName = e.currentTarget.dataset.name;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + itemName + ' 吗？',
      success: res => {
        if (res.confirm) {
          this.deleteActivityItem(this.data.activityID, itemID);
        }
      }
    });
  },

  async deleteActivityItem(activityID, itemID) {
    try {
      const res = await requestWithLoading({
        url: API.deleteActivityItem(activityID, itemID),
        method: 'DELETE',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
        }
      });
      console.log('deleteActivityItem success', res);
      this.setData({
        activityItems: res.data.activity_items
      }, () => {
        this.calculateStats();
      });
    } catch (err) {
      console.log('deleteActivityItem failed', err);
    }
  },

  handleNewItemInput(e) {
    this.setData({
      newItemName: e.detail.value.trim()
    });
  },

  addNewItem() {
    const newItemName = this.data.newItemName;
    if (newItemName === '') {
      wx.showToast({ title: '请输入待办事项名称', icon: 'none' });
      return;
    }
    this.addActivityItem(this.data.activityID, newItemName);

    setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: 9999,
        duration: 300
      });
    }, 100);
  },

  async addActivityItem(activityID, newItemName) {
    try {
      const res = await requestWithLoading({
        url: API.addActivityItem(activityID),
        method: 'POST',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
          activity_item_name: newItemName
        }
      });
      console.log('addActivityItem success', res);
      this.setData({
        activityItems: res.data.activity_items,
        newItemName: ''
      }, () => {
        this.calculateStats();
      });
    } catch (err) {
      console.log('addActivityItem failed', err);
    }
  },
});
