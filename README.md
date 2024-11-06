# **IRoar Premium**

IRoar Premium is a Chrome extension that enhances the Clemson class signup page by integrating valuable data about professors and grade distributions directly within the page. This extension simplifies the class selection process by displaying Rate My Professors ratings and historical grade distribution data for each professor, allowing students to make more informed decisions at a glance.

## **Usage Instructions**

1. **Load the Extension**: 
   - Clone or download this repository.
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top right).
   - Click **Load unpacked** and select the folder containing the extension files.
2. **Navigate to Clemson's Signup Page**: Visit the [Clemson Registration Page](https://regssb.sis.clemson.edu/StudentRegistrationSsb/ssb/prepareRegistration/prepareRegistration). The extension will automatically activate on the class signup page, displaying professor ratings and grade distributions directly within the interface.

> **Important Notes**:  
> - This extension has been primarily tested with the **Plan Ahead tool** and has not been verified to work during the actual registration process. Use caution and remember you can always disable the extension via the `chrome://extensions` page if needed.
> - This extension has not been extensively tested across all possible use cases. If you encounter any bugs or issues, feel free to submit a pull request or open an issue. Contributions are welcome!

## **Features**

- **Integrated Professor Ratings**: Automatically displays ratings, average difficulty, number of ratings, and percentage of students who would take the professor again, directly from Rate My Professors using the GraphQL API.
- **Grade Distribution Data**: Shows detailed grade distributions for each professor, sourced from Clemson's grade distribution CSVs.
- **Simplified Interface**: The extension cleans up unnecessary text and formats data to fit seamlessly within the iRoar interface, ensuring a smooth user experience even on smaller screens.

## **Development Highlights**

### **Project Workflow**

1. **Chrome Extension Icon**: Designed a unique icon for IRoar Premium using GPT-4, enhancing the extension’s branding and visibility in the browser.
2. **Data Extraction**: Requested up-to-date grade distribution data from Clemson’s Office of Institutional Research to ensure accurate information for users.
3. **Data Cleansing**: Updated and standardized the CSV files using Python scripts to ensure consistent headers across different semesters and years, enabling smoother data parsing.
4. **Debugging and Testing**: Tested the extension by loading it unpacked in Chrome’s Developer Mode and debugging using the Chrome Web Developer Tools.
5. **UI Optimization**: Styled the extension’s interface to ensure data wraps appropriately and doesn’t overflow, even on smaller screens, providing a clean and readable display.

### **Data Integration and Display**

- **Grade Distributions**: Implemented CSV parsing and display functionality to show grade distribution percentages next to each professor’s rating. Reformatted the data for consistency and readability, ensuring a smooth display on the Clemson signup page.
- **Consistency Checks**: Manually edited some CSV files to correct header mismatches across datasets, ensuring that all data fields align correctly when displayed.

## **Next Steps**

The next major step for IRoar Premium is to get it approved on the **Chrome Web Store** for easier download and installation. This will allow users to install the extension directly from the Web Store rather than loading it manually.

## **Contributing**

If you notice any bugs or potential improvements, please consider contributing! Fork the repository, make your changes, and submit a pull request with a clear description of the enhancement or fix.

---

By consolidating essential data about professors and course performance, IRoar Premium makes Clemson’s class signup process more informative and user-friendly, helping students make better-informed decisions about their course selections.
