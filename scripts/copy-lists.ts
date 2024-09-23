import fs from 'fs';
import path from 'path';

const connectorsDir = path.join(__dirname, '..', 'src', 'connectors');
const distDir = path.join(__dirname, '..', 'dist', 'connectors');

function copyLists(src: string, dest: string): void {
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(file => {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      fs.copyFileSync(srcFile, destFile);
    });
  }
}

fs.readdirSync(connectorsDir).forEach(connector => {
  const srcListsDir = path.join(connectorsDir, connector, 'lists');
  const destListsDir = path.join(distDir, connector, 'lists');
  copyLists(srcListsDir, destListsDir);
});