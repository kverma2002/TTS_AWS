// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'development', // or 'production' for production builds
  entry: './popup.js',
  output: {
    filename: 'popup.bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  // Change the devtool setting to avoid using eval
  devtool: 'source-map', // or you can disable source maps with devtool: false
  resolve: {
    extensions: ['.js'],
  },
};
