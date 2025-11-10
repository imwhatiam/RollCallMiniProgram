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
    activityID: '',
    title: '',
    items: [],
    creatorWeixinID: '',
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
    if (options.activityID) {
      this.getActivityFromServer(parseInt(options.activityID));
      this.setData({ currentUserWeixinID: wx.getStorageSync('weixinID') });
    } else {
      wx.showToast({
        title: `活动ID无效: ${options.activityID}`,
        icon: 'none',
        duration: 2000,
      });
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
      this.updateActivityData(res.data, activityID);
    } catch (err) {
      console.log('getActivityFromServer failed', err);
      // Additional error handling since requestWithLoading might not cover all cases
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // Update activity data and calculate stats
  updateActivityData(activityData, activityID) {
    this.setData({
      activityID,
      creatorWeixinID: activityData.creator_weixin_id,
      title: activityData.activity_title,
      items: activityData.activity_items,
      whiteList: activityData.white_list,
      isEditingTitle: false
    }, () => {
      this.calculateStats();
    });
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
    const { title, activityID } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '活动/事项名称不能为空', icon: 'none' });
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
      title: '初始化所有人员',
      content: '确定将所有人员都初始化为未签到吗？',
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
