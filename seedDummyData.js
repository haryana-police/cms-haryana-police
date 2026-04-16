import db from './server/db.js';

const seedData = () => {
  const transaction = db.transaction(() => {
    // Clean up existing dummy data first
    db.prepare("DELETE FROM hc_reply_paragraphs WHERE id LIKE 'dummy-%' OR reply_id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_reply_audit_logs WHERE id LIKE 'dummy-%' OR reply_id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_reply_facts WHERE id LIKE 'dummy-%' OR reply_id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_replies WHERE id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_petitions WHERE id LIKE 'dummy-%'").run();

    // 1. Insert Petitions
    const insertPetition = db.prepare(`
      INSERT INTO hc_petitions (
        id, court_name, petition_no, petition_type, petitioner_name, respondent_name, 
        hearing_date, police_station, district, file_name, file_path, 
        extracted_text, extracted_prayer, extracted_grounds, extracted_allegations, extraction_status
      )
      VALUES (
        @id, @court_name, @petition_no, @petition_type, @petitioner_name, @respondent_name, 
        @hearing_date, @police_station, @district, @file_name, @file_path, 
        @extracted_text, @extracted_prayer, @extracted_grounds, @extracted_allegations, 'completed'
      )
    `);

    const petitions = [
      { 
        id: 'dummy-pet-1', 
        court_name: 'Punjab & Haryana High Court', 
        petition_no: 'CRM-M-1234-2024', 
        petition_type: 'Bail Petition', 
        petitioner_name: 'Rahul Kumar', 
        respondent_name: 'State of Haryana', 
        hearing_date: '2024-06-15', 
        police_station: 'City Thanesar', 
        district: 'Kurukshetra',
        file_name: 'dummy-petition.pdf',
        file_path: 'uploads/dummy-petition.pdf',
        extracted_text: 'Full petition text about Rahul Kumar seeking regular bail in FIR 45/2024.',
        extracted_prayer: 'It is therefore respectfully prayed that the petitioner be released on regular bail.',
        extracted_grounds: 'That the petitioner has been falsely implicated and is in custody since 2 months.',
        extracted_allegations: 'Allegations of theft under Section 379 IPC.'
      },
      { 
        id: 'dummy-pet-2', 
        court_name: 'Punjab & Haryana High Court', 
        petition_no: 'CWP-5678-2024', 
        petition_type: 'Civil Writ', 
        petitioner_name: 'Anita Sharma', 
        respondent_name: 'State of Haryana & Ors', 
        hearing_date: '2024-07-20', 
        police_station: 'Sadar Karnal', 
        district: 'Karnal',
        file_name: 'dummy-petition.pdf',
        file_path: 'uploads/dummy-petition.pdf',
        extracted_text: 'Writ petition regarding service matters.',
        extracted_prayer: 'Prayer for issuance of writ in the nature of Mandamus.',
        extracted_grounds: 'Violation of Article 14 and 16.',
        extracted_allegations: 'Wrongful termination.'
      }
    ];

    for (const pet of petitions) insertPetition.run(pet);

    // 2. Insert Replies
    const insertReply = db.prepare(`
      INSERT INTO hc_replies (id, petition_id, reply_type, status, linked_fir, created_by, draft_content, updated_at)
      VALUES (@id, @petition_id, @reply_type, @status, @linked_fir, @created_by, @draft_content, @updated_at)
    `);

    const replies = [
      { 
        id: 'dummy-rep-1', 
        petition_id: 'dummy-pet-1', 
        reply_type: 'para_wise_reply', 
        status: 'draft', 
        linked_fir: '432/2024',
        created_by: 'usr-2',
        draft_content: '<h1>Status Report</h1><p>The investigation is in progress.</p>',
        updated_at: new Date().toISOString()
      },
      { 
        id: 'dummy-rep-2', 
        petition_id: 'dummy-pet-2', 
        reply_type: 'status_report', 
        status: 'under_review', 
        linked_fir: 'FIR-567-SNP',
        created_by: 'usr-2',
        draft_content: '<h1>Draft Reply</h1><p>Sample content for CWP.</p>',
        updated_at: new Date().toISOString()
      }
    ];

    for (const rep of replies) insertReply.run(rep);

    // 3. Insert Paragraphs for dummy-rep-1
    const insertPara = db.prepare(`
      INSERT INTO hc_reply_paragraphs (id, reply_id, para_number, petition_content, reply_content)
      VALUES (@id, @reply_id, @para_number, @petition_content, @reply_content)
    `);

    const paragraphs = [
      { id: 'dummy-para-1', reply_id: 'dummy-rep-1', para_number: 1, petition_content: 'That the petitioner is a law abiding citizen and has been falsely implicated.', reply_content: 'That the contents of para 1 are wrong and emphatically denied.' },
      { id: 'dummy-para-2', reply_id: 'dummy-rep-1', para_number: 2, petition_content: 'That no recovery has been effected from the petitioner.', reply_content: 'That the contents of para 2 are wrong as recovery of stole bike was made from his possession.' }
    ];

    for (const para of paragraphs) insertPara.run(para);

    // 4. Insert Facts
    const insertFact = db.prepare(`
      INSERT INTO hc_reply_facts (
        id, reply_id, fir_no, fir_date, police_station, district, sections, 
        complainant_name, accused_names, investigation_stage, arrest_status, io_name
      )
      VALUES (
        @id, @reply_id, @fir_no, @fir_date, @police_station, @district, @sections, 
        @complainant_name, @accused_names, @investigation_stage, @arrest_status, @io_name
      )
    `);

    const facts = [
      { 
        id: 'dummy-fact-1', 
        reply_id: 'dummy-rep-1', 
        fir_no: '45', 
        fir_date: '2024-01-10', 
        police_station: 'City Thanesar', 
        district: 'Kurukshetra', 
        sections: '379, 420 IPC', 
        complainant_name: 'Ramesh Das', 
        accused_names: 'Rahul Kumar', 
        investigation_stage: 'Ongoing', 
        arrest_status: 'Arrested',
        io_name: 'SI Vikram'
      }
    ];

    for (const fact of facts) insertFact.run(fact);
    
    // 5. Insert Audit Logs
    const insertLog = db.prepare(`
      INSERT INTO hc_reply_audit_logs (id, reply_id, action, actor_id, actor_name, details)
      VALUES (@id, @reply_id, @action, @actor_id, @actor_name, @details)
    `);
    
    const logs = [
      { id: 'dummy-log-1', reply_id: 'dummy-rep-1', action: 'CREATED', actor_id: 'usr-2', actor_name: 'Investigating Officer Singh', details: 'Created draft status report' },
      { id: 'dummy-log-2', reply_id: 'dummy-rep-2', action: 'SUBMITTED', actor_id: 'usr-3', actor_name: 'SHO Kumar', details: 'Submitted for approval' }
    ];
    
    for (const log of logs) insertLog.run(log);

    console.log("Dummy data successfully seeded with all child records!");
  });

  transaction();
};

seedData();
