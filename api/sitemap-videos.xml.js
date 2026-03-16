// Vercel Serverless Function to generate video sitemap
export default async function handler(req, res) {
  try {
    const BATCH_SIZE = 50; // Videos per page
    const NUM_PAGES = 20; // Fetch 20 pages = 1000 videos max
    const BASE_URL = 'https://3speak.tv';
    const API_URL = 'https://tags.3speak.tv/feeds/new';

    // Fetch multiple pages of videos in parallel
    const pagePromises = [];
    for (let page = 1; page <= NUM_PAGES; page++) {
      pagePromises.push(
        fetch(`${API_URL}?page=${page}&limit=${BATCH_SIZE}`)
          .then(response => response.json())
          .catch(err => {
            console.error(`Error fetching page ${page}:`, err);
            return { videos: [] };
          })
      );
    }

    const results = await Promise.all(pagePromises);
    const allVideos = results.flatMap(result => result.videos || []);

    // Filter out invalid videos and generate sitemap entries
    const videoEntries = allVideos
      .filter(video => video.owner && video.permlink && video.status === 'published')
      .map(video => {
        const url = `${BASE_URL}/watch?v=${video.owner}/${video.permlink}`;
        const lastmod = video.created ? new Date(video.created).toISOString().split('T')[0] : '';

        return `  <url>
    <loc>${escapeXml(url)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      })
      .join('\n');

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${videoEntries}
</urlset>`;

    // Set headers and send response
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Error generating video sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
}

// Helper function to escape XML special characters
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
