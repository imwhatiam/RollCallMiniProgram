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
    this.loadActivities()
  },

  loadActivities() {
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
    const name = activities[index].activityName
    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + name + ' 吗？',
      success: res => {
        if (res.confirm) {
          activities.splice(index, 1)
          wx.setStorageSync('activities', activities)
          this.loadActivities()
          wx.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    })
  }
})