const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { merge } = require( 'webpack-merge' );
const path = require( 'path' );

module.exports = merge( defaultConfig, {
	entry: {
		index: path.resolve( process.cwd(), 'public/src/js/', 'index.js' ),
	},
	output: {
		path: path.resolve( process.cwd(), 'public/build' ),
	},

	module: {
		rules: [
			{
				test: /\.(woff|woff2|eot|ttf|otf)$/,
				exclude: /\.(woff|woff2|eot|ttf|otf)$/, // Exclude all font files
				use: [ 'file-loader' ],
			},
		],
	},
} );
