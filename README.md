# Career Signal

**Cut through the noise. Focus on opportunities that fit.**

Career Signal is a job-search intelligence concept developed for the **Noise vs Signal: Proof of Work / Proof of Skill in the AI Era** hackathon. The submitted prototype is named **Pathwise** in the repository and includes a Next.js application dashboard, Supabase authentication and application data, analytics visualisations, and AI-assisted career insights.

> **Project status:** Hackathon prototype. This README distinguishes what is present in the supplied source code from the intended MVP and roadmap. It does not claim that the deployed application or third-party integrations have been tested.

## 1. How it works

The intended Career Signal experience is:

1. **Create an account:** A job seeker registers and signs in, then supplies relevant career preferences and skills.
2. **Capture opportunities:** Save an advertised job or manually record an application made through a referral, direct enquiry, or other channel.
3. **Track progress:** Record the application and update its status as the recruitment process progresses.
4. **Understand the search:** View application totals, outcomes, and conversion rates in one dashboard.
5. **Get guidance:** Use AI-assisted analysis to identify documented CV weaknesses, job-requirement gaps, and practical next steps. The platform cannot know why an employer rejected an applicant unless the employer provides that information.
6. **Discover opportunities:** In the planned workflow, recommend relevant, source-checked vacancies and send opt-in SMS notifications.
7. **Contribute optionally:** Users may separately opt in to community-level analysis. Individual CVs and personal outcomes should not be disclosed to other users.

**Implemented in the supplied code:** email/password authentication via Supabase on the home page, dashboard views of existing applications, charts, and AI insight/optimisation endpoints. **Not established in the supplied code:** the full create/edit application flow, career preferences, community consent, vacancy discovery, or SMS delivery.

## 2. What the MVP looks like

The target minimum viable product is a simple end-to-end journey:

**Sign in → Add a job or application → Update its status → Review the dashboard → Receive a relevant, explainable recommendation.**

A compelling hackathon demonstration should show:

- **Application workspace:** company, role, source, date, deadline, notes, and status.
- **Status tracking:** saved, applied, assessment, interview, offer, hired, rejected, withdrawn, or no response.
- **Personal dashboard:** applications by status and measurable progression through recruitment stages.
- **AI career insights:** clear suggestions grounded in the user's recorded applications, CV content, and/or a job description.
- **Optional notification demo:** a real SMS sent only if the SMS provider integration is complete and tested.

**Current repository evidence:** a dashboard, application table, summary cards, charts, career diagnosis, and résumé insights components are present. The uploaded repository does not establish a functioning application-creation or status-editing screen, so those remain implementation priorities.

## 3. Where AI comes in

AI is intended to **interpret evidence, not invent hiring decisions**.

- **Career diagnosis — present in source:** an API endpoint analyses the signed-in user's application history and derives recruitment-stage metrics. It can produce a performance summary, possible explanations, CV-related suggestions, and an action plan. Hypotheses are not proof of causation.
- **Résumé optimisation — present in source:** an API endpoint supports AI-assisted résumé analysis and suggestions. Users should review all generated text and never present invented qualifications as facts.
- **Job-to-profile matching — planned:** compare documented skills and preferences against actual job requirements and explain why a vacancy is relevant.
- **Community insights — planned:** analyse sufficiently large, consented, appropriately protected datasets to explore patterns in application outcomes. These patterns cannot reveal an individual recruiter's reasoning.

The repository includes `@google/genai` and AI-related routes under `app/api/`. AI output quality and live API access were **not independently verified** in this review.

## 4. Why Career Signal matters in Kenya

Kenyan job seekers navigate opportunities shared through job boards, employer websites, social networks, referrals, and informal channels. An application can therefore be difficult to trace when information is spread across multiple places.

Career Signal is designed to be useful in this environment by:

- Supporting both **advertised and unadvertised/referral-based applications**.
- Providing a single place to monitor deadlines and progress.
- Offering **skills-to-requirements comparisons** rather than encouraging indiscriminate applications.
- Planning **SMS alerts**, which can reach users without requiring them to keep a job-search dashboard open.
- Building toward privacy-preserving, locally relevant career insights as sufficient data becomes available.

**Important:** The platform does not create vacancies, guarantee employment, verify every employer, or replace feedback from recruiters. Kenyan labour-market statistics, if included in a pitch, should be cited with their survey population and year.

## 5. What our team built today

The supplied **Pathwise** source repository contains:

| Area | Evidence in repository | Assessment |
| --- | --- | --- |
| Web application | Next.js 14, React, TypeScript, Tailwind CSS | Present |
| Authentication | Supabase sign-up/sign-in in `app/page.tsx` | Present; needs security review |
| Application dashboard | `app/dashboard/page.tsx` and dashboard components | Present |
| Tracking display | `ApplicationTable.tsx` | Viewing/searching/sorting present; editing not established |
| Analytics | `SummaryCards.tsx`, `ChartsGrid.tsx`, `SuccessAnalysis.tsx` | Present |
| AI career diagnosis | `app/api/career-insights/route.ts` | Endpoint present; runtime unverified |
| AI résumé assistance | `app/api/resume-optimizer/route.ts` | Endpoint present; runtime unverified |
| Database migration | `supabase/migrations/001_add_mvp_fields.sql` | Present; relies on existing schema |
| Job entry and status updates | No complete creation/edit workflow identified | Not established |
| Job discovery and verification | No full pipeline identified | Planned |
| Community consent and insights | No full consent workflow identified | Planned |
| ThriveWave SMS integration | No integration identified | Planned |
| RumptyCloud deployment | No deployment evidence in ZIP | Unverified |

**Technical cautions:** The separate `/login` route includes a demonstration credential bypass; do not treat it as production authentication. Review Supabase row-level security, consolidate public configuration, and remove or restrict the `/api/debug-env` endpoint before public deployment. The migration in the ZIP does not itself create the complete `job_applications` table.

This section describes **what is visible in the uploaded snapshot**, not a verified record of everything the team may have completed later in the day.

## 6. Fit with the hackathon theme

### Noise vs Signal

**Noise:** scattered job advertisements, repeated applications, uncertain application statuses, and advice that is not grounded in a candidate's actual qualifications.

**Signal:** organised application histories, visible progress, explainable opportunity matching, and specific, evidence-based career recommendations.

### Proof of Work

Instead of pitching an idea alone, the team can demonstrate actual software: authentication, a working dashboard, application analytics, and AI-powered career analysis. Any newly completed creation, editing, notification, or deployment workflows should be shown live rather than described as finished without evidence.

### Proof of Skill

The project brings together **full-stack development, database modelling, authentication and privacy, data analysis, AI integration, user experience, and deployment**. The strongest evidence is a reliable end-to-end workflow, transparent limitations, and measurable outcomes—not the number of AI features claimed.

**Our core message:** *Career Signal helps job seekers move from applying everywhere to applying with greater clarity, organisation, and evidence.*

## Technology stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes
- **Authentication and data:** Supabase
- **Charts:** Chart.js and React Chart.js 2
- **AI SDK:** Google Gen AI (`@google/genai`)
- **SMS:** ThriveWave proposed; not present in supplied source
- **Hackathon deployment target:** RumptyCloud; deployment not verified from source

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app also requires a working Supabase project, its expected database schema and policies, and any AI credentials required by the relevant routes. Consult the source before configuring environment variables. Do **not** commit private keys or use a demo login bypass in production.

## Next priorities

1. Implement and test **add application** and **update status**.
2. Align dashboard status display with one canonical database status field.
3. Remove the demo authentication bypass and review RLS/security.
4. Validate AI output against real job requirements and known user data.
5. Add job discovery, explicit consent controls, and SMS only after the core journey works.
6. Test and demonstrate the deployed end-to-end workflow.

---

*Career Signal / Pathwise — Hackathon prototype README, based on the uploaded `pathwise-main.zip` snapshot.*
