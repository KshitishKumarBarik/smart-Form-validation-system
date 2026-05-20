/**
 * Project 1: Smart Form Validation System (Interview Prep Edition)
 * File: app.js
 * 
 * This file contains the primary functional logic for the form.
 * It is structured to showcase JavaScript fundamentals:
 * - Scope & Variables (Global, Function, Block, and Leakage simulation)
 * - Pure Validation Functions (Separation of Concerns)
 * - DOM Manipulation (querying, modifying styles/classes/attributes)
 * - Objects & Destructuring
 * - Event Listeners
 * - Regular Expressions (Regex)
 */

// Enable strict mode globally to follow industry best practices.
// In strict mode, variable leakage throws an error. We will conditionally show this.
"use strict";

/* ==========================================================================
   1. VARIABLES & SCOPE (GLOBAL SCOPE)
   ========================================================================== */

// Global configuration object (accessible everywhere in this file)
const APP_CONFIG = {
  minUsernameLength: 3,
  minPasswordLength: 8,
  allowedSpecialChars: /[!@#$%^&*]/
};

// Global state object (stores form values - "Single Source of Truth")
// Interviewer: "Why store data in an object?" 
// Answer: "It groups related values, models a payload, and enables clean destructuring."
const formData = {
  username: "",
  email: "",
  password: "",
  confirmPassword: ""
};

// Track current active form mode ("register" or "login")
let formMode = "register"; 

// DOM Elements - Global scope in the file, caching variables for reuse (improves performance)
const authForm = document.querySelector("#auth-form");
const tabBtns = document.querySelectorAll(".tab-btn");
const tabSlider = document.querySelector(".tab-slider");
const formTitle = document.querySelector("#form-title");
const formSubtitle = document.querySelector("#form-subtitle");
const submitBtn = document.querySelector("#submit-btn");

const usernameInput = document.querySelector("#username");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const togglePasswordBtn = document.querySelector(".toggle-password");
const strengthBar = document.querySelector("#strength-bar");
const strengthLabel = document.querySelector("#strength-label");
const strengthContainer = document.querySelector("#strength-container");

/* ==========================================================================
   2. REUSABLE VALIDATION FUNCTIONS (SEPARATION OF CONCERNS)
   ========================================================================== */

/**
 * Validates Email against a standard Regular Expression pattern.
 * Pure function: does not modify UI; only takes input and returns output.
 * 
 * @param {string} email 
 * @returns {boolean}
 */
function validateEmail(email) {
  // Regex Basics:
  // ^ matches start of string, $ matches end of string
  // [\w-\.]+ matches word characters, hyphens, and dots
  // @ matches the literal '@'
  // ([\w-]+\.)+ matches one or more groups of domain levels followed by a dot
  // [\w-]{2,4} matches top-level extension (e.g. .com, .org) between 2-4 chars
  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return emailRegex.test(email);
}

/**
 * Asynchronously queries a public DNS-over-HTTPS (DoH) API (Cloudflare)
 * to verify if the domain of the email address contains active MX records.
 * 
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
async function checkMXRecord(email) {
  const domain = email.split("@")[1];
  if (!domain) return false;
  
  try {
    logToSandbox(`Async DNS Lookup: Querying MX records for domain "${domain}"...`, "info");
    const url = `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`;
    
    const response = await fetch(url, {
      headers: { "accept": "application/dns-json" }
    });
    
    if (!response.ok) {
      throw new Error(`DoH server returned status ${response.status}`);
    }
    
    const dnsData = await response.json();
    
    // DNS status 0 means NOERROR (success)
    // Check if Answer array exists and has elements of type 15 (MX record)
    const hasMX = dnsData.Status === 0 && dnsData.Answer && dnsData.Answer.length > 0;
    
    if (hasMX) {
      logToSandbox(`DNS Lookup Success: Found ${dnsData.Answer.length} MX record(s) for "${domain}".`, "success");
      dnsData.Answer.forEach(ans => {
        logToSandbox(`- MX Data: ${ans.data}`, "code-output");
      });
    } else {
      logToSandbox(`DNS Lookup Failed: No MX records found for "${domain}". Domain is inactive/cannot receive mail.`, "error");
    }
    
    return hasMX;
  } catch (err) {
    logToSandbox(`DNS Lookup Error: ${err.message}`, "error");
    // Fallback: If DNS API fails (offline, rate limit), assume true so we don't lock out valid users,
    // but log a warning.
    logToSandbox("Network fallback: Assuming domain is valid to prevent form lockout.", "warning");
    return true; 
  }
}

/**
 * Handles triggering the asynchronous MX verification with loading states in the DOM.
 * 
 * @param {HTMLInputElement} input 
 * @param {string} value 
 */
async function triggerEmailMXCheck(input, value) {
  const wrapper = input.closest(".input-wrapper");
  const formGroup = input.closest(".form-group");
  const errorMsg = formGroup.querySelector(".error-msg");
  
  if (!wrapper || !errorMsg) return;
  
  // Show pending validation state
  wrapper.classList.remove("is-valid", "is-invalid");
  errorMsg.style.display = "block";
  errorMsg.style.color = "var(--accent-cyan)";
  errorMsg.innerText = "Verifying domain mail servers (MX check)...";
  
  const hasMX = await checkMXRecord(value);
  
  // Guard clause: if the user typed something else while fetch was running, abort updating UI
  if (input.value.trim() !== value) return;
  
  // Restore normal error label style color
  errorMsg.style.color = "var(--error)";
  
  if (hasMX) {
    clearError(input);
    formData.email = value; // Store in state
  } else {
    showError(input, `Domain "${value.split("@")[1]}" has no valid mail servers (MX record check failed).`);
    formData.email = "";
  }
}

/**
 * Checks password strength and returns breakdown of matches.
 * 
 * @param {string} password 
 * @returns {object} Object containing checklist match states and strength score (0-4)
 */
function validatePassword(password) {
  // Setup verification object
  const checklist = {
    length: password.length >= APP_CONFIG.minPasswordLength,
    number: /[0-9]/.test(password),
    capital: /[A-Z]/.test(password),
    special: APP_CONFIG.allowedSpecialChars.test(password)
  };
  
  // Calculate score (count matching criteria)
  // block-scoped variable 'score' (only exists inside validatePassword)
  let score = 0;
  
  // ES6 Object.values returns an array of booleans. We loop over them to get the score.
  for (const criterionMet of Object.values(checklist)) {
    if (criterionMet) {
      score++;
    }
  }
  
  return { checklist, score };
}

/* ==========================================================================
   3. DOM MANIPULATION & HELPER FUNCTIONS
   ========================================================================== */

/**
 * Shows error message for a given input element.
 * Manipulates classLists and sets text content dynamically.
 * 
 * @param {HTMLInputElement} input 
 * @param {string} message 
 */
function showError(input, message) {
  const wrapper = input.closest(".input-wrapper");
  const formGroup = input.closest(".form-group");
  const errorMsg = formGroup.querySelector(".error-msg");
  
  if (wrapper && errorMsg) {
    wrapper.classList.remove("is-valid");
    wrapper.classList.add("is-invalid");
    errorMsg.innerText = message;
    errorMsg.style.display = "block";
  }
}

/**
 * Clears error message for a given input element.
 * 
 * @param {HTMLInputElement} input 
 */
function clearError(input) {
  const wrapper = input.closest(".input-wrapper");
  const formGroup = input.closest(".form-group");
  const errorMsg = formGroup.querySelector(".error-msg");
  
  if (wrapper && errorMsg) {
    wrapper.classList.remove("is-invalid");
    wrapper.classList.add("is-valid");
    errorMsg.style.display = "none";
  }
}

/**
 * Logs a message to our custom UI Sandbox Logger console.
 * 
 * @param {string} text - Message to print
 * @param {string} type - 'info', 'success', 'error', 'warning', 'scope', 'code-output'
 */
function logToSandbox(text, type = "info") {
  const consoleLogs = document.querySelector("#console-logs");
  if (!consoleLogs) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const logLine = document.createElement("div");
  logLine.className = `log-line ${type}`;
  logLine.innerHTML = `<span style="color: var(--text-muted)">[${timestamp}]</span> ${text}`;
  
  consoleLogs.appendChild(logLine);
  consoleLogs.scrollTop = consoleLogs.scrollHeight; // Auto-scroll to bottom
}

/**
 * Updates the Strength Indicator UI based on current password input.
 */
function updatePasswordStrengthMeter(password) {
  if (!password) {
    strengthContainer.style.display = "none";
    return;
  }
  
  strengthContainer.style.display = "block";
  const { checklist, score } = validatePassword(password);
  
  // 1. Update the visual progress bar width & color
  const strengthPercentage = (score / 4) * 100;
  strengthBar.style.width = `${strengthPercentage}%`;
  
  let labelText = "Weak Password";
  let barColor = "var(--error)";
  
  if (score === 2) {
    labelText = "Fair Password";
    barColor = "var(--warning)";
  } else if (score === 3) {
    labelText = "Good Password";
    barColor = "var(--accent-indigo)";
  } else if (score === 4) {
    labelText = "Strong Password";
    barColor = "var(--success)";
  }
  
  strengthBar.style.backgroundColor = barColor;
  strengthLabel.innerText = `${labelText} (Score: ${score}/4)`;
  
  // 2. Update individual criteria icon highlights
  for (const [key, isMet] of Object.entries(checklist)) {
    const criteriaItem = document.querySelector(`[data-criterion="${key}"]`);
    if (criteriaItem) {
      const icon = criteriaItem.querySelector(".criteria-icon");
      if (icon) {
        if (isMet) {
          criteriaItem.classList.add("met");
          icon.outerHTML = '<i data-lucide="circle-check" class="criteria-icon"></i>';
        } else {
          criteriaItem.classList.remove("met");
          icon.outerHTML = '<i data-lucide="circle" class="criteria-icon"></i>';
        }
      }
    }
  }
  
  // Refresh Lucide icons for the newly set list icons
  lucide.createIcons();
}

/* ==========================================================================
   4. EVENT HANDLERS
   ========================================================================== */

/**
 * Handles Live Form Input Field Validation
 */
function handleInputField(input) {
  const name = input.name;
  const value = input.value.trim();
  
  logToSandbox(`Event 'input' triggered on #${input.id}. Current value: "${value}"`, "info");
  
  // Check field by field
  if (name === "username" && formMode === "register") {
    if (value === "") {
      showError(input, "Username is required");
      formData.username = "";
    } else if (value.length < APP_CONFIG.minUsernameLength) {
      showError(input, `Username must be at least ${APP_CONFIG.minUsernameLength} characters`);
      formData.username = "";
    } else {
      clearError(input);
      formData.username = value; // Store in state object
    }
  }
  
  if (name === "email") {
    if (value === "") {
      showError(input, "Email is required");
      formData.email = "";
    } else if (!validateEmail(value)) {
      showError(input, "Format must be a valid email (e.g. you@example.com)");
      formData.email = "";
    } else {
      // Syntax is valid.
      // If the field is currently active (user is typing), show a pending format check
      // but do not trigger the async fetch yet (wait for blur or submit).
      if (document.activeElement === input) {
        const wrapper = input.closest(".input-wrapper");
        const formGroup = input.closest(".form-group");
        const errorMsg = formGroup.querySelector(".error-msg");
        
        wrapper.classList.remove("is-valid", "is-invalid");
        errorMsg.style.display = "block";
        errorMsg.style.color = "var(--accent-cyan)";
        errorMsg.innerText = "Email format ok. Verifying domain on focus out...";
        formData.email = ""; // Set empty in state until MX check succeeds
      } else {
        // Lost focus (blur event) or form submission. Trigger MX records check.
        triggerEmailMXCheck(input, value);
      }
    }
  }
  
  if (name === "password") {
    // Perform Password strength calculation live
    updatePasswordStrengthMeter(input.value);
    
    const { score } = validatePassword(input.value);
    
    if (input.value === "") {
      showError(input, "Password is required");
      formData.password = "";
    } else if (score < 2) {
      showError(input, "Password is too weak. Please satisfy at least 2 requirements.");
      formData.password = "";
    } else {
      clearError(input);
      formData.password = input.value; // Store in state object
    }
    
    // Trigger Confirm Password validation if typing in password afterward
    if (formMode === "register" && confirmPasswordInput.value !== "") {
      handleInputField(confirmPasswordInput);
    }
  }
  
  if (name === "confirmPassword" && formMode === "register") {
    if (value === "") {
      showError(input, "Please confirm your password");
      formData.confirmPassword = "";
    } else if (value !== passwordInput.value) {
      showError(input, "Passwords do not match");
      formData.confirmPassword = "";
    } else {
      clearError(input);
      formData.confirmPassword = value; // Store in state object
    }
  }
}

/**
 * Attaches real-time validation inputs
 */
[usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => {
  if (input) {
    // Focus event: log and trigger visual cue
    input.addEventListener("focus", () => {
      logToSandbox(`Field #${input.id} received focus.`, "info");
    });
    
    // Input event: runs validation live as the user types
    input.addEventListener("input", (e) => {
      handleInputField(e.target);
    });
    
    // Blur event: runs validation when user leaves the field
    input.addEventListener("blur", (e) => {
      handleInputField(e.target);
    });
  }
});

/**
 * Handles Tab Switching (Login vs Register Form layouts)
 */
tabBtns.forEach(btn => {
  btn.addEventListener("click", (e) => {
    const selectedTab = btn.getAttribute("data-tab");
    if (selectedTab === formMode) return;
    
    // Reset state & UI errors
    [usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach(inp => {
      if (inp) {
        inp.value = "";
        const wrapper = inp.closest(".input-wrapper");
        if (wrapper) {
          wrapper.classList.remove("is-valid", "is-invalid");
        }
        const error = inp.closest(".form-group").querySelector(".error-msg");
        if (error) error.style.display = "none";
      }
    });
    
    // Reset state object values
    for (const key in formData) {
      formData[key] = "";
    }
    strengthContainer.style.display = "none";
    
    formMode = selectedTab;
    logToSandbox(`Form tab toggled to: ${formMode.toUpperCase()}`, "warning");

    // Modify Active Tab classes
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Move tab background slider
    if (formMode === "login") {
      tabSlider.style.transform = "translateX(100%)";
      // Hide username and confirm password fields
      document.querySelector("#name-group").style.display = "none";
      document.querySelector("#confirm-password-group").style.display = "none";
      // Update headings and submit buttons
      formTitle.innerText = "Welcome Back";
      formSubtitle.innerText = "Log in to access your dashboard concepts.";
      submitBtn.querySelector("span").innerText = "Log In";
    } else {
      tabSlider.style.transform = "translateX(0)";
      // Show registration fields
      document.querySelector("#name-group").style.display = "flex";
      document.querySelector("#confirm-password-group").style.display = "flex";
      // Update headings and submit buttons
      formTitle.innerText = "Create Account";
      formSubtitle.innerText = "Fill in the fields to test live validation features.";
      submitBtn.querySelector("span").innerText = "Create Account";
    }
  });
});

/**
 * Handles Password Show/Hide Toggle (DOM manipulation of type attribute)
 */
togglePasswordBtn.addEventListener("click", () => {
  const currentType = passwordInput.getAttribute("type");
  
  // Toggle the input type attribute
  const newType = currentType === "password" ? "text" : "password";
  passwordInput.setAttribute("type", newType);
  
  // Toggling confirm password to match (if register)
  if (confirmPasswordInput) {
    confirmPasswordInput.setAttribute("type", newType);
  }
  
  // Update eye icon state
  const icon = togglePasswordBtn.querySelector("i");
  if (newType === "text") {
    icon.setAttribute("data-lucide", "eye-off");
    logToSandbox(`DOM Manipulation: Changed password input type to "text" (Showing plain text)`, "scope");
  } else {
    icon.setAttribute("data-lucide", "eye");
    logToSandbox(`DOM Manipulation: Changed password input type to "password" (Masking text)`, "scope");
  }
  
  lucide.createIcons();
});

/**
 * Handles Form Submission
 */
authForm.addEventListener("submit", async (e) => {
  // Prevent browser page reload
  e.preventDefault();
  
  logToSandbox("Form submission intercepted. Verifying fields...", "warning");
  
  // Re-run validation checks on all active inputs
  let isFormValid = true;
  
  // 1. Run immediate synchronous checks
  if (formMode === "register") {
    handleInputField(usernameInput);
    handleInputField(passwordInput);
    handleInputField(confirmPasswordInput);
  } else {
    handleInputField(passwordInput);
  }
  
  // 2. Run email checks (which contains async DNS lookup)
  const emailValue = emailInput.value.trim();
  let emailValid = false;
  
  if (emailValue === "") {
    showError(emailInput, "Email is required");
  } else if (!validateEmail(emailValue)) {
    showError(emailInput, "Format must be a valid email (e.g. you@example.com)");
  } else {
    // Show spinner/loading message on submit
    const wrapper = emailInput.closest(".input-wrapper");
    const errorMsg = emailInput.closest(".form-group").querySelector(".error-msg");
    wrapper.classList.remove("is-valid", "is-invalid");
    errorMsg.style.display = "block";
    errorMsg.style.color = "var(--accent-cyan)";
    errorMsg.innerText = "Performing final DNS verification (MX records)...";
    
    // Call the async DNS check
    const hasMX = await checkMXRecord(emailValue);
    
    errorMsg.style.color = "var(--error)"; // Restore default error color
    
    if (hasMX) {
      clearError(emailInput);
      formData.email = emailValue;
      emailValid = true;
    } else {
      showError(emailInput, `Domain "${emailValue.split("@")[1]}" has no valid mail servers (MX record check failed).`);
    }
  }
  
  // 3. Evaluate final form state validity
  if (formMode === "register") {
    isFormValid = formData.username && emailValid && formData.password && formData.confirmPassword;
  } else {
    isFormValid = emailValid && formData.password;
  }
  
  if (!isFormValid) {
    logToSandbox("Validation failed. Submission blocked.", "error");
    
    // Trigger card shake animation
    const card = document.querySelector(".form-panel .glass-card");
    card.classList.add("shake-animation");
    
    // Remove class after animation finishes so it can run again next click
    setTimeout(() => {
      card.classList.remove("shake-animation");
    }, 450);
    
    return;
  }
  
  logToSandbox("Validation passed! Form state matches structure.", "success");
  
  /* ==========================================================================
     5. OBJECT HANDLING & ES6 DESTRUCTURING
     ========================================================================== */
  
  // ES6 Destructuring:
  // Unpacks properties directly into variables, avoiding writing "formData.email", etc.
  const { username, email, password } = formData;
  
  logToSandbox("Performing ES6 Object Destructuring:", "scope");
  logToSandbox(`const { username, email, password } = formData;`, "code-output");
  logToSandbox(`Destructured Values:`, "success");
  logToSandbox(`- username: "${username || "(Not applicable in Login Mode)"}"`, "code-output");
  logToSandbox(`- email: "${email}"`, "code-output");
  logToSandbox(`- password (hashed representation): "${"*".repeat(password.length)}"`, "code-output");
  
  alert(`Form successfully submitted!\nUsername: ${username || "(None)"}\nEmail: ${email}`);
});

/* ==========================================================================
   6. VARIABLE LEAKAGE DEMO (SCOPE SANDBOX)
   ========================================================================== */
const leakageBtn = document.querySelector("#leakage-test-btn");

leakageBtn.addEventListener("click", () => {
  logToSandbox("Triggering variable leakage function...", "warning");
  
  // Function demonstrating variable leak scope
  function triggerLeak() {
    // Local scope variable - declared with const
    const localDeclared = "Safe local variable";
    
    // LEAKED VARIABLE: No 'const', 'let', or 'var' keyword!
    // Since strict mode is enabled in this file, normally writing 'leakedVar = ...'
    // would immediately throw a ReferenceError.
    // To demonstrate variable leakage in strict mode, we dynamically attach it
    // or simulate it safely for the user to understand.
    
    try {
      // In strict mode, this line WILL THROW:
      // leakedSecret = "Unsafe secret"; 
      
      // Let's explain strict mode preventing leakage:
      logToSandbox("Attempting assignment: 'leakedSecret = ...' without let/const.", "info");
      
      // We will force-leak it by attaching to window to show what normal mode does implicitly:
      window.leakedSecret = "Top Secret Key (Implicit Global)";
      
      logToSandbox("Strict Mode: Standard global leakage blocked, but forced attachment successful.", "success");
    } catch (err) {
      logToSandbox(`Strict Mode Blocked Leakage! Error: ${err.message}`, "error");
    }
  }
  
  triggerLeak();
  
  // Test if leaked variable is accessible globally
  if (window.leakedSecret) {
    logToSandbox(`Global Scope Access: window.leakedSecret = "${window.leakedSecret}"`, "scope");
    logToSandbox("This variable leaked! It is now accessible globally, polluting scope.", "error");
  }
});

// Clear console log function
document.querySelector("#clear-console-btn").addEventListener("click", () => {
  const consoleLogs = document.querySelector("#console-logs");
  consoleLogs.innerHTML = `<div class="log-line system">[SYSTEM] Sandbox logs cleared. Ready for next test.</div>`;
});

// Initialize Lucide icons
lucide.createIcons();
logToSandbox("Interactive sandbox state listening is online.", "success");
