import { executeQuery } from '../config.js';
import axios from 'axios';

export async function getTokenInfo() {
  const query = 'SELECT "AccessToken", "RefreshToken", "ExpireAt" FROM "ZaloTokens" ORDER BY "ExpireAt" DESC LIMIT 1';
  const result = await executeQuery(query);
  return result.rows[0] || null;
}

export async function updateTokenInfo(accessToken, refreshToken, expireAt) {
  // Xóa token cũ, chỉ giữ 1 bản ghi
  await executeQuery('DELETE FROM "ZaloTokens"');
  await executeQuery(
    'INSERT INTO "ZaloTokens" ("AccessToken", "RefreshToken", "ExpireAt") VALUES ($1, $2, $3)',
    [accessToken, refreshToken, expireAt]
  );
}

export async function refreshAccessToken(refreshToken) {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  const url = 'https://oauth.zaloapp.com/v4/oa/access_token';

  const params = new URLSearchParams();
  params.append('refresh_token', refreshToken);
  params.append('app_id', appId);
  params.append('grant_type', 'refresh_token');

  const headers = { 'secret_key': appSecret };

  const response = await axios.post(url, params, { headers });
  const data = response.data;

  if (data.error) throw new Error(data.error_description || 'Refresh token failed');

  // expires_in là giây, nên cộng vào thời gian hiện tại
  const expireAt = new Date(Date.now() + (parseInt(data.expires_in, 10) - 300) * 1000); // trừ 5 phút dự phòng

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expireAt
  };
}