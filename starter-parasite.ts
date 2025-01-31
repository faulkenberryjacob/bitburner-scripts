import { loadConfig } from 'utils';

/** @param {NS} ns */
export async function main(ns: NS) {
ns.disableLog("ALL");

  // Loading up defaults
  const config = await loadConfig(ns);

  const CAN_CRACK_SSH: boolean  = Boolean(config.canCrackSSH);
  const CAN_CRACK_FTP: boolean  = Boolean(config.canCrackFTP);
  const CAN_CRACK_SMTP: boolean = Boolean(config.canCrackSMTP);
  const CAN_CRACK_HTTP: boolean = Boolean(config.canCrackHTTP);
  const CAN_CRACK_SQL: boolean  = Boolean(config.canCrackSQL);

  const CAN_BACKDOOR: boolean   = Boolean(config.canBackdoor);

  const STARTER_HACK_SCRIPT_NAME: string  = config.starterHackScriptName;

  const CURRENT_SERVER = ns.getServer();

  // Ongoing set of already-scanned servers
  const scannedServers = new Set();

  // Ongoing set of hackable servers, put as <name, maxMoney>
  const hackableServers: Map<string, number> = new Map();

  // HOME is our start point. Scan recursively
  logger(CURRENT_SERVER, 0, "Starting " + ns.getScriptName() + " on " + CURRENT_SERVER.hostname);
  await scanServer(CURRENT_SERVER);

// ----------------------------------------------------------------------------------------------------------------------
// --- FUNCTION DEFINITIONS ---------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------------

  /**
       * Recursively scans servers and performs operations on them
       * @param {string} server - The current server to scan
       */
  async function scanServer(server: Server) {
    // If the server has already been scanned, skip it
    if (scannedServers.has(server.hostname)) {
      return;
    }

    // Mark the server as scanned
    scannedServers.add(server.hostname);
    checkServer(server);
    
    // Get connected servers
    const connectedServers = ns.scan(server.hostname);

    // Loop through each connected server
    for (let i = 0; i < connectedServers.length; i++) {
      const connectedServer: Server = ns.getServer(connectedServers[i]);

      // Recursively scan the connected server
      await scanServer(connectedServer);
    }
  }

  /**
   * Checks if a server is scriptable and attempts to gain admin rights if needed.
   * Records the server as hackable if it meets the criteria.
   * @param {Server} server - The server object to check.
   * @param {string} script - The script to check.
   */
  async function checkServer(server: Server) {
    logger(server, 0, "Checking server: " + server.hostname + "...");
    const host: string = server.hostname;

    let isScriptable: boolean = false;
    const maxMoney = ns.getServerMaxMoney(host);
    if (maxMoney == 0) {
      logger(server, 1, "Server has no money, skipping");
      return;
    }

    if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server.hostname)) {
      logger(server, 1, "Hacking skill is too low, skipping");
      return;
    }

    // Root server if we don't have admin rights
    if (!server.hasAdminRights) {
      logger(server, 1, "No admin rights")
      if (openPorts(server)) {
        ns.nuke(host);
        isScriptable = true;
      }
    } else { isScriptable = true; }

    if (!server.backdoorInstalled && CAN_BACKDOOR) {
      logger(server, 1, "Installing backdoor..");
      await ns.singularity.installBackdoor();
    }

    // record the server and its max money as hackable
    if (isScriptable) { scpAndStartScript(server, STARTER_HACK_SCRIPT_NAME); }
    else { logger(server, 1, "Unable to script this server"); }
  }

  async function sortMap(map: Map<string, number>) {
    return Array.from(hackableServers.entries()).sort((a, b) => b[1]-a[1]);
  }

  /**
   * Copies a script to a specified server and starts it with the maximum possible threads.
   *
   * @param {NS} ns - The Netscript object, providing access to Netscript functions.
   * @param {Server} server - The server object representing the target server.
   * @param {string} script - The filename of the script to be copied and executed.
   * @returns {number} - The PID of the newly started script, or 0 if the script fails to start.
   */
  function scpAndStartScript(server: Server, script: string) {
    let host: string = server.hostname;
    logger(server, 2, "SCPing " + script + " to " + host + "...");
    ns.scp(script, host, "home");

    // Calculate how many threads we can run
    const requiredRam: number = ns.getScriptRam(script);
    const idealThreads: number = Math.floor(server.maxRam / requiredRam);
    logger(server, 2, "MaxRam (" + server.maxRam + ") / requiredRam (" + requiredRam + ") = " + idealThreads + " ideal threads");

    // Attempt to start the script. If it fails, log why and skip
    if (idealThreads >= 1) {
      ns.killall(host);
      //ns.scriptKill(script, host);
      
      let returnCode: number = ns.exec(script, host, idealThreads, server.hostname);
      if (returnCode == 0) {
        logger(server, 2, script + " returned 0 on host: " + host);
      } else {
        logger(server, 2, script + " has been started on " + host);
        ns.tprint(script + " has been started on " + host);
      }
      return returnCode;
    } else {
      logger(server, 2, "Not enough resources to run on this host");
      return 0;
    }

  }

  /**
   * Attempts to open the required number of ports on a server.
   * @param {NS} ns - The NS object.
   * @param {Server} server - The server object to open ports on.
   */
  function openPorts(server: Server) {
    logger(server, 2, "Cracking open ports..");
    const target: string = server.hostname;

    // Check how many ports are required vs. opened
    let numRequiredPorts: number = server.numOpenPortsRequired != null ? server.numOpenPortsRequired : 0;
    let numOpenPorts: number = server.openPortCount != null ? server.openPortCount : 0;

    logger(server, 3, numOpenPorts.toString() + " / " + numRequiredPorts.toString() + " ports opened");

    if (numRequiredPorts <= numOpenPorts) { return true; }

    // Keep opening ports until we hit the requirement
    for (let i = 0; i <= (numRequiredPorts - numOpenPorts); i++) {
      if (!server.sshPortOpen && CAN_CRACK_SSH) {
        logger(server, 3, "sshPortOpen: " + server.sshPortOpen);
        ns.brutessh(target);
      }
      else if (!server.ftpPortOpen && CAN_CRACK_FTP) { ns.ftpcrack(target); }
      else if (!server.smtpPortOpen && CAN_CRACK_SMTP) { ns.relaysmtp(target); }
      else if (!server.httpPortOpen && CAN_CRACK_HTTP) { ns.httpworm(target); }
      else if (!server.sqlPortOpen && CAN_CRACK_SQL) { ns.sqlinject(target); }
    }

    numRequiredPorts = server.numOpenPortsRequired != null ? server.numOpenPortsRequired : 0;
    numOpenPorts = server.openPortCount != null ? server.openPortCount : 0;
    return (numRequiredPorts <= numOpenPorts);
  }

  /**
   * Logs a message with a specified indentation level and server hostname.
   * @param {NS} ns - The NS object.
   * @param {Server} server - The server object containing the hostname.
   * @param {number} [level=0] - The indentation level for the log message.
   * @param {string} log - The log message to be printed.
   */
  async function logger(server: Server, level: number = 0, log: string, showInTerminal: boolean = false) {
    let tabbing: string = "";
    for (let i = 0; i < level; i++) {
      tabbing += "  ";
    }
    ns.print(server.hostname + " " + tabbing + log);
    if (showInTerminal) {ns.tprint(server.hostname + " " + tabbing + log); }
  }

}

