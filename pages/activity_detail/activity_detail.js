import { API } from '../../config';
Page({

  onShareTimeline: function () {
    return {
      title: '活动点名/待办事项',
    };
  },
  onShareAppMessage: function () {
    return {
      title: '活动点名/待办事项',
      path: `/pages/activity_detail/activity_detail?activityID=` + this.data.activityID
    };
  },

  data: {
    openid: wx.getStorageSync('openid'),
    activityID: '',
    activityTitle: '',
    activityItems: [],
    isEditingActivityTitle: false,
    newItemName: '',
    showFullTextIndex: ''
  },

  onLoad(options) {
    wx.showLoading({ title: '加载中...' });
    if (options.activityID !== undefined) {
      this.getActivityFromServer(parseInt(options.activityID));
    } else {
      wx.hideLoading();
      wx.showToast({ title: 'activityID invalid', icon: 'none' });
    }
  },

  getActivityFromServer(activityID) {
    wx.request({
      url: API.getActivity(activityID),
      method: 'GET',
      data: {
        activity_id: activityID
      },
      success: (res) => {
        console.log('getActivityFromServer success', res);
        this.setData({
          activityID,
          activityTitle: res.data.activity_title,
          activityItems: res.data.activity_items,
          isEditingActivityTitle: false
        }, () => {
          wx.nextTick(() => {
            wx.hideLoading();
          });
        });
      },
      fail: (err) => {
        console.log('getActivityFromServer failed', err);
      }
    })
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

  updateActivityTitle(activityID, activityTitle) {
    wx.request({
      url: API.updateActivity(activityID),
      method: 'PUT',
      data: {
        weixin_id: wx.getStorageSync('openid'),
        activity_title: activityTitle
      },
      success: (res) => {
        console.log('updateActivityTitle success', res);
      },
      fail: (err) => {
        console.log('updateActivityTitle failed', err);
      }
    })
  },

  showFullText(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({showFullTextIndex: index});
  },

  hideFullText() {
    this.setData({showFullTextIndex: ''});
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

  updateActivityItem(activityID, itemID, itemStatus) {
    wx.request({
      url: API.updateActivityItem(activityID, itemID),
      method: 'PUT',
      data: {
        weixin_id: wx.getStorageSync('openid'),
        activity_item_status: itemStatus
      },
      success: (res) => {
        console.log('updateActivityItem success', res);
        this.setData({ activityItems: res.data.activity_items });
      },
      fail: (err) => {
        console.log('updateActivityItem failed', err);
      }
    })
  },

  handleDeleteItemCompletely(e) {
    const activityID = e.currentTarget.dataset.activityID;
    const itemName= e.currentTarget.dataset.name;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + itemName + ' 吗？',
      success: res => {
        if (res.confirm) {
          const activityItems = this.data.activityItems;
          activityItems.splice(activityID, 1);
          this.setData({ activityItems });
        }
      }
    });
  },

  handleNewItemInput(e) {
    this.setData({
      newItemName: e.detail.value.trim()
    });
  },

  addNewItem() {
    const activityItems = this.data.activityItems;
    const newItemName = this.data.newItemName;

    if (newItemName !== '') {
      activityItems.push({
        itemName: newItemName,
        completed: false,
        deleted: false
      });

      this.setData({
        activityItems: activityItems,
        newItemName: ''
      });
    }
    setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: 9999,
        duration: 300
      });
    }, 100);
  },
});
