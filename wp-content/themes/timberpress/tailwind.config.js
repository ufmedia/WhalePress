/** @type {import('tailwindcss').Config} */
module.exports = {
	mode: 'jit',
	important: true,
	content: [
		'./*/*.{twig,php}',
		'./**/*.{twig,php}',
		//'./public/src/js/*.js',
		//'./node_modules/tw-elements/dist/js/**/*.js',
		'./safelist.txt',
	],
	theme: {
		extend: {},
	},
	plugins: [ require( 'tw-elements/dist/plugin' ) ],
};
