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
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: (res) => {
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          let errorMessage = '请求失败';

          // 根据不同的状态码显示不同的错误信息
          switch (res.statusCode) {
            case 400:
              errorMessage = '请求参数错误';
              break;
            case 401:
              errorMessage = '未授权，请重新登录';
              // 可以在这里添加跳转到登录页的逻辑
              break;
            case 403:
              errorMessage = '拒绝访问';
              break;
            case 404:
              errorMessage = '请求的资源不存在';
              break;
            case 500:
              errorMessage = '服务器内部错误';
              break;
            case 502:
              errorMessage = '网关错误';
              break;
            case 503:
              errorMessage = '服务不可用';
              break;
            default:
              errorMessage = `请求失败 (${res.statusCode})`;
          }

          // 如果服务器返回了错误信息，优先使用服务器的信息
          if (res.data && res.data.error) {
            errorMessage = res.data.error;
          }

          // 拒绝 Promise，让调用方能够处理错误
          reject({
            statusCode: res.statusCode,
            message: errorMessage,
            data: res.data
          });
          return;
        }

        // 状态码为 200，但服务器返回了业务错误
        if (res.data && res.data.error) {
          reject({
            statusCode: res.statusCode,
            message: res.data.error,
            data: res.data
          });
          return;
        }

        // 请求成功
        resolve(res);
      },
      fail: (err) => {
        let errorMessage = '网络请求失败';

        // 可以根据 err.errMsg 提供更具体的错误信息
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMessage = '网络请求超时';
          } else if (err.errMsg.includes('fail')) {
            errorMessage = '网络连接失败';
          }
        }

        reject({
          statusCode: 0, // 0 表示网络错误
          message: errorMessage,
          error: err
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  });
}

module.exports = {
  formatTime,
  requestWithLoading,
}
