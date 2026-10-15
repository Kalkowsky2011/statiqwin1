import { fetchFlashscoreMatch } from '../src/flashscoreService.js';

export default async function handler(req, res) {
  const targetUrl = req.query?.url;
  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'Brak parametru url' });
  }

  try {
    const data = await fetchFlashscoreMatch(targetUrl);
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
