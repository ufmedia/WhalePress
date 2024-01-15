# Tailpack
 
A collection of scripts and tools for rapid front-end development including Tailwindcss which can be used optionally.
 
These scripts are an extension of the [Wordpress Scripts](https://www.npmjs.com/package/@wordpress/scripts) package.
 
The intention is that these scripts can be used during static (serverless) development and once you migrate (if you migrate) onto a hosted platform/framework - PHP or Wordpress, for example.
 
## Configuration
 
### Entry & Output
 
By default webpack will look for the entry point public/src/js/index.js your sass and any additional JS can be imported here, for example:
 
```
import '../scss/style.scss'
//import any other js/scss files here
 
```
 
By default webpack will output all compiled JS and CSS into the public/build folder.
 
You can alter the entry and output points within the webpack.config.js file:
 
```
entry: {
    index: path.resolve(process.cwd(), 'public/src/js/', 'index.js')
  },
  output: {
    path: path.resolve(process.cwd(), 'public/build')
  },
```
 
## Usage
 
### Clone or Download
 
```
gh repo clone ufmedia/tailpack
```
 
[Download Tailpack](https://github.com/ufmedia/tailpack/archive/refs/heads/main.zip)
 
### Installation
 
```
npm install --save-dev
```
 
### Development
 
There are currently 2 development options configured:
 
1. Serve static files from the public folder using the webpack dev server, watch for file changes and reload using browsersync:
 
```
npm run serve
```
(Perfect for static prototyping/development)
 
2. Watch for file changes and reload using browsersync.
 
```
npm run watch
```
(Perfect for use on an already hosted application - For example, a wordpress theme or plugin)
 
### Production
 
```
npm run build
```
 
### Tailwind
 
[Tailwindcsss](https://tailwindcss.com/) and [Tailwind Elements](https://tailwind-elements.com/) are included with this repo to help with rapid development, both are entirely optional.
 
#### Tailwindcss
 
Can be easily excluded from your compiled CSS and JS by removing the imports within the public/src/scss/style.scss file
 
```
@tailwind base;
@tailwind components;
@tailwind utilities;
```
 
#### Tailwind Elements
 
Can be excluded by modifying the tailwind.config.js file and removing the following lines:
 
```
'./node_modules/tw-elements/dist/js/**/*.js',
...
require('tw-elements/dist/plugin')
```
 
### Bootstrap or Similar Frameworks
 
You can easiy add [Bootstrap](https://getbootstrap.com/) or any other CSS frameworks by importing them. As an example, to add and use Bootstrap:
 
```
npm install bootstrap
```
 
Then import the styles into your main SASS file (public/src/scss/style.scss):
 
```
@import "~bootstrap/scss/bootstrap";
```
(Don’t forget to only use the components you require)
 
 
Finally import the required JS into your main JS file public/src/js/index.js:
 
```
import 'bootstrap';
```
(Dont forget to only use the components you require)
 
 
### BrowserSync
 
To make this configuration multipurpose and compatible with static and hosted development browsersync is included to work in partnership with the web-pack-dev server or on it's own if you're just watching for changes. To switch between the two modes simple change the proxy value within the webpack config file:
 
```
proxy: 'http://localhost:9000/'
```
 
By default we'll listen on the webpack-dev-server port (9000). You could change this to http://localhost/ or any other port you might be serving your application on. Your application will then be available on http://localhost:3000 through the browersync service.
 
### Watching for file changes
 
Webpack will only watch files which are children of the entry point directory (by default this is public/src/). This is most likely fine for new static projects but if you're working on an existing application or, for example, developing a wordpress plugin or theme, you can add additional file globs to be watched. These will then trigger a reload within the browser once changed. Within the webpack.config.js:
 
```
new WatchExternalFilesPlugin({
      files: [
        './**/*.php',
        './**/*.twig',
        '!./src/**/*',
        '!./node_modules/**/*',
        '!./build/**/*',
      ]
    })
```
 
 
## To do
 
This is a work in progress and will evolve as more use cases are added, however, the goal here is to keep things clean and simple for reusability across multiple, similar projects. Complex functionality required for a single project shouldn't make it into this repo in favour of this ethos.
 
With this in mind, the following additions are being explored:
 
- Image optimisation
