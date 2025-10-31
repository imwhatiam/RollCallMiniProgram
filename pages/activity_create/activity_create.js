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

    const items = activityItems.map(itemName => ({
      itemName: itemName,
      complete: false,
      deleted: false,
    }))

    const newActivity = {
      activityTitle: activityTitle,
      activityItems: items,
    };

    const activities = wx.getStorageSync('activities') || [];
    activities.unshift(newActivity);

    this.createNewActivityOnServer(newActivity)
    wx.setStorageSync('activities', activities);
    wx.navigateTo({
      url: `/pages/activity_detail/activity_detail?index=0`
    });
  },

  createNewActivityOnServer(newActivity) {
    wx.request({
      url: API.createNewActivity,
      method: 'POST',
      data: {
        creator_weixin_id: wx.getStorageSync('openid'),
        creator_weixin_name: wx.getStorageSync('userInfo').nickName,
        activity_title: newActivity.activityTitle,
        activity_items: newActivity.activityItems.map(item => item.itemName),
        white_list: [wx.getStorageSync('openid')],
      },
      success: (res) => {
        console.log('createNewActivityOnServer success', res);
      },
      fail: (err) => {
        console.log('createNewActivityOnServer failed', err);
      }
    });
  },
});
