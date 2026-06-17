document.getElementById("registerForm").addEventListener("submit", function(event) {
    event.preventDefault();

    let password = document.getElementById("password").value;
    let confirmPassword = document.getElementById("confirmPassword").value;
    let message = document.getElementById("message");

    if (password !== confirmPassword) {
        message.style.color = "red";
        message.textContent = "Passwords do not match!";
        return;
    }

    if (password.length < 6) {
        message.style.color = "red";
        message.textContent = "Password must be at least 6 characters long.";
        return;
    }

    message.style.color = "green";
    message.textContent = "Registration successful!";
});