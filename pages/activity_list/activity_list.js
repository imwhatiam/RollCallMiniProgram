import { API } from '../../config';
Page({

  onShareTimeline: function () {
    return {
      title: '点名签到小工具',
    };
  },
  onShareAppMessage: function () {
    return {
      title: '点名签到小工具',
      path: '/pages/index/index',
    };
  },

  data: {
    activities: [],
  },

  onShow() {
    console.log(wx.getStorageSync('weixinID'));
    this.getActivitiesFromServer()
  },

  getActivitiesFromServer() {
    wx.request({
      url: API.getActivities(wx.getStorageSync('weixinID')),
      method: 'GET',
      success: (res) => {
        console.log('getActivitiesFromServer success', res);
        this.setData({ activities: res.data.data });
      },
      fail: (err) => {
        console.log('getActivitiesFromServer failed', err);
        wx.showToast({ title: '从服务器获取数据失败', icon: 'none' });
      }
    });
  },

  navigateToActivity(e) {
    const activityID = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/activity_detail/activity_detail?activityID=` + activityID
    })
  },

  createNewActivity() {
    wx.navigateTo({
      url: '/pages/activity_create/activity_create'
    })
  },

  deleteActivity(e) {
    const index = e.currentTarget.dataset.index
    const name = this.data.activities[index].activity_title
    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + name + ' 吗？',
      success: res => {
        if (res.confirm) {
          this.deleteActivityFromServer(this.data.activities[index].id)
        }
      }
    })
  },

  deleteActivityFromServer(activityID) {
    wx.request({
      url: API.deleteActivity(activityID),
      method: 'DELETE',
      data: {
        weixin_id: wx.getStorageSync('weixinID')
      },
      success: (res) => {
        console.log('deleteActivityFromServer success', res);
        wx.showToast({ title: '删除成功', icon: 'success' })
        const activities = this.data.activities.filter(item => item.id !== activityID);
        this.setData({ activities: activities });
      },
      fail: (err) => {
        console.log('deleteActivityFromServer failed', err);
      }
    });
  },
})
