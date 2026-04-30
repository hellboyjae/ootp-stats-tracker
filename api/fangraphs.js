export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || !url.startsWith('https://www.fangraphs.com/api/')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; stats-tracker/1.0)',
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
