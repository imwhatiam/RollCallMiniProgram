const { requestWithLoading } = require('../../utils/utils');
import { API } from '../../config';

Page({
  // Share to timeline
  onShareTimeline: function () {
    return {
      title: '点名签到小工具',
    };
  },

  // Share to chat
  onShareAppMessage: function () {
    return {
      title: '点名签到小工具',
      path: '/pages/index/index',
    };
  },

  data: {
    myActivities: [],
    sharedActivities: [],
    publicActivities: [],
  },

  // Page show lifecycle
  onShow() {
    console.log(wx.getStorageSync('weixinID'));
    this.getActivitiesFromServer();
  },

  // Fetch activities from server
  async getActivitiesFromServer() {
    try {
      const res = await requestWithLoading({
        url: API.getActivities(wx.getStorageSync('weixinID')),
        method: 'GET',
      });

      console.log('getActivitiesFromServer success', res);
      this.setData({
        myActivities: res.data.my,
        sharedActivities: res.data.shared,
        publicActivities: res.data.public
      });
    } catch (err) {
      console.log('getActivitiesFromServer failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Navigate to activity detail page
  navigateToActivity(e) {
    const activityID = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity_detail/activity_detail?activityID=${activityID}`
    });
  },

  copyActivity(e) {
    const activityID = e.currentTarget.dataset.id;
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
      this.setData({
        myActivities: res.data.my,
        sharedActivities: res.data.shared,
        publicActivities: res.data.public
      });
    } catch (err) {
      console.log('copyActivityToMy failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Delete activity with confirmation
  deleteActivity(e) {
    const activityID = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    const source = e.currentTarget.dataset.source;

    console.log('deleteActivity', activityID, title, source);

    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + title + ' 吗？',
      success: res => {
        if (res.confirm) {
          this.deleteActivityFromServer(activityID, source);
        }
      }
    });
  },

  // Delete activity from server
  async deleteActivityFromServer(activityID, source) {
    try {
      const res = await requestWithLoading({
        url: API.deleteActivity(activityID),
        method: 'DELETE',
        data: {
          weixin_id: wx.getStorageSync('weixinID'),
          source: source
        }
      });

      console.log('deleteActivityFromServer success', res);
      wx.showToast({
        title: '删除成功',
        icon: 'success',
        duration: 2000
      });

      // Update local data after deletion
      if (source === 'shared') {
        const sharedActivities = this.data.sharedActivities.filter(item => item.id !== activityID);
        this.setData({ sharedActivities: sharedActivities });
      } else if (source === 'my') {
        const myActivities = this.data.myActivities.filter(item => item.id !== activityID);
        this.setData({ myActivities: myActivities });
      }
    } catch (err) {
      console.log('deleteActivityFromServer failed', err);
      wx.showToast({
        title: (err && err.message) ? err.message : '请求失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // Navigate to create new activity page
  createNewActivity() {
    wx.navigateTo({
      url: '/pages/activity_create/activity_create'
    });
  },
});
