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
  },
  onLoad() {
  },
  navigateToOnline() {
    if (wx.getStorageSync('weixinID')) {
      console.log('nav to online activity list')
      wx.navigateTo({
        url: `/pages/activity_list/activity_list`
      })
    } else {
      console.log('nav to login')
      wx.navigateTo({
        url: `/pages/login/login`
      })
    }
  },
  navigateToOffline() {
    console.log('nav to offline activity list')
    wx.navigateTo({
      url: `/pages/offline/activity_list/activity_list`
    })
  },
})
