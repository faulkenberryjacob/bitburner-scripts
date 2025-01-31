export async function main(ns: NS) {
  const TARGET = ns.args[0].toString();
  const DELAY: number  = Number(ns.args[1]);

  if (DELAY) { await ns.sleep(DELAY); }

  const growAmount = await ns.grow(TARGET);
  ns.write("grow.txt", growAmount.toString(), "w");
}