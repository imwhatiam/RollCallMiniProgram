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
    hasUserInfo: false,
    redirect: ''
  },

  onLoad(options) {
    this.setData({
      redirect: decodeURIComponent(options.redirect || '')
    });
    const cachedWeixinID = wx.getStorageSync('weixinID');
    if (cachedWeixinID) {
      this.setData({
        hasUserInfo: true,
      });
      this.navigateToActivityList();
    }
  },

  onChooseAvatar(e) {
    const avatarFilePath = e.detail.avatarUrl;
    wx.login({
      success: (res) => {
        if (res.code) {
          this.saveUserInfoToServer(res.code, avatarFilePath);
        } else {
          console.log('no code from wx.login', res);
        }
      },
      fail: (err) => {
        console.log('wx.login failed', err);
      }
    });
  },

  navigateToActivityList() {
    console.log('nav to activity list')
    wx.navigateTo({
      url: `/pages/activity_list/activity_list`
    })
  },

  saveUserInfoToServer(jscode, avatarFilePath) {
    wx.uploadFile({
      url: API.saveWeixinUserInfo,
      filePath: avatarFilePath,
      name: 'avatar',
      formData: {
        code: jscode,
      },
      success: (res) => {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        console.log('上传成功', data);
        wx.setStorageSync('weixinID', data.weixin_id);
        this.setData({
          hasUserInfo: true
        })
        if (this.data.redirect) {
          wx.navigateTo({
            url: this.data.redirect,
          });
        } else {
          this.navigateToActivityList();
        };
      },
      fail(err) {
        console.error('上传失败', err);
      }
    });
  },
})
