// chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//     if (request.professorName) {
//       fetch(`https://api.ratemyprofessors.com/lookup?name=${encodeURIComponent(request.professorName)}`)
//         .then(response => response.json())
//         .then(data => sendResponse({ data }))
//         .catch(error => sendResponse({ error }));
//       return true; // Will respond asynchronously.
//     }
//   });
chrome.runtime.onInstalled.addListener(() => {
    console.log('Clemson Professor Info extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'log') {
        console.log(message.content);
    }
});
