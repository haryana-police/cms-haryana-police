# Haryana Police CMS — AI Agent Instructions

Welcome, Artificial Intelligence Coder! You are assisting a developer on the Haryana Police CMS project. Please read these strict rules before making any code modifications.

## 1. Database & Backend (CRITICAL)
- **Backend Architecture**: We use a lightweight local Express backend running via `server/index.js` which connects to an internal `better-sqlite3` database `data.db`.
- **API Endpoints**: All frontend queries should use standard `fetch` to `http://localhost:3000/api`. Do NOT attempt to install or use Supabase clients.
- **Data Persistence**: If you need to make schema changes, update the initialization configuration natively located inside `server/db.js`.
- **Test User Provisioning**: Ensure seed accounts are injected straight through initial `db.run()` logic if required.

## 2. Tech Stack and Patterns
- **Frontend**: React 19 + Vite (NO Next.js, NO Server-Side Rendering)
- **UI Framework**: Ant Design (antd) + Lucide React icons
- **CSS**: Vanilla CSS modules or global overrides. Avoid Tailwind unless absolutely necessary.
- **Backend/DB**: Express + better-sqlite3 (SQLite).
- **Authentication**: Custom JWT authentication implementation. Tokens are stored in frontend `localStorage`.

## 3. Code Quality & Workflow
- **Pull Requests ONLY**: Never commit directly to the `main` branch. All work must be conducted on feature branches and submitted via a Pull Request (PR) for review.
- Deliver **COMPLETE, working code**. No placeholders like `// Add your logic here`.
- Ensure mobile-first responsiveness. Police officers will use this predominately on tablets and mobile phones.
- Use Role-Based Access Control logic (e.g. `<RoleGate allowedRoles={['io', 'sho']}>`) to show/hide features appropriately.

## 4. UI/UX Expectations
- Focus on premium aesthetics using the Ant Design components. Avoid plain HTML tables or generic inputs.
- Keep the interface simple and easy for non-technical users.

## 5. Standard Templates & Drafting Formats

### Status of Trial
Whenever "Status of Trial" is mentioned or requested for a reply/affidavit, use the following standardized formats:

**Format A: Charges Framed**
> FIR NO [FIR_NO] PS [POLICE_STATION] ([NAME])
>
> The current status of the trial is that the Ld. Trial Court, [LOCATION], has framed charges against the accused, including [ACCUSED_NAME], under sections [SECTIONS] of the IPC on [DATE]. The case is now at the stage of [STAGE (e.g., Prosecution Evidence)], with a total of [TOTAL_WITNESSES] witnesses listed for the case; [COUNT] key prosecution witnesses, [WITNESS_NAMES], have been examined as of the report date, and the next date of hearing in the case is fixed for [NEXT_DATE].

**Format B: Charges Not Yet Framed**
> FIR NO [FIR_NO] PS [POLICE_STATION] ([NAME])
>
> The current status of the trial for the petitioners ([PETITIONER_NAMES]) is that charges have not been framed by the Ld. JMIC/Court, [LOCATION], and the case is fixed for arguments on charge, with the next date of hearing set for [NEXT_DATE]. [Include co-accused details if applicable, e.g., "Separately, the case against the co-accused [NAME]... is pending before the Ld. Justice Juvenile Board..."].

Thank you for helping us build the Haryana Police Smart CMS!
