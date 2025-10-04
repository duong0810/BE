import { getLatestAccessToken } from '../utils/zaloToken.js';

export async function getAccessToken(req, res) {
  try {
    const token = await getLatestAccessToken();
    if (!token) return res.status(404).json({ error: 'No token found' });
    res.json({ accessToken: token });
  } catch (err) {
    res.status(500).json({ error: 'DB error', details: err.message });
  }
}