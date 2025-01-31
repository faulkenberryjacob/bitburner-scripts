export async function main(ns: NS) {
  const TARGET: string = ns.args[0].toString();
  const DELAY: number  = Number(ns.args[1]);

  if (DELAY) { await ns.sleep(DELAY); }

  const weakenAmount = await ns.weaken(TARGET);
  ns.write("weaken.txt", weakenAmount.toString(), "w");
}