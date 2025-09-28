const { favicons } = require('favicons');
const fs = require('fs');
const path = require('path');

// SVG source
const source = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#4f46e5"/>
  <text x="50" y="70" font-family="Arial" font-size="60" text-anchor="middle" fill="white">I</text>
</svg>
`;

// Write the SVG file
fs.writeFileSync('favicon.svg', source);

// Configuration
const configuration = {
  path: "/",
  appName: "Interview Platform",
  appShortName: "Interview",
  appDescription: "AI-Powered Interview Platform",
  icons: {
    android: false,
    appleIcon: false,
    appleStartup: false,
    coast: false,
    favicons: true,
    firefox: false,
    windows: false,
    yandex: false
  }
};

// Callback to handle results
const callback = function (error, response) {
  if (error) {
    console.log(error.message);
    return;
  }

  // Create output directory if it doesn't exist
  const outputDir = path.resolve(__dirname, 'public');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Save the files
  console.log('Saving favicon files...');
  response.images.forEach(image => {
    fs.writeFileSync(
      path.join(outputDir, image.name),
      image.contents
    );
  });

  // Copy favicon.ico to src/app directory
  const srcAppDir = path.resolve(__dirname, 'src', 'app');
  if (!fs.existsSync(srcAppDir)) {
    fs.mkdirSync(srcAppDir, { recursive: true });
  }
  
  fs.copyFileSync(
    path.join(outputDir, 'favicon.ico'),
    path.join(srcAppDir, 'favicon.ico')
  );

  console.log('Favicon files created successfully!');
};

// Generate the favicons
console.log('Generating favicons...');
favicons('favicon.svg', configuration, callback);