import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to run a query synchronously in Postgres via a subprocess
function runPgQuerySync(sql, params = []) {
  const payload = JSON.stringify({ sql, params });
  const base64Payload = Buffer.from(payload).toString('base64');
  
  try {
    const resultStr = execSync(`node "${path.join(__dirname, 'pg-worker.js')}" ${base64Payload}`, {
      env: {
        ...process.env,
        PGPASSWORD: process.env.PGPASSWORD || 'Pankaj@36085260'
      },
      maxBuffer: 20 * 1024 * 1024 // 20MB buffer for large seed data
    }).toString();
    
    const result = JSON.parse(resultStr);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  } catch (err) {
    console.error('PostgreSQL execution error:', err.message);
    throw err;
  }
}

function translateQueryAndParams(sql, params = []) {
  let finalSql = sql;
  let finalParams = params;

  // Extract all @name placeholders
  const namedParamRegex = /@([a-zA-Z0-9_]+)/g;
  let matches = [];
  let match;
  while ((match = namedParamRegex.exec(sql)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length > 0 && params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !(params[0] instanceof Date)) {
    const paramObj = params[0];
    const uniqueNames = [...new Set(matches)];
    
    let index = 1;
    const nameToPlaceholder = {};
    finalParams = [];
    for (const name of uniqueNames) {
      nameToPlaceholder[name] = `$${index}`;
      finalParams.push(paramObj[name]);
      index++;
    }
    
    finalSql = sql.replace(/@([a-zA-Z0-9_]+)/g, (m, name) => {
      return nameToPlaceholder[name] || m;
    });
  } else {
    // Replace ? with $1, $2, etc.
    let paramCount = 0;
    let tempSql = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      if (char === "'" && sql[i - 1] !== '\\') {
        inSingleQuote = !inSingleQuote;
      }
      if (char === '"' && sql[i - 1] !== '\\') {
        inDoubleQuote = !inDoubleQuote;
      }
      if (char === '?' && !inSingleQuote && !inDoubleQuote) {
        paramCount++;
        tempSql += `$${paramCount}`;
      } else {
        tempSql += char;
      }
    }
    finalSql = tempSql;
  }

  // General DDL and query translations
  finalSql = finalSql.replace(/\bDATETIME\b/gi, 'TIMESTAMP');
  finalSql = finalSql.replace(/\bREAL\b/gi, 'DOUBLE PRECISION');
  finalSql = finalSql.replace(/lower\(hex\(randomblob\(8\)\)\)/gi, "substring(md5(random()::text), 1, 16)");
  finalSql = finalSql.replace(/\bLIKE\b/gi, 'ILIKE');

  if (/INSERT OR IGNORE/gi.test(finalSql)) {
    finalSql = finalSql.replace(/INSERT OR IGNORE/gi, 'INSERT');
    if (!/ON CONFLICT/gi.test(finalSql)) {
      finalSql += ' ON CONFLICT DO NOTHING';
    }
  }

  return { sql: finalSql, params: finalParams };
}

const db = {
  exec(sql) {
    const translated = translateQueryAndParams(sql);
    runPgQuerySync(translated.sql);
  },
  prepare(sql) {
    return {
      run(...params) {
        const translated = translateQueryAndParams(sql, params);
        const rows = runPgQuerySync(translated.sql, translated.params);
        return { changes: rows ? rows.length : 0, lastInsertRowid: null };
      },
      get(...params) {
        const translated = translateQueryAndParams(sql, params);
        const rows = runPgQuerySync(translated.sql, translated.params);
        return rows && rows.length > 0 ? rows[0] : undefined;
      },
      all(...params) {
        const translated = translateQueryAndParams(sql, params);
        return runPgQuerySync(translated.sql, translated.params) || [];
      }
    };
  },
  transaction(fn) {
    return (...args) => {
      runPgQuerySync('BEGIN');
      try {
        const res = fn(...args);
        runPgQuerySync('COMMIT');
        return res;
      } catch (err) {
        runPgQuerySync('ROLLBACK');
        throw err;
      }
    };
  },
  pragma(statement) {
    const match = /table_info\(([^)]+)\)/i.exec(statement);
    if (match) {
      const tableName = match[1].toLowerCase();
      const sql = `SELECT column_name as name FROM information_schema.columns WHERE table_name = $1`;
      try {
        const rows = runPgQuerySync(sql, [tableName]);
        return rows || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }
};

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
    io_id TEXT,
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

  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    complaint_number TEXT UNIQUE NOT NULL,
    complainant_name TEXT NOT NULL,
    complainant_father_name TEXT,
    complainant_dob TEXT,
    complainant_nationality TEXT DEFAULT 'INDIA',
    complainant_phone TEXT,
    complainant_occupation TEXT,
    complainant_present_address TEXT,
    complainant_permanent_address TEXT,
    complainant_uid TEXT,
    district TEXT,
    police_station TEXT,
    complaint_text TEXT,
    incident_place TEXT,
    incident_date TEXT,
    status TEXT DEFAULT 'pending',
    registered_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_io_id TEXT,
    assigned_io_name TEXT,
    io_status TEXT DEFAULT 'Pending',
    original_station TEXT,
    raw_data TEXT
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
  const hasIoId = tableInfo.some(col => col.name === 'io_id');
  if (!hasIoId) {
    db.exec(`ALTER TABLE firs ADD COLUMN io_id TEXT;`);
    console.log('Added io_id column to firs table.');
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

const DISTRICTS_STATIONS = {
  'AMBALA': ['AMBALA CANTT','AMBALA CITY','AMBALA SADAR','BALDEV NAGAR','BARARA','MAHESH NAGAR','MULLANA','NAGGAL','NARAINGARH','PANJOKHRA','PARAO AMBALA CANTT','SAHA','SECTOR-9 AMBALA CITY','SHAHZADPUR','WOMEN POLICE STATION NARAINGARH AMBALA','WOMEN POLICE STATION AMBALA'],
  'BHIWANI': ['BAWANI KHERA','BEHAL','BHIWANI CITY','BHIWANI CIVIL LINES','BHIWANI SADAR','BOND KALAN','DADRI CITY','DADRI SADAR','JUI KALAN PS BHIWANI','LOHARU','PS INDUSTRIAL AREA BHIWANI','SIWANI','TOSHAM','WOMEN POLICE STATION BHIWANI'],
  'CHARKHI DADRI': ['BADHRA','BOND KALAN','DADRI CITY','DADRI SADAR','JHOJHU KALAN','WOMEN POLICE STATION CHARKHI DADRI'],
  'FARIDABAD': ['ADARSH NAGAR','BALLABHGARH CITY','BALLABHGARH SADAR','BHUPANI','CHHANSA','DABUA','DHAUJ','FARIDABAD CENTRAL','FARIDABAD KOTWALI','FARIDABAD N.I.T.','FARIDABAD OLD','KHERIPUL','METRO POLICE STATION FARIDABAD','MUJESAR','PALLA','POLICE STATION B.P.T.P.','S.G.M. NAGAR','SARAI KHAWAJA','SARAN','SECTOR-8','SECTOR-17','SECTOR-31 FARIDABAD','SECTOR-58','SURAJ KUND','TIGAON','WOMEN POLICE STATION BALLABGARH','WOMEN POLICE STATION NIT FARIDABAD','WOMEN POLICE STATION FARIDABAD'],
  'FATEHABAD': ['BHATTU KALAN','BHUNA','CITY FATEHABAD','CITY RATIA','CITY TOHANA','JAKHAL','SADAR FATEHABAD','SADAR RATTIA','SADAR TOHANA','WOMEN POLICE STATION FATEHABAD'],
  'GURUGRAM': ['BADSHAHPUR','BAJGHERA','BHONDSI','BILASPUR GURUGRAM','CITY SOHANA','CIVIL LINES GURGAON','DLF','DLF PH-3RD','DLF PHASE-1','DLF-II','FURRUKH NAGAR','GURGAON CITY','GURGAON SADAR','INDUSTRIAL SECTOR-7 MANESAR','KHEDKI DAULA','MANESAR','METRO','NEW COLONY','PALAM VIHAR','PATAUDI','PS CYBER MANESAR','RAJENDRA PARK','SECTOR-37','SECTOR-50','SECTOR-53','SECTOR-9A','SECTOR-10','SECTOR-14 GURUGRAM','SOHNA','SUSHANT LOK','UDYOG VIHAR','WOMEN POLICE STATION GURGAON'],
  'HANSI': ['BASS','HANSI CITY','HANSI SADAR','NARNAUND','PS CYBER CRIME HANSI','WOMEN POLICE STATION HANSI'],
  'HISAR': ['ADAMPUR','AGROHA','AZAD NAGAR HISAR','BARWALA','CYBER CRIME POLICE STATION HISAR','HISAR CITY','HISAR CIVIL LINES','HISAR SADAR','HTM HISAR','UKLANA','URBAN ESTATE HISAR','WOMEN POLICE STATION HISSAR'],
  'JHAJJAR': ['ASAUDA','BADLI','BERI','CITY BAHADURGARH','CITY JHAJJAR','DUJANA','LINE PAR BAHADURGARH','MACHHROLI','PS CYBER JHAJJAR','SADAR BAHADURGARH','SADAR JHAJJAR','SAHLAWAS','SECTOR-06 BAHADURGARH','WOMEN POLICE STATION JHAJJAR','WOMEN PS BAHADURGARH JHAJJAR'],
  'JIND': ['ALEWA','CITY SAFIDON','CIVIL LINE JIND','GARHI','JIND CITY','JIND SADAR','JULANA','NARWANA CITY','NARWANA SADAR','PILLU KHERA','SAFIDON','UCHANA','WOMEN POLICE STATION JIND'],
  'KAITHAL': ['CHEEKA','CIVIL LINE KAITHAL','DHAND','GUHLA','KAITHAL CITY','KAITHAL SADAR','KALAYAT','PUNDRI','RAJAUND','SIWAN','TITRAM','WOMEN POLICE STATION KAITHAL'],
  'KARNAL': ['ASSANDH','BUTANA','CYBER CRIME POLICE STATION KARNAL','GHARAUNDA','INDRI','KARNAL CITY','KARNAL CIVIL LINES','KARNAL SADAR','KUNJPURA','MADHUBAN','MUNAK KARNAL','NIGDHU KARNAL','NISSING','RAM NAGAR KARNAL','TARAORI','WOMEN POLICE STATION KARNAL'],
  'KURUKSHETRA': ['BABAIN','CYBER CRIME POLICE STATION KURUKSHETRA','ISMAILABAD','JHANSA','LADWA','PEHOWA','SHAHABAD','THANESAR CITY','THANESAR SADAR','WOMEN POLICE STATION KURUKSHETRA'],
  'MAHENDERGARH': ['ATELI','CITY KANINA','CITY MAHENDERGARH','CITY NARNAUL','NANGAL CHAUDHRI','NIZAMPUR','SADAR KANINA','SADAR MAHENDERGARH','SADAR NARNAUL','SATNALI','WOMEN POLICE STATION NARNAUL'],
  'NUH': ['BICCHOR','CITY NUH','CITY TAURU','FEROZEPUR JHIRKA','NAGINA','PINANGWA','PS CITY PUNHANA','PS MOHAMMADPUR AHIR','PUNHANA','ROZKA MEO','SADAR NUH','SADAR TAURU','WOMEN POLICE STATION MEWAT'],
  'PALWAL': ['BAHIN','CAMP PALWAL','CHAND HUT','CITY PALWAL','GADPURI','HASSANPUR','HATHIN','HODAL','MUNDKATI','SADAR PALWAL','UTAWAR','WOMEN POLICE STATION PALWAL'],
  'PANCHKULA': ['CHANDIMANDIR','CYBER CRIME','KALKA','MANSA DEVI COMPLEX','PANCHKULA SECTOR-5','PINJORE','RAIPUR RANI','SECTOR-14 PANCHKULA','SECTOR-20','SECTOR-7 PANCHKULA','WOMEN POLICE STATION PANCHKULA'],
  'PANIPAT': ['BAPOLI','CHANDNIBAGH','CYBER CRIME POLICE STATION PANIPAT','INDUSTRIAL SECTOR 29 PANIPAT','ISRANA','MATLAUDA','MODEL TOWN PANIPAT','OLD INDUSTRIAL PANIPAT','PANIPAT CITY','PANIPAT SADAR','QUILLA PANIPAT','SAMALKHA','SANOLI','SECTOR 13/17 PANIPAT','TEHSIL CAMP PANIPAT','WOMEN POLICE STATION PANIPAT'],
  'REWARI': ['BAWAL','DHARUHERA','JATUSANA','KASOLA','KHOL','KOSLI','MODEL TOWN REWARI','RAMPURA','REWARI CITY','REWARI SADAR','ROHADAI','SEC-6 DHARUHERA','WOMEN POLICE STATION REWARI'],
  'ROHTAK': ['ARYA NAGAR ROHTAK','BAHUAKBARPUR','CYBER POLICE STATION ROHTAK','I.M.T. ROHTAK','KALANAUR','LAKHAN MAJRA','MEHAM','P.G.I.M.S. ROHTAK','PURANI SABZI MANDI ROHTAK','ROHTAK CITY','ROHTAK CIVIL LINES','ROHTAK SADAR','SAMPLA','SHIVAJI COLONY','URBAN ESTATE ROHTAK','WOMEN POLICE STATION ROHTAK'],
  'SIRSA': ['CITY MANDI DABWALI','CYBER CRIME POLICE STATION SIRSA','DABWALI SADAR','DING','ELLENABAD','KALAN WALI','NATHU SARAI CHOPTA','ODHAN','POLICE STATION CIVIL LINE SIRSA','RANIA','RORI','SIRSA CITY','SIRSA SADAR','WOMEN POLICE STATION SIRSA'],
  'SONIPAT': ['BAHALGARH','BARAUDA','CIVIL LINE SONIPAT','GANNAUR','GOHANA CITY','GOHANA SADAR','HSIDC BARHI','KHARKHODA','KUNDLI','MOOHANA','MURTHAL','RAI','SECTOR-27 SONIPAT','SONIPAT CITY','SONIPAT SADAR','WOMEN POLICE STATION SONIPAT'],
  'YAMUNANAGAR': ['BILASPUR','BURIA','CHHACHHRAULI','CHHAPAR','CYBER CRIME POLICE STATION YAMUNANAGAR','FARAKPUR','GANDHI NAGAR YAMUNANAGAR','JAGADDHRI SADAR','JAGADHRI CITY','JATHLANA','PRATAP NAGAR','RADAUR','SADHAURA','WOMEN POLICE STATION YAMUNA NAGAR','YAMUNA NAGAR CITY','YAMUNA NAGAR SADAR'],
  'DABWALI': ['BARAGUDHA', 'CITY MANDI DABWALI', 'DABWALI SADAR', 'KALAN WALI', 'ODHAN', 'RORI', 'WOMEN POLICE STATION DABWALI SIRSA'],
  'STATE CRIME BRANCH': ['NODAL CYBER CRIME POLICE STATION HARYANA'],
  'HSENB': [
    'HSENB POLICE STATION AMBALA', 'HSENB POLICE STATION FARIDABAD',
    'HSENB POLICE STATION GURUGRAM', 'HSENB POLICE STATION HISAR',
    'HSENB POLICE STATION JIND', 'HSENB POLICE STATION KARNAL',
    'HSENB POLICE STATION REWARI', 'HSENB POLICE STATION ROHTAK',
    'PS HSENB BHIWANI', 'PS HSENB CHARKHI DADRI', 'PS HSENB FATEHABAD',
    'PS HSENB JHAJJAR', 'PS HSENB KAITHAL', 'PS HSENB KURUKSHETRA',
    'PS HSENB MAHENDERGARH', 'PS HSENB NUH', 'PS HSENB PALWAL',
    'PS HSENB PANCHKULA', 'PS HSENB PANIPAT', 'PS HSENB SIRSA',
    'PS HSENB SONIPAT', 'PS HSENB YAMUNANAGAR',
  ],
  'HSNCB': [
    'HSNCB UNIT AMBALA', 'HSNCB UNIT BHIWANI', 'HSNCB UNIT FARIDABAD',
    'HSNCB UNIT FATEHABAD', 'HSNCB UNIT GURUGRAM', 'HSNCB UNIT HISAR',
    'HSNCB UNIT KARNAL', 'HSNCB UNIT KURUKSHETRA', 'HSNCB UNIT REWARI',
    'HSNCB UNIT ROHTAK', 'HSNCB UNIT SIRSA',
  ],
};

const IO_NAMES = [
  'Rajesh Kumar','Suresh Singh','Amit Sharma','Vikas Yadav','Rohit Verma',
  'Sandeep Chauhan','Pankaj Malik','Deepak Nain','Rakesh Hooda','Manoj Dahiya',
  'Vinod Kumar','Kuldeep Singh','Harish Dewan','Satish Garg','Naresh Dhull',
  'Ramesh Saini','Ajay Rana','Sanjay Bishnoi','Naveen Arora','Pradeep Goel',
];

// Seed profiles
const profileCount = db.prepare('SELECT COUNT(*) as c FROM profiles').get().c;
if (profileCount === 0) {
  const insertProfile = db.prepare(`
    INSERT INTO profiles (id, username, password, role, full_name, badge_number, rank, station_id)
    VALUES (@id, @username, @password, @role, @full_name, @badge_number, @rank, @station_id)
  `);
  const seedProfiles = [
    { id: 'usr-1', username: 'admin', password: 'admin123', role: 'admin', full_name: 'Test Admin', badge_number: 'ADM-001', rank: 'SP', station_id: 'hq' },
    { id: 'usr-2', username: 'io_1', password: 'io123', role: 'io', full_name: 'Investigating Officer Singh', badge_number: 'IO-101', rank: 'SI', station_id: 'SAMALKHA' },
    { id: 'usr-3', username: 'sho_1', password: 'sho123', role: 'sho', full_name: 'SHO Kumar', badge_number: 'SHO-201', rank: 'Inspector', station_id: 'SAMALKHA' },
  ];
  db.transaction((rows) => rows.forEach(r => insertProfile.run(r)))(seedProfiles);
  console.log('Seed profiles created.');
}

// Auto-seed SHOs if they don't exist
const shoCount = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE role = 'sho'").get().c;
if (shoCount <= 1) {
  console.log('Auto-seeding SHOs...');
  const seenUsernames = new Set();
  const existingUsernames = db.prepare(`SELECT username FROM profiles WHERE role = 'sho'`).all().map(r => r.username);
  existingUsernames.forEach(u => seenUsernames.add(u));

  const uniqueUsername = (base) => {
    if (!seenUsernames.has(base)) { seenUsernames.add(base); return base; }
    let i = 2;
    while (seenUsernames.has(`${base}_${i}`)) i++;
    seenUsernames.add(`${base}_${i}`);
    return `${base}_${i}`;
  };

  const toSHOUsername = (district, station) => {
    const d = district.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 8);
    const s = station.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    return `sho_${d}_${s}`;
  };

  const insertSHO = db.prepare(`
    INSERT INTO profiles (id, username, password, role, full_name, badge_number, rank, station_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  db.transaction(() => {
    for (const [district, stations] of Object.entries(DISTRICTS_STATIONS)) {
      for (const station of stations) {
        const baseUsername = toSHOUsername(district, station);
        const existingSHO = db.prepare(`SELECT id FROM profiles WHERE role = 'sho' AND station_id = ?`).get(station);
        if (existingSHO) continue;

        const username = uniqueUsername(baseUsername);
        const rand = Math.random().toString(36).slice(2, 6);
        const id = `sho-${district.slice(0,3).toLowerCase().replace(/[^a-z]/g,'')}-${rand}`;
        const badgeNo = `SHO-${district.slice(0,3).toUpperCase().replace(/[^A-Z]/g,'')}-${station.slice(0,6).replace(/[^A-Z0-9]/gi,'').toUpperCase()}`;
        const fullName = `SHO ${station}`;

        insertSHO.run(id, username, 'sho123', 'sho', fullName, badgeNo, 'Inspector', station);
      }
    }
  })();
  console.log('SHOs auto-seeded successfully.');
}

// Auto-seed IOs if they don't exist
const ioCount = db.prepare("SELECT COUNT(*) as c FROM profiles WHERE role = 'io'").get().c;
if (ioCount <= 1) {
  console.log('Auto-seeding IOs...');
  const toIOUsername = (district, station, num) => {
    const d = district.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 8);
    const s = station.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 25);
    return `io_${d}_${s}_${num}`;
  };

  const insertIO = db.prepare(`
    INSERT INTO profiles (id, username, password, role, full_name, badge_number, rank, station_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  let nameIdx = 0;
  db.transaction(() => {
    for (const [district, stations] of Object.entries(DISTRICTS_STATIONS)) {
      for (const station of stations) {
        for (let n = 1; n <= 2; n++) {
          const username = toIOUsername(district, station, n);
          const existing = db.prepare('SELECT id FROM profiles WHERE username = ?').get(username);
          if (existing) continue;

          const rand = Math.random().toString(36).slice(2, 6);
          const id = `io-${district.slice(0,3).toLowerCase().replace(/[^a-z]/g,'')}-${rand}-${n}`;
          const name = IO_NAMES[nameIdx % IO_NAMES.length];
          nameIdx++;
          const badgeNo = `IO-${district.slice(0,3).toUpperCase().replace(/[^A-Z]/g,'')}-${n.toString().padStart(3,'0')}`;

          insertIO.run(id, username, 'io123', 'io', name, badgeNo, 'Sub-Inspector (SI)', station);
        }
      }
    }
  })();
  console.log('IOs auto-seeded successfully.');
}

// --- Seed analysis data ---
const caseCount = db.prepare('SELECT COUNT(*) as c FROM cases').get().c;
if (caseCount === 0) {
  // Insert cases
  db.prepare(`INSERT INTO cases (id, title, case_type, status, offense_section, station_id, io_id, registered_at, description)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'case-001', 'Mobile Theft – Sector 14 Market', 'complaint', 'open',
    'BNS 303', 'SAMALKHA', 'usr-2', '2026-04-01 10:30:00',
    'Complainant Ramesh Kumar reports theft of iPhone 14 from busy market area. Suspects fled on motorcycle.'
  );
  db.prepare(`INSERT INTO cases (id, title, case_type, status, offense_section, station_id, io_id, registered_at, description)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'case-002', 'FIR – Cyber Fraud ₹2.5 Lakh', 'fir', 'investigation',
    'BNS 318, IT Act 66C', 'SAMALKHA', 'usr-2', '2026-03-20 14:00:00',
    'Victim Priya Sharma transferred ₹2.5 lakh after receiving fraudulent call from "bank official". Multiple accused involved.'
  );
  db.prepare(`INSERT INTO cases (id, title, case_type, status, offense_section, station_id, io_id, registered_at, description)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'case-003', 'FIR – Drug Peddling (NDPS)', 'fir', 'challan',
    'NDPS Act 20(b)(ii)', 'SAMALKHA', 'usr-3', '2026-02-10 09:15:00',
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

// Insert seed complaints if complaints table is empty
const complaintCount = db.prepare('SELECT COUNT(*) as c FROM complaints').get().c;
if (complaintCount === 0) {
  const insertComplaint = db.prepare(`
    INSERT INTO complaints (
      id, complaint_number, complainant_name, complainant_father_name, complainant_dob,
      complainant_nationality, complainant_phone, complainant_occupation,
      complainant_present_address, complainant_permanent_address, complainant_uid,
      district, police_station, complaint_text, incident_place, incident_date, status,
      assigned_io_id, assigned_io_name, io_status, original_station, raw_data
    ) VALUES (
      @id, @complaint_number, @complainant_name, @complainant_father_name, @complainant_dob,
      @complainant_nationality, @complainant_phone, @complainant_occupation,
      @complainant_present_address, @complainant_permanent_address, @complainant_uid,
      @district, @police_station, @complaint_text, @incident_place, @incident_date, @status,
      @assigned_io_id, @assigned_io_name, @io_status, @original_station, @raw_data
    )
  `);

  const seedComplaints = [
    {
      id: 'cmp-001', complaint_number: 'CMP/2026/0001',
      complainant_name: 'Ramesh Kumar Sharma', complainant_father_name: 'Suresh Kumar Sharma',
      complainant_dob: '15/04/1985', complainant_nationality: 'INDIA',
      complainant_phone: '9876543210', complainant_occupation: 'Farmer',
      complainant_present_address: 'H.No. 45, Village Samalkha, Panipat, Haryana',
      complainant_permanent_address: 'H.No. 45, Village Samalkha, Panipat, Haryana',
      complainant_uid: '123456789012',
      district: 'PANIPAT', police_station: 'SAMALKHA',
      complaint_text: 'Complainant Ramesh Kumar Sharma states that on the night of 20/04/2026, unknown persons broke into his house and stole cash of Rs. 50,000, gold jewellery worth Rs. 2,00,000 and a mobile phone. The incident occurred while the family was away. He requests registration of FIR and investigation of the matter.',
      incident_place: 'H.No. 45, Village Samalkha, Panipat, Haryana', incident_date: '2026-04-20',
      status: 'pending'
    },
    {
      id: 'cmp-002', complaint_number: 'CMP/2026/0002',
      complainant_name: 'Sunita Devi', complainant_father_name: 'Mohan Lal',
      complainant_dob: '1978', complainant_nationality: 'INDIA',
      complainant_phone: '8765432109', complainant_occupation: 'Housewife',
      complainant_present_address: 'Ward No. 5, Rohtak City, Haryana',
      complainant_permanent_address: 'Ward No. 5, Rohtak City, Haryana',
      complainant_uid: '987654321098',
      district: 'ROHTAK', police_station: 'ROHTAK CITY',
      complaint_text: 'Complainant Sunita Devi states that her neighbour Dinesh Kumar has been harassing her family for the past 3 months regarding a property dispute. On 21/04/2026, he along with 2 other persons came to her house and abused and threatened her. She seeks police action against the accused persons.',
      incident_place: 'Ward No. 5, Near Bus Stand, Rohtak', incident_date: '2026-04-21',
      status: 'pending'
    },
    {
      id: 'cmp-003', complaint_number: 'CMP/2026/0003',
      complainant_name: 'Harpal Singh', complainant_father_name: 'Gurdev Singh',
      complainant_dob: '03/07/1979', complainant_nationality: 'INDIA',
      complainant_phone: '7654321098', complainant_occupation: 'Shopkeeper',
      complainant_present_address: 'Shop No. 12, Model Town, Ambala City, Haryana',
      complainant_permanent_address: 'H.No. 78, Sector-9, Ambala City, Haryana',
      complainant_uid: '456789012345',
      district: 'AMBALA', police_station: 'AMBALA CITY',
      complaint_text: 'Complainant Harpal Singh states that he runs a general store in Model Town Ambala. On 22/04/2026 at around 11:30 PM, two unknown persons came on a motorcycle and snatched his bag containing Rs. 35,000 cash and important documents near Model Town market. He could not identify the accused as they were wearing helmets.',
      incident_place: 'Near Model Town Market, Ambala City', incident_date: '2026-04-22',
      status: 'pending'
    },
    {
      id: 'cmp-004', complaint_number: 'CMP/2026/0004',
      complainant_name: 'Vijay Kumar Yadav', complainant_father_name: 'Ram Kishore Yadav',
      complainant_dob: '1990', complainant_nationality: 'INDIA',
      complainant_phone: '9988776655', complainant_occupation: 'Driver',
      complainant_present_address: 'Village Kundli, Sonipat, Haryana',
      complainant_permanent_address: 'Village Kundli, Sonipat, Haryana',
      complainant_uid: '321654987012',
      district: 'SONIPAT', police_station: 'KUNDLI',
      complaint_text: 'Complainant Vijay Kumar Yadav states that he was driving his truck (HR 01 GA 1234) when a group of 5 persons blocked his way near HSIDC area at night and forcibly took away goods worth Rs. 1,50,000 from his truck at gunpoint on 23/04/2026. He managed to escape and inform police.',
      incident_place: 'HSIDC Industrial Area, Kundli, Sonipat', incident_date: '2026-04-23',
      status: 'pending'
    },
    {
      id: 'cmp-005', complaint_number: 'CMP/2026/0005',
      complainant_name: 'Meena Kumari Agarwal', complainant_father_name: 'Shyam Lal Agarwal',
      complainant_dob: '22/11/1995', complainant_nationality: 'INDIA',
      complainant_phone: '9123456780', complainant_occupation: 'Teacher',
      complainant_present_address: 'Flat No. 303, Sector-14, Gurugram, Haryana',
      complainant_permanent_address: 'H.No. 5, Lajpat Nagar, Jind, Haryana',
      complainant_uid: '654321987654',
      district: 'GURUGRAM', police_station: 'SECTOR-14 GURUGRAM',
      complaint_text: 'Complainant Meena Kumari Agarwal states that she received a call from an unknown number claiming to be a bank official. The caller fraudulently obtained her ATM card details and OTP and transferred Rs. 75,000 from her savings account on 20/04/2026. She has bank transaction proof and call records available.',
      incident_place: 'Flat No. 303, Sector-14, Gurugram (Online Fraud)', incident_date: '2026-04-20',
      status: 'pending'
    },
  ];

  const seedComplaintsWithRaw = seedComplaints.map(c => {
    const nameParts = c.complainant_name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    const rawRecord = {
      id: c.id,
      registrationDate: new Date().toISOString(),
      dateRegistered: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      firstName,
      lastName,
      mobileNumber: c.complainant_phone,
      gender: 'Male',
      natureOfComplaint: 'Citizen/General Public',
      typeOfAccused: 'Against Private Person',
      villageTown: c.complainant_present_address,
      district: c.district,
      state: 'Haryana',
      nationality: c.complainant_nationality || 'INDIA',
      idType: 'Aadhar Card',
      idNumber: c.complainant_uid,
      classOfIncident: c.id === 'cmp-005' ? 'Cyber Financial Fraud' : 'Other IPC/BNS Crimes',
      placeOfIncident: c.incident_place,
      dateOfIncident: c.incident_date,
      dateOfComplaint: c.incident_date,
      typeOfComplaint: 'Fresh Complaint',
      typeOfComplainant: 'Private Person',
      complaintPurpose: 'FIR Registration',
      isFirRegistered: 'No',
      modeOfReceipt: 'In-Person/By Hand',
      descriptionOfComplaint: c.complaint_text,
      ioStatus: 'Pending',
      policeStation: c.police_station,
      originalStation: c.police_station,
      assignedIoId: null,
      assignedIoName: null,
      accusedList: []
    };

    return {
      ...c,
      assigned_io_id: null,
      assigned_io_name: null,
      io_status: 'Pending',
      original_station: c.police_station,
      raw_data: JSON.stringify(rawRecord)
    };
  });

  const txn = db.transaction((complaints) => {
    for (const c of complaints) insertComplaint.run(c);
  });
  txn(seedComplaintsWithRaw);
  console.log('Seed complaints created.');
}

export default db;
