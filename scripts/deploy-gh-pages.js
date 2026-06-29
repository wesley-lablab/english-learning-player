import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

try {
  console.log('🚀 开始部署到 GitHub Pages...');
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist 目录不存在，请先运行 npm run build');
    process.exit(1);
  }
  
  process.chdir(DIST_DIR);
  
  if (!fs.existsSync('.git')) {
    console.log('📝 初始化 git 仓库...');
    execSync('git init', { stdio: 'inherit' });
  }
  
  console.log('📡 配置远程仓库...');
  const token = process.env.GITHUB_TOKEN || '';
  const remoteUrl = token 
    ? `https://${token}@github.com/wesley-lablab/english-learning-player.git`
    : 'https://github.com/wesley-lablab/english-learning-player.git';
  
  try {
    execSync(`git remote add origin ${remoteUrl}`, { stdio: 'ignore' });
  } catch (e) {}
  
  try {
    execSync(`git remote set-url origin ${remoteUrl}`, { stdio: 'inherit' });
  } catch (e) {}
  
  console.log('📦 提交文件...');
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git commit -m "Deploy to GitHub Pages" --allow-empty', { stdio: 'inherit' });
  
  console.log('☁️  推送到 gh-pages 分支...');
  execSync('git push -f origin HEAD:gh-pages', { stdio: 'inherit' });
  
  console.log('✅ 部署成功！');
  console.log('🌐 访问地址: https://wesley-lablab.github.io/english-learning-player/');
  
} catch (error) {
  console.error('❌ 部署失败:', error.message);
  process.exit(1);
}
