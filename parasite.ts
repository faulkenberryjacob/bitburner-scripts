import * as utils from 'utils';

/** @param {NS} ns */
export async function main(ns: NS) {
  // Loading up defaults
  const config = await utils.loadConfig(ns);

  const FACTORY_SCRIPT_NAME: string      = config.factoryScriptName;
  const WEAKEN_SCRIPT_NAME: string       = config.weakenScriptName;
  const HACK_SCRIPT_NAME: string         = config.hackScriptName;
  const GROW_SCRIPT_NAME: string         = config.growScriptName;

  const STARTER_HACK_SCRIPT_NAME: string = config.starterHackScriptName;
  const SHARE_SCRIPT_NAME: string        = config.shareLoopScriptName;

  const DEFAULT_PURCHASE_RAM: number     = Number(config.defaultServerPurchaseRam);

  const PURCHASED_SERVER_NAME: string = config.defaultServerPurchaseName;

  const CURRENT_SERVER = ns.getServer();

  const logger = new utils.Logger(ns);
  ns.disableLog("ALL");

  // parsing arguments
  switch (ns.args[0]) {
    case "top":
      // automatically find max money server
      await parasiteMoney();
      break;
    case "target":
      // target a particular server
      const targetServer: string = ns.args[1].toString() ?? "";
      if (targetServer == "") {
        ns.tprint("No target was given for -t");
        break;
      }
      await parasiteTarget(targetServer);

      break;
    case "share":
      // share all other server space
      await parasiteStarter(SHARE_SCRIPT_NAME);
      break;
    case "starter":
      // do basic hacking command
      await parasiteStarter(STARTER_HACK_SCRIPT_NAME);
      break;
    case "auto":
      // automatically target top N servers
      await parasiteAuto();
      break;
    case "home":
      // run top function on our home server
      await parasiteMoney(true);
      break;
    default:
      const help: string = "parasite [OPTIONS]"
        + "\r\n  auto \t\t\t Automatically find top servers to target"
        + "\r\n  target {server} \t Target a particular server"
        + "\r\n  starter \t\t Use basic hack scripts on hosts, assume no purchase power"
        + "\r\n  home \t\t\t Same as Top, but hosted entirely on the home server"
        + "\r\n  top \t\t\t Same as Target, but the most lucrative server"
        + "\r\n  share \t\t Put a looping share script on all unowned servers\r\n";
      ns.tprint(help);
      break;
  }
  return; 

// ----------------------------------------------------------------------------------------------------------------------
// --- FUNCTION DEFINITIONS ---------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------------

  /**
   * Automates the process of preparing and hacking servers by rooting all servers, building a server database, 
   * targeting the top servers, purchasing servers if needed, and deploying factory scripts.
   * @returns {Promise<number>} - Returns 0 upon successful execution.
   */
  async function parasiteAuto() {
    // Recurse through and try to root all possible servers
    await utils.rootServers(ns);

    // Now let's build the JSON DB of all server information
    // (this is just in case it hasn't been done yet)
    await utils.buildServerDB(ns);

    // What are all the servers we can hack?
    const hackableServers: string[] = await utils.getHackableServers(ns);

    // sort by max money, desc
    hackableServers.sort((a, b) => ns.getServerMaxMoney(b)- ns.getServerMaxMoney(a));

    // filter out anything that has no money
    const topServers = hackableServers.filter(server => ns.getServerMaxMoney(server) > 0);

    logger.tlog(`Targeting top servers (${topServers.length}): ${topServers.join(', ')}`);

    const successfulSpinUp: boolean = await spinUpServers(topServers.length);
    if (!successfulSpinUp) {
      logger.tlog("WARNING: Unable to get desired server amount. Have " + ns.getPurchasedServers().length.toString() + "/" + topServers.length.toString(), 1);
    } else {
      logger.tlog("We have enough servers! (" + ns.getPurchasedServers().length.toString() + ")", 1);
    }

    const filesToCopy: string[]    = [FACTORY_SCRIPT_NAME, WEAKEN_SCRIPT_NAME, GROW_SCRIPT_NAME, 
                                      HACK_SCRIPT_NAME, utils.getConfigName(), utils.getUtilsName()];
    const argsForFactory: string[] = [];

    // assume this is trying to fill up ALL purchased servers
    const kickoffFailures: Set<string> = await kickoffFactories(topServers, filesToCopy, argsForFactory);
    if (kickoffFailures.size > 0) {
      logger.tlog("WARNING: " + kickoffFailures.size.toString() + " factories failed to kickoff.", 1);
      logger.tlog(Array.from(kickoffFailures).join(", "), 2);
    } else {
      logger.tlog("All factories kicked off successfully!", 1);
    }

    return 0;
  }

  /**
   * Initializes the parasite scripts by rooting all possible servers, building the server database, and deploying the starter hack script to all hackable servers.
   * @returns {Promise<number>} - Returns 0 upon successful execution.
   */
  async function parasiteStarter(script: string) {
    // Recurse through and try to root all possible servers
    await utils.rootServers(ns);

    // Now let's build the JSON DB of all server information
    // (this is just in case it hasn't been done yet)
    await utils.buildServerDB(ns);

    // What are all the servers we can hack?
    const hackableServers: string[] = await utils.getHackableServers(ns);

    // scp and kickoff starter script
    for (const server of hackableServers) {
      if (server != "home") {
        const idealThreads: number = await utils.calculateMaxThreadsForScript(ns, script, server);
        if (idealThreads <= 0 ) {
          logger.log(`No available threads on ${server}, skipping..`);
          continue;
        }
        ns.killall(server);
        await utils.deleteAllFilesOnServer(ns, server);
        ns.scp(script, server);
        ns.exec(script, server, idealThreads, server);
      }
    }

    return 0;
  }

  /**
   * Attempts to gain access to the target server and deploys a script if successful.
   * @param {string} host - The hostname of the target server.
   * @returns {Promise<number>} - Returns 0 if successful, otherwise returns 2.
   */
  async function parasiteHome(host: string) {
    const target = await utils.getServerData(ns, host);
    if (!target) {
      logger.tlog(host + " is not found in serverDB!", 1);
      return 2;
    }
    logger.tlog(host + " found!", 1);

    if (!(await utils.rootServer(ns, target))) {
      logger.tlog("Server is not scriptable, aborting.", 1);
      return 2;
    }
    logger.tlog(host + " is scriptable!", 1);

    if (ns.exec(FACTORY_SCRIPT_NAME, "home", 1, host) == 0) {
        logger.tlog("ERROR -- Could not start " + FACTORY_SCRIPT_NAME + " on home", 3);
        return 2;
    }

    return 0;
  }

  /**
   * Targets the server with the maximum money and either runs parasiteHome or parasiteTarget based on the onHome flag.
   * @param {boolean} [onHome=false] - Flag to determine whether to run the parasiteHome function or parasiteTarget function.
   * @returns {Promise<number>} - Returns the result of parasiteHome or parasiteTarget function.
   */
  async function parasiteMoney(onHome: boolean = false) {
    const bigMoneyTarget: string = await utils.getTopServerWithMaxMoney(ns);
    if (onHome) {
      return await parasiteHome(bigMoneyTarget);
    } else {
      return await parasiteTarget(bigMoneyTarget);
    }
  }


  /**
   * Targets a specific server by rooting it, ensuring enough servers are available, and deploying factory scripts.
   * @param {string} host - The hostname of the target server.
   * @returns {Promise<number>} - Returns 0 if successful, otherwise returns 2.
   */
  async function parasiteTarget(host: string) {
    const target = await utils.getServerData(ns, host);
    if (!target) {
      logger.tlog(host + " is not found in serverDB!", 1);
      return 2;
    }
    logger.tlog(host + " found!", 1);

    if (!(await utils.rootServer(ns, target))) {
      logger.tlog("Server is not scriptable, aborting.", 1);
      return 2;
    }
    logger.tlog(host + " is scriptable!", 1);

    const desiredServerAmount: number = 1;

    if (!await spinUpServers(desiredServerAmount)) {
      logger.tlog("WARNING: Unable to get desired server amount. Have " + ns.getPurchasedServers().length.toString() + "/" + desiredServerAmount.toString(), 1);
    } else {
      logger.tlog("We have enough servers! (" + ns.getPurchasedServers().length.toString() + ")", 1);
    }

    const targetArray: string[]    = [target.hostname];
    const filesToCopy: string[]    = [FACTORY_SCRIPT_NAME, WEAKEN_SCRIPT_NAME, GROW_SCRIPT_NAME, 
                                      HACK_SCRIPT_NAME, await utils.getConfigName(), await utils.getUtilsName()];
    const argsForFactory: string[] = [];

    // assume this is trying to fill up ALL purchased servers
    const kickoffFailures: Set<string> = await kickoffFactories(targetArray, filesToCopy, argsForFactory);
    if (kickoffFailures.size > 0) {
      logger.tlog("WARNING: " + kickoffFailures.size.toString() + " factories failed to kickoff.", 1);
      logger.tlog(Array.from(kickoffFailures).join(", "), 2);
    } else {
      logger.tlog("All factories kicked off successfully!", 1);
    }

    return 0;
  }


  /**
   * Purchases and sets up the specified number of servers, ensuring the total does not exceed the server limit.
   * @param {number} serverAmount - The desired number of servers to spin up.
   * @returns {Promise<boolean>} - Returns true if the desired number of servers are successfully purchased and set up, otherwise returns false.
   */
  async function spinUpServers(serverAmount: number) {
    // Check if we have as many servers as can hack
    let purchasedServers = ns.getPurchasedServers().sort();
    const serverLimit = ns.getPurchasedServerLimit();
    const serverCeiling = serverAmount <= serverLimit ? serverAmount : serverLimit;

    const generatedServerNames: string[] = [];

    for (let i = 0; i < serverCeiling; i++) {
      const paddedNumber = String(i).padStart(2, '0');
      const newServerName = `${PURCHASED_SERVER_NAME}-${paddedNumber}`;
      generatedServerNames.push(newServerName);
    }

    logger.tlog("Owned servers: " + purchasedServers.length + "/" + serverCeiling.toString(), 1);

    logger.tlog("Checking servers..", 1);

    for (let a = 0; a < serverCeiling; a++) {
      requestServer(generatedServerNames[a], DEFAULT_PURCHASE_RAM);
    }

    return ns.getPurchasedServers().length >= serverAmount;
  }


  /**
   * Spins up factory scripts on purchased servers, copies necessary files, and executes the factory script with specified targets.
   * 
   * @param {NS} ns - The Netscript context.
   * @param {string[]} targets - The list of target hostnames for the factory script.
   * @param {string[]} filesToCopy - The list of files to copy to each server.
   * @param {string[]} argsForFactory - The arguments to pass to the factory script.
   * @param {boolean} [fillServers=true] - Whether to fill all purchased servers or only use the number of targets.
   * @returns {Promise<Set<string>>} - A set of servers where the factory script failed to start.
   */
  async function kickoffFactories(targets: string[], filesToCopy: string[], argsForFactory: string[], fillServers: boolean = false) {
    // Begin spinning up factories and copying over necessary files
    const purchasedServers    = ns.getPurchasedServers().sort();
    const numPurchasedServers = purchasedServers.length;
    const maxFactories        = targets.length > numPurchasedServers ? numPurchasedServers : targets.length;

    const failedFactories: Set<string> = new Set();
    
    const deploymentNum = fillServers ? numPurchasedServers : maxFactories;
    
    for (let b = 0; b < deploymentNum; b++) {
      logger.log("Copying over files: " + filesToCopy, 1);
      logger.log("to: " + purchasedServers[b], 2);
      const distribute: number = b % targets.length;

      // kill all scripts, remove all files, then SCP over
      ns.killall(purchasedServers[b]);
      //await utils.removeFilesFromServer(ns, filesToCopy, purchasedServers[b]);
      ns.scp(filesToCopy, purchasedServers[b], CURRENT_SERVER.hostname);
      if (ns.exec(FACTORY_SCRIPT_NAME, purchasedServers[b], 1, targets[distribute]) == 0) {
        logger.tlog("ERROR -- Could not start " + FACTORY_SCRIPT_NAME + " on " + purchasedServers[b], 3);
        failedFactories.add(purchasedServers[b]);
      }
      logger.tlog(`Factory on ${purchasedServers[b]} has been started targeting ${targets[distribute]}`);
      await ns.sleep(200);
    }

    return failedFactories;
  }

  /**
   * Requests and purchases a server with the specified name and RAM.
   * @param {string} name - The desired name for the server.
   * @param {number} ram - The amount of RAM for the server.
   * @returns {boolean} - True if the server was successfully purchased, false otherwise.
   */
  function requestServer(name: string, ram: number) {
    logger.log("Requesting server " + name + " with RAM " + ram.toString() + "...", 1);
    if (name == "") {
      logger.tlog("Server is undefined, cannot request", 2);
      return false
    }
    const purchasedServers = ns.getPurchasedServers();

    // check if we have enough money
    const currentMoney: number = ns.getServerMoneyAvailable("home");
    const purchaseCost: number = ns.getPurchasedServerCost(ram);
    if (currentMoney < purchaseCost) {
      logger.tlog(`Cannot afford ${name}. Cost: ${utils.formatDollar(purchaseCost)}`, 2);
      return false;
    }

    // check for already-purchased hostnames and upscale
    if (purchasedServers.includes(name)) { 
      if (ns.getServerMaxRam(name) < ram) {
        logger.tlog(name + " already exists with less RAM. Respawning", 2);
        ns.killall(name);
        ns.deleteServer(name);
        return ns.purchaseServer(name, ram) != "";
      } else {
        logger.log(`Already own ${name} with appropriate ram ${ram}, skipping`);
        return true;
      }
    }

    // check if we have enough server slots
    if ((ns.getPurchasedServerLimit() - purchasedServers.length) <= 0) {
      logger.tlog("Server limit size reached. Cannot request", 2);
      return false;
    }

    // otherwise, purchase it
    else {
      const newServerName: string = ns.purchaseServer(name, ram);
      logger.tlog("Purchasing server [" + newServerName + "] with RAM " + ram.toString() + " for $" + ns.formatNumber(purchaseCost), 2);
      return newServerName != "";
    }
  }

}

