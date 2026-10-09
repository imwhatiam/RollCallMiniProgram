import { API } from '../../config';
import { isLoggedIn, setWeixinID } from '../../utils/utils';

/**
 * 微信请求失败返回的 errMsg 是英文的，直接丢给用户看不懂。
 * 这里给常见的几条配一句人话；原文仍然会一起显示，方便排查。
 * 注意「服务器域名」在小程序后台分五张独立的表：request / socket / uploadFile /
 * downloadFile / udp，配了一张不代表另一张能用。
 */
const UPLOAD_FAIL_HINTS = [
  ['url not in domain list', '这个域名没有配置到小程序的「服务器域名」白名单里'],
  ['privacy agreement', '用户隐私保护指引里还没有声明相关接口'],
  ['file not found', '头像临时文件已失效，请重新选择头像'],
  ['createRequestTask', '请求创建失败，请重试'],
  ['timeout', '请求超时，请检查网络后重试'],
  ['abort', '请求被中断，请重试'],
];

function explainUploadFailure(errMsg) {
  const hit = UPLOAD_FAIL_HINTS.find(([keyword]) => errMsg.includes(keyword));
  return hit ? hit[1] : '';
}

const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

/** 从临时文件路径里猜图片后缀；猜不出来就按 jpeg 交，后端也会再兜一层 */
function guessImageExtension(filePath) {
  const match = /\.([A-Za-z0-9]+)$/.exec(filePath || '');
  const ext = match ? match[1].toLowerCase() : '';
  return AVATAR_EXTENSIONS.indexOf(ext) >= 0 ? ext : 'jpeg';
}

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
    // 拿不到临时文件路径就不用往后走了，让 uploadFile 去报「文件不存在」更难查
    if (!avatarFilePath) {
      console.error('chooseAvatar 没有返回 avatarUrl', e);
      this.showLoginFailed('没有取到微信头像，请重试');
      return;
    }

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

  /**
   * 上传失败的真正原因都藏在 err.errMsg 里，一定要原样给出来。
   * 只说「请检查网络」会把「域名没配进 uploadFile 白名单」「隐私协议没声明」
   * 「临时文件路径无效」这些完全不同的原因压成同一句话，线上根本没法查。
   */
  reportUploadFailure(err) {
    const errMsg = (err && err.errMsg) ? err.errMsg : '';
    if (!errMsg) {
      this.showLoginFailed('登录失败，请检查网络');
      return;
    }
    const hint = explainUploadFailure(errMsg);
    wx.showModal({
      title: '登录失败',
      content: hint ? `${hint}\n\n(${errMsg})` : errMsg,
      showCancel: false,
      confirmText: '知道了'
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
    this.readAvatarAsBase64(avatarFilePath).then(
      (avatar) => { this.submitUserInfo(jscode, avatar); },
      (err) => {
        wx.hideLoading();
        console.error('读取头像失败', err);
        this.reportUploadFailure(err);
      }
    );
  },

  /**
   * 把头像临时文件读成 base64。
   *
   * 为什么不用 wx.uploadFile：它要求把域名单独配进「uploadFile 合法域名」，
   * 而这个列表可能已经托管给第三方平台，开发者自己改不了（本项目就是）。
   * wx.request 用的是另一张表（request 合法域名），一般早配好了，所以统一走它。
   */
  readAvatarAsBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (res) => {
          resolve({
            base64: res.data,
            ext: guessImageExtension(filePath)
          });
        },
        fail: reject
      });
    });
  },

  submitUserInfo(jscode, avatar) {
    wx.request({
      url: API.saveWeixinUserInfo,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        code: jscode,
        avatar_base64: avatar.base64,
        avatar_ext: avatar.ext
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

        // wx.request 不会因为非 2xx 状态码走 fail，这里要自己判断
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

        console.log('登录成功', data);
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
        console.error('登录请求失败', err);
        this.reportUploadFailure(err);
      }
    });
  },
})
