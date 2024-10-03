const { merge } = require( 'webpack-merge' );
const common = require( './webpack.common.js' );
const path = require( 'path' );

module.exports = merge( common, {
	mode: 'development',
	watchOptions: {
		ignored: [
			path.resolve( process.cwd(), 'public/build' ),
			path.resolve( process.cwd(), 'node_modules' ),
		],
		aggregateTimeout: 60, // delay before rebuilding
		poll: 1000, // check for changes every second
	},
} );
