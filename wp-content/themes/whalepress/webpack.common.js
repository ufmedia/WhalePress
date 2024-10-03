const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    main: './public/src/js/index.js',
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'public/build'),
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader', // Add PostCSS loader for Tailwind
            options: {
              postcssOptions: {
                plugins: [
                  'tailwindcss',
                  'autoprefixer',
                ],
              },
            },
          },
          'sass-loader', // Process SCSS as usual
        ],
      },
      // Handle all images without transformation
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        include: path.resolve(process.cwd(), "public/images/"),
        type: "asset/resource", // Just emit the files without transformation
        generator: {
          filename: "images/[name][ext]",
        },
      },
      // We're ignoring fonts out of preference, but this can be removed if you want to handle fonts in your project.
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        include: path.resolve(process.cwd(), "public/fonts/"),
        type: "asset/resource", // Just emit the files without transformation
        generator: {
          filename: "fonts/[name][ext]",
        },
      },
    ],
  },
  // Ensure that the CSS is extracted into a separate file.
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'style-index.css',
    }),
  ],
  mode: 'development',
  devtool: 'source-map',
};
