// app.js
App({
  onLaunch() {
    // 检查是否支持 getUpdateManager
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();

      // 监听检查更新结果
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          console.log('发现新版本');
        }
      });

      // 新版本下载完成
      updateManager.onUpdateReady(function () {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: function (res) {
            if (res.confirm) {
              // 强制重启并使用新版本
              updateManager.applyUpdate();
            }
          }
        });
      });

      // 新版本下载失败
      updateManager.onUpdateFailed(function () {
        wx.showModal({
          title: '更新失败',
          content: '请您删除当前小程序，重新搜索打开。'
        });
      });
    } else {
      // 对于不支持的用户，可以给予适当提示
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法自动更新，请升级到最新微信版本后重试。'
      });
    }
  }
})
