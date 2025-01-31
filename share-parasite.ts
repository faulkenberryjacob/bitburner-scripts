import * as utils from 'utils';

/** @param {NS} ns */
export async function main(ns: NS) {
  const CURRENT_SERVER = ns.getServer().hostname;
  const logger = new utils.Logger(ns);

  const config = utils.loadConfig(ns);

  const SHARE_SCRIPT: string = config.shareScriptName;

  await share();


// ----------------------------------------------------------------------------------------------------------------------
// --- FUNCTION DEFINITIONS ---------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------------

  async function share() {
    // get list of scriptable servers
    const scriptableServers: string[] = await utils.getHackableServers(ns);
    let success: boolean = true;


    // iterate through and deploy scripts
    for (const server of scriptableServers) {
      const instance = await utils.deployScript(ns, SHARE_SCRIPT, server, CURRENT_SERVER);
      if (!instance) {
        success = false;
        logger.tlog("Failed to deploy " + SHARE_SCRIPT + " to " + server);
      }
    }

    return success;
  }
}