/*
* PURPOSE:
*   To target a server remotely and efficiently guide the
*   weaken/grow/hack loop as quickly as possible.
*
* HOW:
*   The Orchestrator will be streaming server data and
*   intelligently starting/killing required scripts to 
*   maximize the amount of memory available on the host.
*/

import * as utils from 'utils';

export async function main(ns: NS) {
  const TARGET_HOSTNAME: string = ns.getServer(ns.args[0].toString()).hostname;
  const CURRENT_SERVER: string  = ns.getServer().hostname;

  const config = utils.loadConfig(ns);

  const HACK_SCRIPT   = config.hackScriptName;
  const GROW_SCRIPT   = config.growScriptName;
  const WEAKEN_SCRIPT = config.weakenScriptName;

  const MONEY_THRESHOLD    = config.defaultMoneyThreshold;
  const SECURITY_THRESHOLD = config.defaultSecurityThreshold;

  const logger = new utils.Logger(ns);

  ns.disableLog("ALL");

  logger.log(`--- FACTORY STARTUP targeting ${TARGET_HOSTNAME} ---`);
  logger.log(`---- HOSTED ON ${CURRENT_SERVER} ---- `)

  const maxMoney = ns.getServerMaxMoney(TARGET_HOSTNAME);
  const minSecurity = ns.getServerMinSecurityLevel(TARGET_HOSTNAME);

  // return if no money can be made
  if (maxMoney <= 0) { return; }
  while (true) {
    if (ns.getServerMoneyAvailable(TARGET_HOSTNAME) != maxMoney
        || minSecurity != ns.getServerSecurityLevel(TARGET_HOSTNAME)) {
      const isPrepped: boolean = await prepServer(TARGET_HOSTNAME);
      if (!isPrepped) {
        logger.log(`Could not find prep algorithm for ${TARGET_HOSTNAME}, aborting`);
        return;
      }
    } else {
      await hackServer(TARGET_HOSTNAME);
    }
  }

  /**
   * Prepares the target server by running grow and weaken scripts until the server's security is minimized and money is maximized.
   * @param {string} target - The target server to prepare.
   */
  async function prepServer(target: string) {
    let notPrepped: boolean = true;
    while (notPrepped) {

      // loop growing/weakening until we hit our desired threshold
      const plan = await utils.maxPrepAlgorithm(ns, target, CURRENT_SERVER);
      if (plan.length == 0 ) {
        logger.tlog(`ERROR (${CURRENT_SERVER}) -- no PREP algorithm found for ${TARGET_HOSTNAME}, aborting`);
        return false;
      }

      let sleepTime: number = 0;

      for (let i = 0; i < plan.length; i++) {
        if (plan[i].threads == 0){ continue; }
        const pid = ns.exec(plan[i].script, CURRENT_SERVER, plan[i].threads, ...plan[i].args)
        if (pid == 0) {
          logger.log(`ERROR: ns.exec(${plan[i].script}, ${CURRENT_SERVER}, ${plan[i].threads}, ${plan[i].args.join(', ')} failed)`);
          break;
        } else {
          const executeTime = plan[i].runTime + Number(plan[i].args[1]);
          const strExecuteTime = utils.formatTime(executeTime);

          sleepTime = executeTime > sleepTime ? executeTime : sleepTime;
          logger.log(`${plan[i].script} (${plan[i].threads}) with args ${plan[i].args} will execute in ${strExecuteTime}`, 1);
        }
      }

      // wait for scripts to finish
      const prepScripts: string[] = [GROW_SCRIPT, WEAKEN_SCRIPT];
      logger.log(`Waiting for ${prepScripts.join(', ')} to finish..`), 1;
      await utils.waitForScriptsToFinish(ns, await utils.getScriptPIDS(ns, CURRENT_SERVER, prepScripts));
      //await ns.sleep(sleepTime+100);

      const usedRamPercent = parseFloat((ns.getServerUsedRam(CURRENT_SERVER) / ns.getServerMaxRam(CURRENT_SERVER)).toFixed(2));
      logger.log(`Done waiting! Server is using ${usedRamPercent}% RAM`, 1);

      logger.log(`Security: ${ns.getServerSecurityLevel(target)}`);
      logger.log(`Money: ${utils.formatDollar(ns.getServerMoneyAvailable(target))}`);

      // once security is at a minimum and money is maxed out, break the cycle
      if (ns.getServerMoneyAvailable(TARGET_HOSTNAME) == maxMoney
          && ns.getServerMinSecurityLevel(TARGET_HOSTNAME) == ns.getServerSecurityLevel(TARGET_HOSTNAME)) 
      {
        notPrepped = false;
      }
    }
    return true;
  }

  /**
   * Executes a hacking algorithm on the target server, running grow, weaken, and hack scripts in a loop.
   * @param {string} target - The target server to hack.
   */
  async function hackServer(target: string) {
    let serverStartMoney     = await utils.formatDollar(ns.getServerMoneyAvailable(TARGET_HOSTNAME));
    let serverStartSecurity  = ns.formatNumber(ns.getServerSecurityLevel(TARGET_HOSTNAME));
    logger.log("Starting stats:");
    logger.log("Money: " + serverStartMoney, 1);
    logger.log("Security: " + serverStartSecurity, 1);

    let isHackable: boolean = true;

    logger.log("--- Initiating loop ---");

    while (isHackable) {
        // get the algorithm plan
      const plan: utils.HackAlgorithm[] = await utils.maxHackAlgorithm(ns, TARGET_HOSTNAME, CURRENT_SERVER);
      if (plan.length == 0) {
        logger.tlog(`ERROR (${CURRENT_SERVER}) -- no HACK algorithm found for ${TARGET_HOSTNAME}, returning to prep`);
        isHackable = false;
        break;
      }

      let serverMoney       = ns.getServerMoneyAvailable(TARGET_HOSTNAME);
      let serverSecurity    = ns.getServerSecurityLevel(TARGET_HOSTNAME);
      logger.log(`--- START ------------------------------`);
      logger.log(`Security: ${ns.getServerSecurityLevel(target)}`);
      logger.log(`Money: ${utils.formatDollar(ns.getServerMoneyAvailable(target))}`);

      let sleepTime: number = 0;
      
      for (let i = 0; i < plan.length; i++) {
        if (plan[i].threads == 0){ continue; }

        const now = Date.now();

        const pid = await ns.exec(plan[i].script, CURRENT_SERVER, plan[i].threads, ...plan[i].args);
        if (pid == 0) {
          logger.log(`ERROR: ns.exec(${plan[i].script}, ${CURRENT_SERVER}, ${plan[i].threads}, ${plan[i].args.join(', ')} failed)`);
          return;
        } else {
          const executeTime = plan[i].runTime + Number(plan[i].args[1]);
          const strExecuteTime = utils.formatTime(executeTime);

          sleepTime = executeTime > sleepTime ? executeTime : sleepTime;
          logger.log(`${plan[i].script} (${plan[i].threads}) with args ${plan[i].args} will execute in ${strExecuteTime}`, 1);
        }       
      }

      // wait for scripts to finish
      const hackScripts: string[] = [GROW_SCRIPT, WEAKEN_SCRIPT, HACK_SCRIPT];
      logger.log(`Waiting for ${hackScripts.join(', ')} to finish..`, 2);
      await utils.waitForScriptsToFinish(ns, await utils.getScriptPIDS(ns, CURRENT_SERVER, hackScripts));

      const usedRamPercent = parseFloat((ns.getServerUsedRam(CURRENT_SERVER) / ns.getServerMaxRam(CURRENT_SERVER)).toFixed(2));
      logger.log(`Done waiting! Server is using ${usedRamPercent}% RAM`, 1);

      // look at all the values dumped in hack.txt. they will be in the format "1,2,3,4,5"
      // we will chuck them in a number[] array then sum them up for the total amount hacked.
      const moneyText: string    = await ns.read("hack.txt");
      const moneyArray: number[] = moneyText.split(',').map(record => Number(record));
      const moneyStolen: number  = moneyArray.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

      logger.log(`/// Stole: ${utils.formatDollar(moneyStolen)} ///`);

      ns.rm("hack.txt", CURRENT_SERVER);

      // if we somehow fall back below our threshold, break and restart
      if (serverMoney < (maxMoney * MONEY_THRESHOLD)
          && serverSecurity > (minSecurity * SECURITY_THRESHOLD)) {
            isHackable = false;
      }

      serverMoney       = ns.getServerMoneyAvailable(TARGET_HOSTNAME);
      serverSecurity    = ns.getServerSecurityLevel(TARGET_HOSTNAME);
      logger.log(`Security: ${ns.getServerSecurityLevel(target)}`);
      logger.log(`Money: ${utils.formatDollar(ns.getServerMoneyAvailable(target))}`);
      logger.log(`---------------------------------`);
      logger.log("");
    }

    logger.log("No longer hackable, reverting to prep!");
  }

  
}