import prisma from './prisma.js';
import { runIntelligence } from './intelligence.js';

async function test() {
  try {
    const res = await runIntelligence();
    console.log("SUCCESS:", res);
  } catch (err) {
    console.error("ERROR:", err);
  }
}
test();
