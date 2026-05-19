import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import db from './db.js';
import multer from 'multer';

// Setup multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = 3000;
const JWT_SECRET = 'local-dev-secret-haryana-police-123';

app.use(cors());
app.use(express.json());

// Helper middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Login Route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM profiles WHERE username = ?').get(username);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate an access token
  const token = jwt.sign(
    { 
      id: user.id, 
      username: user.username,
      role: user.role
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
  );

  // Return user details without password
  const { password: _, ...userData } = user;
  
  res.json({
    token,
    user: userData
  });
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { password: _, ...userData } = user;
  res.json(userData);
});

// =====================
// FIR ROUTES
// =====================

// Helper: generate FIR number (e.g. 0175 for 175th FIR in year 2026)
function generateFIRNumber(year) {
  const count = db.prepare('SELECT COUNT(*) as c FROM firs WHERE year = ?').get(year)?.c || 0;
  return String(count + 1).padStart(4, '0');
}

// GET /api/firs - List all FIRs
app.get('/api/firs', authenticateToken, (req, res) => {
  try {
    const { status, district, complaint_id, gd_entry_no } = req.query;
    let query = `
      SELECT f.id, f.fir_number, f.district, f.police_station, f.year,
             f.date_time_of_fir, f.acts_sections, f.complainant_name,
             f.place_address, f.status, f.io_name, f.io_rank,
             f.created_at, p.full_name as registered_by_name,
             f.complaint_id, f.gd_entry_no
      FROM firs f
      LEFT JOIN profiles p ON f.registered_by = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }
    if (district) {
      query += ' AND f.district = ?';
      params.push(district);
    }
    if (complaint_id) {
      query += ' AND f.complaint_id = ?';
      params.push(complaint_id);
    }
    if (gd_entry_no) {
      query += ' AND f.gd_entry_no = ?';
      params.push(gd_entry_no);
    }

    query += ' ORDER BY f.created_at DESC';

    const firs = db.prepare(query).all(...params);
    res.json(firs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/firs - Register new FIR
app.post('/api/firs', authenticateToken, (req, res) => {
  const allowed = ['io', 'sho', 'admin'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only IO, SHO or Admin can register a FIR' });
  }

  const d = req.body;
  const year = new Date().getFullYear();
  const firNumber = generateFIRNumber(year);
  const id = `fir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    db.prepare(`
      INSERT INTO firs (
        id, fir_number, district, police_station, year, date_time_of_fir,
        acts_sections, occurrence_day, occurrence_date_from, occurrence_date_to,
        occurrence_time_period, occurrence_time_from, occurrence_time_to,
        info_received_date, info_received_time, gd_entry_no, gd_date_time,
        info_type, place_direction, place_distance, beat_no, place_address,
        latitude, longitude, outside_ps_name, outside_district,
        complainant_name, complainant_father_name, complainant_dob, complainant_nationality,
        complainant_uid, complainant_passport, complainant_id_details,
        complainant_occupation, complainant_present_address, complainant_permanent_address,
        complainant_phone, accused_details, delay_reason, property_details,
        total_property_value, fir_content, io_name, io_rank, io_no,
        refused_reason, transferred_ps, transferred_district,
        officer_name, officer_rank, officer_no, dispatch_date_time,
        registered_by, complaint_id
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `).run(
      id, firNumber, d.district, d.police_station, year, d.date_time_of_fir,
      JSON.stringify(d.acts_sections || []),
      d.occurrence_day, d.occurrence_date_from, d.occurrence_date_to,
      d.occurrence_time_period, d.occurrence_time_from, d.occurrence_time_to,
      d.info_received_date, d.info_received_time, d.gd_entry_no, d.gd_date_time,
      d.info_type || 'Written',
      d.place_direction, d.place_distance, d.beat_no, d.place_address,
      d.latitude, d.longitude, d.outside_ps_name, d.outside_district,
      d.complainant_name, d.complainant_father_name, d.complainant_dob,
      d.complainant_nationality || 'INDIA', d.complainant_uid, d.complainant_passport,
      JSON.stringify(d.complainant_id_details || []),
      d.complainant_occupation, d.complainant_present_address, d.complainant_permanent_address,
      d.complainant_phone,
      JSON.stringify(d.accused_details || []),
      d.delay_reason,
      JSON.stringify(d.property_details || []),
      d.total_property_value || 0,
      d.fir_content,
      d.io_name, d.io_rank, d.io_no,
      d.refused_reason, d.transferred_ps, d.transferred_district,
      d.officer_name, d.officer_rank, d.officer_no, d.dispatch_date_time,
      req.user.id, d.complaint_id
    );

    res.status(201).json({
      id,
      fir_number: firNumber,
      message: `FIR ${firNumber}/${year} registered successfully`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/firs/stats/summary - Summary stats for M5 Case Analysis
app.get('/api/firs/stats/summary', authenticateToken, (req, res) => {
  try {
    const totalCount = db.prepare('SELECT COUNT(*) as c FROM firs').get().c;
    const byStatus = db.prepare('SELECT status, COUNT(*) as c FROM firs GROUP BY status').all();
    const byDistrict = db.prepare('SELECT district, COUNT(*) as c FROM firs GROUP BY district').all();

    const statusObj = {};
    byStatus.forEach(r => { statusObj[r.status] = r.c; });

    const districtObj = {};
    byDistrict.forEach(r => { districtObj[r.district] = r.c; });

    res.json({
      total: totalCount,
      by_status: statusObj,
      by_district: districtObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/firs/map/locations - Location data for M7 Crime Map
app.get('/api/firs/map/locations', authenticateToken, (req, res) => {
  try {
    const locations = db.prepare(`
      SELECT id, fir_number, place_address, district, police_station, date_time_of_fir, latitude, longitude
      FROM firs
      WHERE place_address IS NOT NULL AND place_address != ''
    `).all();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/firs/search - Search across FIRs for M6 Smart Search
app.get('/api/firs/search', authenticateToken, (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const searchTerm = `%${q}%`;
    const results = db.prepare(`
      SELECT id, fir_number, complainant_name, district, police_station, fir_content
      FROM firs
      WHERE fir_number LIKE ? OR complainant_name LIKE ? OR fir_content LIKE ?
      LIMIT 20
    `).all(searchTerm, searchTerm, searchTerm);
    
    // Format for M6 search module
    const formatted = results.map(r => ({
      id: r.id,
      fir_number: r.fir_number,
      complainant_name: r.complainant_name,
      module: 'fir' // So search module knows it's an FIR
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/firs/:id/link-complaint - Link an existing M1 complaint to an FIR
app.patch('/api/firs/:id/link-complaint', authenticateToken, (req, res) => {
  try {
    const { complaint_id } = req.body;
    if (!complaint_id) return res.status(400).json({ error: 'complaint_id is required' });

    db.prepare('UPDATE firs SET complaint_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(complaint_id, req.params.id);
    res.json({ message: 'Complaint linked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/firs/:id - Single FIR detail
app.get('/api/firs/:id', authenticateToken, (req, res) => {
  try {
    const fir = db.prepare(`
      SELECT f.*, p.full_name as registered_by_name, p.rank as registered_by_rank
      FROM firs f
      LEFT JOIN profiles p ON f.registered_by = p.id
      WHERE f.id = ?
    `).get(req.params.id);
    if (!fir) return res.status(404).json({ error: 'FIR not found' });
    res.json(fir);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/firs/:id/status - Update FIR status (sho/admin only)
app.patch('/api/firs/:id/status', authenticateToken, (req, res) => {
  if (!['sho', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only SHO or Admin can update FIR status' });
  }
  const { status } = req.body;
  const validStatuses = ['registered', 'under_investigation', 'chargesheeted', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  db.prepare('UPDATE firs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated successfully' });
});

// POST /api/firs/extract-pdf - Extract FIR details from PDF (Mocked)
app.post('/api/firs/extract-pdf', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Simulate AI processing delay
  setTimeout(() => {
    // Return dummy data auto-filled from the "AI"
    res.json({
      complainant_name: 'Rahul Sharma',
      complainant_father_name: 'Ramesh Sharma',
      complainant_phone: '9876543210',
      complainant_present_address: 'House No 123, Model Town, Panipat, Haryana, INDIA',
      district: 'PANIPAT',
      police_station: 'MODEL TOWN',
      place_address: 'Near Old Bus Stand, Panipat',
      fir_content: 'This is an auto-generated narrative from the uploaded PDF document. A theft occurred at my residence...',
      date_time_of_fir: new Date().toISOString()
    });
  }, 2000);
});

// =====================
// INVESTIGATION ROUTES
// =====================

// CDRs
app.get('/api/firs/:id/cdrs', authenticateToken, (req, res) => {
  try {
    const cdrs = db.prepare('SELECT * FROM cdr_requests WHERE fir_id = ? ORDER BY updated_at DESC').all(req.params.id);
    res.json(cdrs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/firs/:id/cdrs', authenticateToken, (req, res) => {
  try {
    const { phone_number, tsp_name } = req.body;
    const cid = `cdr-${Date.now()}`;
    db.prepare(`
      INSERT INTO cdr_requests (id, fir_id, phone_number, tsp_name, requested_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(cid, req.params.id, phone_number, tsp_name, req.user.id);
    res.json({ id: cid, message: 'CDR Requested', status: 'requested' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/cdrs/:id/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE cdr_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Status updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Arrests
app.get('/api/firs/:id/arrests', authenticateToken, (req, res) => {
  try {
    const arrests = db.prepare('SELECT * FROM arrests WHERE fir_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(arrests);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/firs/:id/arrests', authenticateToken, (req, res) => {
  try {
    const {
      accused_name,
      accused_address,
      date_of_arrest,
      arrest_place,
      arresting_officer_name,
      arresting_officer_rank,
      arresting_officer_badge,
      arresting_officer_post,
      informed_person_name,
      informed_person_address,
      informed_person_phone,
      witness_name,
      witness_post
    } = req.body;

    const aid = `arr-${Date.now()}`;

    db.prepare(`
      INSERT INTO arrests (
        id, fir_id, accused_name, accused_address, date_of_arrest, arrest_place,
        arresting_officer_name, arresting_officer_rank, arresting_officer_badge, arresting_officer_post,
        informed_person_name, informed_person_address, informed_person_phone,
        witness_name, witness_post
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      aid, req.params.id, accused_name, accused_address, date_of_arrest, arrest_place,
      arresting_officer_name, arresting_officer_rank, arresting_officer_badge, arresting_officer_post,
      informed_person_name, informed_person_address, informed_person_phone,
      witness_name, witness_post
    );

    res.json({ id: aid, message: 'Arrest Recorded & Memo Generated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notices
app.get('/api/firs/:id/notices', authenticateToken, (req, res) => {
  try {
    const notices = db.prepare('SELECT * FROM notices WHERE fir_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(notices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/firs/:id/notices', authenticateToken, (req, res) => {
  try {
    const { notice_type, details } = req.body;
    const nid = `not-${Date.now()}`;
    const content = `NOTICE OF ${notice_type.toUpperCase()}\\nDetails: ${details}\\nFIR ID: ${req.params.id}\\nGenerated at ${new Date().toISOString()}`;
    db.prepare(`
      INSERT INTO notices (id, fir_id, notice_type, content)
      VALUES (?, ?, ?, ?)
    `).run(nid, req.params.id, notice_type, content);
    res.json({ id: nid, message: 'Notice Generated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Evidences
app.get('/api/firs/:id/evidences', authenticateToken, (req, res) => {
  try {
    const evidences = db.prepare('SELECT * FROM evidences WHERE fir_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(evidences);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/firs/:id/evidences', authenticateToken, (req, res) => {
  try {
    const {
      description,
      location,
      extra_details,
      media_file,
      item_id,
      seizure_date,
      seizure_place,
      witness_name,
      witness_badge,
      witness_post,
      officer_post,
      seizure_narrative
    } = req.body;
    const eid = `evd-${Date.now()}`;

    // migrate new columns if not present
    const tInfo = db.pragma('table_info(evidences)');
    const cols = tInfo.map(c => c.name);
    const newCols = [
      ['item_id','TEXT'], ['seizure_date','TEXT'], ['seizure_place','TEXT'],
      ['witness_name','TEXT'], ['witness_badge','TEXT'], ['witness_post','TEXT'],
      ['officer_post','TEXT'], ['seizure_narrative','TEXT']
    ];
    for (const [col, type] of newCols) {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE evidences ADD COLUMN ${col} ${type};`);
      }
    }

    db.prepare(`
      INSERT INTO evidences (
        id, fir_id, description, location, extra_details, media_file,
        item_id, seizure_date, seizure_place,
        witness_name, witness_badge, witness_post,
        officer_post, seizure_narrative
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eid, req.params.id, description, location, extra_details, media_file,
      item_id, seizure_date, seizure_place,
      witness_name, witness_badge, witness_post,
      officer_post, seizure_narrative
    );
    res.json({ id: eid, message: 'Evidence Recorded and Seizure Memo Generated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Challans
app.get('/api/firs/:id/challans', authenticateToken, (req, res) => {
  try {
    const challans = db.prepare('SELECT * FROM challans WHERE fir_id = ? ORDER BY generated_at DESC').all(req.params.id);
    res.json(challans);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/firs/:id/challans', authenticateToken, (req, res) => {
  try {
    const { io_notes } = req.body;
    const chid = `chal-${Date.now()}`;
    const reportText = `FINAL REPORT UNDER SECTION 173 CRPC\\nFIR ID: ${req.params.id}\\nIO Remarks: ${io_notes}\\nTimestamp: ${new Date().toISOString()}`;
    db.prepare(`
      INSERT INTO challans (id, fir_id, io_notes, final_report)
      VALUES (?, ?, ?, ?)
    `).run(chid, req.params.id, io_notes, reportText);
    
    // Auto-update FIR status to chargesheeted
    db.prepare('UPDATE firs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('chargesheeted', req.params.id);
    
    res.json({ id: chid, message: 'Challan Generated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Case Diaries
app.get('/api/firs/:id/case-diaries', authenticateToken, (req, res) => {
  try {
    const diaries = db.prepare('SELECT * FROM case_diaries WHERE fir_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(diaries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/firs/:id/case-diaries', authenticateToken, (req, res) => {
  try {
    const { entry_text } = req.body;
    const cdid = `cd-${Date.now()}`;
    db.prepare(`
      INSERT INTO case_diaries (id, fir_id, entry_text)
      VALUES (?, ?, ?)
    `).run(cdid, req.params.id, entry_text);
    res.json({ id: cdid, message: 'Case Diary Entry Added Successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
