Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
  },

  onLoad() {
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo) {
      this.setData({
        userInfo: cachedUserInfo,
        hasUserInfo: true
      });
    }
  },

  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        console.log('getUserProfile success', res);
        const userInfo = res.userInfo;
        this.setData({
          userInfo: userInfo,
          hasUserInfo: true
        });
        wx.setStorageSync('userInfo', userInfo);

        wx.login({
          success: (res) => {
            if (res.code) {
              this.saveUserInfoToServer(res.code, userInfo);
            } else {
              console.log('no code from wx.login', res);
            }
          },
          fail: (err) => {
            console.log('wx.login failed', err);
          }
        });
      },
      fail: (err) => {
        console.log('wx.getUserProfile failed', err);
      }
    });
  },

  saveUserInfoToServer(jscode, userInfo) {
    wx.request({
      url: 'https://www.lian-yolo.com/weixin-miniprogram/api/jscode2session/',
      method: 'POST',
      data: {
        code: jscode,
        nickname: userInfo.nickName,
        avatar_url: userInfo.avatarUrl,
      },
      success: (res) => {
        console.log('saveUserInfoToServer success', res);
      },
      fail: (err) => {
        console.log('saveUserInfoToServer failed', err);
      }
    });
  },

  clearUserInfo() {
    this.setData({
      userInfo: {},
      hasUserInfo: false
    });
    wx.removeStorageSync('userInfo');
  }
})
