import axios from 'axios';

class ZaloAPI {
  constructor() {
    this.baseURL = 'https://graph.zalo.me';
    this.oauthURL = 'https://oauth.zaloapp.com/v4';
  }

  // Lấy access token từ authorization code
  async getAccessToken(code) {
    try {
      const response = await axios.post(`${this.oauthURL}/access_token`, {
        app_id: process.env.ZALO_APP_ID,
        app_secret: process.env.ZALO_APP_SECRET,
        code: code,
        grant_type: 'authorization_code'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw error;
    }
  }

  // Lấy thông tin user profile
  async getUserProfile(accessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/v2.0/me`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,picture,birthday,gender'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error.response?.data || error.message);
      throw error;
    }
  }

  // Lấy số điện thoại (cần permission đặc biệt)
  async getUserPhone(accessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/v2.0/me`, {
        params: {
          access_token: accessToken,
          fields: 'id,phone'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting user phone:', error.response?.data || error.message);
      throw error;
    }
  }

  // Verify access token với Zalo
  async verifyZaloToken(accessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/v2.0/me`, {
        params: {
          access_token: accessToken,
          fields: 'id'
        }
      });
      
      return !!response.data.id;
    } catch (error) {
      return false;
    }
  }

  // Tạo authorization URL
  getAuthorizationURL() {
    const params = new URLSearchParams({
      app_id: process.env.ZALO_APP_ID,
      redirect_uri: process.env.ZALO_REDIRECT_URI,
      state: 'random_state_string' // Nên tạo random để bảo mật
    });
    
    return `${this.oauthURL}/auth?${params.toString()}`;
  }
}

export default new ZaloAPI();

// Giữ lại các helper functions để tương thích
export const getZaloUserInfo = async (accessToken) => {
  const zaloAPI = new ZaloAPI();
  return await zaloAPI.getUserProfile(accessToken);
};

export const getZaloUserPhone = async (accessToken) => {
  const zaloAPI = new ZaloAPI();
  return await zaloAPI.getUserPhone(accessToken);
};

export const verifyZaloToken = async (accessToken) => {
  const zaloAPI = new ZaloAPI();
  return await zaloAPI.verifyZaloToken(accessToken);
};