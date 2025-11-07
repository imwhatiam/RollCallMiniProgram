const defaultAvatarUrl = 'https://www.lian-yolo.com/media/images/get-weixin-avatar.jpg'
import { API } from '../../config';
Page({
  data: {
    avatarUrl: defaultAvatarUrl,
    weixinID: '',
    hasUserInfo: false,
  },

  onLoad() {
    const cachedWeixinID = wx.getStorageSync('weixinID');
    if (cachedWeixinID) {
      this.setData({
        weixinID: cachedWeixinID,
        hasUserInfo: true
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
          weixinID: data.weixin_id,
          hasUserInfo: true
        })
        this.navigateToActivityList();
      },
      fail(err) {
        console.error('上传失败', err);
      }
    });
  },
})
