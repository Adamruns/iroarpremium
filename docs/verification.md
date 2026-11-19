# iROAR Premium 2.1 verification

Tested November 19, 2026 in regular Chrome with the unpacked extension and an authenticated Clemson session. Each of the 21 SIS links in the student directory opened in a 1,350-pixel and a 520-pixel browser window. Chrome's per-site zoom produced narrow CSS viewports of 520 or 578 pixels. Each destination passed the document-width check at both sizes. The directory exposed all 37 original links.

| Directory destination | Page reached |
| --- | --- |
| Add/Drop Classes, Plan Ahead and View Schedule | Registration hub |
| Course Catalog | Catalog term selector |
| Participation Confirmation | Student Attendance Tracking |
| Request a Seat in a Closed Course | Course Seat Request form |
| Request to Audit a Course | Audit a Course |
| Schedule of Classes | Browse Classes term selector |
| View Registration | View Registration Information |
| Academic Transcript | Academic Transcript |
| View Grades | Student Grades |
| Advising Student Profile | Student Profile |
| Apply to Graduate | Graduation Application |
| DegreeWorks | Degree Works dashboard |
| Graduate Change of Program | Program selection |
| Graduate Degree Evaluation | Degree evaluation record |
| GS2 Committee Selection | Graduate committee |
| GS2 Plan of Study | Plan of Study |
| Undergraduate Change of Program | Banner Page Builder |
| View Application to Graduate | Graduation Application |
| Request Substitution for an Academic Requirement | Course Substitution eligibility notice |
| My Financial Aid | Financial Aid |
| Tax Notification 1098T | Tax Notification |

## Live interactions

- Opened all seven portal tabs and checked that each displayed its destination links. In the directory, searching for “transcript” returned the academic and printed transcript links.
- Selected Spring 2027, searched for 1010 sections and then 1020 sections, and checked the course numbers returned on both requests. Opened course details, ratings, and grade history. Added a section to the preview, checked its meetings and credits, and removed it.
- Ran a native course catalog search. Opened the unsaved Plan Ahead editor, searched its catalog, and switched between Schedule and Schedule Details.
- Opened Register for Classes and chose a term. Banner reported that the account lacked a registration time ticket and its student status prevented registration. No enrollment, drop, saved plan, or administrative form submission was made.

## Reproducible browser checks

The showcase harness uses the manifest's production CSS and JavaScript with fictional Banner responses and instructor data. At 1440 × 820 and 390 × 844 it checks directory filtering, the native grade-history dialog, autocomplete, empty and populated search results, course details, and the Banner-view switch. Scheduler cases cover a separate lab, a weekend meeting, overlapping times, adjacent times, nonoverlapping date ranges, duplicate meeting records, TBA sections, numeric credit totals, and removal. Every server-side registration write would fail the harness. See the commands in the [README](../README.md#testing-and-video).
