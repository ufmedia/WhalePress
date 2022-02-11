<?php /** @noinspection SqlResolve */
/** @noinspection PhpComposerExtensionStubsInspection */
$startTime = microtime(true);

require_once '../../../../includes/ame-utils.php';

$configFileName = 'D:/Dropbox/Projects/Admin Menu Editor/cap-db-generator-config.json';
if ( !is_file($configFileName) ) {
	echo "Error: Configuration file not found.\n";
	exit(1);
}

$config = json_decode(file_get_contents($configFileName));

$inputFileName = ameUtils::get($config, 'inputFile');
$outputFileName = ameUtils::get($config, 'outputFile');
$excerptFileName = ameUtils::get($config, 'excerptFile', __DIR__ . DIRECTORY_SEPARATOR . 'capability-excerpt.sqlite3');

//Basic error checking.
if ( empty($inputFileName) ) {
	echo "Error: Input file not specified.\n";
	exit(2);
}
if ( empty($outputFileName) ) {
	echo "Error: Output file not specified.\n";
	exit(3);
}
if ( empty($excerptFileName) ) {
	echo "Error: Excerpt database file name not specified.\n";
	exit(4);
}

if ( !is_file($inputFileName) ) {
	echo "Error: Input file doesn't exist.\n";
	exit(5);
}
if ( !is_file($outputFileName) ) {
	echo "Error: Output file doesn't exist.\n";
	exit(6);
}

if ( file_exists($excerptFileName) ) {
	echo "Notice: The excerpt file will be overwritten.\n";
}

//Connect to the databases.
$pdo = new PDO('sqlite:' . $outputFileName);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("ATTACH DATABASE '$inputFileName' AS smokebase");
$pdo->exec("PRAGMA foreign_keys = ON");

$statement = $pdo->query('SELECT COUNT(*) FROM smokebase.plugins');
printf(
	"%d plugins available\n",
	$statement->fetchColumn(0)
);
$statement->closeCursor();

//Insert new plugins.
echo "Inserting new plugins\n";
$pdo->exec("
	INSERT INTO components(typeId, slug, name, activeInstalls)
	SELECT 
		componentTypes.typeId, plugins.slug, coalesce(plugins.name_header, plugins.name), plugins.active_installs
	FROM 
		plugins
		JOIN componentTypes
	WHERE componentTypes.prefix = 'plugin:'
	ON CONFLICT DO NOTHING
");

//Update plugin names and install stats.
echo "Updating plugin names\n";
$pdo->exec("
	UPDATE components
	SET name = coalesce((
		SELECT coalesce(plugins.name_header, plugins.name) 
		FROM plugins
		WHERE plugins.slug = components.slug
	), name)
	WHERE components.typeId = (SELECT componentTypes.typeId FROM componentTypes WHERE componentTypes.prefix = 'plugin:')
");

echo "Updating active installs\n";
$pdo->exec("
	UPDATE components
	SET activeInstalls = coalesce((
		SELECT plugins.active_installs
		FROM plugins
		WHERE plugins.slug = components.slug
	), activeInstalls)
	WHERE components.typeId = (SELECT componentTypes.typeId FROM componentTypes WHERE componentTypes.prefix = 'plugin:')
");

//Insert new capabilities.
echo "Inserting new capabilities\n";

/** @noinspection SqlConstantCondition */
$pdo->exec("
	INSERT INTO capabilities(name)
	SELECT smokebase.capabilities.name
	FROM smokebase.capabilities
	WHERE 1=1
	ON CONFLICT DO NOTHING
");

echo "Updating plugin-capability relationships\n";
$pdo->exec("
	INSERT INTO componentCapabilityInfo(capabilityId, numericId)
	SELECT DISTINCT
		capabilities.capabilityId, components.numericId
	FROM
		plugin_capabilities 
		JOIN smokebase.capabilities ON (smokebase.capabilities.entity_id = plugin_capabilities.entity_id)
		JOIN reports ON (plugin_capabilities.report_id = reports.report_id)
		JOIN plugins ON (plugins.slug = reports.slug)
		JOIN components ON (components.slug = plugins.slug)
		JOIN componentTypes ON (componentTypes.typeId = components.typeId)
		JOIN main.capabilities ON (main.capabilities.name = smokebase.capabilities.name)
	WHERE
		componentTypes.prefix = 'plugin:'
	ON CONFLICT DO NOTHING
");

$pdo = null;

//Make a copy of the database.
$tempFileName = tempnam(sys_get_temp_dir(), 'rex');
printf("Creating temporary file %s\n", $tempFileName);
copy($outputFileName, $tempFileName);

$excerptDb = new PDO('sqlite:' . $tempFileName);
$excerptDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$excerptDb->exec("PRAGMA foreign_keys = OFF");

//Delete plugins that don't have any associated capabilities.
echo "Deleting plugins without any capabilities (this can take a while)\n";

$excerptDb->exec("
	DELETE FROM components 
	WHERE components.numericId IN (
		select a.numericId 
		from components AS a LEFT JOIN componentCapabilityInfo ON (a.numericId = componentCapabilityInfo.numericId)
		WHERE componentCapabilityInfo.capabilityId is NULL
	)
	AND components.typeId = (SELECT typeId from componentTypes WHERE prefix = 'plugin:')
");

//Delete plugins with less than X installs.
echo "Deleting unpopular plugins\n";
$excerptDb->exec("PRAGMA foreign_keys = ON");
$excerptDb->exec("
	DELETE FROM components 
	WHERE activeInstalls < 100
	AND components.typeId = (SELECT typeId from componentTypes WHERE prefix = 'plugin:')
");

echo "Deleting unused capabilities\n";
$excerptDb->exec("
	DELETE FROM capabilities
	WHERE capabilityId IN (
		SELECT capabilities.capabilityId
		FROM capabilities LEFT JOIN componentCapabilityInfo 
		    ON (capabilities.capabilityId = componentCapabilityInfo.capabilityId)
		WHERE componentCapabilityInfo.numericId IS NULL
	)
");

//The database probably has some empty space after deleting all of that data,
//so lets compact it to reduce its size.
$excerptDb->exec("VACUUM");

$excerptDb = null;
$size = filesize($tempFileName);
printf("Excerpt size: %d bytes\n", $size);

//Move the file to the appropriate location.
if ( copy($tempFileName, $excerptFileName) ) {
	printf("File moved to: %s\n", $excerptFileName);
} else {
	printf("Error: Could not move the file to %s", $excerptFileName);
	exit(10);
}
unlink($tempFileName);

printf("Elapsed time: %.3f seconds\n", microtime(true) - $startTime);