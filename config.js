// config.js
const DOMAIN = 'https://www.lian-yolo.com'
const API_BASE = 'https://www.lian-yolo.com/weixin-miniprogram/api';
export const API = {
  domain: DOMAIN,
  saveWeixinUserInfo: `${API_BASE}/jscode2session/`,
  createNewActivity: `${API_BASE}/activities/`,
  getActivities: (weixin_id) => `${API_BASE}/activities/?weixin_id=${weixin_id}`,
};
