import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Open database in the root folder
const db = new Database(join(__dirname, '../data.db'));

// â”€â”€â”€ Profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    full_name TEXT NOT NULL,
    badge_number TEXT,
    rank TEXT,
    station_id TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS firs (
    id TEXT PRIMARY KEY,
    fir_number TEXT UNIQUE NOT NULL,

    -- Section 1: Basic Details
    district TEXT NOT NULL,
    police_station TEXT NOT NULL,
    year INTEGER NOT NULL,
    date_time_of_fir TEXT NOT NULL,

    -- Section 2: Acts & Sections (JSON array)
    acts_sections TEXT NOT NULL DEFAULT '[]',

    -- Section 3: Occurrence of Offence
    occurrence_day TEXT,
    occurrence_date_from TEXT,
    occurrence_date_to TEXT,
    occurrence_time_period TEXT,
    occurrence_time_from TEXT,
    occurrence_time_to TEXT,
    info_received_date TEXT,
    info_received_time TEXT,
    gd_entry_no TEXT,
    gd_date_time TEXT,

    -- Section 4: Type of Information
    info_type TEXT DEFAULT 'Written',

    -- Section 5: Place of Occurrence
    place_direction TEXT,
    place_distance TEXT,
    beat_no TEXT,
    place_address TEXT,
    latitude REAL,
    longitude REAL,
    outside_ps_name TEXT,
    outside_district TEXT,

    -- Section 6: Complainant Details
    complainant_name TEXT NOT NULL,
    complainant_father_name TEXT,
    complainant_dob TEXT,
    complainant_nationality TEXT DEFAULT 'INDIA',
    complainant_uid TEXT,
    complainant_passport TEXT,
    complainant_id_details TEXT DEFAULT '[]',
    complainant_occupation TEXT,
    complainant_present_address TEXT,
    complainant_permanent_address TEXT,
    complainant_phone TEXT,

    -- Section 7: Accused Details (JSON array)
    accused_details TEXT NOT NULL DEFAULT '[]',

    -- Section 8: Delay Reason
    delay_reason TEXT,

    -- Section 9 & 10: Property Details (JSON array) & Total Value
    property_details TEXT NOT NULL DEFAULT '[]',
    total_property_value REAL DEFAULT 0,

    -- Section 12: FIR Narrative Content
    fir_content TEXT NOT NULL,

    -- Section 13: Action Taken
    io_name TEXT,
    io_rank TEXT,
    io_no TEXT,
    refused_reason TEXT,
    transferred_ps TEXT,
    transferred_district TEXT,

    -- Section 14: Officer in Charge
    officer_name TEXT,
    officer_rank TEXT,
    officer_no TEXT,

    -- Section 15: Dispatch
    dispatch_date_time TEXT,

    -- Meta
    status TEXT DEFAULT 'registered',
    registered_by TEXT NOT NULL,
    complaint_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cdr_requests (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT DEFAULT 'requested',
    tsp_name TEXT,
    requested_by TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fir_id) REFERENCES firs(id)
  );

  CREATE TABLE IF NOT EXISTS arrests (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL,
    accused_name TEXT NOT NULL,
    date_of_arrest TEXT NOT NULL,
    arrest_memo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fir_id) REFERENCES firs(id)
  );

  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL,
    notice_type TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fir_id) REFERENCES firs(id)
  );

  CREATE TABLE IF NOT EXISTS evidences (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT,
    extra_details TEXT,
    seizure_memo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fir_id) REFERENCES firs(id)
  );

  CREATE TABLE IF NOT EXISTS challans (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL,
    io_notes TEXT,
    final_report TEXT,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fir_id) REFERENCES firs(id)
  );

  CREATE TABLE IF NOT EXISTS case_diaries (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL,
    entry_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fir_id) REFERENCES firs(id)
  );
`);

// â”€â”€â”€ Analysis Module Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    case_type TEXT NOT NULL CHECK(case_type IN ('complaint','fir')),
    status TEXT DEFAULT 'open',
    offense_section TEXT,
    station_id TEXT,
    io_id TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    FOREIGN KEY (io_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS case_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    event_time DATETIME NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    officer_id TEXT,
    location TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id),
    FOREIGN KEY (officer_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS case_persons (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('accused','victim','witness')),
    phone TEXT,
    address TEXT,
    age INTEGER,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS case_documents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    case_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    content_text TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS cdr_records (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    caller TEXT NOT NULL,
    receiver TEXT NOT NULL,
    duration_sec INTEGER,
    call_time DATETIME NOT NULL,
    tower_id TEXT,
    tower_location TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS case_wiki_pages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    case_id TEXT NOT NULL,
    page_slug TEXT NOT NULL,
    content_md TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, page_slug),
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );
`);

// â”€â”€â”€ New AI Analysis Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
db.exec(`
  CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    date TEXT,
    description TEXT,
    debit REAL,
    credit REAL,
    balance REAL,
    ref_no TEXT,
    account_no TEXT,
    is_suspicious INTEGER DEFAULT 0,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS ip_records (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER,
    protocol TEXT,
    timestamp DATETIME,
    duration_sec INTEGER,
    data_bytes INTEGER,
    location TEXT,
    isp TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS case_leads (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    confidence REAL DEFAULT 0.7,
    category TEXT DEFAULT 'other',
    sources TEXT,
    action TEXT,
    legal_basis TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS case_contradictions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT DEFAULT 'moderate',
    category TEXT DEFAULT 'other',
    description TEXT,
    document_a TEXT,
    document_b TEXT,
    significance TEXT,
    recommended_action TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );
`);

// â”€â”€â”€ Auto-migrate tables for new columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
try {
  const tableInfo = db.pragma('table_info(firs)');
  const hasLatitude = tableInfo.some(col => col.name === 'latitude');
  if (!hasLatitude) {
    db.exec(`ALTER TABLE firs ADD COLUMN latitude REAL; ALTER TABLE firs ADD COLUMN longitude REAL;`);
    console.log('Added latitude and longitude columns to firs table.');
  }
  const hasComplaintId = tableInfo.some(col => col.name === 'complaint_id');
  if (!hasComplaintId) {
    db.exec(`ALTER TABLE firs ADD COLUMN complaint_id TEXT;`);
    console.log('Added complaint_id column to firs table.');
  }
  const evidenceTableInfo = db.pragma('table_info(evidences)');
  const hasMediaFile = evidenceTableInfo.some(col => col.name === 'media_file');
  if (!hasMediaFile) {
    db.exec(`ALTER TABLE evidences ADD COLUMN media_file TEXT;`);
    console.log('Added media_file column to evidences table.');
  }
  const arrestTableInfo = db.pragma('table_info(arrests)');
  const existingArrestCols = arrestTableInfo.map(col => col.name);
  const newArrestCols = [
    ['arresting_officer_name', 'TEXT'], ['arresting_officer_rank', 'TEXT'],
    ['arresting_officer_badge', 'TEXT'], ['arresting_officer_post', 'TEXT'],
    ['accused_address', 'TEXT'], ['arrest_place', 'TEXT'],
    ['informed_person_name', 'TEXT'], ['informed_person_address', 'TEXT'],
    ['informed_person_phone', 'TEXT'], ['witness_name', 'TEXT'], ['witness_post', 'TEXT'],
  ];
  for (const [col, type] of newArrestCols) {
    if (!existingArrestCols.includes(col)) {
      db.exec(`ALTER TABLE arrests ADD COLUMN ${col} ${type};`);
      console.log(`Added ${col} column to arrests table.`);
    }
  }
} catch (err) {
  console.log('Migration note:', err.message);
}

// â”€â”€â”€ Seed profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const profileCount = db.prepare('SELECT COUNT(*) as c FROM profiles').get().c;
if (profileCount === 0) {
  const insertProfile = db.prepare(`
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    case_type TEXT NOT NULL CHECK(case_type IN ('complaint','fir')),
    status TEXT DEFAULT 'open',
    offense_section TEXT,
    station_id TEXT,
    io_id TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    FOREIGN KEY (io_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS case_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    event_time DATETIME NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    officer_id TEXT,
    location TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id),
    FOREIGN KEY (officer_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS case_persons (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('accused','victim','witness')),
    phone TEXT,
    address TEXT,
    age INTEGER,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS case_documents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    case_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    content_text TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS cdr_records (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    caller TEXT NOT NULL,
    receiver TEXT NOT NULL,
    duration_sec INTEGER,
    call_time DATETIME NOT NULL,
    tower_id TEXT,
    tower_location TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS case_wiki_pages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    case_id TEXT NOT NULL,
    page_slug TEXT NOT NULL,
    content_md TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, page_slug),
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );
`);

// â”€â”€â”€ New AI Analysis Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
db.exec(`
  CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    date TEXT,
    description TEXT,
    debit REAL,
    credit REAL,
    balance REAL,
    ref_no TEXT,
    account_no TEXT,
    is_suspicious INTEGER DEFAULT 0,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS ip_records (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER,
    protocol TEXT,
    timestamp DATETIME,
    duration_sec INTEGER,
    data_bytes INTEGER,
    location TEXT,
    isp TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS case_leads (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    confidence REAL DEFAULT 0.7,
    category TEXT DEFAULT 'other  );
`);

// â”€â”€â”€ Seed profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const profileCount = db.prepare('SELECT COUNT(*) as c FROM profiles').get().c;
if (profileCount === 0) {
  const insertProfile = db.prepare(`
    INSERT INTO profiles (id, username, password, role, full_name, badge_number, rank, station_id)
    VALUES (@id, @username, @password, @role, @full_name, @badge_number, @rank, @station_id)
  `);
  const seedProfiles = [
    { id: 'usr-1', username: 'admin', password: 'admin123', role: 'admin', full_name: 'Test Admin', badge_number: 'ADM-001', rank: 'SP', station_id: 'hq' },
    { id: 'usr-2', username: 'io_1', password: 'io123', role: 'io', full_name: 'Investigating Officer Singh', badge_number: 'IO-101', rank: 'SI', station_id: 'stn-1' },
    { id: 'usr-3', username: 'sho_1', password: 'sho123', role: 'sho', full_name: 'SHO Kumar', badge_number: 'SHO-201', rank: 'Inspector', station_id: 'stn-1' },
  ];
  db.transaction((rows) => rows.forEach(r => insertProfile.run(r)))(seedProfiles);
  console.log('âœ… Seed profiles created.');full_name, badge_number, rank, station_id)
    VALUES (@id, @username, @password, @role, @full_name, @badge_number, @rank, @station_id)
  `);
  const seedProfiles = [
    { id: 'usr-1', username: 'admin', password: 'admin123', role: 'admin', full_name: 'Test Admin', badge_number: 'ADM-001', rank: 'SP', station_id: 'hq' },
    { id: 'usr-2', username: 'io_1', password: 'io123', role: 'io', full_name: 'Investigating Officer Singh', badge_number: 'IO-101', rank: 'SI', station_id: 'stn-1' },
    { id: 'usr-3', username: 'sho_1', password: 'sho123', role: 'sho', full_name: 'SHO Kumar', badge_number: 'SHO-201', rank: 'Inspector', station_id: 'stn-1' },
  ];
  db.transaction((rows) => rows.forEach(r => insertProfile.run(r)))(seedProfiles);
  console.log('âœ… Seed profiles created.');
}

// â”€â”€â”€ Seed analysis data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const caseCount = db.prepare('SELECT COUNT(*) as c FROM cases').get().c;
if (caseCount === 0) {
  // Insert cases
  db.prepare(`INSERT INTO cases (id, title, case_type, status, offense_section, station_id, io_id, registered_at, description)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'case-001', 'Mobile Theft â€“ Sector 14 Market', 'complaint', 'open',
    'BNS 303', 'stn-1', 'usr-2', '2026-04-01 10:30:00',
    'Complainant Ramesh Kumar reports theft of iPhone 14 from busy market area. Suspects fled on motorcycle.'
  );
  db.prepare(`INSERT INTO cases (id, title, case_type, status, offense_section, station_id, io_id, registered_at, description)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'case-002', 'FIR â€“ Cyber Fraud â‚¹2.5 Lakh', 'fir', 'investigation',
    'BNS 318, IT Act 66C', 'stn-1', 'usr-2', '2026-03-20 14:00:00',
    'Victim Priya Sharma transferred â‚¹2.5 lakh after receiving fraudulent call from "bank official". Multiple accused involved.'
  );
  db.prepare(`INSERT INTO cases (id, title, case_type, status, offense_section, station_id, io_id, registered_at, description)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'case-003', 'FIR â€“ Drug Peddling (NDPS)', 'fir', 'challan',
    'NDPS Act 20(b)(ii)', 'stn-1', 'usr-3', '2026-02-10 09:15:00',
    'Accused Vikram Yadav and Suresh Nain apprehended with 500g of cannabis near bus stand.'
  );

  // Events for case-001
  const evts = [
    ['evt-001', 'case-001', '2026-04-01 10:30:00', 'registration', 'Complaint registered by Ramesh Kumar', 'usr-2', 'Police Station Sector 14'],
    ['evt-002', 'case-001', '2026-04-02 11:00:00', 'statement', 'Statement recorded from complainant', 'usr-2', 'PS Sector 14'],
    ['evt-003', 'case-001', '2026-04-03 14:30:00', 'evidence', 'CCTV footage retrieved from market', 'usr-2', 'Market CCTV Control Room'],
    ['evt-004', 'case-001', '2026-04-05 09:00:00', 'statement', 'Witness statement from shopkeeper', 'usr-2', 'PS Sector 14'],
    ['evt-005', 'case-001', '2026-04-07 16:00:00', 'raid', 'Raid conducted on suspected hideout', 'usr-2', 'Sector 18'],
  ];
  // Events for case-002
  const evts2 = [
    ['evt-101', 'case-002', '2026-03-20 14:00:00', 'registration', 'FIR registered. Victim Priya Sharma reported cyber fraud', 'usr-2', 'PS Sector 14'],
    ['evt-102', 'case-002', '2026-03-21 10:00:00', 'statement', 'Victim statement recorded. Call from 9876543210 identified as fraud number', 'usr-2', 'PS Sector 14'],
    ['evt-103', 'case-002', '2026-03-22 12:00:00', 'evidence', 'Bank transaction records obtained showing â‚¹2.5L transfer', 'usr-2', 'Online'],
    ['evt-104', 'case-002', '2026-03-25 15:00:00', 'arrest', 'Accused Deepak Sharma arrested from Gurugram. Deepak Sharma confessed to operating fraud network', 'usr-2', 'Gurugram'],
    ['evt-105', 'case-002', '2026-03-28 09:00:00', 'evidence', 'Seized mobile phones sent for forensic examination', 'usr-2', 'Forensic Lab'],
    ['evt-106', 'case-002', '2026-04-01 11:00:00', 'statement', 'Statement of co-accused Rahul Verma recorded', 'usr-2', 'PS Sector 14'],
    ['evt-107', 'case-002', '2026-04-10 14:00:00', 'evidence', 'Forensic report received. SIM cards traced to fraudsters', 'usr-2', 'PS Sector 14'],
  ];
  // Events for case-003
  const evts3 = [
    ['evt-201', 'case-003', '2026-02-10 09:15:00', 'arrest', 'Vikram Yadav and Suresh Nain arrested near bus stand', 'usr-3', 'Bus Stand Sector 17'],
    ['evt-202', 'case-003', '2026-02-10 10:00:00', 'evidence', 'Seizure memo prepared. 500g cannabis, 2 mobile phones seized', 'usr-3', 'Bus Stand Sector 17'],
    ['evt-203', 'case-003', '2026-02-11 09:00:00', 'statement', 'Arrest memo prepared and signed. Accused sent to judicial custody', 'usr-3', 'PS Sector 14'],
    ['evt-204', 'case-003', '2026-02-15 11:00:00', 'evidence', 'FSL report received confirming cannabis', 'usr-3', 'FSL Office'],
    ['evt-205', 'case-003', '2026-03-01 10:00:00', 'challan', 'Challan submitted to court', 'usr-3', 'District Court'],
  ];

  const insertEvt = db.prepare(
    'INSERT INTO case_events (id, case_id, event_time, category, description, officer_id, location) VALUES (?,?,?,?,?,?,?)'
  );
  db.transaction((rows) => rows.forEach(r => insertEvt.run(...r)))([...evts, ...evts2, ...evts3]);

  // Persons
  const persons = [
    ['per-001', 'case-001', 'Ramesh Kumar', 'victim', '9812345678', 'House No. 45, Sector 14', 35],
    ['per-002', 'case-001', 'Unknown Accused A', 'accused', null, 'Unknown', null],
    ['per-003', 'case-001', 'Mukesh (Shopkeeper)', 'witness', '9988776655', 'Shop No. 12, Market', 42],
    ['per-101', 'case-002', 'Priya Sharma', 'victim', '9876501234', 'House 7, Sector 22', 28],
    ['per-102', 'case-002', 'Deepak Sharma', 'accused', '9876543210', 'Gurugram', 30],
    ['per-103', 'case-002', 'Rahul Verma', 'accused', '9123456789', 'Delhi', 27],
    ['per-104', 'case-002', 'Bank Manager Mohan', 'witness', '9812000001', 'SBI Branch', 45],
    ['per-201', 'case-003', 'Vikram Yadav', 'accused', '9090909090', 'Village Raipur', 24],
    ['per-202', 'case-003', 'Suresh Nain', 'accused', '9191919191', 'Village Moginand', 22],
  ];
  const insertPer = db.prepare(
    'INSERT INTO case_persons (id, case_id, name, role, phone, address, age) VALUES (?,?,?,?,?,?,?)'
  );
  db.transaction((rows) => rows.forEach(r => insertPer.run(...r)))(persons);

  // CDR records for case-002 (cyber fraud)
  const cdrs = [
    ['cdr-001', 'case-002', '9876543210', '9876501234', 420, '2026-03-19 10:15:00', 'TWR-GGN-01', 'Gurugram Sector 5'],
    ['cdr-002', 'case-002', '9876543210', '9876501234', 185, '2026-03-19 10:22:00', 'TWR-GGN-01', 'Gurugram Sector 5'],
    ['cdr-003', 'case-002', '9123456789', '9876501234', 317, '2026-03-19 10:30:00', 'TWR-DEL-12', 'Delhi Rohini'],
    ['cdr-004', 'case-002', '9876543210', '9000000001', 95, '2026-03-19 11:00:00', 'TWR-GGN-02', 'Gurugram Sector 9'],
    ['cdr-005', 'case-002', '9123456789', '9876543210', 220, '2026-03-19 11:15:00', 'TWR-DEL-12', 'Delhi Rohini'],
    ['cdr-006', 'case-002', '9876543210', '9876501234', 540, '2026-03-20 09:05:00', 'TWR-GGN-01', 'Gurugram Sector 5'],
    ['cdr-007', 'case-002', '9876543210', '9000000002', 110, '2026-03-20 09:30:00', 'TWR-GGN-01', 'Gurugram Sector 5'],
    ['cdr-008', 'case-002', '9123456789', '9876501234', 450, '2026-03-20 13:45:00', 'TWR-DEL-12', 'Delhi Rohini'],
    ['cdr-009', 'case-002', '9876543210', '9123456789', 300, '2026-03-20 14:30:00', 'TWR-GGN-02', 'Gurugram Sector 9'],
    ['cdr-010', 'case-002', '9000000001', '9876543210', 180, '2026-03-21 10:00:00', 'TWR-GGN-03', 'Gurugram DLF'],
  ];
  const insertCdr = db.prepare(
    'INSERT INTO cdr_records (id, case_id, caller, receiver, duration_sec, call_time, tower_id, tower_location) VALUES (?,?,?,?,?,?,?,?)'
  );
  db.transaction((rows) => rows.forEach(r => insertCdr.run(...r)))(cdrs);

  // Seed wiki pages for case-002
  db.prepare('INSERT INTO case_wiki_pages (case_id, page_slug, content_md, updated_at) VALUES (?,?,?,?)').run(
    'case-002', 'index',
    `# Wiki Index â€“ Cyber Fraud Case (FIR)

| Page | Summary |
|---|---|
| [entities](entities) | Persons, phones, accounts involved |
| [timeline](timeline) | Chronological events of the fraud |
| [leads](leads) | Active investigative leads |
| [contradictions](contradictions) | Flagged inconsistencies |
| [log](log) | Operation log |
`,
    '2026-03-28T10:00:00Z'
  );
  db.prepare('INSERT INTO case_wiki_pages (case_id, page_slug, content_md, updated_at) VALUES (?,?,?,?)').run(
    'case-002', 'entities',
    `# Entities â€“ Cyber Fraud Case

## Persons
- **Priya Sharma** (Victim) â€“ Phone: 9876501234, Sector 22
- **Deepak Sharma** (Accused) â€“ Phone: 9876543210, Gurugram â€“ *Primary fraudster, arrested*
- **Rahul Verma** (Accused) â€“ Phone: 9123456789, Delhi â€“ *Co-conspirator, in custody*
- **Bank Manager Mohan** (Witness) â€“ SBI Branch â€“ *Confirmed no legitimate call was made*

## Phone Numbers (from CDR)
- 9876543210 â€“ Deepak Sharma (Accused) â€“ *Called victim 3 times on day of fraud*
- 9123456789 â€“ Rahul Verma (Accused) â€“ *Coordinated with Deepak before and after fraud*
- 9000000001 â€“ Unknown â€“ *Received call from accused post-fraud, identity pending*
- 9000000002 â€“ Unknown â€“ *Identity pending; possible money mule*

## Bank Accounts
- Victim account ending **4521** â€“ â‚¹2.5L debited on 2026-03-20
- Mule account in Gurugram bank (details in forensic report)
`,
    '2026-04-01T10:00:00Z'
  );
  db.prepare('INSERT INTO case_wiki_pages (case_id, page_slug, content_md, updated_at) VALUES (?,?,?,?)').run(
    'case-002', 'leads',
    `# Investigative Leads

## Active
- [ ] Identify phone number 9000000001 (likely money mule) â€“ request CDR from TSP
- [ ] Identify phone number 9000000002 â€“ request CDR
- [ ] Trace mule bank account to its registered phone & address
- [ ] Check if Deepak Sharma has prior complaints in other stations
- [ ] Digital forensics on Deepak's mobile: WhatsApp, call records

## Completed
- [x] CDR obtained from TSP for 9876543210 and 9123456789
- [x] Victim's bank statement obtained
- [x] Arrest of Deepak Sharma
- [x] Statement of Rahul Verma recorded
`,
    '2026-04-05T09:00:00Z'
  );
  db.prepare('INSERT INTO case_wiki_pages (case_id, page_slug, content_md, updated_at) VALUES (?,?,?,?)').run(
    'case-002', 'contradictions',
    `# Contradictions & Inconsistencies

## Flagged
- âš ï¸ **Rahul Verma's Statement vs. CDR**: Rahul states he did not contact the victim, but CDR shows his number (9123456789) called victim's number on 2026-03-19 at 10:30 (317 sec). *Follow up required.*
- âš ï¸ **Location of Deepak at time of fraud**: Deepak claims he was in Delhi on 2026-03-20, but CDR tower data shows his phone was active on TWR-GGN-01 (Gurugram) during the fraud call.
`,
    '2026-04-06T09:00:00Z'
  );
  db.prepare('INSERT INTO case_wiki_pages (case_id, page_slug, content_md, updated_at) VALUES (?,?,?,?)').run(
    'case-002', 'log',
    `# Case Log

## [2026-03-22] ingest | Victim Statement | 2 entities, 2 events extracted
## [2026-03-25] ingest | Arrest Memo â€“ Deepak Sharma | 1 entity, 1 event extracted
## [2026-03-28] ingest | CDR Analysis | 4 phone numbers, 10 call records loaded
## [2026-04-01] query | "Who are the key suspects?" | pages consulted: entities
## [2026-04-06] lint | Health check | 0 missing pages, 2 active contradictions flagged
`,
    '2026-04-06T10:00:00Z'
  );

  console.log('âœ… Analysis seed data created.');
}

// â”€â”€â”€ Seed bank transactions & AI analysis data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const bankCount = db.prepare('SELECT COUNT(*) as c FROM bank_transactions').get().c;
if (bankCount === 0) {
  const insertTxn = db.prepare(`
    INSERT INTO bank_transactions (id, case_id, date, description, debit, credit, balance, ref_no, account_no, is_suspicious)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transactions = [
    // Victim Priya Sharma â€” A/C ending 4521 (SBI, Sector 22 branch)
    ['btxn-001','case-002','2026-03-15','Salary credit â€” HDFC Payroll',null,48000,210000,'SAL-31550421','xxxx4521',0],
    ['btxn-002','case-002','2026-03-16','Amazon Online Purchase',1299,null,208701,'UPI/AMZ-7891','xxxx4521',0],
    ['btxn-003','case-002','2026-03-17','ATM Withdrawal â€” Sector 22',5000,null,203701,'ATM-SEC22','xxxx4521',0],
    ['btxn-004','case-002','2026-03-18','Electricity Bill â€” DHBVN',2143,null,201558,'NACH-DHBVN','xxxx4521',0],
    ['btxn-005','case-002','2026-03-20','IMPS Transfer â€” fraudulent â€” "bank KYC verification"',50000,null,151558,'IMPS-9876543210','xxxx4521',1],
    ['btxn-006','case-002','2026-03-20','NEFT Transfer â€” "Account verification fee"',100000,null,51558,'NEFT-GGN-MULE1','xxxx4521',1],
    ['btxn-007','case-002','2026-03-20','UPI Transfer â€” "Refund processing"',100000,null,-48442,'UPI-9000000001','xxxx4521',1],
    ['btxn-008','case-002','2026-03-21','Overdraft triggered',null,null,-48442,'OD-AUTO','xxxx4521',0],
    ['btxn-009','case-002','2026-03-22','Reverse charge attempt â€” FAILED',null,null,-48442,'REV-FAIL-001','xxxx4521',0],
    ['btxn-010','case-002','2026-03-25','Police freeze order applied',null,null,-48442,'FREEZE-PS14','xxxx4521',0],
    // Mule account â€” Deepak Sharma (Axis Bank GGN)
    ['btxn-011','case-002','2026-03-20','IMPS Received from victim xxxx4521',50000,null,62300,'IMPS-9876501234','yyyy8832',1],
    ['btxn-012','case-002','2026-03-20','NEFT Received from victim',100000,null,162300,'NEFT-SBI-SEC22','yyyy8832',1],
    ['btxn-013','case-002','2026-03-20','ATM cash withdrawal â€” DLF ATM',49000,null,113300,'ATM-DLF-GGN','yyyy8832',1],
    ['btxn-014','case-002','2026-03-20','NEFT Out â€” unknown beneficiary',90000,null,23300,'NEFT-OUT-CHAIN','yyyy8832',1],
    ['btxn-015','case-002','2026-03-20','UPI Received â€” third transfer',100000,null,123300,'UPI-RCV-9876501234','yyyy8832',1],
    ['btxn-016','case-002','2026-03-21','ATM withdrawal Rohini Delhi',49000,null,74300,'ATM-ROHINI','yyyy8832',1],
    ['btxn-017','case-002','2026-03-21','NEFT Out â€” second chain transfer',60000,null,14300,'NEFT-CHAIN-2','yyyy8832',1],
    ['btxn-018','case-002','2026-03-22','Account frozen â€” bank compliance',null,null,14300,'FREEZE-BANK','yyyy8832',0],
  ];

  db.transaction(rows => rows.forEach(r => insertTxn.run(...r)))(transactions);

  // Seed IP/IPDR records (case-002 cyber fraud)
  const insertIP = db.prepare(`
    INSERT INTO ip_records (id, case_id, ip_address, port, protocol, timestamp, duration_sec, data_bytes, location, isp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ipRecords = [
    ['ip-001','case-002','223.178.192.45',443,'HTTPS','2026-03-19T10:10:00',1200,45231,'Gurugram, Haryana','Airtel'],
    ['ip-002','case-002','103.21.58.12',80,'HTTP','2026-03-19T10:12:00',340,12480,'Delhi, Rohini','Jio'],
    ['ip-003','case-002','223.178.192.45',443,'HTTPS','2026-03-20T09:00:00',2100,98120,'Gurugram, Haryana','Airtel'],
    ['ip-004','case-002','182.71.210.33',443,'HTTPS','2026-03-20T09:05:00',85,2100,'Mumbai, Maharashtra','BSNL'],
    ['ip-005','case-002','103.21.58.12',443,'HTTPS','2026-03-20T13:40:00',1800,76230,'Delhi, Rohini','Jio'],
    ['ip-006','case-002','45.152.66.12',1080,'SOCKS5','2026-03-20T09:01:00',2400,12000,'Frankfurt, Germany','Hetzner'],
    ['ip-007','case-002','10.192.168.1',0,'INTERNAL','2026-03-20T14:30:00',0,0,'Gurugram (Local)','â€”'],
  ];
  db.transaction(rows => rows.forEach(r => insertIP.run(...r)))(ipRecords);

  // Seed AI Leads (case-002)
  const insertLead = db.prepare(`
    INSERT INTO case_leads (id, case_id, title, description, priority, confidence, category, sources, action, legal_basis, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const leads = [
    ['lead-001','case-002','Identify Unknown Number 9000000001','CDR analysis shows number 9000000001 received calls from accused Deepak Sharma immediately after the fraud. This is likely a money mule coordinator.',
     'high',0.92,'telecom','["CDR Records", "Case entities wiki"]','Request CDR/IPDR from TSP for number 9000000001. Cross-reference with bank beneficiary list.','CrPC Section 91, TRAI Guidelines','active'],
    ['lead-002','case-002','Trace Complete Money Trail â€” â‚¹2.5 Lakh','Bank analysis shows â‚¹2.5L left victim account in 3 tranches within 2 hours. Mule account (yyyy8832) received funds and immediately withdrew â‚¹49K cash + NEFT to another account. Chain not fully traced.',
     'high',0.96,'financial','["Bank Statement", "Case diary"]','Obtain complete bank statement of yyyy8832 account. Trace NEFT-CHAIN-2 beneficiary. Request RBI freeze on all connected accounts.','CrPC Section 91, PMLA Section 17','active'],
    ['lead-003','case-002','IP Address 45.152.66.12 Routes Through VPN (Germany)','IPDR analysis reveals accused used a SOCKS5 proxy based in Frankfurt during the fraud window. Indicates planning and technical sophistication.',
     'high',0.88,'digital','["IPDR Report", "Forensic report"]','Submit MLAT request for IP records. Check if VPN provider has Indian LE cooperation agreement. Cross-reference with dark web activity.','IPC Section 66(B) IT Act','active'],
    ['lead-004','case-002','Rahul Verma Location Alibi Contradiction','Rahul Verma claims he was NOT in contact with the victim. CDR shows his number 9123456789 called 9876501234 (victim) at 10:30 on 2026-03-19 for 317 seconds. Location tower: Delhi Rohini.',
     'high',0.95,'witness','["CDR Records", "Statement of Rahul Verma"]','Confront Rahul Verma with CDR data. Record supplementary statement. Apply for narco analysis if required.','CrPC Section 161, 164','active'],
    ['lead-005','case-002','Check Prior Fraud Cases in Delhi/NCR','Fraud pattern â€” fake bank call, immediate fund transfer, mule account â€” is characteristic of organized cybercrime gangs operating from Mewat/Delhi NCR.',
     'medium',0.78,'other','["Case profile", "entities"]','Run CCTNS search for Deepak Sharma in all states. Contact Gurugram Cyber Cell for gang-level intelligence.','CrPC Section 54','active'],
    ['lead-006','case-002','Forensic Extraction of WhatsApp from Seized Phones','Seized mobiles from Deepak Sharma sent to forensic lab. WhatsApp communications likely contain coordination with co-conspirators and instructions for mule account operation.',
     'medium',0.83,'digital','["Seizure memo", "Forensic report"]','Follow up with forensic lab for extraction report. Prioritize WhatsApp, Telegram, and call log analysis.','IT Act Section 65B, Evidence Act','active'],
    ['lead-007','case-002','Identify Number 9000000002 â€” Second Mule','9000000002 received a call from accused post-fraud (Deepak â†’ 9000000002 at 09:30 on 2026-03-20, 110 sec). Identity and location unknown.',
     'medium',0.74,'telecom','["CDR Records"]','Request subscriber details and CDR from TSP. Cross-reference with mule account beneficiary details.','CrPC Section 91','active'],
  ];
  db.transaction(rows => rows.forEach(r => insertLead.run(...r)))(leads);

  // Seed Contradictions (case-002)
  const insertCont = db.prepare(`
    INSERT INTO case_contradictions (id, case_id, title, severity, category, description, document_a, document_b, significance, recommended_action, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const contradictions = [
    ['cont-001','case-002',
     'Rahul Verma: Statement vs. CDR Data',
     'critical','statement',
     'Rahul Verma states in his recorded statement (2026-03-21) that he had NO contact with the victim Priya Sharma. However, CDR records conclusively show his number (9123456789) called the victim (9876501234) on 2026-03-19 at 10:30 for 317 seconds.',
     'Accused Statement (Rahul Verma, 2026-03-21)',
     'CDR Records â€” TSP Data for 9123456789',
     'This is a direct provable lie by the accused, indicating consciousness of guilt and active deception of the investigating officer.',
     'Confront Rahul Verma with CDR evidence in next interrogation. Record revised statement under CrPC 161. Present as evidence of false information to court.',
     'open'],
    ['cont-002','case-002',
     'Deepak Sharma: Location Alibi vs. CDR Tower Data',
     'critical','location',
     'Deepak Sharma claims he was in Delhi on 2026-03-20 (the date of fraud). CDR tower records show his phone (9876543210) was active on TWR-GGN-01 (Gurugram, Sector 5) at 09:05 and TWR-GGN-02 (Gurugram Sector 9) at 09:30 â€” placing him in Gurugram, NOT Delhi, during the fraud calls.',
     'Accused Statement (Deepak Sharma, post-arrest)',
     'CDR Records â€” Tower location data for 9876543210',
     'Establishes that Deepak Sharma was physically present in Gurugram while conducting the fraud calls. Destroys his alibi completely.',
     'Prepare CDR tower data summary as court exhibit. Obtain geo-coordinates of TWR-GGN-01 and TWR-GGN-02. Cross-verify with CCTV in the area.',
     'open'],
    ['cont-003','case-002',
     'Bank Transfer Amount: FIR vs. Statement',
     'moderate','financial',
     'The FIR states victim transferred â‚¹2.5 lakh. However, bank statement analysis shows three separate transactions: â‚¹50,000 + â‚¹1,00,000 + â‚¹1,00,000 = â‚¹2,50,000. The victim\'s initial complaint mentioned "one transfer of â‚¹2.5 lakh" â€” this is technically incorrect as 3 separate UPI/NEFT transfers were made.',
     'FIR (registered 2026-03-20)',
     'Bank Statement â€” Priya Sharma SBI account xxxx4521',
     'The distinction matters for chargesheet â€” 3 separate fraudulent inducements make the case stronger under IPC 420.',
     'Amend FIR statement or add supplementary statement from victim. Record exact sequence of transactions with timestamps.',
     'open'],
    ['cont-004','case-002',
     'Forensic Report Timeline vs. Arrest Date',
     'minor','timeline',
     'Forensic report received date (2026-04-10) is after the statement of co-accused Rahul Verma (2026-04-01). If Rahul\'s statement referenced forensic evidence, this would be impossible unless there was an earlier informal communication from the lab.',
     'Statement of Rahul Verma (2026-04-01)',
     'Forensic Report received (2026-04-10)',
     'Minor procedural inconsistency â€” could affect admissibility if defense raises it.',
     'Verify if an interim forensic report was received verbally before formal report date. Document all lab communications.',
     'closed'],
  ];
  db.transaction(rows => rows.forEach(r => insertCont.run(...r)))(contradictions);

  console.log('âœ… Bank transactions, IP records, leads, and contradictions seeded.');
}

export default db;
