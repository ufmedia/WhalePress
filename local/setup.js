import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';

console.clear();

console.log(chalk.blue(`

        .
       ":"
     ___:____     |"\\/""|
   ,'        \`.    \\  /
   |  O        \\___/  |
 ~^~^~^~^~^~^~^~^~^~^~^~^~
 ------- ${chalk.yellow('DokPress')} --------
`));

// Function to get the directory name
function getDirname(importMetaUrl) {
    const __filename = fileURLToPath(importMetaUrl);
    return path.dirname(__filename);
}

// Function to load variables from .env-template file
function loadEnvTemplate() {
    const dirname = getDirname(import.meta.url);
    const envFile = fs.readFileSync(path.join(dirname, '..', '.env-example'), 'utf8');
    const envVariables = {};
    envFile.split('\n').forEach(line => {
        if (line.trim() !== '' && line.indexOf('#') !== 0) {
            const [keyWithValue, comment] = line.split('#');
            const [key, value] = keyWithValue.split('=');
            envVariables[key.trim()] = { value: value.trim(), description: comment ? comment.trim() : '' };
        }
    });
    return envVariables;
}

// Function to prompt user for values using inquirer
async function promptUser(envVariables) {
    const questions = Object.keys(envVariables).map(key => ({
        type: 'input',
        name: key,
        message: envVariables[key].description || `Enter value for ${key}:`,
        default: envVariables[key].value || ''
    }));

    return await inquirer.prompt(questions);
}

// Function to save new .env file with user-provided values
function saveEnv(envVariables) {
    const dirname = getDirname(import.meta.url);
    let envContent = '';
    for (const key in envVariables) {
        envContent += `${key}=${envVariables[key]}\n`;
    }
    fs.writeFileSync(path.join(dirname, '..', '.env'), envContent);
    console.log(chalk.green('New .env file saved successfully!'));
}

// Function to build theme assets
async function buildThemeAssets() {
    const dirname = getDirname(import.meta.url);
    const themeEnvPath = path.join(dirname, '..', '.env');
    const themeEnvExists = fs.existsSync(themeEnvPath);
    if (!themeEnvExists) {
        console.log(chalk.red("ERROR: .env file for the theme not found. You need to populate the .env file first."));
        return;
    }
    const themeEnvContent = fs.readFileSync(themeEnvPath, 'utf8');
    const themeNameMatch = themeEnvContent.match(/THEME_NAME=(.+)/);
    if (!themeNameMatch) {
        console.log(chalk.red("ERROR: THEME_NAME variable not found in the .env file. You need to populate the .env file first."));
        return;
    }
    const themeName = themeNameMatch[1].trim();
    const themePath = path.join(dirname, '..', 'wp-content', 'themes', themeName);
    const themePackageJsonPath = path.join(themePath, 'package.json');
    if (!fs.existsSync(themePackageJsonPath)) {
        console.log(chalk.red(`ERROR: package.json not found in the theme directory (${themePath}). Make sure the theme directory is correct or create a package.json file within the theme.`));
        return;
    }
    console.log(`Installing npm dependencies for the theme ${themeName}...`);
    execSync('npm install', { stdio: 'inherit', cwd: themePath });
    console.log(`Building assets for the theme ${themeName}...`);
    execSync('npm run build', { stdio: 'inherit', cwd: themePath });

    const themePackageJsonContent = fs.readFileSync(themePackageJsonPath, 'utf8');
    const themePackageJson = JSON.parse(themePackageJsonContent);

    const themeScripts = themePackageJson.scripts || {};
    const rootPackageJsonPath = path.join(dirname, '..', 'package.json');

    const rootPackageJsonContent = fs.readFileSync(rootPackageJsonPath, 'utf8');
    const rootPackageJson = JSON.parse(rootPackageJsonContent);

    // Create npm scripts in the root package.json to execute scripts in the theme directory
    for (const scriptName in themeScripts) {
        rootPackageJson.scripts[`theme:${scriptName}`] = `cd ./wp-content/themes/${themeName} && npm run ${scriptName}`;
    }

    fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2));
    console.log(chalk.green(`Theme scripts copied to the root package.json successfully!`));
}

// Function to display border
function displayBorder() {
    console.log(chalk.gray('\n-------------------------------------------\n'));
}

// Main function
async function main() {
    console.log(chalk.black.bgMagenta("Let's get things ready..."));

    // Ask user if they want to build the .env file
    displayBorder();
    const { buildEnv } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'buildEnv',
            message: chalk.black.bgWhite('Do you want to build a new .env file?'),
            default: true
        }
    ]);

    if (buildEnv) {
        console.log(chalk.green("Let's setup your local .env file..."));
        const envVariables = loadEnvTemplate();
        const answers = await promptUser(envVariables);
        saveEnv(answers);

    }

    // Ask user if they want to build Docker containers
    displayBorder();
    const { buildContainers } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'buildContainers',
            message: chalk.black.bgWhite('Do you want to build the Docker containers?'),
            default: true
        }
    ]);

    if (buildContainers) {
        try {
            console.log('Building Docker containers...');
            execSync('docker-compose build', { stdio: 'inherit' });
            console.log('Docker containers built successfully!');
        } catch (error) {
            console.error('Error building Docker containers:', error);
        }
    }

    // Ask user if they want to install composer dependencies
    displayBorder();
    const { installComposer } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'installComposer',
            message: chalk.black.bgWhite('Do you want to install composer dependencies?'),
            default: true
        }
    ]);

    if (installComposer) {
        try {
            console.log('Installing composer dependencies...');
            execSync('composer install --no-dev', { stdio: 'inherit', cwd: path.join(getDirname(import.meta.url), '..') });
            console.log('Composer dependencies installed successfully!');
        } catch (error) {
            console.error('Error installing composer dependencies:', error);
        }
    }

    // Ask user if they want to build theme assets
    displayBorder();
    const { buildTheme } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'buildTheme',
            message: chalk.black.bgWhite('Do you want to build theme assets?'),
            default: true
        }
    ]);

    if (buildTheme) {
        await buildThemeAssets();
    }

    //Do you want to install development plugins?
    displayBorder();
    const { installPlugins } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'installPlugins',
            message: chalk.black.bgWhite('Do you want to install development plugins?'),
            default: true
        }
    ]);

    if (installPlugins) {
        // Function to read environment variables from .env file
        function readEnvVariable(envFilePath, variableName) {
            try {
                const envContent = fs.readFileSync(envFilePath, 'utf8');
                const envLines = envContent.split('\n');
                for (const line of envLines) {
                    const [name, value] = line.split('=');
                    if (name.trim() === variableName) {
                        return value.trim();
                    }
                }
                return null; // Variable not found
            } catch (error) {
                console.error('Error reading environment variable:', error.message);
                return null;
            }
        }

        // Function to read the container name from .env file
        function getContainerName() {
            const envFilePath = '../.env'; // Path to the .env file
            const containerName = readEnvVariable(envFilePath, 'PROJECT_NAME') + '_wordpress';
            if (!containerName) {
                console.error('Error: PROJECT_NAME environment variable not found in .env file.');
                process.exit(1); // Exit the script
            }
            return containerName;
        }

        // Function to read commands from dev-plugins.sh file
        function readCommandsFromFile() {
            try {
                const content = fs.readFileSync('dev-plugins.sh', 'utf8');
                // Split the content by newline and filter out empty lines and comments
                const commands = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
                console.log('Commands:', commands);
                return commands;
            } catch (error) {
                console.error('Error reading commands from file:', error.message);
                return [];
            }
        }

        // Function to execute each command sequentially
        function executeCommand(command, containerName) {

            execSync(`docker exec ${containerName} ${command}`, (error, stdout, stderr) => {

                console.log(`stdout: ${stdout}`);

            });


        }

        // Function to execute all commands sequentially
        async function executeCommands(commands, containerName) {
            for (const command of commands) {
                console.log(`Executing command: ${command}`);
                try {
                    executeCommand(command, containerName);
                } catch (error) {
                    console.error(`Error executing command: ${error}`);
                }
            }
        }

        // Read container name from .env file
        const containerName = getContainerName();

        // Read commands from dev-plugins.sh file
        const commands = readCommandsFromFile();

        // Call the function to execute all commands
        try {
            await executeCommands(commands, containerName);
        } catch (error) {
            console.error('Error executing commands:', error);
        }

        console.log(chalk.green('Development plugins installed, see logs above for details!'));

    }



    //Shall we run the start.js script in this same directory?
    displayBorder();
    const { runStart } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'runStart',
            message: chalk.black.bgWhite('Do you want to run the start script?'),
            default: true
        }
    ]);

    if (runStart) {
        console.log('Running start script...');
        execSync('node start.js', { stdio: 'inherit', cwd: getDirname(import.meta.url) });
    }
}

main();
