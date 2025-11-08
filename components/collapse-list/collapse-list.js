Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    initiallyExpanded: {
      type: Boolean,
      value: true
    }
  },

  data: {
    isCollapsed: false
  },

  lifetimes: {
    attached() {
      this.setData({
        isCollapsed: !this.properties.initiallyExpanded
      });
    }
  },

  methods: {
    toggleCollapse() {
      this.setData({
        isCollapsed: !this.data.isCollapsed
      });
      this.triggerEvent('toggle', {
        isCollapsed: this.data.isCollapsed
      });
    }
  }
});
