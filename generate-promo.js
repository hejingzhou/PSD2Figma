const { createCanvas } = require('canvas');
const fs = require('fs');

const width = 1920;
const height = 1080;

const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, width, height);

const gradient = ctx.createLinearGradient(0, 0, width, height);
gradient.addColorStop(0, '#16213e');
gradient.addColorStop(0.5, '#1a1a2e');
gradient.addColorStop(1, '#0f3460');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

for (let i = 0; i < 50; i++) {
  const x = Math.random() * width;
  const y = Math.random() * height;
  const radius = Math.random() * 2 + 0.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.1})`;
  ctx.fill();
}

ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

ctx.font = 'bold 100px "Microsoft YaHei", "PingFang SC", sans-serif';
ctx.fillStyle = '#ffffff';
ctx.shadowColor = 'rgba(0, 150, 255, 0.8)';
ctx.shadowBlur = 30;
ctx.fillText('PSD 转 Figma 转换器', width / 2, height / 2 - 120);

ctx.font = 'bold 48px "Microsoft YaHei", "PingFang SC", sans-serif';
ctx.fillStyle = '#00d4ff';
ctx.shadowColor = 'rgba(0, 212, 255, 0.6)';
ctx.shadowBlur = 20;
ctx.fillText('让设计资产无缝流转', width / 2, height / 2 - 20);

ctx.font = '30px "Microsoft YaHei", "PingFang SC", sans-serif';
ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
ctx.shadowBlur = 0;
ctx.fillText('支持图层重建、蒙版与裁剪还原、字体容错与导入回滚', width / 2, height / 2 + 70);

ctx.fillStyle = '#e94560';
ctx.fillRect(width / 2 - 220, height / 2 + 130, 440, 4);

ctx.font = '28px "Microsoft YaHei", "PingFang SC", sans-serif';
ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
ctx.fillText('功能亮点', width / 2, height / 2 + 200);

const highlights = [
  'PSD导入  |  图层结构还原  |  混合模式映射'
];
ctx.font = '22px "Microsoft YaHei", "PingFang SC", sans-serif';
ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
ctx.fillText(highlights[0], width / 2, height / 2 + 260);

ctx.font = '20px "Microsoft YaHei", "PingFang SC", sans-serif';
ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
ctx.fillText('By 看大医技术团队  |  Powered by Figma Plugin API', width / 2, height - 52);

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./promo-1920x1080.png', buffer);

console.log('Promo image created: promo-1920x1080.png (1920x1080)');
