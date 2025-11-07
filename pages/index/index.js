Page({
  data: {
  },
  onLoad() {
  },
  navigateToLogin() {
    console.log('nav to login')
    wx.navigateTo({
      url: `/pages/login/login`
    })
  },
  navigateToActivityList() {
    console.log('nav to offline activity list')
    wx.navigateTo({
      url: `/pages/offline/activity_list/activity_list`
    })
  },
})
