import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Open database in the root folder
const db = new Database(join(__dirname, '../data_v3.db'), { verbose: console.log });

// Create tables
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

  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    fir_number TEXT UNIQUE NOT NULL,
    incident_date DATETIME NOT NULL,
    incident_type TEXT NOT NULL,
    location TEXT NOT NULL,
    district TEXT NOT NULL,
    complainant_name TEXT NOT NULL,
    accused_name TEXT,
    victim_name TEXT,
    contact_number TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Virtual table for search
  CREATE VIRTUAL TABLE IF NOT EXISTS cases_fts USING fts5(
    fir_number,
    incident_type,
    location,
    complainant_name,
    accused_name,
    victim_name,
    description,
    tokenize='porter unicode61'
  );

  -- Embeddings table for semantic search
  CREATE TABLE IF NOT EXISTS case_embeddings (
    case_id TEXT PRIMARY KEY,
    vector BLOB NOT NULL,
    metadata TEXT, -- JSON search string used for embedding
    FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
  );
`);

// Triggers for FTS sync (simplified for demo - manual sync might be safer if ID is TEXT)
// For this demo, we will manually sync during seeding and use a dedicated search service.

// Insert seed data if profiles is empty
const profileCount = db.prepare('SELECT COUNT(*) as c FROM profiles').get().c;
if (profileCount === 0) {
  const insert = db.prepare(`
    INSERT INTO profiles (id, username, password, role, full_name, badge_number, rank, station_id)
    VALUES (@id, @username, @password, @role, @full_name, @badge_number, @rank, @station_id)
  `);

  const users = [
    {
      id: 'usr-1', username: 'admin', password: 'admin123', role: 'admin',
      full_name: 'Test Admin', badge_number: 'ADM-001', rank: 'SP', station_id: 'hq'
    },
    {
      id: 'usr-2', username: 'io_1', password: 'io123', role: 'io',
      full_name: 'Investigating Officer Singh', badge_number: 'IO-101', rank: 'SI', station_id: 'stn-1'
    }
  ];

  db.transaction((users) => {
    for (const user of users) insert.run(user);
  })(users);
  console.log('Seed users created.');
}

// Seed cases
const caseCount = db.prepare('SELECT COUNT(*) as c FROM cases').get().c;
if (caseCount === 0) {
  const insertCase = db.prepare(`
    INSERT INTO cases (id, fir_number, incident_date, incident_type, location, district, complainant_name, accused_name, victim_name, contact_number, description, status)
    VALUES (@id, @fir_number, @incident_date, @incident_type, @location, @district, @complainant_name, @accused_name, @victim_name, @contact_number, @description, @status)
  `);

  const insertFts = db.prepare(`
    INSERT INTO cases_fts (fir_number, incident_type, location, complainant_name, accused_name, victim_name, description)
    VALUES (@fir_number, @incident_type, @location, @complainant_name, @accused_name, @victim_name, @description)
  `);

  const cases = [
    // ── THEFT (चोरी) variations ─────────────────────────────────────────────
    {
      id: 'case-001', fir_number: 'FIR-2026-001', incident_date: '2026-01-05', incident_type: 'Theft',
      location: 'Sector 14, Gurugram', district: 'Gurugram', complainant_name: 'Sandeep Sharma',
      accused_name: 'Unknown', victim_name: 'Sandeep Sharma', contact_number: '9876543210',
      description: 'Silver Maruti Suzuki Swift was stolen from outside the house at night.', status: 'investigating'
    },
    {
      id: 'case-002', fir_number: 'FIR-2026-002', incident_date: '2026-01-10', incident_type: 'Theft',
      location: 'Old Railway Road, Gurugram', district: 'Gurugram', complainant_name: 'Sandip Gupta',
      accused_name: 'Sunil Singh', victim_name: 'Sandip Gupta', contact_number: '9123456789',
      description: 'Mobile phone snatched while walking near Old Railway Road.', status: 'investigating'
    },
    {
      id: 'case-003', fir_number: 'FIR-2026-003', incident_date: '2026-01-15', incident_type: 'Theft',
      location: 'Sector 5, Panchkula', district: 'Panchkula', complainant_name: 'Rhaul Dev',
      accused_name: 'Local gang', victim_name: 'Rhaul Dev', contact_number: '9000011111',
      description: 'Bicycle stolen from apartment complex parking area overnight.', status: 'pending'
    },
    {
      id: 'case-004', fir_number: 'FIR-2026-004', incident_date: '2026-01-20', incident_type: 'Theft',
      location: 'Model Town, Ambala', district: 'Ambala', complainant_name: 'Sandepp Kumar',
      accused_name: 'Unknown', victim_name: 'Sandepp Kumar', contact_number: '9811122233',
      description: 'Laptop and cash stolen from office cabin. CCTV footage available.', status: 'pending'
    },

    // ── ASSAULT (मारपीट) variations ──────────────────────────────────────────
    {
      id: 'case-005', fir_number: 'FIR-2026-005', incident_date: '2026-01-22', incident_type: 'Assault',
      location: 'Civil Lines, Rohtak', district: 'Rohtak', complainant_name: 'Rahul Verma',
      accused_name: 'Amit Kumar', victim_name: 'Rahul Verma', contact_number: '9888877777',
      description: 'Physical assault following a road rage incident near the main market.', status: 'pending'
    },
    {
      id: 'case-006', fir_number: 'FIR-2026-006', incident_date: '2026-01-25', incident_type: 'Assault',
      location: 'Bus Stand Road, Hisar', district: 'Hisar', complainant_name: 'Rahool Singh',
      accused_name: 'Vijay Dahiya', victim_name: 'Rahool Singh', contact_number: '9777766655',
      description: 'Beaten with iron rod outside a dhaba. Three fractures reported.', status: 'investigating'
    },
    {
      id: 'case-007', fir_number: 'FIR-2026-007', incident_date: '2026-01-28', incident_type: 'Assault',
      location: 'Sector 21, Faridabad', district: 'Faridabad', complainant_name: 'Rahuul Mehta',
      accused_name: 'Sanjay group', victim_name: 'Rahuul Mehta', contact_number: '9666655544',
      description: 'Group assault during a property dispute. Victim hospitalised.', status: 'closed'
    },

    // ── FRAUD / CYBERCRIME (धोखाधड़ी) ─────────────────────────────────────────
    {
      id: 'case-008', fir_number: 'FIR-2026-008', incident_date: '2026-02-01', incident_type: 'Fraud',
      location: 'Sohna Road, Gurugram', district: 'Gurugram', complainant_name: 'Anjali Rathi',
      accused_name: 'Unknown Caller', victim_name: 'Anjali Rathi', contact_number: '9555544444',
      description: 'Online banking fraud — OTP shared unknowingly, Rs 50,000 deducted.', status: 'closed'
    },
    {
      id: 'case-009', fir_number: 'FIR-2026-009', incident_date: '2026-02-05', incident_type: 'Cybercrime',
      location: 'Sector 7, Karnal', district: 'Karnal', complainant_name: 'Priya Singh',
      accused_name: 'Fake job portal', victim_name: 'Priya Singh', contact_number: '9444433322',
      description: 'Fake job portal scam. Rs 1,20,000 transferred for placement fee. No job received.', status: 'investigating'
    },
    {
      id: 'case-010', fir_number: 'FIR-2026-010', incident_date: '2026-02-08', incident_type: 'Cybercrime',
      location: 'Urban Estate, Kurukshetra', district: 'Kurukshetra', complainant_name: 'Prya Rani',
      accused_name: 'Unknown hacker', victim_name: 'Prya Rani', contact_number: '9333322211',
      description: 'Social media account hacked, morphed images uploaded to blackmail victim.', status: 'investigating'
    },
    {
      id: 'case-011', fir_number: 'FIR-2026-011', incident_date: '2026-02-10', incident_type: 'Fraud',
      location: 'Model Town, Sonipat', district: 'Sonipat', complainant_name: 'Preya Devi',
      accused_name: 'Property dealer Ramesh', victim_name: 'Preya Devi', contact_number: '9222211100',
      description: 'Property dealer sold the same plot to two buyers. Advance of Rs 5 lakh taken and fled.', status: 'pending'
    },

    // ── MURDER / ATTEMPT TO MURDER (हत्या) ────────────────────────────────────
    {
      id: 'case-012', fir_number: 'FIR-2026-012', incident_date: '2026-02-12', incident_type: 'Murder',
      location: 'Village Kharkhoda, Sonipat', district: 'Sonipat', complainant_name: 'Geeta Devi',
      accused_name: 'Rampal alias Ramu', victim_name: 'Suresh Kumar', contact_number: '9111100099',
      description: 'Body found in agricultural field. Blunt force trauma. Land dispute suspected motive.', status: 'investigating'
    },
    {
      id: 'case-013', fir_number: 'FIR-2026-013', incident_date: '2026-02-15', incident_type: 'Attempt to Murder',
      location: 'GT Road, Panipat', district: 'Panipat', complainant_name: 'Vikram Pandey',
      accused_name: 'Kiran alias Kalla', victim_name: 'Vikram Pandey', contact_number: '9900088877',
      description: 'Shot twice with country-made pistol during evening walk. Survived. Enmity reported.', status: 'investigating'
    },

    // ── BURGLARY (सेंधमारी) ────────────────────────────────────────────────────
    {
      id: 'case-014', fir_number: 'FIR-2026-014', incident_date: '2026-02-18', incident_type: 'Burglary',
      location: 'Model Town, Panipat', district: 'Panipat', complainant_name: 'Priyanka Singh',
      accused_name: 'Deepak alias Deepu', victim_name: 'Priyanka Singh', contact_number: '9999900000',
      description: 'चोरी की घटना — घर का ताला तोड़कर गहने और नकदी ले गए। (Gold jewellery and Rs 80,000 cash stolen.)', status: 'pending'
    },
    {
      id: 'case-015', fir_number: 'FIR-2026-015', incident_date: '2026-02-20', incident_type: 'Burglary',
      location: 'Shastri Nagar, Bhiwani', district: 'Bhiwani', complainant_name: 'Rajesh Yadav',
      accused_name: 'Three unidentified persons', victim_name: 'Rajesh Yadav', contact_number: '9800099900',
      description: 'Warehouse broken into at midnight. Electronic goods worth Rs 3 lakh stolen.', status: 'investigating'
    },

    // ── ROBBERY / DACOITY (डकैती) ─────────────────────────────────────────────
    {
      id: 'case-016', fir_number: 'FIR-2026-016', incident_date: '2026-02-22', incident_type: 'Robbery',
      location: 'NH-44, Ambala', district: 'Ambala', complainant_name: 'Harjit Dhaliwal',
      accused_name: 'Five armed persons', victim_name: 'Harjit Dhaliwal', contact_number: '9700077766',
      description: 'Armed robbery on national highway. Truck driver looted at gunpoint. Cash and valuables taken.', status: 'investigating'
    },
    {
      id: 'case-017', fir_number: 'FIR-2026-017', incident_date: '2026-02-25', incident_type: 'Robbery',
      location: 'Palwal Chowk, Palwal', district: 'Palwal', complainant_name: 'Mohan Bansal',
      accused_name: 'Bike-borne criminals', victim_name: 'Mohan Bansal', contact_number: '9600066655',
      description: 'Shopkeeper robbed at gunpoint at closing time. CCTV footage recovered.', status: 'pending'
    },

    // ── KIDNAPPING (अपहरण) ────────────────────────────────────────────────────
    {
      id: 'case-018', fir_number: 'FIR-2026-018', incident_date: '2026-03-01', incident_type: 'Kidnapping',
      location: 'Sector 12, Faridabad', district: 'Faridabad', complainant_name: 'Sunita Devi',
      accused_name: 'Rakesh Nain', victim_name: 'Aryan Devi (minor)', contact_number: '9500055544',
      description: 'Minor girl kidnapped near school. Ransom of Rs 10 lakh demanded. Case transferred to crime branch.', status: 'investigating'
    },

    // ── DOMESTIC VIOLENCE (घरेलू हिंसा) ───────────────────────────────────────
    {
      id: 'case-019', fir_number: 'FIR-2026-019', incident_date: '2026-03-03', incident_type: 'Domestic Violence',
      location: 'Sadar Bazar, Rewari', district: 'Rewari', complainant_name: 'Kamla Devi',
      accused_name: 'Suresh alias Suresha (husband)', victim_name: 'Kamla Devi', contact_number: '9400044433',
      description: 'Regularly beaten by husband under influence of alcohol. Medical examination done.', status: 'pending'
    },

    // ── DOWRY CASE (दहेज प्रताड़ना) ─────────────────────────────────────────────
    {
      id: 'case-020', fir_number: 'FIR-2026-020', incident_date: '2026-03-05', incident_type: 'Dowry Case',
      location: 'Village Ateli, Mahendragarh', district: 'Mahendragarh', complainant_name: 'Rekha Sharma',
      accused_name: 'In-laws family', victim_name: 'Rekha Sharma', contact_number: '9300033322',
      description: 'Dowry harassment for two years. Threatened for additional Rs 2 lakh. Sc 498-A applied.', status: 'investigating'
    },

    // ── DRUG TRAFFICKING (मादक पदार्थ) ────────────────────────────────────────
    {
      id: 'case-021', fir_number: 'FIR-2026-021', incident_date: '2026-03-07', incident_type: 'Drug Trafficking',
      location: 'Bus Stand Area, Sirsa', district: 'Sirsa', complainant_name: 'Police (suo motu)',
      accused_name: 'Harinder alias Hari', victim_name: 'Society', contact_number: '9200022211',
      description: '3 kg heroin recovered from accused during vehicle checking. Route from Punjab to Rajasthan.', status: 'closed'
    },
    {
      id: 'case-022', fir_number: 'FIR-2026-022', incident_date: '2026-03-09', incident_type: 'Drug Trafficking',
      location: 'Fatehabad Road, Fatehabad', district: 'Fatehabad', complainant_name: 'Police (NC)',
      accused_name: 'Rajbir Singh', victim_name: 'Society', contact_number: '9100011100',
      description: '500 grams of chitta (heroin) seized along with Rs 15,000 drug money.', status: 'closed'
    },

    // ── LAND DISPUTE (भूमि विवाद) ─────────────────────────────────────────────
    {
      id: 'case-023', fir_number: 'FIR-2026-023', incident_date: '2026-03-10', incident_type: 'Land Dispute',
      location: 'Village Patli, Jhajjar', district: 'Jhajjar', complainant_name: 'Dharampal Hooda',
      accused_name: 'Bimla Devi (neighbour)', victim_name: 'Dharampal Hooda', contact_number: '9000099988',
      description: 'Illegal encroachment on two acres of agricultural land. Boundary wall demolished.', status: 'pending'
    },

    // ── MISSING PERSON (लापता व्यक्ति) ────────────────────────────────────────
    {
      id: 'case-024', fir_number: 'FIR-2026-024', incident_date: '2026-03-12', incident_type: 'Missing Person',
      location: 'Sector 9, Panchkula', district: 'Panchkula', complainant_name: 'Mandeep Kaur',
      accused_name: 'N/A', victim_name: 'Gurpreet Singh (age 17)', contact_number: '8900088877',
      description: 'Teenager missing since three days. Last seen at school. No contact since.', status: 'investigating'
    },
    {
      id: 'case-025', fir_number: 'FIR-2026-025', incident_date: '2026-03-14', incident_type: 'Missing Person',
      location: 'Palam Vihar, Gurugram', district: 'Gurugram', complainant_name: 'Ameet Jain',
      accused_name: 'N/A', victim_name: 'Ameet Jain (self reported earlier)', contact_number: '8800077766',
      description: 'Old man with dementia went missing. Later found near IFFCO Chowk by police patrolling.', status: 'closed'
    },

    // ── TRAFFIC ACCIDENT (यातायात दुर्घटना) ────────────────────────────────────
    {
      id: 'case-026', fir_number: 'FIR-2026-026', incident_date: '2026-03-16', incident_type: 'Traffic Accident',
      location: 'NH-48, Manesar, Gurugram', district: 'Gurugram', complainant_name: 'Satbir Rana',
      accused_name: 'Truck driver (absconding)', victim_name: 'Satbir Rana', contact_number: '8700066655',
      description: 'Hit and run accident. Bike rider severely injured. Truck registration traced via CCTV.', status: 'investigating'
    },
    {
      id: 'case-027', fir_number: 'FIR-2026-027', incident_date: '2026-03-18', incident_type: 'Traffic Accident',
      location: 'Hansi Bypass, Hansi', district: 'Hansi', complainant_name: 'Sukhbir Malik',
      accused_name: 'Overloaded truck driver', victim_name: 'Two labourers', contact_number: '8600055544',
      description: 'Overloaded truck overturned injuring two migrant workers. Driver arrested.', status: 'closed'
    },

    // ── EXTORTION (जबरन वसूली) ────────────────────────────────────────────────
    {
      id: 'case-028', fir_number: 'FIR-2026-028', incident_date: '2026-03-20', incident_type: 'Extortion',
      location: 'Industrial Area, Bahadurgarh, Jhajjar', district: 'Jhajjar', complainant_name: 'Naresh Goel',
      accused_name: 'Lokesh alias Lucky gang', victim_name: 'Naresh Goel', contact_number: '8500044433',
      description: 'Factory owner receiving threats and extortion calls demanding Rs 20 lakh monthly.', status: 'investigating'
    },

    // ── ARSON (आगजनी) ─────────────────────────────────────────────────────────
    {
      id: 'case-029', fir_number: 'FIR-2026-029', incident_date: '2026-03-22', incident_type: 'Arson',
      location: 'Village Kalayat, Kaithal', district: 'Kaithal', complainant_name: 'Ombir Dhull',
      accused_name: 'Jaipal (rival family)', victim_name: 'Ombir Dhull', contact_number: '8400033322',
      description: 'Standing wheat crop set on fire due to old enmity. Loss of Rs 4 lakh estimated.', status: 'pending'
    },

    // ── ARMS ACT (शस्त्र अधिनियम) ─────────────────────────────────────────────
    {
      id: 'case-030', fir_number: 'FIR-2026-030', incident_date: '2026-03-24', incident_type: 'Arms Act',
      location: 'Jind Bypass, Jind', district: 'Jind', complainant_name: 'Police (suo motu)',
      accused_name: 'Rajveer Singh', victim_name: 'Society', contact_number: '8300022211',
      description: 'Illegal country-made pistol with 10 live cartridges seized during naka checking.', status: 'closed'
    },

    // ── CORRUPTION (भ्रष्टाचार) ──────────────────────────────────────────────
    {
      id: 'case-031', fir_number: 'FIR-2026-031', incident_date: '2026-03-26', incident_type: 'Corruption',
      location: 'Tehsil Office, Yamunanagar', district: 'Yamunanagar', complainant_name: 'Joginder Saini',
      accused_name: 'Patwari Naresh Chand', victim_name: 'Joginder Saini', contact_number: '8200011100',
      description: 'Patwari caught accepting Rs 15,000 bribe for correction in land records. Vigilance trap laid.', status: 'closed'
    },

    // ── EVE TEASING (छेड़छाड़) ────────────────────────────────────────────────
    {
      id: 'case-032', fir_number: 'FIR-2026-032', incident_date: '2026-03-28', incident_type: 'Eve Teasing',
      location: 'Near Government College, Charkhi Dadri', district: 'Charkhi Dadri', complainant_name: 'Sunita (student)',
      accused_name: 'Aakash, Deepak, Ravi', victim_name: 'Sunita', contact_number: '8100000099',
      description: 'Three youths repeatedly harassing girl students outside college. CCTV footage secured.', status: 'investigating'
    },

    // ── ACID ATTACK (तेजाब हमला) ──────────────────────────────────────────────
    {
      id: 'case-033', fir_number: 'FIR-2026-033', incident_date: '2026-03-30', incident_type: 'Acid Attack',
      location: 'Mewat Road, Nuh', district: 'Mewat', complainant_name: 'Reena Bibi',
      accused_name: 'Irfan (ex-boyfriend)', victim_name: 'Reena Bibi', contact_number: '9876500000',
      description: 'Acid thrown on victim after rejection of marriage proposal. 40% burns. Accused arrested.', status: 'investigating'
    },

    // ── CHILD ABUSE (बाल शोषण) ────────────────────────────────────────────────
    {
      id: 'case-034', fir_number: 'FIR-2026-034', incident_date: '2026-04-01', incident_type: 'Child Abuse',
      location: 'Village Dobh, Palwal', district: 'Palwal', complainant_name: 'Kanta Devi (mother)',
      accused_name: 'Mahesh (neighbour)', victim_name: 'Minor boy (age 9)', contact_number: '9876501111',
      description: 'Child physically abused by neighbour. POCSO registered. Child in shelter home.', status: 'investigating'
    },

    // ── SMUGGLING (तस्करी) ────────────────────────────────────────────────────
    {
      id: 'case-035', fir_number: 'FIR-2026-035', incident_date: '2026-04-03', incident_type: 'Smuggling',
      location: 'Kundli Border, Sonipat', district: 'Sonipat', complainant_name: 'Police (NC)',
      accused_name: 'Munna alias Munaf', victim_name: 'Society', contact_number: '9876502222',
      description: 'Illegal liquor worth Rs 8 lakh intercepted at inter-state border. Two carriers arrested.', status: 'closed'
    },

    // ── PHONETIC / SPELLING VARIATION TEST CASES ──────────────────────────────
    {
      id: 'case-036', fir_number: 'FIR-2026-036', incident_date: '2026-04-05', incident_type: 'Theft',
      location: 'Sector 3, Ambala City', district: 'Ambala', complainant_name: 'Amit Sharma',
      accused_name: 'Unknown', victim_name: 'Amit Sharma', contact_number: '9876503333',
      description: 'Two-wheeler stolen from outside railway station.', status: 'pending'
    },
    {
      id: 'case-037', fir_number: 'FIR-2026-037', incident_date: '2026-04-06', incident_type: 'Assault',
      location: 'Hisar Road, Bhiwani', district: 'Bhiwani', complainant_name: 'Ameet Chauhan',
      accused_name: 'Gajender', victim_name: 'Ameet Chauhan', contact_number: '9876504444',
      description: 'Beaten with sticks during a money dispute. Three teeth broken.', status: 'investigating'
    },
    {
      id: 'case-038', fir_number: 'FIR-2026-038', incident_date: '2026-04-07', incident_type: 'Fraud',
      location: 'Sector 1, Rewari', district: 'Rewari', complainant_name: 'Ammit Goyal',
      accused_name: 'Online trader Ravi', victim_name: 'Ammit Goyal', contact_number: '9876505555',
      description: 'Paid Rs 60,000 for fake investment scheme. No returns received.', status: 'pending'
    },
    {
      id: 'case-039', fir_number: 'FIR-2026-039', incident_date: '2026-04-08', incident_type: 'Theft',
      location: 'Sadar Bazar, Karnal', district: 'Karnal', complainant_name: 'Sandeep Kumar',
      accused_name: 'Unknown pickpocket', victim_name: 'Sandeep Kumar', contact_number: '9876506666',
      description: 'Wallet stolen at busy market. Rs 12,000 cash and ATM card taken.', status: 'pending'
    },
    {
      id: 'case-040', fir_number: 'FIR-2026-040', incident_date: '2026-04-09', incident_type: 'Missing Person',
      location: 'Pehowa, Kurukshetra', district: 'Kurukshetra', complainant_name: 'Sundeep Arora',
      accused_name: 'N/A', victim_name: 'Sundeep Arora spouse', contact_number: '9876507777',
      description: 'Wife missing for 4 days after domestic dispute. Mobile switched off.', status: 'investigating'
    },
    {
      id: 'case-041', fir_number: 'FIR-2026-041', incident_date: '2026-04-10', incident_type: 'Assault',
      location: 'Sector 15, Faridabad', district: 'Faridabad', complainant_name: 'Rahul Nair',
      accused_name: 'Security guard Ramesh', victim_name: 'Rahul Nair', contact_number: '9876508888',
      description: 'Assaulted during parking dispute outside a mall.', status: 'closed'
    },
    {
      id: 'case-042', fir_number: 'FIR-2026-042', incident_date: '2026-04-11', incident_type: 'Cybercrime',
      location: 'NIT, Faridabad', district: 'Faridabad', complainant_name: 'Priya Kumari',
      accused_name: 'Unknown hacker', victim_name: 'Priya Kumari', contact_number: '9876509999',
      description: 'UPI fraud — fake customer care call, Rs 25,000 deducted via screen share app.', status: 'investigating'
    },
    {
      id: 'case-043', fir_number: 'FIR-2026-043', incident_date: '2026-04-12', incident_type: 'Land Dispute',
      location: 'Village Badshahpur, Gurugram', district: 'Gurugram', complainant_name: 'Devender Yadav',
      accused_name: 'Builder group', victim_name: 'Devender Yadav', contact_number: '9876510000',
      description: 'Illegal possession of agricultural land by builder. Crops destroyed by JCB.', status: 'pending'
    },
    {
      id: 'case-044', fir_number: 'FIR-2026-044', incident_date: '2026-04-13', incident_type: 'Drug Trafficking',
      location: 'Village Kakroi, Sonipat', district: 'Sonipat', complainant_name: 'Police (NC)',
      accused_name: 'Ajay alias Budda', victim_name: 'Society', contact_number: '9876511111',
      description: '2 kg poppy husk seized. Accused was supplying to school-going youth in the area.', status: 'closed'
    },
    {
      id: 'case-045', fir_number: 'FIR-2026-045', incident_date: '2026-04-14', incident_type: 'Extortion',
      location: 'Sector 22, Gurugram', district: 'Gurugram', complainant_name: 'Sarvesh Kapoor',
      accused_name: 'Gangster Kala Jathedi gang', victim_name: 'Sarvesh Kapoor', contact_number: '9876512222',
      description: 'Business owner receiving WhatsApp extortion threats from jailed gangster network. Rs 50 lakh demanded.', status: 'investigating'
    },
    {
      id: 'case-046', fir_number: 'FIR-2026-046', incident_date: '2026-04-15', incident_type: 'Theft',
      location: 'Civil Lines, Ambala', district: 'Ambala', complainant_name: 'Rajinder Singh',
      accused_name: 'Unknown', victim_name: 'Rajinder Singh', contact_number: '9988776655',
      description: 'White Scorpio (HR-01-AB-1234) stolen from outside residence.', status: 'pending'
    },
    {
      id: 'case-047', fir_number: 'FIR-2026-047', incident_date: '2026-04-16', incident_type: 'Fraud',
      location: 'Sector 15, Panchkula', district: 'Panchkula', complainant_name: 'Meena Kumari',
      accused_name: 'Fake Bank Employee', victim_name: 'Meena Kumari', contact_number: '9876543322',
      description: 'KYC update scam. Victim lost Rs 45,000 from mobile number 98765-43210.', status: 'investigating'
    },
    {
      id: 'case-048', fir_number: 'FIR-2026-048', incident_date: '2026-04-17', incident_type: 'Missing Person',
      location: 'Main Bazar, Rohtak', district: 'Rohtak', complainant_name: 'Suresh Kumar',
      accused_name: 'N/A', victim_name: 'Karan Kumar (Age 12)', contact_number: '9123456700',
      description: '12-year-old boy missing from crowded market area. Wearing red shirt and blue jeans.', status: 'pending'
    },
    {
      id: 'case-049', fir_number: 'FIR-2026-049', incident_date: '2026-04-18', incident_type: 'Theft',
      location: 'Sector 14, Gurugram', district: 'Gurugram', complainant_name: 'Anil Mehra',
      accused_name: 'Unknown', victim_name: 'Anil Mehra', contact_number: '9234567890',
      description: 'Black Royal Enfield Bullet (HR-26-DJ-7788) stolen from parking lot.', status: 'pending'
    },
    {
      id: 'case-050', fir_number: 'FIR-2026-050', incident_date: '2026-04-19', incident_type: 'Fraud',
      location: 'Railway Road, Karnal', district: 'Karnal', complainant_name: 'Suman Devi',
      accused_name: 'Rahul Sharma', victim_name: 'Suman Devi', contact_number: '9345678901',
      description: 'Job fraud: Accused took Rs 2 lakh promising govt job in Haryana Police. Mobile used 98761-22334.', status: 'investigating'
    },
    {
      id: 'case-051', fir_number: 'FIR-2026-051', incident_date: '2026-04-20', incident_type: 'Assault',
      location: 'Hansi Road, Jind', district: 'Jind', complainant_name: 'Vikram Singh',
      accused_name: 'Monu & Sonu', victim_name: 'Vikram Singh', contact_number: '9456789012',
      description: 'Fight over water tap connection. Victim attacked with sticks (Lathi).', status: 'investigating'
    },
    {
      id: 'case-052', fir_number: 'FIR-2026-052', incident_date: '2026-04-21', incident_type: 'Cybercrime',
      location: 'Sector 7, Panchkula', district: 'Panchkula', complainant_name: 'Pooja Rani',
      accused_name: 'Anonymous', victim_name: 'Pooja Rani', contact_number: '9567890123',
      description: 'Online BF scam: Victim transferred Rs 50,000 to fraudster pretending to be from bank.', status: 'pending'
    },
    {
      id: 'case-053', fir_number: 'FIR-2026-053', incident_date: '2026-04-22', incident_type: 'Theft',
      location: 'Old City, Bhiwani', district: 'Bhiwani', complainant_name: 'Manoj Kumar',
      accused_name: 'Unknown', victim_name: 'Manoj Kumar', contact_number: '9678901234',
      description: 'Silver Honda Activa (HR-16-K-4455) stolen at night from street.', status: 'closed'
    },
    {
      id: 'case-054', fir_number: 'FIR-2026-054', incident_date: '2026-04-23', incident_type: 'Arms Act',
      location: 'National Highway, Palwal', district: 'Palwal', complainant_name: 'SI Ramesh',
      accused_name: 'Bittu alias Katta', victim_name: 'State', contact_number: '9789012345',
      description: 'One illegal country-made pistol (Desi Katta) recovered during checking.', status: 'closed'
    },
    {
      id: 'case-055', fir_number: 'FIR-2026-055', incident_date: '2026-04-24', incident_type: 'Drug Trafficking',
      location: 'Dabwali Road, Sirsa', district: 'Sirsa', complainant_name: 'Police (CIA)',
      accused_name: 'Jagga Singh', victim_name: 'Society', contact_number: '9890123456',
      description: '100 grams of Heroin (Chitta) seized from accused traveling in car.', status: 'closed'
    },
    {
      id: 'case-056', fir_number: 'FIR-2026-056', incident_date: '2026-04-25', incident_type: 'Extortion',
      location: 'Model Town, Sonipat', district: 'Sonipat', complainant_name: 'Amit Bansal',
      accused_name: 'Local Gang', victim_name: 'Amit Bansal', contact_number: '9901234567',
      description: 'Businessman getting threats for protection money (Gunda Tax). Calls from 91122-33445.', status: 'investigating'
    },
    {
      id: 'case-057', fir_number: 'FIR-2026-057', incident_date: '2026-04-26', incident_type: 'Murder',
      location: 'Village Garhi, Jhajjar', district: 'Jhajjar', complainant_name: 'Sombir Singh',
      accused_name: 'Neighbor Anil', victim_name: 'Rakesh Singh', contact_number: '9012345678',
      description: 'Murder over land dispute. Victim shot with illegal weapon.', status: 'investigating'
    },
    {
      id: 'case-058', fir_number: 'FIR-2026-058', incident_date: '2026-04-27', incident_type: 'Traffic Accident',
      location: 'GT Road, Panipat', district: 'Panipat', complainant_name: 'Kamal Kant',
      accused_name: 'Truck Driver', victim_name: 'Sunil Kumar', contact_number: '9123456789',
      description: 'Hit and run: Speeding truck (HR-06-A-5678) hit motorcycle. One dead.', status: 'pending'
    },
    {
      id: 'case-059', fir_number: 'FIR-2026-059', incident_date: '2026-04-28', incident_type: 'Kidnapping',
      location: 'Sector 12, Faridabad', district: 'Faridabad', complainant_name: 'Rekha Sharma',
      accused_name: 'Pradeep & Gang', victim_name: 'Anjali Sharma (Age 19)', contact_number: '9231234567',
      description: 'College student abducted in white car while returning home.', status: 'investigating'
    },
    {
      id: 'case-060', fir_number: 'FIR-2026-060', incident_date: '2026-04-29', incident_type: 'Fraud',
      location: 'Main Road, Hisar', district: 'Hisar', complainant_name: 'Gopal Dass',
      accused_name: 'Agent Mukesh', victim_name: 'Gopal Dass', contact_number: '9341234567',
      description: 'Visa fraud: Accused took Rs 5 lakh for sending victim to Canada. Now unreachable.', status: 'pending'
    },
    {
      id: 'case-061', fir_number: 'FIR-2026-061', incident_date: '2026-04-30', incident_type: 'Missing Person',
      location: 'Village Nahar, Rewari', district: 'Rewari', complainant_name: 'Om Prakash',
      accused_name: 'Unknown', victim_name: 'Sita Devi (Age 65)', contact_number: '9451234567',
      description: 'Elderly woman with memory loss missing since yesterday. Wearing pink saree.', status: 'pending'
    },
    {
      id: 'case-062', fir_number: 'FIR-2026-062', incident_date: '2026-05-01', incident_type: 'Theft',
      location: 'Sector 5, Kurukshetra', district: 'Kurukshetra', complainant_name: 'Nitin Goel',
      accused_name: 'Burglars', victim_name: 'Nitin Goel', contact_number: '9561234567',
      description: 'House burglary: Gold jewelry worth 4 lakhs and cash stolen in broad daylight.', status: 'investigating'
    },
    {
      id: 'case-063', fir_number: 'FIR-2026-063', incident_date: '2026-05-02', incident_type: 'Domestic Violence',
      location: 'Jagadhri, Yamunanagar', district: 'Yamunanagar', complainant_name: 'Santosh Rani',
      accused_name: 'Husband Sandeep', victim_name: 'Santosh Rani', contact_number: '9671234567',
      description: 'Wife beaten for dowry. Constant harassment and physical abuse reported.', status: 'investigating'
    },
    {
      id: 'case-064', fir_number: 'FIR-2026-064', incident_date: '2026-05-03', incident_type: 'Drug Trafficking',
      location: 'Border Checkpost, Fatehabad', district: 'Fatehabad', complainant_name: 'Police (Sturdy)',
      accused_name: 'Pala Ram', victim_name: 'Society', contact_number: '9781234567',
      description: '500 prohibited drug tablets recovered from bike during checking.', status: 'closed'
    },
    {
      id: 'case-065', fir_number: 'FIR-2026-065', incident_date: '2026-05-04', incident_type: 'Fraud',
      location: 'Village Mohna, Charkhi Dadri', district: 'Charkhi Dadri', complainant_name: 'Jai Singh',
      accused_name: 'Co-op Society manager', victim_name: 'Jai Singh', contact_number: '9891234567',
      description: 'Crop loan scam: Rs 1 lakh missing from victim\'s account info via phone 99911-22334.', status: 'pending'
    },
    {
      id: 'case-066', fir_number: 'FIR-2026-066', incident_date: '2026-05-05', incident_type: 'Theft',
      location: 'Urban Estate, Jind', district: 'Jind', complainant_name: 'Rohit Verma',
      accused_name: 'Unknown', victim_name: 'Rohit Verma', contact_number: '9901239876',
      description: 'White Maruti Swift (HR-31-M-8899) stolen from outside community center.', status: 'pending'
    },
    {
      id: 'case-067', fir_number: 'FIR-2026-067', incident_date: '2026-05-06', incident_type: 'Assault',
      location: 'Main Road, Kaithal', district: 'Kaithal', complainant_name: 'Krishan Chander',
      accused_name: 'Local Youth', victim_name: 'Krishan Chander', contact_number: '9111222333',
      description: 'Road rage incident: Complainant beaten after minor car collision.', status: 'closed'
    },
    {
      id: 'case-068', fir_number: 'FIR-2026-068', incident_date: '2026-05-07', incident_type: 'Robbery',
      location: 'Jewelry Lane, Hansi', district: 'Hansi', complainant_name: 'Deepak Jewellers',
      accused_name: 'Three masked men', victim_name: 'Deepak Soni', contact_number: '9222333444',
      description: 'Armed robbery at jewelry shop. Gold and 2 lakh cash taken at gunpoint.', status: 'investigating'
    },
    {
      id: 'case-069', fir_number: 'FIR-2026-069', incident_date: '2026-05-08', incident_type: 'Fraud',
      location: 'Palam Vihar, Gurugram', district: 'Gurugram', complainant_name: 'Sanjeev Goel',
      accused_name: 'Online Trading Platform', victim_name: 'Sanjeev Goel', contact_number: '9333444555',
      description: 'Bitcoin investment fraud: Victim lost 10 lakhs in fake trading app. Contact 95556-77889.', status: 'investigating'
    },
    {
      id: 'case-070', fir_number: 'FIR-2026-070', incident_date: '2026-05-09', incident_type: 'Theft',
      location: 'Ambala Cantt', district: 'Ambala', complainant_name: 'Vijay Pratap',
      accused_name: 'Unknown', victim_name: 'Vijay Pratap', contact_number: '9444555666',
      description: 'Grey Mahindra XUV500 (HR-01-XX-0007) stolen while family was shopping.', status: 'pending'
    },
    {
      id: 'case-071', fir_number: 'FIR-2026-071', incident_date: '2026-05-10', incident_type: 'Murder',
      location: 'Sector 4, Rohtak', district: 'Rohtak', complainant_name: 'Narendra Singh',
      accused_name: 'Sunil alias Sunny', victim_name: 'Mahender Singh', contact_number: '9555666777',
      description: 'Dead body found in empty plot. Multiple knife wounds. Gang rivalry suspected.', status: 'investigating'
    },
    {
      id: 'case-072', fir_number: 'FIR-2026-072', incident_date: '2026-05-11', incident_type: 'Missing Person',
      location: 'Village Lakhan, Sirsa', district: 'Sirsa', complainant_name: 'Baljit Kaur',
      accused_name: 'Unknown', victim_name: 'Gurpreet Singh (Age 25)', contact_number: '9666777888',
      description: 'Young man missing since trip to Chandigarh. Last seen at bus stand.', status: 'pending'
    },
    {
      id: 'case-073', fir_number: 'FIR-2026-073', incident_date: '2026-05-12', incident_type: 'Fraud',
      location: 'Model Town, Rewari', district: 'Rewari', complainant_name: 'Ishwar Singh',
      accused_name: 'Fake LIC agent', victim_name: 'Ishwar Singh', contact_number: '9777888999',
      description: 'Policy maturity fraud: Rs 2 lakh stolen from victim\'s account. Mobile: 98123-44556.', status: 'investigating'
    },
    {
      id: 'case-074', fir_number: 'FIR-2026-074', incident_date: '2026-05-13', incident_type: 'Arms Act',
      location: 'Kundli Border, Sonipat', district: 'Sonipat', complainant_name: 'Police (Naka)',
      accused_name: 'Parveen Yadav', victim_name: 'State', contact_number: '9888999000',
      description: 'Illegal .32 bore pistol and 5 live cartridges recovered from car during search.', status: 'closed'
    },
    {
      id: 'case-075', fir_number: 'FIR-2026-075', incident_date: '2026-05-14', incident_type: 'Theft',
      location: 'Sector 9, Karnal', district: 'Karnal', complainant_name: 'Abhishek Jain',
      accused_name: 'Unknown', victim_name: 'Abhishek Jain', contact_number: '9999000111',
      description: 'Black TVS Apache (HR-05-BC-3344) stolen from outside gym.', status: 'pending'
    },
    {
      id: 'case-076', fir_number: 'FIR-2026-076', incident_date: '2026-05-15', incident_type: 'Drug Trafficking',
      location: 'Indri Road, Karnal', district: 'Karnal', complainant_name: 'SI Sunil Kumar',
      accused_name: 'Deepak & Ravi', victim_name: 'Society', contact_number: '9000111222',
      description: 'Seizure of 50 kg Poppy Husk (Lahan) from a hidden store in warehouse.', status: 'investigating'
    },
    {
      id: 'case-077', fir_number: 'FIR-2026-077', incident_date: '2026-05-16', incident_type: 'Cybercrime',
      location: 'Sector 15, Gurugram', district: 'Gurugram', complainant_name: 'Neha Gupta',
      accused_name: 'Cyber Fraudsters', victim_name: 'Neha Gupta', contact_number: '9111000222',
      description: 'SIM swap fraud: 3 lakhs stolen from bank account info via phone 97777-11223.', status: 'pending'
    },
    {
      id: 'case-078', fir_number: 'FIR-2026-078', incident_date: '2026-05-17', incident_type: 'Missing Person',
      location: 'Village Ganaur, Sonipat', district: 'Sonipat', complainant_name: 'Jai Kishan',
      accused_name: 'Unknown', victim_name: 'Ajay (Age 8)', contact_number: '9222111333',
      description: '8-year-old child missing from village playground. Wearing yellow T-shirt.', status: 'pending'
    },
  ];

  // Dynamically generate the rest to reach 10,000 cases for bulk testing
  const firstNames = ['Sandeep', 'Rahul', 'Amit', 'Vikas', 'Pooja', 'Sunita', 'Rakesh', 'Anil', 'Suman', 'Neha', 'Vijay', 'Deepak'];
  const lastNames = ['Sharma', 'Singh', 'Verma', 'Kumar', 'Devi', 'Yadav', 'Rani', 'Jain', 'Gupta', 'Goel'];
  const caseTypesList = ['Theft', 'Assault', 'Fraud', 'Cybercrime', 'Missing Person', 'Extortion', 'Murder', 'Kidnapping', 'Domestic Violence', 'Drug Trafficking'];
  const distList = ['Gurugram', 'Faridabad', 'Rohtak', 'Karnal', 'Hisar', 'Sirsa', 'Ambala', 'Panipat', 'Sonipat', 'Jhajjar'];

  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const getRandomPhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000);
  const getRandomVehicle = () => `HR-${String(Math.floor(Math.random()*99)).padStart(2,'0')}-${String.fromCharCode(65+Math.random()*26)}${String.fromCharCode(65+Math.random()*26)}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`;

  for (let i = 79; i <= 10000; i++) {
    const isVehicleTht = Math.random() < 0.15; // 15% vehicle thefts
    const type = isVehicleTht ? 'Theft' : getRandomItem(caseTypesList);
    const dist = getRandomItem(distList);
    const phone = getRandomPhone();
    const vehicle = isVehicleTht ? getRandomVehicle() : '';
    
    let desc = `Dummy ${type} case generated for testing in ${dist}. Contact linked: ${phone}.`;
    if (isVehicleTht) {
      desc = `Vehicle theft reported. Vehicle number ${vehicle} stolen from sector market area. Mobile ${phone}.`;
    }

    cases.push({
      id: `case-${i.toString().padStart(5, '0')}`,
      fir_number: `FIR-2026-${i.toString().padStart(5, '0')}`,
      incident_date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().split('T')[0],
      incident_type: type,
      location: `Sector ${Math.floor(Math.random() * 50) + 1}, ${dist}`,
      district: dist,
      complainant_name: `${getRandomItem(firstNames)} ${getRandomItem(lastNames)}`,
      accused_name: 'Unknown',
      victim_name: 'N/A',
      contact_number: phone,
      description: desc,
      status: Math.random() > 0.5 ? 'pending' : 'investigating'
    });
  }

  db.transaction((cases) => {
    for (const c of cases) {
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
    }
  })(cases);
  console.log(`Seed cases created: Total ${cases.length} records.`);
}

export default db;
