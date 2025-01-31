const CONFIG_FILE: string = 'config.json';
const SCRIPT_NAME: string = 'utils.ts';


export async function main(ns: NS) {
  const rawArg = ns.args[0];
  const logger = new Logger(ns);

  let funcName: string;
  if (rawArg) {
    funcName = rawArg.toString().toLowerCase();
  } else {
    funcName = "";
  }
  

  switch (funcName) {
    case "buildserverdb":
      await buildServerDB(ns);
      break;
    case "printserverdata":
      await printServerData(ns, ns.args[1].toString());
      break;
    case "dryrun":
      if (ns.args[1] && ns.args[2]) {
        logger.tlog("Prep Algorithm:");
        await printPrepAlgorithm(ns, ns.args[1].toString(), ns.args[2].toString());

        logger.tlog("");
        logger.tlog("Hack Algorithm:");
        await printHackAlgorithm(ns, ns.args[1].toString(), ns.args[2].toString());
      } else {
        ns.tprint("Missing args! Require targetServer and sourceServer");
        ns.tprint("\tex: run utils.ts dryRun n00dles home");
      }
      break;
    case "maxram":
      ns.tprint(`Max ram you can purchase per server:  ${determinePurchaseServerMaxRam(ns)}`);
      break;
    default:
      ns.tprint("No such function: " + funcName);
      ns.tprint("Available functions:");
      ns.tprint("\tbuildServerDB");
      ns.tprint("\tprintServerData");
      ns.tprint("\tdryRun");
      ns.tprint("\tmaxRam");
      break;
  }
}

export function getUtilsName() {
  return SCRIPT_NAME;
}

export function getConfigName() {
  return CONFIG_FILE;
}


/**
 * Loads the configuration data from the specified configuration file.
 * @param {NS} ns - The NS object.
 * @returns {object} - The parsed configuration data.
 */
export function loadConfig(ns: NS) {
  return JSON.parse(ns.read(CONFIG_FILE));
}


/**
 * Retrieves data for a specified server from the database.
 * @param {NS} ns - The Netscript context.
 * @param {string} target - The hostname of the server to retrieve data for.
 * @returns {Promise<Server | undefined>} - A promise that resolves to the server data if found, otherwise undefined.
 */
export async function getServerData(ns: NS, target: string) {
  const db = await readDB(ns);
  return db.find(server => server.hostname === target);
}

/**
 * Prints the data of a specified server from the database.
 * @param {NS} ns - The Netscript context.
 * @param {string} target - The hostname of the server to print data for.
 * @returns {Promise<void>}
 */
export async function printServerData(ns: NS, target: string) {
  const logger = new Logger(ns);
  const db: Server[] = await readDB(ns);
  const foundServer = db.find(server => server.hostname === target);

  if (foundServer) { logger.tlog(JSON.stringify(foundServer, null, 2)); }
  else { logger.tlog("Server not found."); }
}


/**
 * Reads and parses the server database file into an array of sorted Server objects.
 * @param {NS} ns - The NS object.
 * @returns {Promise<Server[]>} - An array of Server objects.
 */
export async function readDB(ns: NS) {

  // Parse the JSON in the same format it was written to
  const dbData: { [key: string]: Server } = JSON.parse(ns.read(loadConfig(ns).serverDBFileName));

  // Create a server Array so we can keep the sorted integrity
  const serverArray: Server[] = [];

  for (const key in dbData) {
    if (dbData.hasOwnProperty(key)) {
      const server: Server = dbData[key];
      serverArray.push(server);
    }
  }

  return serverArray;
}


/**
 * Gets the current time formatted as HH:mm:ss.
 * @returns {string} - The current time in HH:mm:ss format.
 */
export function getCurrentTime() {
  // Get the current date and time
  const now = new Date();

  // Extract hours, minutes, and seconds
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // Format the time as HH:mm:ss
  return `${hours}:${minutes}:${seconds}`;
}


/**
 * Formats a given number into a short string representation with suffixes (k, m, b) for thousands, millions, and billions.
 * @param {number} num - The number to format.
 * @returns {Promise<string>} - A promise that resolves to the formatted number string.
 */
export async function shortFormatNumber(num: number) {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'b';
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'm';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Formats a given number into a string with commas as thousands separators.
 * @param {number} num - The number to format.
 * @returns {Promise<string>} - A promise that resolves to the formatted number string.
 */
export async function formatNumber(num: number) {
  return num.toLocaleString('en-US');
}


/**
 * Formats a number into a dollar amount with commas and a dollar sign.
 * @param {number} money - The amount of money to format.
 * @returns {Promise<string>} - The formatted dollar amount.
 */
export function formatDollar(money: number) {
  // Create a NumberFormat object for US dollars
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });

  // Format the number
  return formatter.format(money);
}

/**
 * Retrieves the hostname of the server with the maximum money available that the player can hack.
 * @param {NS} ns - The Netscript context.
 * @returns {Promise<string>} - A promise that resolves to the hostname of the top server with the maximum money.
 */
export async function getTopServerWithMaxMoney(ns: NS) {
  const db = await readDB(ns);
  const logger = new Logger(ns);

  logger.log("DB has " + db.length.toString() + " entries.");

  let topServer: Server = db[db.length - 1];
  const hackingLevel: number = ns.getHackingLevel();

  for (let i = 0; i < db.length; i++) {
    const serverMoney = ns.getServerMaxMoney(db[i].hostname);
    const requiredLevel = ns.getServerRequiredHackingLevel(db[i].hostname);
    logger.log(`Checking ${db[i].hostname} with ${formatDollar(serverMoney)} and required hacking ${requiredLevel}...`);

    if (serverMoney > (ns.getServerMaxMoney(topServer.hostname))
      && hackingLevel >= (ns.getServerRequiredHackingLevel(db[i].hostname))) {
      topServer = db[i];
      logger.log(`\t${db[i].hostname} matches!`)
    }
  }

  return topServer.hostname;
}

/**
 * Retrieves a list of hackable servers based on the player's hacking level and admin rights.
 * @param {NS} ns - The Netscript context.
 * @returns {Promise<string[]>} - A promise that resolves to a list of hackable server hostnames.
 */
export async function getHackableServers(ns: NS) {
  const db = await readDB(ns);

  let hackableServers: string[] = [];
  const hackingLevel: number = ns.getHackingLevel();
  const ownedServers: string[] = ns.getPurchasedServers();

  for (const server of db) {
    if (hackingLevel >= (server.requiredHackingSkill ?? 0)
      && server.hasAdminRights 
      && server.hostname != "home"
      && !ownedServers.includes(server.hostname)) {
      hackableServers.push(server.hostname);
    }
  }

  return hackableServers;
}

export async function removeFilesFromServer(ns: NS, files: string[], server: string) {
  const logger = new Logger(ns);
  if (server == "home") {
    logger.log("We're not deleting files off home. Aborting");
    return 2;
  }

  let allFiles = ns.ls(server);
  let allFilesDeleted: boolean = true;

  for (const file of allFiles) {
    if (files.includes(file)) {
      logger.log(`Deleting ${file}...`);
      if (!ns.rm(file, server)) {
        logger.log(`Could not delete ${file}`);
        allFilesDeleted = false;
      }
    }
  }

  return allFilesDeleted;
}

/**
 * Deletes all files on a specified server, optionally filtering by file extension.
 * @param {NS} ns - The Netscript context.
 * @param {string} server - The hostname of the server to delete files from.
 * @param {string} [fileExtension] - The file extension to filter by (optional).
 * @returns {Promise<number>} - Returns 2 if aborting deletion on "home", otherwise returns 0.
 */
export async function deleteAllFilesOnServer(ns: NS, server: string, fileExtension?: string) {
  const logger = new Logger(ns);
  if (server = "home") {
    logger.log("We're not deleting files off home. Aborting");
    return 2;
  }
  const allFiles = ns.ls(server);
  let filesToDelete: string[] = [];

  if (fileExtension) {
    filesToDelete = allFiles.filter(file => file.endsWith(fileExtension));
  } else {
    filesToDelete = allFiles;
  }

  for (const file of filesToDelete) {
    ns.rm(file, server);
  }

  return 0;
}

/**
 * Checks if any of the specified scripts are already running on the target server.
 * @param {NS} ns - The NS object.
 * @param {string[]} scripts - An array of script names to check.
 * @param {string} targetServer - The target server to check for running scripts.
 * @returns {Promise<boolean>} - True if any of the specified scripts are running, false otherwise.
 */
export async function checkIfScriptsAlreadyRunning(ns: NS, scripts: string[], targetServer: string) {
  // Get all the running scripts on the server
  const runningScripts = ns.ps(targetServer);
  let scriptsStillRunning: boolean = false;

  const logger = new Logger(ns);

  logger.log("Checking if " + scripts.join(', ') + " are still running..");
  for (const script of runningScripts) {
    if (scripts.includes(script.filename)) {
      scriptsStillRunning = true;
    }
  }
  logger.log("Done! stillRunning: " + scriptsStillRunning);

  return scriptsStillRunning;
}

/**
 * Kills specified scripts running on the target server and confirms that they have been terminated.
 * @param {NS} ns - The NS object.
 * @param {string[]} scripts - An array of script names to kill.
 * @param {string} targetServer - The target server where the scripts are running.
 * @returns {Promise<boolean>} - True if all specified scripts are killed, false otherwise.
 */
export async function killScripts(ns: NS, scripts: string[], targetServer: string) {
  // Get all the running scripts on the server
  const runningScripts = ns.ps(targetServer);

  const logger = new Logger(ns);

  // Iterate through and kill them
  logger.log("Killing scripts..");
  for (const script of runningScripts) {
    if (scripts.includes(script.filename)) {
      ns.kill(script.filename, targetServer, ...script.args);
      logger.log("  Killed " + script.filename + " on " + targetServer);
    }
  }
  logger.log("Done killing scripts!");

  // confirm scripts are all dead
  return !await checkIfScriptsAlreadyRunning(ns, scripts, targetServer);
}

interface ScriptInstance {
  name: string,
  threads: number,
  args: string[]
}

/**
 * Deploys and executes specified scripts on the target server after killing any currently running instances.
 * @param {NS} ns - The NS object.
 * @param {ScriptInstance[]} scripts - An array of script instances, each containing a script name, number of threads, and arguments.
 * @param {string} targetServer - The target server on which to deploy the scripts.
 * @param {string} sourceServer - The source server from which to copy the scripts.
 * @returns {Promise<boolean>} - True if all specified scripts are executed successfully, false otherwise.
 */
export async function deployScripts(ns: NS, scripts: ScriptInstance[], targetServer: string, sourceServer: string) {
  const logger = new Logger(ns);
  
  // kill anything already running
  const scriptArray: string[] = scripts.map(instance => instance.name);
  if (!await killScripts(ns, scriptArray, targetServer)) {
    logger.log("Unable to kill still-running scripts. Aborting.");
    return false;
  }

  // copy over scripts
  ns.scp(scriptArray, targetServer, sourceServer);

  let anyScriptsFailed = false;

  scripts.forEach(instance => {
    const pid = ns.exec(instance.name, targetServer, instance.threads, ...instance.args);
    if (pid === 0) {
      anyScriptsFailed = true;
      logger.log(`Failed to execute script ${instance.name} on server: ${targetServer}`);
    }
  })

  return !anyScriptsFailed;
}

/**
 * Deploys and executes a specified script on the target server after killing any currently running instance.
 * @param {NS} ns - The NS object.
 * @param {string} script - The name of the script to deploy.
 * @param {string} targetServer - The target server on which to deploy the script.
 * @param {string} sourceServer - The source server from which to copy the script.
 * @param {string[]} [args] - Optional array of arguments for the script.
 * @returns {Promise<boolean>} - True if the script is executed successfully, false otherwise.
 */
export async function deployScript(ns: NS, script: string, targetServer: string, sourceServer: string, args?: string[]) {
  const logger = new Logger(ns);
  
  // kill anything already running
  const scriptArray: string[] = [script];

  if (!await killScripts(ns, scriptArray, targetServer)) {
    logger.log("Unable to kill still-running script. Aborting.");
    return false;
  }

  // copy over scripts
  if (targetServer != sourceServer) {
    ns.scp(scriptArray, targetServer, sourceServer);
  }

  const idealThreads = await calculateMaxThreadsForScript(ns, script, targetServer, sourceServer);

  if (idealThreads <= 0) {
    logger.log("Not enough RAM to run script");
    return false;
  }

  let pid: number = 0;

  if (args) { 
    pid = ns.exec(script, targetServer, idealThreads, ...args);
  } else {
    pid = ns.exec(script, targetServer, idealThreads);
  }

  if (pid === 0) {
    logger.log(`Failed to execute script ${script} on server: ${targetServer}`);
  }

  return pid != 0;
}

/**
 * Deploys and executes a specified script on the target server after killing any currently running instance.
 * @param {NS} ns - The NS object.
 * @param {string} script - The name of the script to deploy.
 * @param {string} targetServer - The target server on which to deploy the script.
 * @param {string} sourceServer - The source server from which to copy the script.
 * @param {string[]} [args] - Optional array of arguments for the script.
 * @returns {Promise<boolean>} - True if the script is executed successfully, false otherwise.
 */
export async function deployScriptNoOptimization(ns: NS, script: string, targetServer: string, sourceServer: string, threads: number, args?: string[]) {
  const logger = new Logger(ns);
  
  // kill anything already running
  const scriptArray: string[] = [script];

  if (!await killScripts(ns, scriptArray, targetServer)) {
    logger.log("Unable to kill still-running script. Aborting.");
    return false;
  }

  // copy over scripts
  if (targetServer != sourceServer) {
    ns.scp(scriptArray, targetServer, sourceServer);
  }

  let pid: number = 0;

  if (args) { 
    pid = ns.exec(script, targetServer, threads, ...args);
  } else {
    pid = ns.exec(script, targetServer, threads);
  }

  if (pid === 0) {
    logger.log(`Failed to execute script ${script} on server: ${targetServer}`);
  }

  return pid != 0;
}


/**
 * Calculates the maximum number of threads that can be run for a specific script on a given server.
 * @param {NS} ns - The Netscript context.
 * @param {string} script - The name of the script to run.
 * @param {string} server - The hostname of the server to run the script on.
 * @param {string} [scriptSource="home"] - The hostname of the server where the script is located. Defaults to "home".
 * @returns {Promise<number>} - The maximum number of threads that can be run.
 */
export async function calculateMaxThreadsForScript(ns: NS, script: string, server: string, scriptSource: string = "home") {
  const logger = new Logger(ns);
  
  // Calculate how many threads we can run
  const HOME_RAM_BUFFER: number = Number(loadConfig(ns).homeRamBuffer);

  // add a buffer if we're working on "home"
  const ramBuffer: number = server == "home" ? HOME_RAM_BUFFER : 0;

  const requiredRam: number = ns.getScriptRam(script, scriptSource);
  const availableRam: number = (ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) - ramBuffer;
  const idealThreads: number = Math.floor(availableRam / requiredRam);
  logger.log("AvailableRam (" + availableRam + ") / requiredRam (" + requiredRam + ") = " + idealThreads + " ideal threads");
  return idealThreads;
}

export function canCrackSSH(ns: NS) {
  return ns.fileExists("BruteSSH.exe", "home");
}

export function canCrackFTP(ns: NS) {
  return ns.fileExists("FTPCrack.exe", "home");
}

export function canCrackSMTP(ns: NS) {
  return ns.fileExists("relaySMTP.exe", "home");
}

export function canCrackHTTP(ns: NS) {
  return ns.fileExists("HTTPWorm.exe", "home");
}

export function canCrackSQL(ns: NS) {
  return ns.fileExists("SQLInject.exe", "home");
}


/**
 * Recursively scans and roots servers starting from a given server or the "home" server by default.
 * @param {NS} ns - The Netscript context.
 * @param {string} [startServer="home"] - The hostname to start the scan from. Defaults to "home".
 * @returns {Promise<string[]>} - A promise that resolves to a list of rooted server hostnames.
 */
export async function rootServers(ns: NS, startServer: string = "home") {
  // Ongoing set of already-scanned servers
  const scannedServers = new Set();
  const logger = new Logger(ns);
  const rootedServers: string[] = [];

  logger.log(`Rooting servers..`);

  await scanServer(ns.getServer(startServer));

  return rootedServers;

  /**
   * Recursively scans servers and performs operations on them
   * @param {string} server - The current server to scan
   */
  async function scanServer(server: Server) {
    // If the server has already been scanned, skip it
    if (scannedServers.has(server.hostname)) {
      return;
    }

    logger.log(`Scanning ${server.hostname}..`);

    // Mark the server as scanned
    scannedServers.add(server.hostname);
    const rootServerReturn = await rootServer(ns, server);
    if (rootServerReturn) {
      rootedServers.push(rootServerReturn);
    }

    // Get connected servers
    const connectedServers = ns.scan(server.hostname);

    // Loop through each connected server
    for (let i = 0; i < connectedServers.length; i++) {
      const connectedServer: Server = ns.getServer(connectedServers[i]);

      // Recursively scan the connected server
      await scanServer(connectedServer);
    }
  }

}

/**
 * Attempts to root a specified server by gaining admin access and optionally installing a backdoor.
 * This function checks the player's hacking level, opens required ports, and uses nuke to gain admin rights.
 * 
 * @param {NS} ns - The Netscript context.
 * @param {Server} server - The server to root.
 * @returns {Promise<string | undefined>} - Returns the server hostname if successfully rooted, otherwise undefined.
 */
export async function rootServer(ns: NS, server: Server) {
  const logger = new Logger(ns);
  
  const config = await loadConfig(ns);

  const CAN_BACKDOOR: boolean = Boolean(config.canBackdoor);

  logger.log("Checking server: " + server.hostname + "...");
  const host: string = server.hostname;

  let isScriptable: boolean = false;
  const maxMoney = ns.getServerMaxMoney(host);

  // if (maxMoney == 0) {
  //   logger.log("Server has no money, skipping");
  //   return 2;
  // }

  logger.log(`Checking hack level..`);
  if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server.hostname)) {
    logger.log("Hacking skill is too low, skipping", 1);
    return;
  }
  logger.log(`It's hackable!`,1);

  // Root server if we don't have admin rights
  logger.log(`Checking for admin rights..`)
  if (!server.hasAdminRights) {
    logger.log("No admin rights. Cracking..",1)
    if (openPorts(server)) {
      ns.nuke(host);
      logger.log(`Ports opened and nuked!`,2);
      isScriptable = true;
    }
  } else { 
    logger.log(`We have admin rights!`,1);
    isScriptable = true; 
  }

  if (!server.backdoorInstalled && CAN_BACKDOOR) {
    //ns.print("Installing backdoor..");
    //await ns.singularity.installBackdoor();
  }

  if (!isScriptable) { return; }

  return server.hostname;

/**
 * Attempts to open the required number of ports on a server.
 * @param {NS} ns - The NS object.
 * @param {Server} server - The server object to open ports on.
 */
  function openPorts(server: Server) {
    logger.log("Cracking open ports..", 2);
    const target: string = server.hostname;

    // Check how many ports are required vs. opened
    let numRequiredPorts: number = server.numOpenPortsRequired != null ? server.numOpenPortsRequired : 0;
    let numOpenPorts: number = server.openPortCount != null ? server.openPortCount : 0;

    logger.log(numOpenPorts.toString() + " / " + numRequiredPorts.toString() + " ports opened", 3);

    if (numRequiredPorts <= numOpenPorts) { return true; }

    // Open them puppies up
    if (!server.sshPortOpen && canCrackSSH(ns))   { ns.brutessh(target); }
    if (!server.ftpPortOpen && canCrackFTP(ns))   { ns.ftpcrack(target); }
    if (!server.smtpPortOpen && canCrackSMTP(ns)) { ns.relaysmtp(target); }
    if (!server.httpPortOpen && canCrackHTTP(ns)) { ns.httpworm(target); }
    if (!server.sqlPortOpen && canCrackSQL(ns))   { ns.sqlinject(target); }

    numRequiredPorts = server.numOpenPortsRequired != null ? server.numOpenPortsRequired : 0;
    numOpenPorts = server.openPortCount != null ? server.openPortCount : 0;
    return (numRequiredPorts <= numOpenPorts);
  }
}


/**
 * Formats a given time in milliseconds into a more readable string format (hours, minutes, or seconds).
 * @param {number} timeInMillis - The time in milliseconds to format.
 * @returns {string} - The formatted time string.
 */
export function formatTime(timeInMillis: number) {
  const seconds = timeInMillis / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;

  if (hours >= 1) {
    return `${hours.toFixed(2)} hours`;
  } else if (minutes >= 1) {
    return `${minutes.toFixed(2)} minutes`;
  } else {
    return `${seconds.toFixed(2)} seconds`;
  }
}


/**
 * Determines the maximum RAM that can be afforded for purchasing servers.
 * @param {NS} ns - The Netscript context.
 * @returns {number} - The maximum RAM that can be afforded for the servers.
 */
export function determinePurchaseServerMaxRam(ns: NS) {
  const logger              = new Logger(ns);
  const serverLimit: number = ns.getPurchasedServerLimit();
  const playerMoney: number = ns.getServerMoneyAvailable("home");

  // we can only buy server RAM in powers of 2, or 2^n
  // let's start at 256
  const starterRamExponent: number = 8;

  return recurseRamCost(starterRamExponent);

  function recurseRamCost(ramExponent: number) {
    const ram = Math.pow(2, ramExponent);
    logger.log(`Checking cost for ${serverLimit} servers with ${ram} RAM..`)

    const cost = ns.getPurchasedServerCost(ram);
    const totalCost = cost * serverLimit;

    if (totalCost <= playerMoney) {
      logger.log(`Can afford ${ram}!`,1);
      return recurseRamCost(ramExponent + 1);
    } else {
      const maxRam = Math.pow(2, ramExponent-1);
      logger.log(`Found max: ${maxRam}`);
      return maxRam;
    }
  }
}

/**
 * Retrieves the process IDs (PIDs) of specified scripts running on the target server.
 * @param {NS} ns - The NS object.
 * @param {string} targetServer - The target server to check for running scripts.
 * @param {string[]} scripts - An array of script names to look for.
 * @returns {Promise<number[]>} - An array of PIDs of the specified scripts running on the target server.
 */
export async function getScriptPIDS(ns: NS, targetServer: string, scripts: string[]) {
  const processes = ns.ps(targetServer);
  const scriptPIDs: number[] = [];

  for (const scriptName of scripts) {
      const pids = processes
          .filter(process => process.filename === scriptName)
          .map(process => process.pid);

      scriptPIDs.push(...pids);
  }

  return scriptPIDs;
}

/**
 * Waits for the specified scripts (by PIDs) to finish execution, with a customizable delay between checks.
 * @param {NS} ns - The NS object.
 * @param {number[]} pids - An array of process IDs (PIDs) to wait for.
 * @param {number} [delay=500] - Optional delay in milliseconds between each check (default is 500 ms).
 */
export async function waitForScriptsToFinish(ns: NS, pids: number[], delay: number = 500) {
  const logger = new Logger(ns);
  while (pids.some(pid => ns.isRunning(pid))) {
    await ns.sleep(delay); // Check every half second
  }
  //logger.log(`Done waiting for pids: ${pids.join(', ')}`);
}


/**
 * Builds a server database by scanning all connected servers recursively and sorting them by maximum money.
 * @param {NS} ns - The NS object.
 * @returns {Promise<void>} - A promise that resolves when the server database is built.
 */
export async function buildServerDB(ns: NS) {
  ns.disableLog("disableLog");
  ns.disableLog("write");
  // Ongoing set of already-scanned servers
  const scannedHostNames: Set<string> = new Set();
  const scannedServers: Set<Server> = new Set();

  // Load and create new server file
  const serverDB: string = loadConfig(ns).serverDBFileName;
  if (ns.fileExists(serverDB)) { ns.rm(serverDB); }

  await scanServer(ns.getServer());

  // remove all our owned servers from the list
  const ownedServers = ns.getPurchasedServers();
  ownedServers.push("home");
  const nonOwnedServerArray = Array.from(scannedServers).filter(server => !ownedServers.includes(server.hostname));

  // sort
  const sortedServerArray = Array.from(nonOwnedServerArray).sort((a, b) => (ns.getServerMaxMoney(b.hostname)) - (ns.getServerMaxMoney(a.hostname)));
  const sortedServerMap: { [key: string]: Server } = sortedServerArray.reduce((acc, server) => {
    acc[server.hostname] = server;
    return acc;
  }, {} as { [key: string]: Server });

  const jsonString = JSON.stringify(sortedServerMap, null, 2);
  ns.write(serverDB, jsonString, "w");

  /**
   * Recursively scans servers and performs operations on them
   * @param {string} server - The current server to scan
   */
  async function scanServer(server: Server) {
    // If the server has already been scanned, skip it
    if (scannedHostNames.has(server.hostname)) {
      return;
    }

    // Mark the server as scanned
    scannedHostNames.add(server.hostname);
    scannedServers.add(server);

    // Get connected servers
    const connectedServers = ns.scan(server.hostname);

    // Loop through each connected server
    for (let i = 0; i < connectedServers.length; i++) {
      const connectedServer: Server = ns.getServer(connectedServers[i]);

      // Recursively scan the connected server
      await scanServer(connectedServer);
    }
  }
}


export interface HackAlgorithm {
  script: string,
  threads: number,
  args: string[],
  runTime: number
}


/**
 * Calculates the maximum preparation algorithm for a target server by determining the optimal number of threads for grow and weaken scripts.
 * @param {NS} ns - The Netscript context.
 * @param {string} targetServer - The hostname of the target server.
 * @param {string} sourceServer - The hostname of the source server.
 * @returns {Promise<HackAlgorithm[]>} - Returns an array of HackAlgorithm objects representing the ideal preparation plan.
 */
export async function maxPrepAlgorithm(ns: NS, targetServer: string, sourceServer: string) {
  const logger = new Logger(ns);
  const config = loadConfig(ns);

  logger.log(`Starting prep algorithm`);

  const GROW_SCRIPT: string     = config.growScriptName;
  const WEAKEN_SCRIPT: string   = config.weakenScriptName;

  const resultArray: HackAlgorithm[] = [];

  // get some resource info
  const maxMoney = ns.getServerMaxMoney(targetServer);
  const serverRam = ns.getServerMaxRam(sourceServer) - ns.getServerUsedRam(sourceServer);
  const minSecurityLevel = ns.getServerMinSecurityLevel(targetServer);
  const currentSecurityLevel = ns.getServerSecurityLevel(targetServer);

  const growRam = ns.getScriptRam(GROW_SCRIPT);
  const weakenRam = ns.getScriptRam(WEAKEN_SCRIPT);

  // assume we can prep the server in one script run
  const growPercentage: number = 1;
  

  return await findQuickestPrepAlgorithm(growPercentage);

  async function findQuickestPrepAlgorithm(growDecay: number, weakenDecay: number = 1) {
    growDecay   = parseFloat(growDecay.toFixed(2));
    weakenDecay = parseFloat(weakenDecay.toFixed(2));
    

    // Calculate the number of threads needed to grow the server to max money
    const growThreads = Math.ceil(growDecay * ns.growthAnalyze(targetServer, maxMoney / Math.max(ns.getServerMoneyAvailable(targetServer), 1)));

    // Calculate the security increase from growing
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, targetServer);

    // Calculate the number of threads needed to weaken the server to min security
    const totalSecurityIncrease = growSecurityIncrease + (currentSecurityLevel - minSecurityLevel);
    const weakenThreads = Math.ceil(weakenDecay * (totalSecurityIncrease / ns.weakenAnalyze(1)));

    // Check available RAM
    const growScriptRam = ns.getScriptRam(GROW_SCRIPT);
    const weakenScriptRam = ns.getScriptRam(WEAKEN_SCRIPT);

    // Ensure there is enough RAM to run the scripts
    const totalRamUsed = (growThreads * growScriptRam) + (weakenThreads * weakenScriptRam);
    logger.log(`Prep algorithm: growDecay ${growDecay} gives ${growThreads} threads, weakenDecay ${weakenDecay} gives ${weakenThreads} threads = ${totalRamUsed} RAM`, 1);

    if (totalRamUsed > serverRam || totalRamUsed < 0 ) { 
      // these decay numbers are our failsafes. If it's impossible to grow & weaken with full potential,
      // we slowly wittle down how many grow threads are possible. Once we hit 10% (0.1) of potential
      // grow threads, we start decaying weaken until our worst possible outcomes: 10% of both's potential
      growDecay   -= growDecay > 0.05 ? 0.05 : 0;
      weakenDecay -= (growDecay <= 0.05) && (weakenDecay > 0.05) ? 0.05 : 0;

      if (growDecay <= 0.05 && weakenDecay <= 0.05) {
        logger.log(`No prep solutions found. Lowest used ${totalRamUsed} RAM. ${targetServer} only has ${serverRam} RAM available`);
        const empty: HackAlgorithm[] = [];
        return empty;
      } else {
        // found the numbers to the nearest hundredths. ex: 0.200004 = 0.20
        return await findQuickestPrepAlgorithm(growDecay, weakenDecay);
      }
    }
    
    // if this succeeds let's store the results
    else {

      const weakenTime  = ns.getWeakenTime(targetServer);
      const growTime    = ns.getGrowTime(targetServer);

      const longestRunTime  = Math.max(weakenTime, growTime);

      const weakenDelay = longestRunTime - weakenTime;
      const growDelay   = longestRunTime - growTime;

      const parallelLoops = Math.floor(serverRam/totalRamUsed);
      for (let a = 0; a < parallelLoops; a++) {
        const parallelDelay: number = 150 // in milliseconds

        const growInterface: HackAlgorithm = {
          script: GROW_SCRIPT,
          threads: growThreads,
          args: [targetServer, (growDelay + (a * parallelDelay)).toString()],
          runTime: ns.getGrowTime(targetServer),
        };

        const weakenInterface: HackAlgorithm = {
          script: WEAKEN_SCRIPT,
          threads: weakenThreads,
          args: [targetServer, (weakenDelay + (a * parallelDelay)).toString()],
          runTime: ns.getWeakenTime(targetServer),
        };

        resultArray.push(growInterface);
        resultArray.push(weakenInterface);
      }


      logger.log(`Ideal plan determined with ${growDecay.toString()}, ${weakenDecay.toString()} decays using ${totalRamUsed} RAM`);
      // for (let p = 0; p < resultArray.length; p++) {
      //   logger.log(resultArray[p].script + "(" + resultArray[p].threads + ")" + " with runTime: " + formatTime(resultArray[p].runTime) 
      //   + " ms and args: " + resultArray[p].args + " ms");
      // }

      return resultArray;
    }

  }
}

/**
 * Prints the preparation algorithm for a target server, including the money available and security level.
 * @param {NS} ns - The Netscript context.
 * @param {string} targetServer - The hostname of the target server.
 * @param {string} sourceServer - The hostname of the source server.
 * @returns {Promise<void>}
 */
export async function printPrepAlgorithm(ns: NS, targetServer: string, sourceServer: string) {
  const logger = new Logger(ns);

  const algorithm = await maxPrepAlgorithm(ns, targetServer, sourceServer);
  const moneyAvailable = formatDollar(ns.getServerMoneyAvailable(targetServer));
  const currentSecurity = ns.getServerSecurityLevel(targetServer);

  logger.tlog(`${targetServer} has ${moneyAvailable} with security level ${currentSecurity}`);
  for (const step of algorithm) {
    const finishTime = formatTime(step.runTime + Number(step.args[1]));
    logger.tlog(`\tWould run ${step.script} with ${step.threads} threads, finshing in ${finishTime}`);
  }
  return;
}

/**
 * Prints the hacking algorithm for a target server, including the money available and security level.
 * @param {NS} ns - The Netscript context.
 * @param {string} targetServer - The hostname of the target server.
 * @param {string} sourceServer - The hostname of the source server.
 * @returns {Promise<void>}
 */
export async function printHackAlgorithm(ns: NS, targetServer: string, sourceServer: string) {
  const logger = new Logger(ns);

  const algorithm = await maxHackAlgorithm(ns, targetServer, sourceServer);
  const moneyAvailable = formatDollar(ns.getServerMoneyAvailable(targetServer));
  const currentSecurity = ns.getServerSecurityLevel(targetServer);

  logger.tlog(`${targetServer} has ${moneyAvailable} with security level ${currentSecurity}`);
  for (const step of algorithm) {
    const finishTime = formatTime(step.runTime + Number(step.args[1]));
    logger.tlog(`\tWould run ${step.script} with ${step.threads} threads, finshing in ${finishTime}`);
  }
  return;
}


/**
 * Calculates the maximum hack algorithm for a target server by determining the optimal number of threads for hack, grow, and weaken scripts.
 * @param {NS} ns - The Netscript context.
 * @param {string} targetServer - The hostname of the target server.
 * @param {string} sourceServer - The hostname of the source server.
 * @returns {Promise<HackAlgorithm[]>} - Returns an array of HackAlgorithm objects representing the ideal hack plan.
 */
export async function maxHackAlgorithm(ns: NS, targetServer: string, sourceServer: string) {
  /*
                        |= hack ====================|
      |=weaken 1======================================|
                    |= grow ==========================|
        |=weaken 2======================================|
  
                  We want to accomplish the above
  */

  const config = loadConfig(ns);
  const logger = new Logger(ns);

  logger.log(`Starting max hack algorithm`);

  const HACK_SCRIPT: string     = config.hackScriptName;
  const GROW_SCRIPT: string     = config.growScriptName;
  const WEAKEN_SCRIPT: string   = config.weakenScriptName;

  const resultArray: HackAlgorithm[] = [];

  // get some resource info
  const maxMoney = ns.getServerMaxMoney(targetServer);
  const serverRam = ns.getServerMaxRam(sourceServer) - ns.getServerUsedRam(sourceServer);

  const hackRam = ns.getScriptRam(HACK_SCRIPT);
  const growRam = ns.getScriptRam(GROW_SCRIPT);
  const weakenRam = ns.getScriptRam(WEAKEN_SCRIPT);
  
  // Start at 100%
  const startHackPercent = 1.0;

  return await findMaxHackPercentageForAlgorithm(startHackPercent);

  async function findMaxHackPercentageForAlgorithm(hackPercent: number) {
    hackPercent = parseFloat(hackPercent.toFixed(2));

    if (hackPercent <= 0) {
      const error: HackAlgorithm[] = []
      return error;
    }

    // Calculate hack threads
    const hackAmount = (maxMoney * hackPercent) > maxMoney ? maxMoney : (maxMoney * hackPercent);
    const hackThreads = Math.floor(ns.hackAnalyzeThreads(targetServer, hackAmount));
    if (hackThreads <= -1) {
      logger.log(`hackAnalyzeThreads returned ${hackThreads} for hackAmount ${hackAmount} with hackPercent ${hackPercent}.`);
      const error: HackAlgorithm[] = []
      return error;
    }

    // Calculate security increase from hacking
    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads);

    // Calculate weaken threads needed to counter hack security increase
    const weakenThreadsForHack = Math.ceil(hackSecurityIncrease / ns.weakenAnalyze(1));

    // Calculate grow threads needed to restore money
    const moneyAfterHack = (maxMoney * (1.0 - hackPercent)) == 0 ? 0.001 : (maxMoney * (1.0 - hackPercent));
    const growThreads = Math.ceil(ns.growthAnalyze(targetServer, maxMoney / moneyAfterHack));

    // Calculate security increase from growing
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads);

    // Calculate weaken threads needed to counter grow security increase
    const weakenThreadsForGrow = Math.ceil(growSecurityIncrease / ns.weakenAnalyze(1));

    // Total weaken threads required
    const totalWeakenThreads = weakenThreadsForHack + weakenThreadsForGrow;

    // if this uses too much RAM, let's try again but reduce 5% hack
    const totalRamUsed = (hackThreads * hackRam) + (growThreads * growRam) + (totalWeakenThreads * weakenRam);

    if (totalRamUsed > serverRam || totalRamUsed < 0 ) { return await findMaxHackPercentageForAlgorithm(hackPercent-0.05); }
    
    // if this succeeds let's store the results and sort them by
    // longest running script first
    else {

      const hackTime        = ns.getHackTime(targetServer);
      const weakenHackTime  = ns.getWeakenTime(targetServer);
      const growTime        = ns.getGrowTime(targetServer);
      const weakenGrowTime  = ns.getWeakenTime(targetServer);

      const longestRunTime  = Math.max(hackTime, weakenHackTime, growTime, weakenGrowTime);

      const hackDelay       = longestRunTime - hackTime;
      const weakenHackDelay = longestRunTime - weakenHackTime + 20;
      const growDelay       = longestRunTime - growTime + 40;
      const weakenGrowDelay = longestRunTime - weakenGrowTime + 60;

      // how many times can this loop fit into our available server RAM?
      // for example, if we have 1,000 GB available but this loop only takes 250 GB,
      // we can run it four times back to back.
      const parallelLoops = Math.floor(serverRam/totalRamUsed);
      for (let a = 0; a < parallelLoops; a++) {
        const parallelDelay: number = 150 // in milliseconds

        const hackInterface: HackAlgorithm = {
          script: HACK_SCRIPT,
          threads: hackThreads,
          args: [targetServer, (hackDelay + (a * parallelDelay)).toString()],
          runTime: ns.getHackTime(targetServer)
        };

        const weakenHackInterface: HackAlgorithm = {
          script: WEAKEN_SCRIPT,
          threads: weakenThreadsForHack,
          args: [targetServer, (weakenHackDelay + (a * parallelDelay)).toString()],
          runTime: ns.getWeakenTime(targetServer),
        };

        const growInterface: HackAlgorithm = {
          script: GROW_SCRIPT,
          threads: growThreads,
          args: [targetServer, (growDelay+ (a * parallelDelay)).toString()],
          runTime: ns.getGrowTime(targetServer),
        };

        const weakenGrowInterface: HackAlgorithm = {
          script: WEAKEN_SCRIPT,
          threads: weakenThreadsForGrow,
          args: [targetServer, (weakenGrowDelay + (a * parallelDelay)).toString()],
          runTime: ns.getWeakenTime(targetServer),
        };

        resultArray.push(hackInterface);
        resultArray.push(weakenHackInterface);
        resultArray.push(growInterface);
        resultArray.push(weakenGrowInterface);  
      }   

      logger.log(`Ideal plan determine with hackPercent [${hackPercent.toString()}] using ${totalRamUsed} RAM`);

      // for (let p = 0; p < resultArray.length; p++) {
      //   logger.log(`${resultArray[p].script} (${resultArray[p].threads}) with runTime: ${formatTime(resultArray[p].runTime)} and args ${resultArray[p].args.join(', ')}`);
      // }

      return resultArray;
    }

  }
}

/**
 * Logger class to handle logging messages with timestamps, caller information, and optional indentation.
 */
export class Logger {
  private ns: NS;
  private isHome: boolean;

  constructor(ns: NS) {
    this.ns = ns;
    this.isHome = this.ns.getHostname() === "home";
  }

  /**
   * Logs a message with timestamp, caller information, and optional indentation.
   * @param {string} message - The message to log.
   * @param {number} [indent=0] - The number of indentation levels to apply.
   */
  log(message: string, indent: number = 0): void {
    const callerInfo = Logger.getCallerInfo();
    let indentation: string = "";
    for (let i = 0; i < indent; i++) { indentation += "  "; }
    const formMessage = `[${Logger.getTimestampFormat()}] ${callerInfo}: ${indentation}${message}`;
    this.ns.print(formMessage);
    //this.ns.write(`${Logger.getCustomDate()}.txt`, formMessage + "\r\n", "a");
  }

  /**
   * Logs a message to both the game log and the terminal with timestamp, caller information, and optional indentation.
   * @param {string} message - The message to log.
   * @param {number} [indent=0] - The number of indentation levels to apply.
   */
  tlog(message: string, indent: number = 0): void {
    const callerInfo = Logger.getCallerInfo();
        let indentation: string = "";
    for (let i = 0; i < indent; i++) { indentation += "  "; }
    const formMessage = `[${Logger.getTimestampFormat()}] ${callerInfo}: ${indentation}${message}`;
    this.ns.print(formMessage);
    this.ns.tprint(formMessage);
    //this.ns.write(`${Logger.getCustomDate()}.txt`, formMessage + "\r\n", "a");
  }

  private static getCustomDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}_${month}_${day}`;
  }

  private static getTimestampFormat(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Retrieves caller information such as function name, file path, and line/column numbers.
   * @returns {string} - The caller information string.
   */
  private static getCallerInfo(): string {
    const error = new Error();
    const stack = error.stack?.split("\n");

    if (stack && stack.length > 3) {
      // The 3rd element in the stack trace should be the caller
      const callerLine = stack[3];
      const callerMatch = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);

      if (callerMatch) {
        const functionName = callerMatch[1] || "anonymous";
        const filePath = callerMatch[2];
        const lineNumber = callerMatch[3];
        const columnNumber = callerMatch[4];

        return `${functionName} (${filePath}:${lineNumber}:${columnNumber})`;
      }
    }

    return "unknown";
  }
}