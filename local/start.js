import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';

console.clear();

console.log(chalk.blue(`
        .
       ":"
     ___:____     |"\\/""|
   ,'        \`.    \\  /
   |  ${chalk.yellow('O')}        \\___/  |
 ~^~^~^~^~^~^~^~^~^~^~^~^~
 ------- ${chalk.yellow('WhalePress')} --------
`));

console.log(chalk.black.bgGreen('Time to build something awesome...'));
// Display border   
displayBorder();

console.log(chalk.black.bgWhite('Local configuration'))
// Call the function to create the console.table
createEnvTable();

//Start up docker compose -d
console.log('Starting up Docker containers...');
try {
    execSync('docker compose up -d', { stdio: 'inherit' });
    console.log(chalk.green('Docker containers started successfully!'));
} catch (error) {
    console.error(chalk.red('Error starting Docker containers:', error));
}

// Display border   
displayBorder();

//Start theme:watch npm script from pakagge.json one directory up from this script
console.log(chalk.black.bgWhite('Starting Theme Scripts'));
try {
    execSync('npm run theme:watch --silent', { stdio: 'inherit' });
} catch (error) {
    console.error(chalk.red('Error starting theme:watch:', error));
}

// Display border
displayBorder();

// Function to display border
function displayBorder() {
    console.log(chalk.gray('\n-------------------------------------------\n'));
}

// Function to parse the .env file and create a console.table with selected keys
function createEnvTable() {
    const envFilePath = '../.env'; // Path to the .env file

    // Check if .env file exists
    if (!fs.existsSync(envFilePath)) {
        console.log(chalk.red('The .env file does not exist. Please run "npm run setup" to create it.'));
        process.exit(1);
    }

    const envContent = fs.readFileSync(envFilePath, 'utf8');
    const envLines = envContent.split('\n');
    const envData = {};

    envLines.forEach(line => {
        const [key, value] = line.split('=');
        const trimmedKey = key.trim();
        if (['PROJECT_NAME', 'SITE_URL', 'WP_PORT', 'WP_VERSION', 'WORDPRESS_DEBUG', 'THEME_NAME'].includes(trimmedKey)) {
            envData[trimmedKey] = value;
        }
    });

    console.table(envData);
}

