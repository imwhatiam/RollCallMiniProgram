import { API } from '../../config';
import { requestWithLoading } from '../../utils/utils';

Page({

  // Share activity
  onShareAppMessage: function () {
    return {
      title: this.data.title,
      path: `/pages/activity_detail/activity_detail?activityID=${this.data.activityID}`,
    }
  },

  data: {
    currentUserWeixinID: '',
    currentUserPermission: '',

    activityID: '',
    activityType: '',
    title: '',
    items: [],
    isEditingTitle: false,
    newItemName: '',
    showFullTextIndex: '',
    totalCount: 0,
    checkedCount: 0,
    deletedCount: 0,
    uncheckedCount: 0,
  },

  // Page load lifecycle
  onLoad(options) {
    const activityID = options.activityID;
    if (wx.getStorageSync('weixinID') === '') {
      const redirect = `/pages/activity_detail/activity_detail?activityID=${activityID}`;
      const encodedRedirect = encodeURIComponent(redirect);
      wx.navigateTo({
        url: `/pages/login/login?redirect=${encodedRedirect}`
      });
    } else {
      if (activityID) {
        this.getActivityFromServer(parseInt(activityID));
        this.setData({
          activityID: activityID,
          currentUserWeixinID: wx.getStorageSync('weixinID'),
        });
      } else {
        wx.showToast({
          title: `活动ID无效: ${activityID}`,
          icon: 'none',
          duration: 2000,
        });
      }
    }
  },

  // Fetch activity data from server
  async getActivityFromServer(activityID) {
    try {
      const res = await requestWithLoading({
        url: API.getActivity(activityID, wx.getStorageSync('weixinID')),
        method: 'GET',
      });
      console.log('getActivityFromServer success', res);

      const user = res.data.white_list.find(item => item.weixin_id === wx.getStorageSync('weixinID'));
      const permission = user ? user.permission : '';

      this.setData({
        currentUserPermission: permission,
        activityType: res.data.activity_type,
        title: res.data.activity_title,
        items: res.data.activity_items,
        whiteList: res.data.white_list,
      }, () => {
        this.calculateStats();
      });
    } catch (err) {
      console.log('getActivityFromServer failed', err);
      const toastDuration = 2000;
      if (err && err.statusCode === 404) {
        wx.showToast({
          title: '活动不存在或已被删除',
          icon: 'none',
          duration: toastDuration
        });
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/index/index' });
        }, toastDuration);

        return;
      }
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Start editing title
  startEditingTitle() {
    this.setData({ isEditingTitle: true });
  },

  // Handle title input
  handleTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  // Save title changes
  saveTitle() {
    const { activityID, title } = this.data;
    if (!title.trim()) {
      wx.showToast({
        title: '活动/事项名称不能为空',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    this.setData({ isEditingTitle: false });
    this.updateTitle(activityID, title);
  },

  // Update title on server
  async updateTitle(activityID, title) {
    try {
      const res = await requestWithLoading({
        url: API.updateActivity(activityID),
        method: 'PUT',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
          activity_title: title
        }
      });
      console.log('updateTitle success', res);
    } catch (err) {
      console.log('updateTitle failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  setAdmin(e) {
    const { activityID } = this.data;
    const weixinID = e.currentTarget.dataset.id;
    this.updateWhiteList(activityID, weixinID, 'admin');
  },

  unsetAdmin(e) {
    const { activityID } = this.data;
    const weixinID = e.currentTarget.dataset.id;
    this.updateWhiteList(activityID, weixinID, '');
  },

  async updateWhiteList(activityID, weixinID, permission) {
    try {
      const res = await requestWithLoading({
        url: API.updateWhiteList(activityID),
        method: 'PUT',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
          white_list: {
            weixin_id: weixinID,
            permission: permission
          }
        }
      });
      console.log('updateWhiteList success', res);
      this.setData({ whiteList: res.data.white_list });
    } catch (err) {
      console.log('updateWhiteList failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Show full text of item
  showFullText(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ showFullTextIndex: index });
  },

  // Hide full text
  hideFullText() {
    this.setData({ showFullTextIndex: '' });
  },

  // Calculate activity statistics
  calculateStats() {
    const items = this.data.items || [];
    const itemArray = Object.values(items);
    const totalCount = itemArray.length;
    const checkedCount = itemArray.filter(item => item.status === 'completed').length;
    const deletedCount = itemArray.filter(item => item.status === 'deleted').length;

    this.setData({
      totalCount,
      checkedCount,
      deletedCount,
      uncheckedCount: totalCount - checkedCount - deletedCount,
    });
  },

  // Refresh activity data
  refreshData() {
    this.getActivityFromServer(this.data.activityID);
  },

  // Initialize all items (reset status)
  initItems() {
    wx.showModal({
      title: '初始化所有项',
      content: '确定将所有项都初始化为未完成吗？',
      success: res => {
        if (res.confirm) {
          this.initActivityItems(this.data.activityID);
        }
      }
    });
  },

  // Initialize activity items on server
  async initActivityItems(activityID) {
    try {
      const res = await requestWithLoading({
        url: API.initActivityItems(activityID),
        method: 'PUT',
        data: {
          weixin_id: wx.getStorageSync('weixinID')
        }
      });
      console.log('initActivityItems success', res);
      this.updateItemsAndStats(res.data.activity_items);
    } catch (err) {
      console.log('initActivityItems failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  copyActivity(e) {
    const { activityID } = this.data;
    this.copyActivityToMy(activityID);
  },

  async copyActivityToMy(activityID) {
    try {
      const res = await requestWithLoading({
        url: API.copyActivityToMy(activityID),
        method: 'POST',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
        }
      });
      console.log('copyActivityToMy success', res);
      wx.showToast({
        title: '复制成功',
        icon: 'success',
        duration: 2000
      });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/activity_list/activity_list' });
      }, 2000);
    } catch (err) {
      console.log('copyActivityToMy failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Mark item as completed
  handleCompleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, 'completed');
  },

  // Mark item as uncompleted
  handleUncompleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, '');
  },

  // Mark item as deleted
  handleDeleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, 'deleted');
  },

  // Restore deleted item
  handleUndeleteItem(e) {
    const { activityID } = this.data;
    const itemID = e.currentTarget.dataset.index;
    this.updateActivityItem(activityID, itemID, '');
  },

  // Update item status on server
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
      this.updateItemsAndStats(res.data.activity_items);
    } catch (err) {
      console.log('updateActivityItem failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Completely delete item with confirmation
  handleDeleteItemCompletely(e) {
    const itemID = e.currentTarget.dataset.index;
    const itemName = e.currentTarget.dataset.name;
    wx.showModal({
      title: '确认删除',
      content: '确定从服务器中彻底删除 ' + itemName + ' 吗？',
      success: res => {
        if (res.confirm) {
          this.deleteActivityItem(this.data.activityID, itemID);
        }
      }
    });
  },

  // Delete item from server
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
      this.updateItemsAndStats(res.data.activity_items);
    } catch (err) {
      console.log('deleteActivityItem failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Handle new item input
  handleNewItemInput(e) {
    this.setData({
      newItemName: e.detail.value.trim()
    });
  },

  // Add new item
  addNewItem() {
    const newItemName = this.data.newItemName;
    if (newItemName === '') {
      wx.showToast({ title: '请输入待办事项名称', icon: 'none' });
      return;
    }
    this.addActivityItem(this.data.activityID, newItemName);

    // Scroll to bottom after adding new item
    setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: 9999,
        duration: 300
      });
    }, 100);
  },

  // Add new item to server
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
      this.updateItemsAndStats(res.data.activity_items, '');
    } catch (err) {
      console.log('addActivityItem failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Helper method to update items and recalculate stats
  updateItemsAndStats(items, newItemName = '') {
    this.setData({
      items: items,
      newItemName: newItemName
    }, () => {
      this.calculateStats();
    });
  }
});
