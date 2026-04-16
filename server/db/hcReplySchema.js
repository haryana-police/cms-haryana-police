export const initHcReplyDb = (db) => {
  // Petitions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_petitions (
      id TEXT PRIMARY KEY,
      court_name TEXT,
      petition_no TEXT,
      petition_type TEXT,
      petitioner_name TEXT,
      respondent_name TEXT,
      hearing_date DATETIME,
      police_station TEXT,
      district TEXT,
      file_name TEXT,
      file_path TEXT,
      extracted_text TEXT,
      extracted_prayer TEXT,
      extracted_grounds TEXT,
      extracted_allegations TEXT,
      extraction_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // HC Replies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_replies (
      id TEXT PRIMARY KEY,
      petition_id TEXT,
      reply_type TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      linked_fir TEXT,
      linked_complaint TEXT,
      linked_case TEXT,
      draft_content TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(petition_id) REFERENCES hc_petitions(id)
    );
  `);

  // Facts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_reply_facts (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL,
      fir_no TEXT,
      fir_date TEXT,
      police_station TEXT,
      district TEXT,
      sections TEXT,
      complainant_name TEXT,
      accused_names TEXT,
      investigation_stage TEXT,
      arrest_status TEXT,
      recovery_status TEXT,
      fsl_status TEXT,
      challan_status TEXT,
      trial_status TEXT,
      next_hearing_date TEXT,
      io_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(reply_id) REFERENCES hc_replies(id)
    );
  `);

  // Paragraphs
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_reply_paragraphs (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL,
      para_number INTEGER,
      petition_content TEXT,
      reply_content TEXT,
      FOREIGN KEY(reply_id) REFERENCES hc_replies(id)
    );
  `);

  // Versions
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_reply_versions (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL,
      version_number INTEGER,
      content TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(reply_id) REFERENCES hc_replies(id)
    );
  `);

  // Comments
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_reply_comments (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL,
      author_id TEXT,
      author_name TEXT,
      comment_type TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(reply_id) REFERENCES hc_replies(id)
    );
  `);

  // Audit logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_reply_audit_logs (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(reply_id) REFERENCES hc_replies(id)
    );
  `);

  // Attachments
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_reply_attachments (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL,
      file_name TEXT,
      file_path TEXT,
      file_type TEXT,
      source_type TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(reply_id) REFERENCES hc_replies(id)
    );
  `);

  // Templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS hc_reply_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      reply_type TEXT,
      content TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default templates if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM hc_reply_templates').get().c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO hc_reply_templates (id, title, reply_type, content)
      VALUES (@id, @title, @reply_type, @content)
    `);
    
    insert.run({
      id: 'tpl-1',
      title: 'Standard Status Report',
      reply_type: 'status_report',
      content: `IN THE HON'BLE PUNJAB AND HARYANA HIGH COURT AT CHANDIGARH

[PETITION_NO]
[PETITIONER_NAME] ...Petitioner
Vs.
[RESPONDENT_NAME] ...Respondent

RESPECTFULLY SHOWETH:
1. That the present factual report is being submitted in response to...`
    });

    insert.run({
      id: 'tpl-2',
      title: 'Basic Para-wise Reply',
      reply_type: 'para_wise_reply',
      content: `PARA-WISE REPLY ON BEHALF OF RESPONDENT STATE

Preliminary Objections:
1. That the present petition is not maintainable...

On Merits:
1. That the contents of para 1 are...`
    });
    console.log('Seed templates created.');
  }

  // Schema Migrations (Fail-safe for existing db)
  const runMigration = (sql) => { try { db.exec(sql); } catch(e) { /* ignore if column exists */ } };
  runMigration("ALTER TABLE hc_petitions ADD COLUMN file_name TEXT");
  runMigration("ALTER TABLE hc_petitions ADD COLUMN file_path TEXT");
  runMigration("ALTER TABLE hc_petitions ADD COLUMN extracted_text TEXT");
  runMigration("ALTER TABLE hc_petitions ADD COLUMN extracted_prayer TEXT");
  runMigration("ALTER TABLE hc_petitions ADD COLUMN extracted_grounds TEXT");
  runMigration("ALTER TABLE hc_petitions ADD COLUMN extracted_allegations TEXT");
  runMigration("ALTER TABLE hc_petitions ADD COLUMN extraction_status TEXT DEFAULT 'pending'");
  runMigration("ALTER TABLE hc_reply_attachments ADD COLUMN source_type TEXT DEFAULT 'manual'");

};
