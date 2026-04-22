/**
 * FIRPrintDocument.jsx
 *
 * Renders a print-ready FIR document that exactly mirrors the
 * official Haryana Police "First Information Report" (FIR) form
 * as prescribed under Section 173 BNSS.
 *
 * Usage:
 *   <FIRPrintDocument fir={firObject} />
 *
 * The `fir` prop should be the raw object returned by the API
 * (acts_sections and accused_details already JSON-parsed as arrays).
 */

import React from 'react';

/* ── small helper ──────────────────────────────────────────── */
const V = ({ v, fallback = '—' }) => <>{v || fallback}</>;

const fmt = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return d; }
};
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
};

/* ── Print styles injected once at top level ────────────────── */
const PRINT_STYLE = `
@page { size: A4; margin: 15mm 12mm; }
@media print {
  body * { visibility: hidden !important; }
  #fir-print-root, #fir-print-root * { visibility: visible !important; }
  #fir-print-root { position: fixed; top: 0; left: 0; width: 100%; }
  .no-print { display: none !important; }
}
`;

/* ── Shared print colours / sizes ───────────────────────────── */
const root = {
  fontFamily: '"Noto Serif", "Times New Roman", Georgia, serif',
  fontSize: '11.5px',
  color: '#000',
  background: '#fff',
  padding: '0',
  lineHeight: 1.55,
};

const headerCell = {
  border: '1px solid #000',
  padding: '5px 8px',
  verticalAlign: 'top',
  fontSize: '11px',
};
const labelCell = { ...headerCell, fontWeight: 700, background: '#f0f0f0', width: '38%' };
const valueCell = { ...headerCell };

const sectionTitle = (n, en, hi) => (
  <tr>
    <td colSpan={4} style={{ ...headerCell, fontWeight: 700, background: '#dce6f1', textAlign: 'center', letterSpacing: '0.03em', fontSize: '11.5px' }}>
      {n}. {en} &nbsp;|&nbsp; <span style={{ fontFamily: '"Noto Sans Devanagari", sans-serif' }}>{hi}</span>
    </td>
  </tr>
);

const Row2 = ({ label, value, labelHi, span }) => (
  <tr>
    <td style={labelCell}>
      {label}
      {labelHi && <span style={{ fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: '10px', display: 'block', color: '#444' }}>{labelHi}</span>}
    </td>
    <td colSpan={span || 3} style={valueCell}>{value ?? '—'}</td>
  </tr>
);

const Row4 = ({ items }) => (
  <tr>
    {items.map((item, i) => (
      <React.Fragment key={i}>
        <td style={labelCell}>
          {item.label}
          {item.labelHi && <span style={{ fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: '10px', display: 'block', color: '#444' }}>{item.labelHi}</span>}
        </td>
        <td style={valueCell}>{item.value ?? '—'}</td>
      </React.Fragment>
    ))}
    {/* pad odd items */}
    {items.length % 2 !== 0 && <><td style={labelCell} /><td style={valueCell} /></>}
  </tr>
);

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
export default function FIRPrintDocument({ fir }) {
  if (!fir) return null;

  /* parse JSON arrays safely */
  const acts = (() => {
    try { return typeof fir.acts_sections === 'string' ? JSON.parse(fir.acts_sections) : (fir.acts_sections || []); }
    catch { return []; }
  })();
  const accusedList = (() => {
    try { return typeof fir.accused_details === 'string' ? JSON.parse(fir.accused_details) : (fir.accused_details || []); }
    catch { return []; }
  })();
  const idDetails = (() => {
    try { return typeof fir.complainant_id_details === 'string' ? JSON.parse(fir.complainant_id_details) : (fir.complainant_id_details || []); }
    catch { return []; }
  })();
  const properties = (() => {
    try { return typeof fir.property_details === 'string' ? JSON.parse(fir.property_details) : (fir.property_details || []); }
    catch { return []; }
  })();

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div id="fir-print-root" style={root}>

        {/* ── DOCUMENT HEADER ──────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Haryana Police — हरियाणा पुलिस
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
            FIRST INFORMATION REPORT &nbsp;(प्रथम सूचना रिपोर्ट)
          </div>
          <div style={{ fontSize: '12px', marginTop: '3px' }}>
            (Under Section 173 B.N.S.S. / धारा 173 बी.एन.एस.एस. के तहत)
          </div>
          <hr style={{ borderTop: '2px solid #000', margin: '8px 0 0' }} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>

            {/* ══ SECTION 1 — Basic Details ════════════════════════ */}
            {sectionTitle(1, 'Basic FIR Details', 'मूल विवरण')}
            <Row4 items={[
              { label: 'FIR No. (प्र.सू.रि. सं.)', labelHi: '', value: fir.fir_number },
              { label: 'Year (वर्ष)', value: fir.year },
            ]} />
            <Row4 items={[
              { label: 'Date & Time of FIR', labelHi: 'दिनांक और समय', value: fmt(fir.date_time_of_fir) },
              { label: 'Police Station (थाना)', value: fir.police_station },
            ]} />
            <Row4 items={[
              { label: 'District (जिला)', value: fir.district },
              { label: 'Registered By', value: fir.registered_by_name || fir.registered_by },
            ]} />

            {/* ══ SECTION 2 — Acts & Sections ══════════════════════ */}
            {sectionTitle(2, 'Acts & Sections', 'अधिनियम और धाराएँ')}
            <tr>
              <td style={{ ...headerCell, fontWeight: 700, width: '5%', textAlign: 'center' }}>S.No.</td>
              <td style={{ ...headerCell, fontWeight: 700, width: '55%' }}>Act (अधिनियम)</td>
              <td colSpan={2} style={{ ...headerCell, fontWeight: 700 }}>Sections (धाराएँ)</td>
            </tr>
            {acts.length > 0 ? acts.map((a, i) => (
              <tr key={i}>
                <td style={{ ...headerCell, textAlign: 'center' }}>{i + 1}</td>
                <td style={headerCell}>{a.act}</td>
                <td colSpan={2} style={headerCell}>{a.sections}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} style={{ ...headerCell, textAlign: 'center', color: '#888' }}>None</td></tr>
            )}

            {/* ══ SECTION 3 — Occurrence of Offence ═══════════════ */}
            {sectionTitle(3, 'Occurrence of Offence', 'अपराध की घटना')}
            <tr>
              <td colSpan={4} style={{ ...headerCell, fontWeight: 700, background: '#f7f7f7', fontSize: '10.5px' }}>
                (a) Date & Time of Occurrence — घटना की दिनांक एवं समय
              </td>
            </tr>
            <Row4 items={[
              { label: 'Day (दिन)', value: fir.occurrence_day },
              { label: 'Date From (दिनांक से)', value: fmtDate(fir.occurrence_date_from) },
            ]} />
            <Row4 items={[
              { label: 'Date To (दिनांक तक)', value: fmtDate(fir.occurrence_date_to) },
              { label: 'Time Period (समय अवधि)', value: fir.occurrence_time_period },
            ]} />
            <Row4 items={[
              { label: 'Time From (समय से)', value: fir.occurrence_time_from },
              { label: 'Time To (समय तक)', value: fir.occurrence_time_to },
            ]} />
            <tr>
              <td colSpan={4} style={{ ...headerCell, fontWeight: 700, background: '#f7f7f7', fontSize: '10.5px' }}>
                (b) Information Received at P.S. — थाना जहाँ सूचना प्राप्त हुई
              </td>
            </tr>
            <Row4 items={[
              { label: 'Date (दिनांक)', value: fmtDate(fir.info_received_date) },
              { label: 'Time (समय)', value: fir.info_received_time },
            ]} />
            <tr>
              <td colSpan={4} style={{ ...headerCell, fontWeight: 700, background: '#f7f7f7', fontSize: '10.5px' }}>
                (c) General Diary Reference — रोजनामचा संदर्भ
              </td>
            </tr>
            <Row4 items={[
              { label: 'GD Entry No. (प्रविष्टि सं.)', value: fir.gd_entry_no },
              { label: 'GD Date & Time', value: fmt(fir.gd_date_time) },
            ]} />

            {/* ══ SECTION 4 — Type of Information ══════════════════ */}
            {sectionTitle(4, 'Type of Information', 'सूचना का प्रकार')}
            <Row2 label="Type (प्रकार)" labelHi="Written = लिखित | Oral = मौखिक" value={fir.info_type} />

            {/* ══ SECTION 5 — Place of Occurrence ══════════════════ */}
            {sectionTitle(5, 'Place of Occurrence', 'घटनास्थल')}
            <Row4 items={[
              { label: '(a) Direction (दिशा)', value: fir.place_direction },
              { label: 'Distance (दूरी)', value: fir.place_distance ? `${fir.place_distance} Km` : '—' },
            ]} />
            <Row4 items={[
              { label: 'Beat No. (बीट सं.)', value: fir.beat_no },
              { label: '', value: '' },
            ]} />
            <Row2 label="(b) Address (पता)" labelHi="" value={fir.place_address} />
            <Row4 items={[
              { label: 'Latitude (अक्षांश)', value: fir.latitude },
              { label: 'Longitude (देशांतर)', value: fir.longitude },
            ]} />
            {(fir.outside_ps_name || fir.outside_district) && (
              <Row4 items={[
                { label: '(c) Outside P.S. Name', value: fir.outside_ps_name },
                { label: 'District/State', value: fir.outside_district },
              ]} />
            )}

            {/* ══ SECTION 6 — Complainant Details ══════════════════ */}
            {sectionTitle(6, 'Complainant / Informant Details', 'शिकायतकर्ता / सूचनाकर्ता का विवरण')}
            <Row4 items={[
              { label: '(a) Name (नाम)', value: fir.complainant_name },
              { label: "(b) Father's Name (पिता का नाम)", value: fir.complainant_father_name },
            ]} />
            <Row4 items={[
              { label: '(c) Date of Birth (जन्म तिथि)', value: fir.complainant_dob },
              { label: '(d) Nationality (राष्ट्रीयता)', value: fir.complainant_nationality },
            ]} />
            <Row4 items={[
              { label: '(e) UID / Aadhaar No.', value: fir.complainant_uid },
              { label: '(f) Passport No.', value: fir.complainant_passport },
            ]} />
            {/* ID Details */}
            {idDetails.length > 0 && (
              <>
                <tr>
                  <td colSpan={4} style={{ ...headerCell, fontWeight: 700, background: '#f7f7f7', fontSize: '10.5px' }}>
                    (g) ID Details — पहचान पत्र विवरण
                  </td>
                </tr>
                <tr>
                  <td style={{ ...headerCell, fontWeight: 700 }}>S.No.</td>
                  <td colSpan={2} style={{ ...headerCell, fontWeight: 700 }}>ID Type (पहचान पत्र का प्रकार)</td>
                  <td style={{ ...headerCell, fontWeight: 700 }}>ID Number (पहचान संख्या)</td>
                </tr>
                {idDetails.map((id, i) => (
                  <tr key={i}>
                    <td style={{ ...headerCell, textAlign: 'center' }}>{i + 1}</td>
                    <td colSpan={2} style={headerCell}>{id.id_type}</td>
                    <td style={headerCell}>{id.id_number}</td>
                  </tr>
                ))}
              </>
            )}
            <Row4 items={[
              { label: '(h) Occupation (व्यवसाय)', value: fir.complainant_occupation },
              { label: '(j) Phone No. (दूरभाष सं.)', value: fir.complainant_phone },
            ]} />
            <Row2 label="(i) Present Address (वर्तमान पता)" value={fir.complainant_present_address} />
            <Row2 label="Permanent Address (स्थायी पता)" value={fir.complainant_permanent_address} />

            {/* ══ SECTION 7 — Accused Details ═══════════════════════ */}
            {sectionTitle(7, 'Details of Accused', 'अभियुक्त का विवरण')}
            {accusedList.length > 0 ? (
              <>
                <tr>
                  <td style={{ ...headerCell, fontWeight: 700, textAlign: 'center', width: '5%' }}>S.No.</td>
                  <td style={{ ...headerCell, fontWeight: 700 }}>Name & Alias (नाम / उर्फ)</td>
                  <td style={{ ...headerCell, fontWeight: 700 }}>Relative's Name (रिश्तेदार)</td>
                  <td style={{ ...headerCell, fontWeight: 700 }}>Address & Phone (पता / मोबाइल)</td>
                </tr>
                {accusedList.map((a, i) => (
                  <tr key={i}>
                    <td style={{ ...headerCell, textAlign: 'center' }}>{i + 1}</td>
                    <td style={headerCell}>
                      {a.name}
                      {a.alias && <span style={{ display: 'block', fontSize: '10px', color: '#555' }}>उर्फ: {a.alias}</span>}
                    </td>
                    <td style={headerCell}>{a.relative_name || '—'}</td>
                    <td style={headerCell}>
                      {a.address || '—'}
                      {a.phone && <span style={{ display: 'block', fontSize: '10px' }}>📞 {a.phone}</span>}
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <tr><td colSpan={4} style={{ ...headerCell, color: '#666' }}>Unknown / None mentioned</td></tr>
            )}

            {/* ══ SECTION 8 — Delay Reason ══════════════════════════ */}
            {sectionTitle(8, 'Reasons for Delay in Reporting', 'देरी से रिपोर्ट करने के कारण')}
            <Row2 label="Delay Reason (कारण)" value={fir.delay_reason || 'Not Applicable'} />

            {/* ══ SECTION 9 & 10 — Property Details ════════════════ */}
            {sectionTitle(9, 'Particulars of Properties of Interest', 'संम्बन्धित सम्पत्ति का विवरण')}
            {properties.length > 0 ? (
              <>
                <tr>
                  <td style={{ ...headerCell, fontWeight: 700, textAlign: 'center' }}>S.No.</td>
                  <td style={{ ...headerCell, fontWeight: 700 }}>Category & Type (श्रेणी)</td>
                  <td colSpan={2} style={{ ...headerCell, fontWeight: 700 }}>Description & Value (विवरण / मूल्य)</td>
                </tr>
                {properties.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...headerCell, textAlign: 'center' }}>{i + 1}</td>
                    <td style={headerCell}>{p.category}{p.type_detail ? ` — ${p.type_detail}` : ''}</td>
                    <td colSpan={2} style={headerCell}>
                      {p.description}
                      {p.value ? <span style={{ display: 'block', fontWeight: 700 }}>₹ {Number(p.value).toLocaleString('en-IN')}</span> : ''}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ ...headerCell, fontWeight: 700, textAlign: 'right', background: '#f0f0f0' }}>
                    Section 10 — Total Value of Property (सम्पत्ति का कुल मूल्य):
                  </td>
                  <td style={{ ...headerCell, fontWeight: 700, fontSize: '13px' }}>
                    ₹ {Number(fir.total_property_value || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </>
            ) : (
              <tr><td colSpan={4} style={{ ...headerCell, color: '#666' }}>No property involved</td></tr>
            )}

            {/* ══ SECTION 12 — FIR Narrative ════════════════════════ */}
            {sectionTitle(12, 'First Information Contents', 'प्रथम सूचना तथ्य')}
            <tr>
              <td colSpan={4} style={{ ...headerCell, whiteSpace: 'pre-wrap', fontFamily: '"Noto Serif", Georgia, serif', lineHeight: 1.75, minHeight: '120px' }}>
                {fir.fir_content || '—'}
              </td>
            </tr>

            {/* ══ SECTION 13 — Action Taken ═════════════════════════ */}
            {sectionTitle(13, 'Action Taken', 'की गई कार्यवाही')}
            <tr>
              <td colSpan={4} style={{ ...headerCell, fontStyle: 'italic', fontSize: '10.5px' }}>
                Since the above information reveals commission of offence(s) u/s mentioned in Column No. 2, registered the case and took up the investigation.
                &nbsp;(प्रकरण दर्ज किया गया और जांच के लिए लिया गया — ✓)
              </td>
            </tr>
            <Row4 items={[
              { label: 'I.O. Name (जांच अधिकारी)', value: fir.io_name },
              { label: 'I.O. Rank (पद)', value: fir.io_rank },
            ]} />
            <Row2 label="I.O. No. (सं.)" labelHi="" value={fir.io_no} span={1} />
            {fir.refused_reason && <Row2 label="Refused Reason (इनकार का कारण)" value={fir.refused_reason} />}
            {(fir.transferred_ps || fir.transferred_district) && (
              <Row4 items={[
                { label: 'Transferred to P.S. (थाना)', value: fir.transferred_ps },
                { label: 'District (जिला)', value: fir.transferred_district },
              ]} />
            )}
            <tr>
              <td colSpan={4} style={{ ...headerCell, fontStyle: 'italic', fontSize: '10.5px', background: '#f7f7f7' }}>
                R.O.A.C. — FIR read over to the complainant, admitted to be correctly recorded and a copy given free of cost.
                &nbsp;(सही दर्ज हुई माना और एक प्रति शिकायतकर्ता को दी गयी।)
              </td>
            </tr>

            {/* ══ SECTION 14 — Officer in Charge ═══════════════════ */}
            {sectionTitle(14, 'Signature of Officer in Charge, Police Station', 'थाना प्रभारी के हस्ताक्षर')}
            <Row4 items={[
              { label: 'Officer Name (नाम)', value: fir.officer_name },
              { label: 'Rank (पद)', value: fir.officer_rank },
            ]} />
            <Row2 label="Officer No. (सं.)" value={fir.officer_no} span={1} />

            {/* ══ SECTION 15 — Dispatch ═════════════════════════════ */}
            {sectionTitle(15, 'Date & Time of Dispatch to Court', 'अदालत में प्रेषण की दिनांक और समय')}
            <Row2 label="Dispatch Date & Time" value={fmt(fir.dispatch_date_time)} />

          </tbody>
        </table>

        {/* ── SIGNATURE BLOCK ──────────────────────────────────── */}
        <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between', pageBreakInside: 'avoid' }}>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px', fontSize: '11px' }}>
              Signature / Thumb Impression of Complainant<br />
              <span style={{ fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: '10px' }}>शिकायतकर्ता के हस्ताक्षर / अंगूठे का निशान</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px', fontSize: '11px' }}>
              Signature of Officer In-Charge<br />
              <span style={{ fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: '10px' }}>थाना प्रभारी के हस्ताक्षर</span>
            </div>
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '10px', color: '#555', borderTop: '1px solid #ccc', paddingTop: '6px' }}>
          Generated by Haryana Police CMS &nbsp;|&nbsp; FIR No: {fir.fir_number}/{fir.year} &nbsp;|&nbsp; Printed on: {new Date().toLocaleString('en-IN')}
        </div>

      </div>
    </>
  );
}
