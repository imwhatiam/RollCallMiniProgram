// config.js
const DOMAIN = 'https://www.lian-yolo.com'
const API_BASE = 'https://www.lian-yolo.com/weixin-miniprogram/api';
export const API = {
  domain: DOMAIN,
  saveWeixinUserInfo: `${API_BASE}/jscode2session/`,

  createNewActivity: `${API_BASE}/activities/`,
  getActivities: (weixinID) => `${API_BASE}/activities/?weixin_id=${weixinID}`,
  getActivity: (activityID, weixinID) => `${API_BASE}/activities/${activityID}/?weixin_id=${weixinID}`,
  updateActivity: (activityID) => `${API_BASE}/activities/${activityID}/`,
  deleteActivity: (activityID) => `${API_BASE}/activities/${activityID}/`,

  addActivityItem: (activityID) => `${API_BASE}/activities/${activityID}/items/`,
  updateActivityItem: (activityID, itemID) => `${API_BASE}/activities/${activityID}/items/${itemID}/`,
  deleteActivityItem: (activityID, itemID) => `${API_BASE}/activities/${activityID}/items/${itemID}/`,
};
