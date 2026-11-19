# iROAR Premium

A student-built Chrome extension for Clemson iROAR. Search the student directory, compare class sections with instructor ratings and historical grades, and preview a week of classes before opening registration.

[![Watch the 38-second iROAR Premium showcase](docs/media/showcase-poster.jpg)](https://adamruns.github.io/iroarpremium/)

**[Watch the 38-second before-and-after tour](https://adamruns.github.io/iroarpremium/)** · [Download the MP4](https://raw.githubusercontent.com/Adamruns/iroarpremium/main/docs/media/iroar-premium.mp4)

## Install

1. Download and extract the [extension source ZIP](https://github.com/Adamruns/iroarpremium/archive/refs/heads/main.zip), or clone this repository.
2. In desktop Chrome, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the extracted folder containing `manifest.json`.
3. Open the [Clemson iROAR portal](https://iroar.app.clemson.edu/dashboard/). Sign in and connect to the campus network or VPN as required. If a tab was already open, refresh it.

## Use it

- **Student Self-Service** groups the original service links and lets you search by name. **Show original directory** switches back to Clemson's list.
- **Registration → Browse Classes** opens the planner after you select a term. Search by subject, instructor, course number, or another filter. Select a course title for meeting details, requirements, ratings, and grade history.
- **Add** places a section in **My schedule** for the current page visit. The preview includes additional labs, weekends, and time conflicts. Leaving or refreshing the page clears it.
- **Plan Ahead** saves plans through Clemson. **Register for Classes** handles enrollment. Both use Banner's own controls. **Use Banner view** also restores the original class search.
- The interface adapts to narrow windows. Phone-width testing uses Chromium viewport emulation. Installation instructions are for desktop Chrome.

Ratings come from Rate My Professors when available. The bundled Clemson grade distributions span Fall 2013 through Spring 2024 and describe past classes. This is an independent student project.

## Testing and video

The live review covered the portal's seven tabs, the student directory's 21 SIS destinations, the registration menu, course catalog, unsaved Plan Ahead search and schedule tabs, and the course planner. Course Seat Request opened its form. Course Substitution showed an eligibility restriction. Clemson also reported that the test account lacked a registration time ticket and that its student status prevented enrollment.

See the [page-by-page verification record](docs/verification.md).

The showcase opens with the public registration menu captured before and after the extension's stylesheet runs. The directory, classes, ratings, and schedules shown afterward use fictional fixtures rendered by the extension code. The soundtrack is generated in Python.

To run the desktop and 390-pixel interaction checks from the repository root:

```sh
npm ci --prefix tools/showcase
cd tools/showcase
npx playwright install chromium
npm run check
```

To regenerate the MP4, install FFmpeg plus Python packages Pillow and NumPy, then run `npm run video` from `tools/showcase`. The public registration-menu captures are included. Run `node hub.mjs` to refresh them when the Clemson registration host is reachable.
