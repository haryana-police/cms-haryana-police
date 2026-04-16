export const draftGeneratorService = {
  /**
   * Universal find-and-replace for templates
   */
  generateDraft: (templateContent, facts) => {
    if (!templateContent) return "";
    let draft = templateContent;

    const placeholders = {
      "[PETITION_NO]": facts?.petition_no || "___________",
      "[CASE_NO]": facts?.case_no || facts?.petition_no || "___________",
      "[PETITIONER_NAME]": facts?.petitioner_name || "___________",
      "[RESPONDENT_NAME]": facts?.respondent_name || "State of Haryana",
      "[COURT_NAME]": facts?.court_name || "Hon'ble Punjab and Haryana High Court at Chandigarh",
      "[CASE_TITLE]":
        facts?.case_title ||
        `${facts?.petitioner_name || "___________"} Versus ${facts?.respondent_name || "State of Haryana"}`,
      "[FIR_NO]": facts?.fir_no || "___________",
      "[FIR_DATE]": facts?.fir_date || "___________",
      "[POLICE_STATION]": facts?.police_station || "___________",
      "[DISTRICT]": facts?.district || "Panipat",
      "[SECTIONS]": facts?.sections || "___________",
      "[ARREST_STATUS]": facts?.arrest_status || "___________",
      "[CHALLAN_STATUS]": facts?.challan_status || "___________",
      "[IO_NAME]": facts?.io_name || "___________",
      "[IO_RANK]": facts?.io_rank || "Deputy Superintendent of Police",
      "[NEXT_HEARING_DATE]": facts?.next_hearing_date || "___________",
      "[MEMO_NO]": facts?.memo_no || "___________",
      "[DATE]": facts?.date || new Date().toLocaleDateString("en-GB"),
      "[OFFICE_CITY]": facts?.office_city || facts?.police_station || "Samalkha",
      "[STATE]": facts?.state || "Haryana",
      "[DEPARTMENT]": facts?.department || "Police Department, Haryana",
      "[REPLY_TYPE]": facts?.reply_type || "Reply / Status Report",
      "[ADVOCATE_NAME]": facts?.advocate_name || "Advocate General, Haryana",
      "[PETITION_TYPE]": facts?.petition_type || "CRM-M",
      "[PRAYER]": facts?.prayer || "___________",
      "[TRIAL_STATUS]": facts?.trial_status || "___________",
      "[CURRENT_STAGE]": facts?.current_stage || "___________",
      "[FACTS_SUMMARY]": facts?.facts_summary || "___________",
      "[PARA_WISE_REPLY]": facts?.para_wise_reply || "___________",
    };

    for (const [key, value] of Object.entries(placeholders)) {
      draft = draft.replaceAll(key, value);
    }

    return draft;
  },

  /**
   * Formal Covering Letter to the AG Office
   */
  generateCoveringLetter: (facts) => {
    const currentDate = facts?.date || new Date().toLocaleDateString("en-GB");
    const petitionTitle = `${facts?.petitioner_name || "[Petitioner Name]"} Versus ${
      facts?.respondent_name || "State of Haryana"
    }`;

    return `
<div style="font-family: 'Times New Roman', serif; font-size: 16px; line-height: 1.6; color: #000;">
  <p><strong>From,</strong></p>
  <p style="margin-left: 60px;">
    ${facts?.io_rank || "Deputy Superintendent of Police"},<br>
    ${facts?.office_city || facts?.police_station || "[City]"}, ${facts?.district || "Panipat"}<br>
    Haryana
  </p>

  <p><strong>To,</strong></p>
  <p style="margin-left: 60px;">
    The Advocate General, Haryana,<br>
    Punjab and Haryana High Court,<br>
    Chandigarh
  </p>

  <p>
    <strong>Memo No.:</strong> ${facts?.memo_no || "___________"}
    <span style="float:right;"><strong>Dated:</strong> ${currentDate}</span>
  </p>

  <p>
    <strong>Subject:</strong> Forwarding of reply in ${facts?.petition_no || "[Petition No.]"} titled as <strong>${petitionTitle}</strong>.
  </p>

  <p>Sir,</p>

  <p style="text-align: justify; text-indent: 50px;">
    Kindly find enclosed herewith the duly prepared / vetted reply on behalf of the respondent-State of Haryana
    in the above-mentioned case for filing before the Hon'ble Punjab and Haryana High Court, Chandigarh.
    The matter is fixed for hearing on <strong>${facts?.next_hearing_date || "[Hearing Date]"}</strong>.
  </p>

  <p style="text-align: justify; text-indent: 50px;">
    It is, therefore, requested that the enclosed reply may kindly be filed before the Hon'ble Court
    on behalf of the State.
  </p>

  <br><br>

  <div style="text-align: right; margin-right: 50px;">
    <p>
      Yours faithfully,<br><br><br>
      <strong>(${facts?.io_name || "________________"})</strong><br>
      ${facts?.io_rank || "Deputy Superintendent of Police"}<br>
      ${facts?.office_city || facts?.police_station || "[City]"}, ${facts?.district || "Panipat"}
    </p>
  </div>
</div>
    `;
  },

  /**
   * Main Reply / Status Report Template
   */
  generateMainReply: (facts) => {
    const caseTitle = facts?.case_title || `${facts?.petitioner_name || "[Petitioner Name]"} Versus ${facts?.respondent_name || "State of Haryana"}`;
    const year = facts?.case_year || new Date().getFullYear();

    return `
<div style="font-family: 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #000;">
  <div style="text-align: center; margin-bottom: 20px;">
    <p><strong>IN THE HON'BLE PUNJAB AND HARYANA HIGH COURT AT CHANDIGARH</strong></p>
    <p><strong>${facts?.petition_type || "CRM-M"} No. ${facts?.petition_no || "___________"} of ${year}</strong></p>
  </div>

  <div style="margin-top: 20px;">
    <p><strong>${facts?.petitioner_name || "Petitioner"}</strong> &nbsp;&nbsp;&nbsp;&nbsp;...Petitioner</p>
    <p style="text-align:center;"><strong>Versus</strong></p>
    <p><strong>${facts?.respondent_name || "State of Haryana"}</strong> &nbsp;&nbsp;&nbsp;&nbsp;...Respondent</p>
  </div>

  <br>

  <div style="text-align: center; margin-top: 25px; margin-bottom: 25px;">
    <p><strong>REPLY / STATUS REPORT ON BEHALF OF RESPONDENT-STATE</strong></p>
  </div>

  <p>
    I, <strong>${facts?.io_name || "[Officer Name]"}</strong>,
    ${facts?.io_rank || "Deputy Superintendent of Police"},
    ${facts?.office_city || facts?.police_station || "[City]"}, District ${facts?.district || "Panipat"},
    Haryana, do hereby solemnly affirm and state as under:
  </p>

  <p><strong>1.</strong> That the deponent is presently posted as ${facts?.io_rank || "Deputy Superintendent of Police"} at ${facts?.office_city || facts?.police_station || "[City]"}, District ${facts?.district || "Panipat"}, and is fully conversant with the facts and circumstances of the case. Hence, competent to file the present reply.</p>

  <p><strong>2.</strong> That the present reply is being filed on behalf of respondent-State in the matter titled as <strong>${caseTitle}</strong>.</p>

  <p><strong>3.</strong> That FIR No. <strong>${facts?.fir_no || "___________"}</strong> dated <strong>${facts?.fir_date || "___________"}</strong> under Sections <strong>${facts?.sections || "___________"}</strong>
    was registered at Police Station <strong>${facts?.police_station || "___________"}</strong>,
    District <strong>${facts?.district || "Panipat"}</strong>.
  </p>

  <p><strong>4.</strong> That the brief facts of the case are that ${facts?.facts_summary || "the investigation was conducted in accordance with law and all necessary steps were taken by the investigating agency."}</p>

  <p><strong>5.</strong> That during investigation, the arrest status of the accused/petitioner is as follows:
    <strong>${facts?.arrest_status || "___________"}</strong>.
  </p>

  <p><strong>6.</strong> That the status of report under Section 173 Cr.P.C. / challan is as follows:
    <strong>${facts?.challan_status || "___________"}</strong>.
  </p>

  <p><strong>7.</strong> That the present petition has been filed by the petitioner seeking the relief of ${facts?.prayer || "___________"}, which is not maintainable in the present facts and circumstances of the case.
  </p>

  <p><strong>8.</strong> That the allegations made in the petition are wrong, misconceived and denied except those specifically admitted herein. The true and correct facts are borne out from the official record and investigation conducted in accordance with law.</p>

  ${facts?.para_wise_reply ? `
  <p><strong>9. Para-wise reply:</strong></p>
  <div style="margin-left: 25px; text-align: justify;">
    ${facts.para_wise_reply}
  </div>
  ` : `
  <p><strong>9.</strong> That the contents of the petition, to the extent contrary to the record, are denied and the petitioner is put to strict proof of the averments made therein.</p>
  `}

  <p><strong>10.</strong> That the present petition deserves to be dismissed in the interest of justice.</p>

  <br><br>

  <p><strong>PRAYER</strong></p>
  <p style="text-align: justify;">
    In view of the facts and circumstances stated above, it is most respectfully prayed that the present petition may kindly be dismissed.
  </p>

  <br><br>

  <div style="text-align: right; margin-right: 50px;">
    <p><strong>DEPONENT</strong></p>
  </div>

  <br><br>

  <p>
    <strong>VERIFICATION</strong><br>
    Verified that the contents of the above reply from paragraphs 1 to 10 are true and correct to the best of my knowledge and belief, derived from the official record, and nothing material has been concealed therein.
  </p>

  <p>
    Verified at <strong>${facts?.office_city || facts?.police_station || "[City]"}</strong>,
    District <strong>${facts?.district || "Panipat"}</strong> on this
    <strong>${facts?.date || new Date().toLocaleDateString("en-GB")}</strong>.
  </p>

  <br><br>

  <div style="text-align: right; margin-right: 50px;">
    <p><strong>DEPONENT</strong></p>
  </div>
</div>
    `;
  },

  /**
   * Generates a structural table for annexures
   */
  generateAnnexureList: (facts) => {
    const annexures = facts?.annexures || [];

    if (!annexures.length) {
      return `
<div style="font-family: 'Times New Roman', serif; font-size: 16px; line-height: 1.6;">
  <p style="text-align:center;"><strong>LIST OF ANNEXURES</strong></p>
  <p>Annexures, if any, may be added as per record.</p>
</div>
      `;
    }

    const annexureRows = annexures.map((item, index) => `
      <tr>
        <td style="border:1px solid #000; padding:8px; text-align:center;">${index + 1}</td>
        <td style="border:1px solid #000; padding:8px;">Annexure R-${index + 1}</td>
        <td style="border:1px solid #000; padding:8px;">${item.title || "Document"}</td>
      </tr>
    `).join("");

    return `
<div style="font-family: 'Times New Roman', serif; font-size: 16px; line-height: 1.6;">
  <p style="text-align:center;"><strong>LIST OF ANNEXURES</strong></p>

  <table style="width:100%; border-collapse:collapse; margin-top:15px;">
    <thead>
      <tr style="background-color: #f2f2f2;">
        <th style="border:1px solid #000; padding:8px; width:10%;">S.No.</th>
        <th style="border:1px solid #000; padding:8px; width:25%;">Annexure No.</th>
        <th style="border:1px solid #000; padding:8px;">Particulars</th>
      </tr>
    </thead>
    <tbody>
      ${annexureRows}
    </tbody>
  </table>
</div>
    `;
  },

  /**
   * Assembles the full legal package
   */
  generateFullHCReply: (facts) => {
    return `
      ${draftGeneratorService.generateCoveringLetter(facts)}
      <div class="page-break"></div>
      ${draftGeneratorService.generateMainReply(facts)}
      <div class="page-break"></div>
      ${draftGeneratorService.generateAnnexureList(facts)}
    `;
  },

  /**
   * AI Rebuttal Generation Logic
   */
  generateParaRebuttal: (petitionText, paraNumber) => {
    if (!petitionText) return "";

    const patterns = [
      {
        regex: /law abiding citizen|falsely implicated|innocent/i,
        rebuttal: `That the contents of para ${paraNumber} are wrong and emphatically denied. It is submitted that the petitioner is not entitled to the relief claimed and the allegations made are contrary to the official record and investigation.`
      },
      {
        regex: /no recovery|not effected|nothing was recovered/i,
        rebuttal: `That the contents of para ${paraNumber} are denied as incorrect. The recovery was made strictly in accordance with law following due procedure, and the same is duly documented in the recovery memo prepared at the spot.`
      },
      {
        regex: /custody|illegal detention|unlawful arrest/i,
        rebuttal: `That the contents of para ${paraNumber} are false and denied. The arrest of the petitioner was made strictly in compliance with the due process of law and the constitutional safeguards, and he was produced before the competent Court within the prescribed time.`
      },
      {
        regex: /cooperate|investigation|joined the investigation/i,
        rebuttal: `That the contents of para ${paraNumber} are misleading. Although the petitioner joined the investigation, he has been non-cooperative and has failed to disclose material facts within his exclusive knowledge.`
      },
      {
        regex: /parity|similarly situated/i,
        rebuttal: `That the contents of para ${paraNumber} are denied. The role of the petitioner is distinct from the other co-accused who have been granted relief, and the principle of parity is not applicable in the present facts.`
      },
      {
        regex: /bail|anticipatory/i,
        rebuttal: `That the contents of para ${paraNumber} are wrong. Given the gravity of the offence and the evidence available on record, the petitioner does not deserve the extraordinary relief of bail.`
      }
    ];

    const match = patterns.find((p) => p.regex.test(petitionText));
    if (match) return match.rebuttal;

    return `That the contents of para ${paraNumber} are wrong, misconceived and denied. The petitioner is put to strict proof of the averments made therein.`;
  }
};