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
      path: '/pages/activity_list/activity_list'
    };
  },

  data: {
    activities: [],
  },

  onShow() {
    this.getActivitiesFromServer()
  },

  getActivitiesFromServer() {
    wx.request({
      url: API.getActivities(wx.getStorageSync('openid')),
      method: 'GET',
      success: (res) => {
        console.log('getActivitiesFromServer success', res);
      },
      fail: (err) => {
        console.log('getActivitiesFromServer failed', err);
        wx.showToast({ title: '从服务器获取数据失败, 改为从缓存获取', icon: 'none' });
        this.loadActivitiesFromCache()
      }
    });
  },

  deleteActivityFromServer(activityTitle) {
    wx.request({
      url: API.deleteActivity,
      method: 'DELETE',
      data: {
        creator_weixin_id: wx.getStorageSync('openid'),
        activity_title: activityTitle,
      },
      success: (res) => {
        console.log('deleteActivityFromServer success', res);
      },
      fail: (err) => {
        console.log('deleteActivityFromServer failed', err);
      }
    });
  },

  loadActivitiesFromCache() {
    const activities = wx.getStorageSync('activities') || []
    const result = activities.map(activity => {
      const deletedCount = activity.activityItems.reduce((count, subItem) => {
        return subItem.deleted ? count + 1 : count;
      }, 0);

      const completedCount = activity.activityItems.reduce((count, subItem) => {
        return subItem.completed ? count + 1 : count;
      }, 0);

      return {
        ...activity,
        deletedCount,
        completedCount
      };
    });
    this.setData({ activities: result })
  },

  navigateToActivity(e) {
    const index = e.currentTarget.dataset.index
    wx.navigateTo({
      url: `/pages/activity_detail/activity_detail?index=${index}`
    })
  },

  createNewActivity() {
    wx.navigateTo({
      url: '/pages/activity_create/activity_create'
    })
  },

  deleteActivity(e) {
    const activities = wx.getStorageSync('activities')
    const index = e.currentTarget.dataset.index
    const name = activities[index].activityTitle
    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + name + ' 吗？',
      success: res => {
        if (res.confirm) {
          activities.splice(index, 1)
          wx.setStorageSync('activities', activities)
          this.loadActivitiesFromCache()
          wx.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    })
  }
})
