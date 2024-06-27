console.log('Content script has loaded');

// Function to show the popup
function showPopup(event) {
    // Create the popup container
    const popup = document.createElement('div');
    popup.id = 'professor-popup';
    popup.style.position = 'absolute';
    popup.style.backgroundColor = '#fff';
    popup.style.border = '1px solid #ccc';
    popup.style.padding = '10px';
    popup.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
    popup.style.zIndex = '1000';

    // Position the popup
    popup.style.top = `${event.clientY + window.scrollY + 10}px`;
    popup.style.left = `${event.clientX + window.scrollX + 10}px`;

    // Fetch the professor's name from the link text
    const professorName = event.target.textContent;

    // Fetch the popup.html content and insert it into the popup
    fetch(chrome.runtime.getURL('popup.html'))
        .then(response => response.text())
        .then(data => {
            // Create a temporary container to hold the fetched HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = data;

            // Insert the professor's name into the placeholder
            const nameElement = tempDiv.querySelector('#professor-name');
            if (nameElement) {
                nameElement.textContent = professorName;
            }

            // Set the inner HTML of the popup to the modified content
            popup.innerHTML = tempDiv.innerHTML;

            // Add the popup to the document
            document.body.appendChild(popup);

            // Add event listeners to hide the popup when the mouse leaves the link or the popup
            event.target.addEventListener('mouseleave', hidePopup);
            popup.addEventListener('mouseleave', hidePopup);
            popup.addEventListener('mouseenter', () => {
                // Remove hidePopup listener from link while mouse is over popup
                event.target.removeEventListener('mouseleave', hidePopup);
            });
            popup.addEventListener('mouseleave', () => {
                // Add hidePopup listener back to link when mouse leaves popup
                event.target.addEventListener('mouseleave', hidePopup);
            });
        })
        .catch(error => console.error('Error loading popup.html:', error));
}

// Function to hide the popup
function hidePopup() {
    const existingPopup = document.getElementById('professor-popup');
    if (existingPopup) {
        document.body.removeChild(existingPopup);
    }
}

// Initialize the script
function initializeScript() {
    const professorLinks = document.querySelectorAll('td[data-property="instructor"] a.email');
    professorLinks.forEach(link => {
        link.addEventListener('mouseenter', showPopup);
    });
}

// This makes sure the script runs on places like plan page where content is not dynamically loaded
window.onload = function() {
    console.log("Window loaded completely");
    initializeScript();
};

// This is for dynamically loaded content
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            initializeScript();
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });
