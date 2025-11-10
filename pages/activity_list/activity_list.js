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
    myActivitiesExpanded: true,
    sharedActivitiesExpanded: true
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
      });
    } catch (err) {
      console.log('getActivitiesFromServer failed', err);
      // Error handling is done in requestWithLoading
    }
  },

  // Toggle my activities section
  onMyActivitiesToggle(e) {
    this.setData({
      myActivitiesExpanded: !e.detail.isCollapsed
    });
  },

  // Toggle shared activities section
  onSharedActivitiesToggle(e) {
    this.setData({
      sharedActivitiesExpanded: !e.detail.isCollapsed
    });
  },

  // Navigate to activity detail page
  navigateToActivity(e) {
    const activityID = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity_detail/activity_detail?activityID=` + activityID
    });
  },

  // Delete activity with confirmation
  deleteActivity(e) {
    const index = e.currentTarget.dataset.index;
    const source = e.currentTarget.dataset.source;
    const activities = source === 'my' ? this.data.myActivities : this.data.sharedActivities;
    const name = activities[index].activity_title;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + name + ' 吗？',
      success: res => {
        if (res.confirm) {
          this.deleteActivityFromServer(activities[index].id, source);
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
      wx.showToast({ title: '删除成功', icon: 'success' });

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
      // Error handling is done in requestWithLoading
    }
  },

  // Navigate to create new activity page
  createNewActivity() {
    wx.navigateTo({
      url: '/pages/activity_create/activity_create'
    });
  },
});
