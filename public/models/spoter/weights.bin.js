// This script generates a binary weights file for the SPOTER model
const fs = require('fs');
const path = require('path');

// Create a buffer with random weights data
const generateRandomWeights = (size) => {
  const buffer = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
};

// Generate weights for each layer
const weights = {
  // LSTM layer weights [274, 512] (input_dim, 4*units)
  lstm_kernel: generateRandomWeights(274 * 512),
  lstm_recurrent: generateRandomWeights(128 * 512),
  lstm_bias: generateRandomWeights(512),
  
  // Dense layer 1 weights [128, 64]
  dense1_kernel: generateRandomWeights(128 * 64),
  dense1_bias: generateRandomWeights(64),
  
  // Output layer weights [64, 10]
  dense_output_kernel: generateRandomWeights(64 * 10),
  dense_output_bias: generateRandomWeights(10)
};

// Combine all weights into a single buffer
const totalSize = Object.values(weights).reduce((sum, buffer) => sum + buffer.length, 0);
const combinedBuffer = Buffer.concat(Object.values(weights), totalSize);

// Write to file
const outputPath = path.join(__dirname, 'weights.bin');
fs.writeFileSync(outputPath, combinedBuffer);

console.log(`Generated weights.bin file with ${totalSize} bytes`);