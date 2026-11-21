import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const imagesDir = path.join(publicDir, 'images');
const officialsDir = path.join(imagesDir, 'officials');
const backupDir = path.join(officialsDir, 'backup_600px');

async function optimizeImages() {
  console.log('🚀 Starting image optimization...');

  // 1. Optimize SK Logo
  const logoPath = path.join(publicDir, 'sk-logo.jpg');
  if (fs.existsSync(logoPath)) {
    console.log('\n--- Optimizing SK Logo ---');
    const originalLogoSize = fs.statSync(logoPath).size;
    console.log(`Original logo: ${(originalLogoSize / 1024).toFixed(1)} KB`);

    const circleSvg128 = Buffer.from(
      '<svg width="128" height="128"><circle cx="64" cy="64" r="63.5" fill="white"/></svg>'
    );

    // 128x128 WebP with circular transparency mask
    const logoSmWebpPath = path.join(imagesDir, 'sk-logo-sm.webp');
    await sharp(logoPath)
      .resize(132, 132, { fit: 'cover' })
      .extract({ left: 2, top: 2, width: 128, height: 128 })
      .composite([{ input: circleSvg128, blend: 'dest-in' }])
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(logoSmWebpPath);
    const logoSmWebpSize = fs.statSync(logoSmWebpPath).size;
    console.log(`Created sk-logo-sm.webp: ${(logoSmWebpSize / 1024).toFixed(1)} KB (-${((1 - logoSmWebpSize / originalLogoSize) * 100).toFixed(1)}%)`);

    // 128x128 PNG fallback with circular transparency mask
    const logoSmPngPath = path.join(imagesDir, 'sk-logo-sm.png');
    await sharp(logoPath)
      .resize(132, 132, { fit: 'cover' })
      .extract({ left: 2, top: 2, width: 128, height: 128 })
      .composite([{ input: circleSvg128, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toFile(logoSmPngPath);
    const logoSmPngSize = fs.statSync(logoSmPngPath).size;
    console.log(`Created sk-logo-sm.png: ${(logoSmPngSize / 1024).toFixed(1)} KB (-${((1 - logoSmPngSize / originalLogoSize) * 100).toFixed(1)}%)`);
  }

  // 2. Backup 600px officials images if not already backed up
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 3. Optimize Officials Photos
  console.log('\n--- Optimizing Council Officials Photos ---');
  const files = fs.readdirSync(officialsDir).filter(f => f.endsWith('.jpg'));

  let totalOriginal = 0;
  let totalOptimizedJpg = 0;
  let totalOptimizedWebp = 0;

  for (const file of files) {
    const filePath = path.join(officialsDir, file);
    const backupPath = path.join(backupDir, file);

    // Save to backup if not backed up yet
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }

    const sourcePath = fs.existsSync(backupPath) ? backupPath : filePath;
    const origSize = fs.statSync(sourcePath).size;
    totalOriginal += origSize;

    // 160x160 WebP
    const baseName = path.parse(file).name;
    const webpPath = path.join(officialsDir, `${baseName}.webp`);
    await sharp(sourcePath)
      .resize(160, 160, { fit: 'cover', position: 'center' })
      .webp({ quality: 82 })
      .toFile(webpPath);
    const webpSize = fs.statSync(webpPath).size;
    totalOptimizedWebp += webpSize;

    // 160x160 JPEG (in-place replacement for zero-config backward compatibility)
    const tempJpg = path.join(officialsDir, `temp_${file}`);
    await sharp(sourcePath)
      .resize(160, 160, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toFile(tempJpg);
    
    fs.renameSync(tempJpg, filePath);
    const jpgSize = fs.statSync(filePath).size;
    totalOptimizedJpg += jpgSize;

    console.log(
      `✓ ${file}: ${(origSize / 1024).toFixed(1)} KB ➜ ${(jpgSize / 1024).toFixed(1)} KB (JPG) / ${(webpSize / 1024).toFixed(1)} KB (WebP)`
    );
  }

  console.log('\n--- Summary ---');
  console.log(`Officials Total Before: ${(totalOriginal / 1024).toFixed(1)} KB`);
  console.log(`Officials Total After (JPG): ${(totalOptimizedJpg / 1024).toFixed(1)} KB (-${((1 - totalOptimizedJpg / totalOriginal) * 100).toFixed(1)}%)`);
  console.log(`Officials Total After (WebP): ${(totalOptimizedWebp / 1024).toFixed(1)} KB (-${((1 - totalOptimizedWebp / totalOriginal) * 100).toFixed(1)}%)`);
  console.log('🎉 Optimization completed successfully!');
}

optimizeImages().catch(err => {
  console.error('Optimization failed:', err);
  process.exit(1);
});
