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
    activityName: '',
    activityItems: [],
  },

  handleActivityNameInput(e) {
    this.setData({ activityName: e.detail.value.trim() });
  },

  handleActivityItemsInput(e) {
    const items = e.detail.value
      .split('\n')
      .filter(item => item.trim());
    this.setData({ activityItems: items });
  },

  saveActivity() {
    const { activityName, activityItems } = this.data;
    if (!activityName) {
      wx.showToast({ title: '请输入活动/事项名称', icon: 'none' });
      return;
    }

    const items = activityItems.map(itemName => ({
      itemName: itemName,
      complete: false,
      deleted: false,
    }))

    const newActivity = {
      activityName: activityName,
      activityItems: items,
    };

    const activities = wx.getStorageSync('activities') || [];
    activities.unshift(newActivity);

    wx.setStorageSync('activities', activities);
    wx.navigateTo({
      url: `/pages/offline/activity_detail/activity_detail?index=0`
    });
  },
});
