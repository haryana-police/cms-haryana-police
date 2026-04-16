import db from './server/db.js';

const removeData = () => {
  const transaction = db.transaction(() => {
    // Delete in reverse order of foreign key dependencies
    db.prepare("DELETE FROM hc_reply_audit_logs WHERE id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_reply_facts WHERE id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_reply_versions WHERE id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_reply_comments WHERE id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_reply_paragraphs WHERE id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_reply_attachments WHERE id LIKE 'dummy-%'").run();
    
    db.prepare("DELETE FROM hc_replies WHERE id LIKE 'dummy-%'").run();
    db.prepare("DELETE FROM hc_petitions WHERE id LIKE 'dummy-%'").run();

    console.log("Dummy data successfully removed!");
  });

  transaction();
};

removeData();
