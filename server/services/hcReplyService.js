import db from '../db.js';
import { integrationService } from './integrationService.js';

export const hcReplyService = {
  getAllReplies: () => {
    return db.prepare(`
      SELECT r.*, p.petition_no, p.petitioner_name, p.respondent_name 
      FROM hc_replies r 
      LEFT JOIN hc_petitions p ON r.petition_id = p.id
      ORDER BY r.updated_at DESC
    `).all();
  },

  getReplyById: (id) => {
    if (!id) return null;

    try {
      const stmt = db.prepare(`
        SELECT r.*, p.court_name, p.petition_no, p.petition_type, 
               p.petitioner_name, p.respondent_name, p.hearing_date, 
               p.police_station as petition_police_station, p.district as petition_district,
               p.extracted_text, p.extracted_prayer, p.extracted_grounds, p.extracted_allegations
        FROM hc_replies r 
        LEFT JOIN hc_petitions p ON r.petition_id = p.id 
        WHERE r.id = ?
      `);
      
      const reply = stmt.get(id);

      
      if (!reply) return null;
      
      // Ensure child lookups don't crash and handle empty cases
      reply.facts = db.prepare('SELECT * FROM hc_reply_facts WHERE reply_id = ?').get(id) || {};
      reply.paragraphs = db.prepare('SELECT * FROM hc_reply_paragraphs WHERE reply_id = ? ORDER BY para_number').all(id) || [];
      reply.comments = db.prepare('SELECT * FROM hc_reply_comments WHERE reply_id = ? ORDER BY created_at DESC').all(id) || [];
      reply.audit_logs = db.prepare('SELECT * FROM hc_reply_audit_logs WHERE reply_id = ? ORDER BY created_at DESC').all(id) || [];
      
      return reply;
    } catch (error) {
      console.error('Database error in getReplyById:', error);
      throw error;
    }
  },

  getFacts: (replyId) => {
    try {
      // 1. Check if we have saved facts
      const facts = db.prepare('SELECT * FROM hc_reply_facts WHERE reply_id = ?').get(replyId);
      if (facts) return facts;

      // 2. If not, auto-build from linked FIR
      const reply = db.prepare('SELECT linked_fir FROM hc_replies WHERE id = ?').get(replyId);
      if (reply && reply.linked_fir) {
        return integrationService.getFirDetails(reply.linked_fir);
      }

      return {};
    } catch (error) {
      console.error('Error in getFacts service:', error);
      throw error;
    }
  },

  createReply: (data, user) => {
    const petitionId = `pet-${Date.now()}`;
    const replyId = `rep-${Date.now()}`;
    
    const insertPet = db.prepare(`
      INSERT INTO hc_petitions (id, court_name, petition_no, petition_type, petitioner_name, respondent_name, hearing_date, police_station, district)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertReply = db.prepare(`
      INSERT INTO hc_replies (id, petition_id, reply_type, status, linked_fir, linked_complaint, linked_case, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertAudit = db.prepare(`
      INSERT INTO hc_reply_audit_logs (id, reply_id, action, actor_id, actor_name, details)
      VALUES (?, ?, 'created', ?, ?, 'Reply drafted')
    `);

    db.transaction(() => {
      insertPet.run(
        petitionId, data.court_name, data.petition_no, data.petition_type, 
        data.petitioner_name, data.respondent_name, data.hearing_date, 
        data.police_station, data.district
      );
      
      insertReply.run(
        replyId, petitionId, data.reply_type, 'draft', 
        data.related_fir_number || null, data.linked_complaint || null, 
        data.linked_case || null, user.id
      );
      
      insertAudit.run(`aud-${Date.now()}`, replyId, user.id, user.full_name);
    })();
    
    return { id: replyId };
  },

  updateReplyStatus: (id, status, comment, user) => {
     db.transaction(() => {
        db.prepare('UPDATE hc_replies SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
        
        db.prepare(`
          INSERT INTO hc_reply_audit_logs (id, reply_id, action, actor_id, actor_name, details)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(`aud-${Date.now()}`, id, `status_changed_to_${status}`, user.id, user.full_name, `Status updated to ${status}`);
        
        if (comment) {
           db.prepare(`
             INSERT INTO hc_reply_comments (id, reply_id, author_id, author_name, comment_type, content)
             VALUES (?, ?, ?, ?, ?, ?)
           `).run(`cmt-${Date.now()}`, id, user.id, user.full_name, 'status_change', comment);
        }
     })();
  },

  saveFacts: (replyId, facts) => {
    const existing = db.prepare('SELECT id FROM hc_reply_facts WHERE reply_id = ?').get(replyId);
    if (existing) {
      db.prepare(`
        UPDATE hc_reply_facts SET 
          fir_no=?, fir_date=?, police_station=?, district=?, sections=?, complainant_name=?, accused_names=?, investigation_stage=?, arrest_status=?, recovery_status=?, fsl_status=?, challan_status=?, trial_status=?, next_hearing_date=?, io_name=?
        WHERE reply_id=?
      `).run(
        facts.fir_no || null, facts.fir_date || null, facts.police_station || null, facts.district || null, facts.sections || null, 
        facts.complainant_name || null, facts.accused_names || null, facts.investigation_stage || null, facts.arrest_status || null, 
        facts.recovery_status || null, facts.fsl_status || null, facts.challan_status || null, facts.trial_status || null, 
        facts.next_hearing_date || null, facts.io_name || null, replyId
      );
    } else {
      db.prepare(`
        INSERT INTO hc_reply_facts (id, reply_id, fir_no, fir_date, police_station, district, sections, complainant_name, accused_names, investigation_stage, arrest_status, recovery_status, fsl_status, challan_status, trial_status, next_hearing_date, io_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `fact-${Date.now()}`, replyId, facts.fir_no || null, facts.fir_date || null, facts.police_station || null, 
        facts.district || null, facts.sections || null, facts.complainant_name || null, facts.accused_names || null, 
        facts.investigation_stage || null, facts.arrest_status || null, facts.recovery_status || null, 
        facts.fsl_status || null, facts.challan_status || null, facts.trial_status || null, facts.next_hearing_date || null, facts.io_name || null
      );
    }
  },

  getTemplates: (type) => {
    if (type) {
      return db.prepare('SELECT * FROM hc_reply_templates WHERE reply_type = ? AND is_active = 1').all(type);
    }
    return db.prepare('SELECT * FROM hc_reply_templates').all();
  },

  createTemplate: (data) => {
    const id = `tpl-${Date.now()}`;
    db.prepare(`
      INSERT INTO hc_reply_templates (id, title, reply_type, content, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.title, data.reply_type, data.content, 1);
    return { id };
  },

  updateTemplate: (id, data) => {
    db.prepare(`
      UPDATE hc_reply_templates 
      SET title = ?, reply_type = ?, content = ?, is_active = ?
      WHERE id = ?
    `).run(data.title, data.reply_type, data.content, data.is_active ? 1 : 0, id);
    return { success: true };
  },

  saveDraftContent: (replyId, content, user) => {
     db.transaction(() => {
        db.prepare('UPDATE hc_replies SET draft_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, replyId);
        
        const vCount = db.prepare('SELECT COUNT(*) as c FROM hc_reply_versions WHERE reply_id = ?').get(replyId).c;
        db.prepare(`
          INSERT INTO hc_reply_versions (id, reply_id, version_number, content, created_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(`ver-${Date.now()}`, replyId, vCount + 1, content, user.id);

        db.prepare(`
          INSERT INTO hc_reply_audit_logs (id, reply_id, action, actor_id, actor_name, details)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(`aud-${Date.now()}`, replyId, 'draft_updated', user.id, user.full_name, 'Draft content was saved and versioned');
     })();
  }
};
