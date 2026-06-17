// DOM Elements
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const usernameField = document.getElementById("username");
const passwordField = document.getElementById("password");
const message = document.getElementById("message");

// EVENT LISTENER 1
registerBtn.addEventListener("click", registerUser);

// EVENT LISTENER 2
loginBtn.addEventListener("click", loginUser);

// EVENT LISTENER 3
passwordField.addEventListener("keyup", passwordStrength);

// EVENT LISTENER 4
window.addEventListener("load", welcomeUser);

// FUNCTION
function registerUser() {

    let username = usernameField.value;
    let password = passwordField.value;

    if(username === "" || password === "") {

        message.innerHTML = "Fill all fields";
        message.style.color = "red";
        return;
    }

    localStorage.setItem("username", username);
    localStorage.setItem("password", password);

    message.innerHTML = "Registration Successful";
    message.style.color = "green";
}

// FUNCTION
function loginUser() {

    let username = usernameField.value;
    let password = passwordField.value;

    let storedUser = localStorage.getItem("username");
    let storedPass = localStorage.getItem("password");

    if(username === storedUser &&
       password === storedPass){

        message.innerHTML = "Login Successful";
        message.style.color = "green";

    } else {

        message.innerHTML = "Invalid Login";
        message.style.color = "red";
    }
}

// FUNCTION
function passwordStrength(){

    let password = passwordField.value;

    if(password.length < 6){

        message.innerHTML = "Weak Password";
        message.style.color = "orange";

    } else {

        message.innerHTML = "Strong Password";
        message.style.color = "green";
    }
}

// FUNCTION
function welcomeUser(){

    console.log("Application Loaded");
}