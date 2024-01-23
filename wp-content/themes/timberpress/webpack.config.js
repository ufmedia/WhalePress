const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { merge } = require( 'webpack-merge' );
const path = require( 'path' );
const BrowserSyncPlugin = require( 'browser-sync-webpack-plugin' );

//Define our plugins here so we can filter based on custom envs
let plugins = [
	new BrowserSyncPlugin( {
		host: 'localhost',
		port: 3000,
		open: false,
		proxy: 'http://localhost/', //Use a proxy when using an existing local server.
		files: [
			{
				match: [ '**/*.php', '**/*.css', '**/*.js', '**/*.twig' ],
				fn: function ( event, file ) {
					if ( event === 'change' ) {
						const bs =
							require( 'browser-sync' ).get(
								'bs-webpack-plugin'
							);
						bs.reload();
					}
				},
			},
		],
		ignored: [
			path.resolve( process.cwd(), 'node_modules' ),
			path.resolve( process.cwd(), 'public/build' ),
		],
	} ),
];

module.exports = merge( defaultConfig, {
	entry: {
		index: path.resolve( process.cwd(), 'public/src/js/', 'index.js' ),
	},
	output: {
		path: path.resolve( process.cwd(), 'public/build' ),
	},
	plugins: [ ...plugins ],
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
