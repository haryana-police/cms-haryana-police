export const integrationService = {
  // Stub implementation. Returns mocked data for FIR lookup.
  getFirDetails: (firNumber) => {
     if (!firNumber) return null;
     
     // Instead of connecting to FIR tables directly which we assume we aren't rebuilding,
     // we simulate a clean integration boundary.
     return {
        fir_no: firNumber,
        fir_date: '2023-05-10',
        police_station: 'City Sector 14',
        district: 'Gurugram',
        sections: 'IPC 420, 120B',
        complainant_name: 'Rahul Sharma',
        accused_names: 'Amit Kumar, Suresh',
        investigation_stage: 'Chargesheet filed',
        arrest_status: '2 Arrested, 1 Absconding',
        recovery_status: 'Partial',
        fsl_status: 'Pending',
        challan_status: 'Submitted',
        trial_status: 'Evidence Stage',
        next_hearing_date: '2026-06-12',
        io_name: 'Insp. Ram Niwas'
     };
  }
};
