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
      .filter(item => item.trim())
      .map(item => item.trim());
    this.setData({ activityItems: items });
  },

  saveActivity() {
    const { activityName, activityItems } = this.data;
    if (!activityName) {
      wx.showToast({ title: '请输入活动/事项名称', icon: 'none' });
      return;
    }

    // 字段名必须和详情页读写的一致（详情页用的是 completed），
    // 之前这里写成 complete，导致新活动里所有条目都带着一个没人读的脏字段。
    const items = activityItems.map(itemName => ({
      itemName: itemName,
      completed: false,
      deleted: false,
    }))

    const newActivity = {
      activityName: activityName,
      activityItems: items,
    };

    const activities = wx.getStorageSync('activities') || [];
    activities.unshift(newActivity);

    wx.setStorageSync('activities', activities);
    // 用 redirectTo 而不是 navigateTo：从详情页返回时不该再回到已提交的表单
    wx.redirectTo({
      url: `/pages/offline/activity_detail/activity_detail?index=0`
    });
  },
});
