document.addEventListener('DOMContentLoaded', function() {
    const professors = document.querySelectorAll('.professor-name'); // Adjust the selector to match the actual structure
    professors.forEach(professor => {
      const name = professor.innerText;
      chrome.runtime.sendMessage({ professorName: name }, function(response) {
        console.log(response);
      });
    });
  });
  