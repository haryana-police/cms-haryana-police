import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun } = require('docx');

export const documentExportService = {
  exportToPdf: async (contentHtml, res) => {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);
        
        // Very basic HTML strip for mock export. 
        // In production, html-to-pdf libraries should be used.
        const plainText = contentHtml.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n\n');
        
        doc.fontSize(12)
           .font('Times-Roman')
           .text(plainText, { align: 'justify' });
           
        doc.end();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  },

  exportToDocx: async (contentHtml, res) => {
    try {
      const plainText = contentHtml.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n\n');
      const textLines = plainText.split('\n').filter(l => l.trim() !== '');
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: textLines.map(line => new Paragraph({
            children: [ new TextRun(line) ]
          }))
        }]
      });

      const b64string = await Packer.toBase64String(doc);
      res.setHeader('Content-Disposition', 'attachment; filename=HC_Reply.docx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(Buffer.from(b64string, 'base64'));
    } catch (e) {
      console.error(e);
      res.status(500).send('Error generating DOCX');
    }
  }
};
