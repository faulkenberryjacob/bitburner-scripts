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

const MS_TO_S: number = 1000;
const MS_TO_M: number = 60000;
const POLL_RATE_S: number = 5;
const POLL_RATE_M: number = 10;

export async function main(ns: NS) {
  ns.disableLog("ALL");
  const logger = new utils.Logger(ns);

  // loading config
  const config = utils.loadConfig(ns);

  const WEAKEN_SCRIPT: string      = config.weakenLoopScriptName;
  const GROW_SCRIPT: string        = config.growLoopScriptName;
  const HACK_SCRIPT: string        = config.hackLoopScriptName;
  const MONEY_THRESHOLD: number    = Number(config.defaultMoneyThreshold);
  const SECURITY_THRESHOLD: number = Number(config.defaultSecurityThreshold);
  const CURRENT_SERVER: Server     = ns.getServer();

  // check for the most lucrative server to hack
  const db = await utils. readDB(ns);

  while(true) {
    const TARGET: string = await utils.getTopServerWithMaxMoney(ns);

    await factoryHack(TARGET);
  }

  // ------------------------------------------------------------------------------------------------------------
  // ------------------------------------------ FUNCTION DEFINITIONS --------------------------------------------
  // ------------------------------------------------------------------------------------------------------------

  async function factoryHack(target: string) {
    logger.tlog("--- FACTORY STARTUP targeting " + target + " ---");

    // Define static thresholds
    const moneyThresh = ns.getServerMaxMoney(target);
    if (moneyThresh <= 0) { return; }
    const acceptableMoney = moneyThresh * MONEY_THRESHOLD;

    const securityThresh = ns.getServerMinSecurityLevel(target);
    const acceptableSecurity = securityThresh * SECURITY_THRESHOLD;

    let runningScripts: Set<string> = new Set();
    let printCounter: number = -1;
    const factoryScripts: string[] = [WEAKEN_SCRIPT, GROW_SCRIPT, HACK_SCRIPT];

    const startTime = Date.now();

    // main loop, wait 10 minutes before exiting
    while (Date.now() - startTime < (POLL_RATE_M * MS_TO_M)) {

      const securityLevel: number  = ns.getServerSecurityLevel(target);
      const moneyAvailable: number = ns.getServerMoneyAvailable(target);

      const strMoneyAvailable: string  = await utils.formatDollar(moneyAvailable);
      const strMoneyThresh: string     = await utils.formatDollar(moneyThresh);
      const strAcceptableMoney: string = await utils.formatDollar(acceptableMoney);

      if (printCounter >= 20 || printCounter == -1) {
        logger.tlog("Security: " + securityLevel.toString() + "/" + securityThresh + ". Acceptable is " + ns.formatNumber(acceptableSecurity), 1);
        logger.tlog("Money: " + strMoneyAvailable + "/" + strMoneyThresh + ". Acceptable is " + strAcceptableMoney, 1);
        logger.tlog("\r\n", 1);
        printCounter = 0;
      }

      if (securityLevel > acceptableSecurity) {
        if (!runningScripts.has(WEAKEN_SCRIPT)){ 
          logger.tlog("Spawning " + WEAKEN_SCRIPT, 1);
          await utils.killScripts(ns, factoryScripts, CURRENT_SERVER.hostname);
          await utils.deployScript(ns, WEAKEN_SCRIPT, CURRENT_SERVER.hostname, CURRENT_SERVER.hostname, [target])

          runningScripts.clear();
          runningScripts.add(WEAKEN_SCRIPT);
        }
      } 
      else if (moneyAvailable < acceptableMoney) { 
        if (!runningScripts.has(GROW_SCRIPT)) { 
          logger.tlog("Spawning " + GROW_SCRIPT, 1);
          await utils.killScripts(ns, factoryScripts, CURRENT_SERVER.hostname);
          await utils.deployScript(ns, GROW_SCRIPT, CURRENT_SERVER.hostname, CURRENT_SERVER.hostname, [target])

          runningScripts.clear();
          runningScripts.add(GROW_SCRIPT);
        }
      } 
      else { 
        if (!runningScripts.has(HACK_SCRIPT)) { 
          logger.tlog("Spawning " + HACK_SCRIPT, 1);
          await utils.killScripts(ns, factoryScripts, CURRENT_SERVER.hostname);
          await utils.deployScript(ns, HACK_SCRIPT, CURRENT_SERVER.hostname, CURRENT_SERVER.hostname, [target])

          runningScripts.clear();
          runningScripts.add(HACK_SCRIPT);
        }
      }
      printCounter++;
      await ns.sleep(POLL_RATE_S * MS_TO_S);
    }

    await utils.killScripts(ns, factoryScripts, CURRENT_SERVER.hostname);
  }
}