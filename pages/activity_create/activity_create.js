import { API } from '../../config';
import { requestWithLoading } from '../../utils/utils';

Page({

  // Share to timeline
  onShareTimeline: function () {
    return {
      title: '点名签到小工具',
    };
  },

  // Share to chat
  onShareAppMessage: function () {
    return {
      title: '点名签到小工具',
      path: '/pages/index/index',
    };
  },

  data: {
    activityTitle: '',
    activityItems: [],
  },

  // Handle activity title input
  handleActivityTitleInput(e) {
    this.setData({ activityTitle: e.detail.value.trim() });
  },

  // Handle activity items input (split by newline, filter empty lines, and trim each item)
  handleActivityItemsInput(e) {
    const items = e.detail.value
      .split('\n')
      .filter(item => item.trim())        // Remove empty lines
      .map(item => item.trim());          // Trim whitespace from each item
    this.setData({ activityItems: items });
  },

  // Validate and save activity
  saveActivity() {
    const { activityTitle, activityItems } = this.data;

    if (!this.validateInput(activityTitle, activityItems)) {
      return;
    }

    this.createNewActivityOnServer(activityTitle, activityItems);
  },

  // Validate user input
  validateInput(title, items) {
    if (!title) {
      wx.showToast({
        title: '请输入活动/事项名称',
        icon: 'none',
        duration: 2000
      });
      return false;
    }

    if (!items.length) {
      wx.showToast({
        title: '请输入至少一个待办事项',
        icon: 'none',
        duration: 2000
      });
      return false;
    }

    // Check if any item is too long (optional)
    const tooLongItem = items.find(item => item.length > 50);
    if (tooLongItem) {
      wx.showToast({
        title: '待办事项名称不能超过50个字符',
        icon: 'none',
        duration: 2000
      });
      return false;
    }

    return true;
  },

  // Create new activity on server
  async createNewActivityOnServer(activityTitle, activityItems) {
    try {
      const res = await requestWithLoading({
        url: API.createNewActivity,
        method: 'POST',
        data: {
          creator_weixin_id: wx.getStorageSync('weixinID'),
          activity_title: activityTitle,
          activity_items: activityItems,
        },
      });

      console.log('createNewActivityOnServer success', res);

      if (res.data && res.data.id) {
        this.navigateToActivityDetail(res.data.id);
      } else {
        throw new Error('Invalid response: missing activity ID');
      }
    } catch (err) {
      console.log('createNewActivityOnServer failed', err);
      this.handleCreateError(err);
    }
  },

  // Navigate to activity detail page
  navigateToActivityDetail(activityID) {
    wx.navigateTo({
      url: `/pages/activity_detail/activity_detail?activityID=${activityID}`
    });
  },

  // Handle creation error
  handleCreateError(err) {
    let errorMessage = '创建活动失败，请重试';

    // You can customize error messages based on error type
    if (err.errMsg && err.errMsg.includes('timeout')) {
      errorMessage = '网络请求超时，请检查网络连接';
    }

    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 3000
    });
  },

  // Clear form data
  clearForm() {
    this.setData({
      activityTitle: '',
      activityItems: []
    });
  },

  // Preview activity items count
  getItemsCount() {
    return this.data.activityItems.length;
  },

  // Check if form has data
  hasFormData() {
    return this.data.activityTitle || this.data.activityItems.length > 0;
  },

  // Show confirmation before clearing form
  confirmClearForm() {
    if (!this.hasFormData()) {
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: '确定要清空当前填写的内容吗？',
      success: (res) => {
        if (res.confirm) {
          this.clearForm();
          wx.showToast({
            title: '已清空',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  }
});
