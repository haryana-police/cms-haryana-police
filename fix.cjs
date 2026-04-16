const fs = require('fs');
let data = fs.readFileSync('prisma/schema.prisma', 'utf-8');
const ix = data.indexOf('@@map("sho_alerts")');
if (ix !== -1) {
    const end = data.indexOf('}', ix) + 1;
    let clean = data.substring(0, end) + '\n\nmodel CrimePrediction {\n  id             String   @id @default(uuid())\n  district       String?\n  policeStation  String?\n  beatArea       String?\n  areaName       String?\n  predictedRisk  Float\n  confidence     Float\n  likelyTimeBand String?\n  reason         String\n  status         String   @default("ACTIVE")\n  createdAt      DateTime @default(now())\n  updatedAt      DateTime @updatedAt\n\n  @@map("crime_predictions")\n}\n';
    fs.writeFileSync('prisma/schema.prisma', clean);
}
