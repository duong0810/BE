/**
 * Helper functions để làm việc với Zalo API
 */
import axios from "axios";

const ZALO_API_BASE = "https://graph.zalo.me/v2.0";

/**
 * Lấy thông tin user từ Zalo API
 * @param {string} accessToken - Zalo access token
 * @returns {Promise<Object>} - Thông tin user từ Zalo
 */
export const getZaloUserInfo = async (accessToken) => {
  try {
    const response = await axios.get(`${ZALO_API_BASE}/me`, {
      headers: {
        'access_token': accessToken
      },
      params: {
        fields: 'id,name,picture,birthday,gender'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Lỗi khi lấy thông tin user từ Zalo:", error);
    throw error;
  }
};

/**
 * Lấy số điện thoại của user từ Zalo API (cần quyền đặc biệt)
 * @param {string} accessToken - Zalo access token
 * @returns {Promise<Object>} - Thông tin số điện thoại
 */
export const getZaloUserPhone = async (accessToken) => {
  try {
    const response = await axios.get(`${ZALO_API_BASE}/me`, {
      headers: {
        'access_token': accessToken
      },
      params: {
        fields: 'phone'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Lỗi khi lấy số điện thoại từ Zalo:", error);
    throw error;
  }
};

/**
 * Verify access token với Zalo
 * @param {string} accessToken - Zalo access token
 * @returns {Promise<boolean>} - True nếu token hợp lệ
 */
export const verifyZaloToken = async (accessToken) => {
  try {
    const response = await axios.get(`${ZALO_API_BASE}/me`, {
      headers: {
        'access_token': accessToken
      },
      params: {
        fields: 'id'
      }
    });
    
    return !!response.data.id;
  } catch (error) {
    return false;
  }
};

/**
 * Lấy danh sách bạn bè của user (nếu có quyền)
 * @param {string} accessToken - Zalo access token
 * @returns {Promise<Object>} - Danh sách bạn bè
 */
export const getZaloUserFriends = async (accessToken) => {
  try {
    const response = await axios.get(`${ZALO_API_BASE}/me/friends`, {
      headers: {
        'access_token': accessToken
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè từ Zalo:", error);
    throw error;
  }
};
