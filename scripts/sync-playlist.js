import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'wesley-lablab';
const REPO = 'english-learning-player';
const BRANCH = 'gh-pages';
const PATH = 'videos/playlist.json';

const OUTPUT_PATH = path.join(PROJECT_ROOT, 'public', 'videos', 'playlist.json');

function fetchPlaylist() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'english-learning-player'
      }
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const content = Buffer.from(json.content, 'base64').toString('utf-8');
          resolve(content);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
  });
}

async function main() {
  console.log('📡 正在从 GitHub 同步最新的 playlist.json...');
  
  try {
    const content = await fetchPlaylist();
    
    const playlistData = JSON.parse(content);
    const videoCount = playlistData.videos?.length || 0;
    const courseCount = playlistData.courses?.length || 0;
    
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_PATH, content, 'utf-8');
    
    console.log(`✅ 同步成功！共 ${courseCount} 个课程，${videoCount} 个视频`);
    console.log(`📁 保存到: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('❌ 同步失败:', error.message);
    console.log('⚠️  将使用本地版本继续构建');
  }
}

main();
