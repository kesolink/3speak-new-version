// Vercel Serverless Function to generate channels/users sitemap
export default async function handler(req, res) {
  try {
    const BATCH_SIZE = 50; // Videos per page
    const NUM_PAGES = 20; // Fetch 20 pages to get diverse channels
    const BASE_URL = 'https://3speak.tv';
    const API_URL = 'https://tags.3speak.tv/feeds/new';

    // Fetch multiple pages of videos in parallel to extract unique channels
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

    // Extract unique channel owners and their latest video date
    const channelsMap = new Map();
    allVideos
      .filter(video => video.owner && video.status === 'published')
      .forEach(video => {
        const owner = video.owner;
        const videoDate = video.created ? new Date(video.created) : null;

        if (!channelsMap.has(owner)) {
          channelsMap.set(owner, {
            owner,
            lastmod: videoDate,
          });
        } else {
          // Update with most recent video date
          const existing = channelsMap.get(owner);
          if (videoDate && (!existing.lastmod || videoDate > existing.lastmod)) {
            existing.lastmod = videoDate;
          }
        }
      });

    // Sort channels alphabetically for consistent output
    const channels = Array.from(channelsMap.values()).sort((a, b) =>
      a.owner.localeCompare(b.owner)
    );

    // Generate sitemap entries
    const channelEntries = channels
      .map(channel => {
        const url = `${BASE_URL}/user/${channel.owner}`;
        const lastmod = channel.lastmod
          ? channel.lastmod.toISOString().split('T')[0]
          : '';

        return `  <url>
    <loc>${escapeXml(url)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
      })
      .join('\n');

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${channelEntries}
</urlset>`;

    // Set headers and send response
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=7200, s-maxage=7200');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Error generating channels sitemap:', error);
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
