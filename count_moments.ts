import fs from 'fs/promises';
import path from 'path';

async function main() {
  const files = await fs.readdir('./output');
  const momentFiles = files.filter(f => f.endsWith('_moments_tagged.json'));
  let totalMoments = 0;
  let eligibleMoments = 0;

  for (const f of momentFiles) {
    const data = JSON.parse(await fs.readFile(path.join('./output', f), 'utf-8'));
    totalMoments += data.length;
    eligibleMoments += data.filter((m: any) => m.insight_eligible).length;
  }

  console.log(`Total moments: ${totalMoments}`);
  console.log(`Eligible moments: ${eligibleMoments}`);
}

main().catch(console.error);
