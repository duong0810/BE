import { getTokenInfo, refreshAccessToken, updateTokenInfo } from '../utils/zaloToken.js';

export async function getValidAccessToken(req, res) {
  try {
    let tokenInfo = await getTokenInfo();
    if (!tokenInfo) return res.status(404).json({ error: 'No token found' });

    const now = new Date();
    if (new Date(tokenInfo.ExpireAt) <= now) {
      // Token hết hạn, refresh
      const refreshed = await refreshAccessToken(tokenInfo.RefreshToken);
      await updateTokenInfo(refreshed.accessToken, refreshed.refreshToken, refreshed.expireAt);
      tokenInfo = await getTokenInfo(); // lấy lại token mới nhất
    }
    res.json({ accessToken: tokenInfo.AccessToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}