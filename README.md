# iROAR Premium

A student-built Chrome extension for Clemson iROAR. Search the student directory, compare class sections with Rate My Professors ratings and historical grades, and preview a week of classes before opening registration.

[![Watch the 48-second iROAR Premium tour](docs/media/showcase-poster.jpg)](https://adamruns.com/iroarpremium/)

**[Watch the 48-second narrated tour](https://adamruns.com/iroarpremium/)** · [Download the MP4](https://raw.githubusercontent.com/Adamruns/iroarpremium/main/docs/media/iroar-premium.mp4)

## Install

Install [iROAR Premium from the Chrome Web Store](https://chromewebstore.google.com/detail/iroar-premium/kfiijlenjablmbgdbbidepbljlbjjhpf) in desktop Chrome. Open the [Clemson iROAR portal](https://iroar.app.clemson.edu/dashboard/). Sign in and connect to the campus network or VPN as required. If iROAR was already open, refresh the tab.

To try the exact 2.3.2 build manually, extract the [packaged extension ZIP](https://github.com/Adamruns/iroarpremium/releases/download/v2.3.2/iroar-premium-2.3.2.zip). Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.

## Use it

- **Banner Menu** in the upper left opens Clemson’s navigation. When Clemson supplies an empty menu, the extension offers the portal, student directory, registration home, class search, Plan Ahead and registration history. Browse Classes has the same destinations under **Menu**.
- On the desktop iROAR dashboard, use **Portal sections** to switch sections or **Search all campus services** to find links across all seven tabs. **Student Self-Service** adds shortcuts for classes, registration and grades. Search services by name or choose a category. **Show original directory** switches back to Clemson's list.
- **Registration → Browse Classes** opens the planner after you select a term. Enter a course code, title or CRN in **Find a class**. Open **Filters** on a narrow screen to refine by instructor, subject or meeting details. Select a course title for meeting details, requirements, ratings, and grade history.
- **Add** places a section in **My schedule** for the current page visit. The preview includes additional labs, weekends, and time conflicts. Leaving or refreshing the page clears it.
- **Plan Ahead** saves plans through Clemson. **Register for Classes** handles enrollment. Both use Banner's own controls. **Use Banner view** also restores the original class search.
- The interface adapts to narrow windows. Phone-width testing uses Chromium viewport emulation. Installation instructions are for desktop Chrome.

Ratings come from a matching Clemson profile on Rate My Professors. A successful lookup is reused for up to 24 hours. Grade history spans Fall 2013 through Spring 2026. Browse Classes compares reported sections of the selected course taught by that instructor. [Grade data sources and coverage](docs/grade-sources.md) · [Privacy policy](https://adamruns.com/iroarpremium/privacy.html)

This is an independent student project.

## Testing and video

The live review covered the portal's seven tabs, the student directory's 21 SIS destinations, the registration menu, course catalog, unsaved Plan Ahead search and schedule tabs, and the course planner. Course Seat Request opened its form. Course Substitution showed an eligibility restriction. Clemson also reported that the test account lacked a registration time ticket and that its student status prevented enrollment.

See the [page-by-page verification record](docs/verification.md).

The 48-second narrated tour opens on the campus dashboard before and after the redesign. It then follows one class search: comparing BIOL 1010 sections by Rate My Professors rating, sorting them, opening a section's grade history, and adding it to a weekly schedule that flags a time conflict. The dashboard comparison uses cropped Clemson screens. The planner scenes are the extension's own interface, loaded with fictional courses, instructors, ratings, and grades. The narration, music, and sound effects are generated. English captions are available in the player.

To run the desktop and 390-pixel interaction checks from the repository root:

```sh
npm ci --prefix tools/showcase
cd tools/showcase
npx playwright install chromium
npm run check
```

`npm run video` from `tools/showcase` still renders the earlier 72-second before-and-after cut, and it overwrites the MP4 and poster in `docs/media`. It needs FFmpeg plus Python packages Pillow and NumPy. The public registration-menu captures are included. Run `node hub.mjs` to refresh them when the Clemson registration host is reachable.
