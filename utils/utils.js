const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

const requestWithLoading = (options) => {
  wx.showLoading({ title: '加载中...' });
  return new Promise((resolve) => {
    wx.request({
      ...options,
      success(res) {
        if (res.data && res.data.error) {
          wx.showToast({
            title: res.data.error,
            icon: 'none',
            duration: 3000
          });
        } else {
          resolve(res);
        }
      },
      fail(err) {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none',
          duration: 3000
        });
      },
      complete() {
        wx.hideLoading();
      }
    });
  });
}

module.exports = {
  formatTime,
  requestWithLoading,
}
