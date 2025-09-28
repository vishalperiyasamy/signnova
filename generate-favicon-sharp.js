const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Create a simple blue square with white 'I' as favicon
const size = 32;
const svgBuffer = Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0066cc" />
  <text x="50%" y="50%" font-family="Arial" font-size="24" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">I</text>
</svg>
`);

// Ensure directories exist
const publicDir = path.join(__dirname, 'public');
const appDir = path.join(__dirname, 'src', 'app');

// Generate favicon.ico files
async function generateFavicons() {
  try {
    // Create ICO file for public directory
    await sharp(svgBuffer)
      .resize(32, 32)
      .toFormat('png')
      .toBuffer()
      .then(data => {
        fs.writeFileSync(path.join(publicDir, 'favicon.ico'), data);
        console.log('Created public/favicon.ico');
      });

    // Create ICO file for app directory
    await sharp(svgBuffer)
      .resize(32, 32)
      .toFormat('png')
      .toBuffer()
      .then(data => {
        fs.writeFileSync(path.join(appDir, 'favicon.ico'), data);
        console.log('Created src/app/favicon.ico');
      });

    console.log('Favicon generation completed successfully!');
  } catch (error) {
    console.error('Error generating favicons:', error);
  }
}

generateFavicons();