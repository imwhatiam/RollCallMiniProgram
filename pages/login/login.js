import { API } from '../../config';
import { isLoggedIn, setWeixinID } from '../../utils/utils';

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
    let redirect = '';
    try {
      redirect = decodeURIComponent(options.redirect || '');
    } catch (err) {
      console.log('redirect 参数解析失败，忽略回跳', options.redirect, err);
    }

    this.setData({ redirect: redirect });
    if (isLoggedIn()) {
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
          this.showLoginFailed('登录失败，请重试');
        }
      },
      fail: (err) => {
        console.log('wx.login failed', err);
        this.showLoginFailed('登录失败，请重试');
      }
    });
  },

  showLoginFailed(title) {
    wx.showToast({
      title: title,
      icon: 'none',
      duration: 2000
    });
  },

  navigateToActivityList() {
    console.log('nav to activity list')
    wx.reLaunch({
      url: `/pages/activity_list/activity_list`
    })
  },

  saveUserInfoToServer(jscode, avatarFilePath) {
    wx.showLoading({ title: '登录中...', mask: true });
    wx.uploadFile({
      url: API.saveWeixinUserInfo,
      filePath: avatarFilePath,
      name: 'avatar',
      formData: {
        code: jscode,
      },
      success: (res) => {
        wx.hideLoading();

        let data;
        try {
          data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        } catch (err) {
          console.error('登录返回不是合法 JSON', res, err);
          this.showLoginFailed('登录失败，请重试');
          return;
        }

        // wx.uploadFile 不会因为非 2xx 状态码走 fail，这里要自己判断
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          this.showLoginFailed((data && data.error) ? data.error
            : `登录失败 (${res.statusCode})`);
          return;
        }

        if (!data || !data.weixin_id) {
          console.error('登录返回里没有 weixin_id', data);
          this.showLoginFailed('登录失败，请重试');
          return;
        }

        console.log('上传成功', data);
        setWeixinID(data.weixin_id);
        this.setData({
          hasUserInfo: true
        })
        if (this.data.redirect) {
          wx.reLaunch({
            url: this.data.redirect,
          });
        } else {
          this.navigateToActivityList();
        };
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('上传失败', err);
        this.showLoginFailed('登录失败，请检查网络');
      }
    });
  },
})
