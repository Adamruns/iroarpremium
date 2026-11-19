# iROAR Premium verification

## Version 2.3.0 · November 19, 2026

Five page reviews covered the campus dashboard, Student Self-Service, Banner navigation and registration home, Browse Classes and its scheduler, and academic records. The following checks used the signed-in Clemson site unless identified as fixture tests.

| Page | Checks and results |
| --- | --- |
| Campus dashboard | Compared all 50 service entries with Clemson’s HTML and checked all seven sections at five window widths from 520 to 1728 pixels. Link labels, destinations, order, targets, section notes, and the maintenance notice matched. Search, keyboard navigation, Help, and the account menu worked. The 50 entries point to 44 unique destinations. The automated link check reached 43, including sign-in pages. The remaining destination, Off-Campus Housing, opened in regular Chrome. |
| Student Self-Service | The directory preserved all 37 native links, including the text explaining billing and fee links. Opened all three shortcuts and followed the billing link. Multi-column and narrow layouts, category and text search, clearing filters, and keyboard focus passed. |
| Banner navigation and registration home | All 21 SIS directory destinations loaded in narrow Chrome. Attendance and DegreeWorks verification covered page loading and width. All four repaired registration card URLs resolved and an ordinary Plan Ahead click opened the native workflow. A fixture exercised replacement of the menu by Banner and keyboard navigation around its links. |
| Browse Classes and scheduler | A Spring 2027 search for ACCT 2010 returned 17 sections. A matched section showed an instructor profile link and 64 grade report choices including the average. Added a three-credit section to the preview, verified two meeting blocks, then removed it. Fixture tests covered delayed rating sorts, missing ratings, grade report selection, keyboard focus, lab and weekend times, midnight, duplicate adds, unavailable prerequisites, and conflict detection. |
| Grades, transcript and registration history | The native grade term, transcript type, and Plan Ahead term selectors opened. In registration history no visible cells clipped at 390, 520, or 1240 pixels. Sort labels cleared their buttons. Sorting, expanding a row, and opening and closing section details worked. |

A fresh data check loaded 75,156 published grade rows. Spring 2026 was the latest semester on Clemson’s report index. Live Rate My Professors lookups matched two Clemson instructors and returned 52 and 14 ratings. The showcase uses fictional course, grade, and instructor examples. The signed-in verification did not submit enrollments, saved plans, or academic forms.

## Version 2.2.2 · November 19, 2026

On the signed-in Clemson dashboard, all seven sections passed layout checks at 1728, 1366, 1024, 820 and 520 CSS pixels. Each service label fit inside its link, the desktop sidebar and service grid stayed side by side, and the document fit the viewport width. Compared all 50 link labels, destinations, targets and ordering, plus the section notes and maintenance alert, with the HTML served by Clemson.

Verified search across sections, selecting the current or another section during a search, arrow-key navigation, the mobile portal menu, Help, and the account dropdown. The browser fixture also exercises the dashboard at 1440 and 390 pixels, including duplicate search results and empty results.

## Version 2.2.1 · November 19, 2026

On Student Self-Service and Registration, the signed-in top-left Banner Menu opened an empty tree. Same-origin frames showing the native pages without the extension reproduced it on both hosts. The blank left margin of the menu icon also ignored clicks.

Checked the student directory and its 21 SIS destinations in desktop and narrow Chrome windows. Twenty-one of those 22 pages used the Banner header. Their fallback menu exposed six links, including after Student Attendance Tracking finished loading its header. Followed all six links from Student Self-Service and verified the destination pages. Degree Works has its own navigation. On the portal at narrow width, the second navigation button opened all seven role-specific sections. Selecting Records & Registration cleared a service search, activated the correct tab and returned focus to it.

The 1440- and 390-pixel browser checks cover keyboard opening and dismissal, asynchronous arrival of native links, portal section selection, the planner menu, filter suggestion selection, and switching between the planner and the original Banner view. The signed-in Spring 2027 planner also exposed all six destinations and restored keyboard focus after switching views.

## Version 2.2.0 · November 19, 2026

A fresh pass opened all 21 SIS directory destinations, both registration term selectors, the directory and the portal at desktop and narrow window sizes. All 50 page loads completed without horizontal overflow. The table below identifies the individual destinations. Account-based eligibility and registration restrictions still apply.

The signed-in portal returned three services for “aid.” Student Self-Service retained 37 native links and added three shortcuts. The registration hub exposed six actions for the signed-in role. In Browse Classes, searching for `ACCT 2010` returned 17 sections. Ten had course-and-instructor grade history. Opening a section showed Spring 2026 history for ACCT 2010 section 003 and the date its instructor rating was checked.

The service worker loaded 75,156 published grade rows. A Spring 2026 AAH 1020 sample matched the official PDF. Live Rate My Professors lookups matched two Clemson profiles and returned rating counts of 52 and 14. The browser fixture checks also exercised the directory category filter and quick course-code search on desktop and at phone width.

## Version 2.1.0 page inventory

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
