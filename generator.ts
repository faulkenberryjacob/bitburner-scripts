import * as utils from 'utils';

export async function main(ns: NS) {
  ns.disableLog("ALL");

  const config = await utils.loadConfig(ns);
  const dbFile: string = config.serverDBFileName;

  const logger = new utils.Logger(ns);
  const scriptName: string = ns.getScriptName();

  let servers: string[] = [];
  let serverCheck: string[] = [];

  // if the DB doesn't exist, build it first
  if (!ns.fileExists(dbFile)) {
    await utils.buildServerDB(ns);
  } 

  // grab all the hostnames of our DB servers that we have admin rights on to populate our ongoing 'tracker' of servers
  servers = (await utils.readDB(ns)).filter(server => server.hasAdminRights == true).map(server => server.hostname);

  try{
    while(true) {
      ns.print("Rooting servers..");
      await utils.rootServers(ns);

      ns.print("Building DB..");
      await utils.buildServerDB(ns);

      await ns.sleep(1000);

      // check for any new rooted servers
      serverCheck = (await utils.readDB(ns)).filter(server => server.hasAdminRights == true).map(server => server.hostname);
      const differences: string[] = serverCheck.filter(server => !servers.includes(server));
      for (const newServer of differences) {
        logger.tlog(`New server rooted: ${newServer}!`);
      }
      servers = serverCheck;
    }
  } catch (error) {
    logger.tlog(`ERROR -- ${scriptName} DIED --`);
  }
  logger.tlog(`ERROR -- ${scriptName} DIED --`)
}