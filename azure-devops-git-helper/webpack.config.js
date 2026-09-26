const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

// Load author key from gitignored .author-key file (falls back to empty string).
let authorKey = '';
try {
  authorKey = fs.readFileSync(path.resolve(__dirname, '.author-key'), 'utf8').trim();
} catch {
  // Not present in this environment — author bypass will be inactive.
}

module.exports = {
  entry: {
    content: './src/content.ts',
    popup: './popup/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new webpack.DefinePlugin({
      __AUTHOR_KEY__: JSON.stringify(authorKey),
    }),
  ],
};
