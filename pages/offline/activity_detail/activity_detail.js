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
    index: '',
    activityName: '',
    activityItems: [],
    isEditingActivityName: false,
    newItemName: '',
    showFullTextIndex: ''
  },

  onLoad(options) {
    wx.showLoading({ title: '加载中...' });
    if (options.index !== undefined) {
      this.loadActivity(parseInt(options.index));
    } else {
      wx.hideLoading();
      wx.showToast({ title: 'index invalid', icon: 'none' });
    }
  },

  loadActivity(index) {
    const activities = wx.getStorageSync('activities');
    const activity = activities[index];

    this.setData({
      index,
      activityName: activity.activityName,
      activityItems: activity.activityItems,
      isEditingActivityName: false
    }, () => {
      wx.nextTick(() => {
        wx.hideLoading();
      });
    });
  },

  startEditingActivityName() {
    this.setData({ isEditingActivityName: true });
  },

  handleActivityNameInput(e) {
    this.setData({ activityName: e.detail.value });
  },

  saveActivityName() {
    const { activityName, index } = this.data;
    if (!activityName.trim()) {
      wx.showToast({ title: '活动/事项名称不能为空', icon: 'none' });
      return;
    }

    const activities = wx.getStorageSync('activities');
    activities[index].activityName = activityName.trim();
    wx.setStorageSync('activities', activities);

    this.setData({ isEditingActivityName: false });
  },

  showFullText(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({showFullTextIndex: index});
  },
  hideFullText() {
    this.setData({showFullTextIndex: ''});
  },

  handleCompleteItem(e) {
    const index = e.currentTarget.dataset.index;
    const key = `activityItems[${index}].completed`;
    this.setData({
      [key]: !this.data.activityItems[index].completed
    });
    this.saveChanges();
  },

  handleDeleteItem(e) {
    const index = e.currentTarget.dataset.index;
    const key = `activityItems[${index}].deleted`;
    this.setData({
      [key]: !this.data.activityItems[index].deleted
    });
    this.saveChanges();
  },

  handleDeleteItemCompletely(e) {
    const index = e.currentTarget.dataset.index;
    const itemName= e.currentTarget.dataset.name;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + itemName + ' 吗？',
      success: res => {
        if (res.confirm) {
          const activityItems = this.data.activityItems;
          activityItems.splice(index, 1);
          this.setData({ activityItems });
          this.saveChanges();
        }
      }
    });
  },

  handleNewItemInput(e) {
    this.setData({
      newItemName: e.detail.value.trim()
    });
  },

  addNewItem() {
    const activityItems = this.data.activityItems;
    const newItemName = this.data.newItemName;

    if (newItemName !== '') {
      activityItems.push({
        itemName: newItemName,
        completed: false,
        deleted: false
      });

      this.setData({
        activityItems: activityItems,
        newItemName: ''
      });

      this.saveChanges();
    }
    setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: 9999,
        duration: 300
      });
    }, 100);
  },

  saveChanges() {
    const activities = wx.getStorageSync('activities');
    const currentActivity = activities[this.data.index];
    currentActivity.activityItems = this.data.activityItems;
    wx.setStorageSync('activities', activities);
  },
});
