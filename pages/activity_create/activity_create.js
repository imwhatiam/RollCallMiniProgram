import { API } from '../../config';
Page({

  onShareTimeline: function () {
    return {
      title: '活动点名/待办事项',
    };
  },

  onShareAppMessage: function () {
    return {
      title: '活动点名/待办事项',
      path: '/pages/activity_list/activity_list'
    };
  },

  data: {
    activityTitle: '',
    activityItems: [],
  },

  handleActivityTitleInput(e) {
    this.setData({ activityTitle: e.detail.value.trim() });
  },

  handleActivityItemsInput(e) {
    const items = e.detail.value
      .split('\n')
      .filter(item => item.trim());
    this.setData({ activityItems: items });
  },

  saveActivity() {
    const { activityTitle, activityItems } = this.data;
    if (!activityTitle) {
      wx.showToast({ title: '请输入活动/事项名称', icon: 'none' });
      return;
    }

    if (!activityItems.length) {
      wx.showToast({ title: '请输入待办事项', icon: 'none' });
      return;
    }

    this.createNewActivityOnServer(activityTitle, activityItems);
  },

  createNewActivityOnServer(activityTitle, activityItems) {
    wx.request({
      url: API.createNewActivity,
      method: 'POST',
      data: {
        creator_weixin_id: wx.getStorageSync('weixinID'),
        activity_title: activityTitle,
        activity_items: activityItems,
      },
      success: (res) => {
        console.log('createNewActivityOnServer success', res);
        const activityID = res.data.id;
        wx.navigateTo({
          url: `/pages/activity_detail/activity_detail?activityID=` + activityID
        });
      },
      fail: (err) => {
        console.log('createNewActivityOnServer failed', err);
      }
    });
  },
});
