import db from './db.js';
import { syncEmbeddings } from './syncEmbeddings.js';

const newCases = [
  {
    id: 'case-hotspot-001',
    fir_number: 'FIR-2026-HOT1',
    incident_date: '2026-04-12',
    incident_type: 'Theft',
    location: 'Sector 29 Market (Hotspot)',
    district: 'Gurugram',
    complainant_name: 'Rahul Dravid',
    accused_name: 'Unknown',
    victim_name: 'Rahul Dravid',
    contact_number: '9999911111',
    description: 'Vehicle theft at known crime hotspot. White Hyundai Creta bearings number HR-26-BQ-7788 was stolen from Sector 29 parking lot hotspot area at midnight.',
    status: 'investigating'
  },
  {
    id: 'case-hotspot-002',
    fir_number: 'FIR-2026-HOT2',
    incident_date: '2026-04-11',
    incident_type: 'Assault',
    location: 'MG Road Pub Area (Hotspot)',
    district: 'Gurugram',
    complainant_name: 'Arjun Singh',
    accused_name: 'Bouncer Group',
    victim_name: 'Arjun Singh',
    contact_number: '9888822222',
    description: 'Brawl at noted nightlife hotspot. Victim attacked outside a pub. Assailants fled in black Scorpio vehicle number HR-10-XY-9090.',
    status: 'pending'
  },
  {
    id: 'case-hotspot-003',
    fir_number: 'FIR-2026-HOT3',
    incident_date: '2026-04-10',
    incident_type: 'Snatching',
    location: 'Cyber Hub Walkway (Hotspot)',
    district: 'Gurugram',
    complainant_name: 'Priya Verma',
    accused_name: 'Bike Borne Youth',
    victim_name: 'Priya Verma',
    contact_number: '9777733333',
    description: 'Mobile snatching at pedestrian hotspot. Two youths on a motorcycle without registration plate snatched gold chain and iPhone. Motorcycle was a black Pulsar.',
    status: 'investigating'
  },
  {
    id: 'case-hotspot-004',
    fir_number: 'FIR-2026-HOT4',
    incident_date: '2026-04-09',
    incident_type: 'Traffic Accident',
    location: 'Hero Honda Chowk (Hotspot)',
    district: 'Gurugram',
    complainant_name: 'Traffic Police',
    accused_name: 'Truck Driver',
    victim_name: 'Cyclist',
    contact_number: '9666644444',
    description: 'Fatal accident at major accident hotspot. Speeding dumper HR-55-ZX-3214 hit a cyclist resulting in severe injuries.',
    status: 'investigating'
  },
  {
    id: 'case-hotspot-005',
    fir_number: 'FIR-2026-HOT5',
    incident_date: '2026-04-08',
    incident_type: 'Robbery',
    location: 'Kundli Border (Hotspot)',
    district: 'Sonipat',
    complainant_name: 'Rajesh Tyagi',
    accused_name: 'Masked Men',
    victim_name: 'Rajesh Tyagi',
    contact_number: '9555555555',
    description: 'Highway robbery hotspot incident. Armed robbers halted a logistics truck at Kundli border. Suspects escaped in a stolen Bolero camper HR-20-MB-1011.',
    status: 'investigating'
  }
];

const insertCase = db.prepare(`
  INSERT INTO cases (id, fir_number, incident_date, incident_type, location, district, complainant_name, accused_name, victim_name, contact_number, description, status)
  VALUES (@id, @fir_number, @incident_date, @incident_type, @location, @district, @complainant_name, @accused_name, @victim_name, @contact_number, @description, @status)
`);

const insertFts = db.prepare(`
  INSERT INTO cases_fts (fir_number, incident_type, location, complainant_name, accused_name, victim_name, description)
  VALUES (@fir_number, @incident_type, @location, @complainant_name, @accused_name, @victim_name, @description)
`);

async function main() {
  try {
    db.transaction((casesList) => {
      for (const c of casesList) {
        const existing = db.prepare('SELECT id FROM cases WHERE id = ?').get(c.id);
        if (!existing) {
          insertCase.run(c);
          insertFts.run({
            fir_number: c.fir_number,
            incident_type: c.incident_type,
            location: c.location,
            complainant_name: c.complainant_name,
            accused_name: c.accused_name,
            victim_name: c.victim_name,
            description: c.description
          });
          console.log(`Inserted case ${c.fir_number}`);
        } else {
           console.log(`Case ${c.fir_number} already exists.`);
        }
      }
    })(newCases);
    
    await syncEmbeddings();
    console.log('Custom data script completed.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
