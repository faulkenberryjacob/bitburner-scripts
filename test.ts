import * as utils from 'utils';

export async function main(ns: NS) {
  const logger = new utils.Logger(ns);

  logger.tlog(`max ram: ${utils.determinePurchaseServerMaxRam(ns).toString()}`);
}