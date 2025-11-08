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
    myActivities: [],
    sharedActivities: [],
    myActivitiesExpanded: true,
    sharedActivitiesExpanded: true
  },

  onShow() {
    console.log(wx.getStorageSync('weixinID'));
    this.getActivitiesFromServer();
  },

  getActivitiesFromServer() {
    wx.request({
      url: API.getActivities(wx.getStorageSync('weixinID')),
      method: 'GET',
      success: (res) => {
        console.log('getActivitiesFromServer success', res);
        this.setData({
          myActivities: res.data.my,
          sharedActivities: res.data.shared,
        });
      },
      fail: (err) => {
        console.log('getActivitiesFromServer failed', err);
        wx.showToast({ title: '从服务器获取数据失败', icon: 'none' });
      }
    });
  },

  // 处理我创建的活动折叠/展开
  onMyActivitiesToggle(e) {
    this.setData({
      myActivitiesExpanded: !e.detail.isCollapsed
    });
  },

  // 处理共享活动折叠/展开
  onSharedActivitiesToggle(e) {
    this.setData({
      sharedActivitiesExpanded: !e.detail.isCollapsed
    });
  },

  navigateToActivity(e) {
    const activityID = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity_detail/activity_detail?activityID=` + activityID
    });
  },

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

  deleteActivityFromServer(activityID, source) {
    wx.request({
      url: API.deleteActivity(activityID),
      method: 'DELETE',
      data: {
        weixin_id: wx.getStorageSync('weixinID'),
        source: source
      },
      success: (res) => {
        console.log('deleteActivityFromServer success', res);
        wx.showToast({ title: '删除成功', icon: 'success' });

        if (source === 'shared') {
          const sharedActivities = this.data.sharedActivities.filter(item => item.id !== activityID);
          this.setData({ sharedActivities: sharedActivities });
        } else if (source === 'my') {
          const myActivities = this.data.myActivities.filter(item => item.id !== activityID);
          this.setData({ myActivities: myActivities });
        }
      },
      fail: (err) => {
        console.log('deleteActivityFromServer failed', err);
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    });
  },

  createNewActivity() {
    wx.navigateTo({
      url: '/pages/activity_create/activity_create'
    });
  },
});
