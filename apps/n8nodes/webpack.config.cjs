const fs = require('fs');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

// Helper function to add entries from a given directory
function addEntriesFromDirectory(sourcePath, entries, pattern, outputDir, isFlat) {
  if (fs.existsSync(sourcePath)) {
    fs.readdirSync(sourcePath).forEach(file => {
      let fullPath;
      if (isFlat) {
        // Handle flat structure: files are directly in the sourcePath
        fullPath = path.join(sourcePath, file);
        const match = file.match(/^(.+)\.ts$/);
        if (match) {
          entries[`${outputDir}/${match[1]}`] = fullPath;
        }
      } else {
        // Handle nested structure: files are in subdirectories
        fullPath = path.join(sourcePath, file, file + pattern);
        const filePattern = pattern.slice(0, -3);
        if (fs.existsSync(fullPath)) {
          console.log(`Adding entry: ${outputDir}/${file}/${file} from ${fullPath}`)
          entries[`${outputDir}/${file}/${file}${filePattern}`] = fullPath;
        }
      }
    });
  }
}

// Main function to get entry points for Webpack
function getEntryPoints() {
  const entries = {};
  const nodesPath = path.resolve(__dirname, './nodes');
  const credentialsPath = path.resolve(__dirname, './credentials');

  // Add node entries, expecting nested directories
  addEntriesFromDirectory(nodesPath, entries, '.node.ts', 'nodes', false);
  // Add credential entries, expecting flat files
  addEntriesFromDirectory(credentialsPath, entries, '.credentials.ts', 'credentials', true);

  return entries;
}

module.exports = {
  mode: 'production',
  entry: getEntryPoints(),
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    chunkFilename: 'shared/[name].js', // Shared chunks go into the 'shared' directory
    library: {
      type: 'commonjs2',
    },
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.node']
  },
  plugins: [
    // existing plugins...
    new CopyPlugin({
      patterns: [
        {
          from: 'package.json',
          to: '',
          transform(content) {
            const packageJson = JSON.parse(content.toString());
            packageJson.type = 'commonjs';
            return JSON.stringify(packageJson, null, 2);
          }
        }
      ]
    })
  ],
  optimization: {
    minimize: true, // Ensure optimization is enabled
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true, // Preserve class names
          keep_fnames: true, // Preserve function names where necessary
        }
      })
    ],
    splitChunks: {
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          filename: 'shared/vendors.js' // Ensure vendor files go into 'shared'
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          filename: 'shared/common.js' // Common chunks are placed in 'shared'
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
      {
        test: /\.ts$/,
        use: ['babel-loader', 'ts-loader'],
      },
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        },
      }
    ]
  }
};

