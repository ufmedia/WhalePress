# You can specify the test file to execute as the first argument.
# By default, we'll run all tests in the "casper-tests" subdirectory.
param(
	[string]$file = ".\casper-tests"
)

# Temporarily change to the script directory so we can use relative paths (for simplicity).
$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path $scriptPath
Push-Location $scriptDir

# You can leave out the "casper-tests" directory from the test filename
# and we'll prepend it automatically.
$fileExists = Test-Path $file;
$fileExistsInCasperTests = (Test-Path (".\casper-tests\" + $file));
if ( ($fileExists -ne $true) -and ($fileExistsInCasperTests -eq $true) ) {
	$file = ".\casper-tests\" + $file;
}

$pluginDir = Split-Path -Parent $PSScriptRoot

# Invoke the test runner.
casperjs test --includes="../js/lodash.js,config.js,helpers.js" --menuEditorDir="$pluginDir" $file

# Switch back to the previous directory.
Pop-Location