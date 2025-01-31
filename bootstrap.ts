import * as utils from 'utils';

export async function main(ns: NS) {
  const logger = new utils.Logger(ns);


  if (ns.exec('generator.ts', 'home', 1) != 0) {
    logger.tlog(`[generator.ts] started successfully`);
  } else {
    logger.tlog(`[generator.ts] FAILED`);
  }

  if (ns.exec('parasite.ts', 'home', 1, ...['home']) != 0) {
    logger.tlog(`[parasite.ts home] started successfully`);
  } else {
    logger.tlog(`[parasite.ts home] FAILED`);
  }

  if (ns.exec('parasite.ts', 'home', 1, ...['share']) != 0) {
    logger.tlog(`[parasite.ts share] started successfully`);
  } else {
    logger.tlog(`[parasite.ts share] FAILED`);
  }

}