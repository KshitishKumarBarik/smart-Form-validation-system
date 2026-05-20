/**
 * Project 1: Smart Form Validation System
 * File: companion.js
 * 
 * This file coordinates the "Concept Companion" panel on the right.
 * It observes interactions in the form panel and updates the companion
 * panel to show relevant Q&A cards, code snippets, and highlight active elements.
 */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // Select Companion Tabs & Sections
  const companionNavButtons = document.querySelectorAll(".c-tab-btn");
  const conceptSections = document.querySelectorAll(".concept-section");
  const consoleLogs = document.querySelector("#console-logs");
  
  // Select Form Elements to Observe
  const usernameInput = document.querySelector("#username");
  const emailInput = document.querySelector("#email");
  const passwordInput = document.querySelector("#password");
  const confirmPasswordInput = document.querySelector("#confirm-password");
  const leakageBtn = document.querySelector("#leakage-test-btn");
  const submitBtn = document.querySelector("#submit-btn");
  const togglePasswordBtn = document.querySelector(".toggle-password");
  
  // Select Q&A Cards & Code blocks to highlight
  const qaItems = document.querySelectorAll(".qa-item");

  /* ==========================================================================
     1. TAB SWITCHING FUNCTIONALITY
     ========================================================================== */
  function switchCompanionTab(conceptId) {
    // Deactivate all nav buttons
    companionNavButtons.forEach(btn => btn.classList.remove("active"));
    
    // Activate current nav button
    const targetBtn = document.querySelector(`.c-tab-btn[data-concept="${conceptId}"]`);
    if (targetBtn) targetBtn.classList.add("active");

    // Toggle visible content sections
    conceptSections.forEach(section => {
      if (section.id === `concept-${conceptId}`) {
        section.classList.add("active");
        // Scroll companion to top when switching tab
        section.parentElement.scrollTop = 0;
      } else {
        section.classList.remove("active");
      }
    });
  }

  // Bind click listeners on the Concept Companion tabs
  companionNavButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const concept = btn.getAttribute("data-concept");
      switchCompanionTab(concept);
      
      const logLineText = `Manual navigation to Concept Companion tab: [${concept.toUpperCase()}]`;
      // Call local log helper from app.js if available
      if (window.logToSandbox) {
        window.logToSandbox(logLineText, "info");
      } else {
        console.log(logLineText);
      }
    });
  });

  /* ==========================================================================
     2. DYNAMIC CORRELATION (INTERACTION TO EXPLANATION BINDINGS)
     ========================================================================== */

  /**
     * Clear all current Q&A card highlights
     */
  function clearQAHighlights() {
    qaItems.forEach(item => item.classList.remove("active-highlight"));
  }

  /**
     * Highlights a specific Q&A card inside a section
     * @param {number} qaIndex - Index of the QA item to highlight
     */
  function highlightQA(qaIndex) {
    clearQAHighlights();
    if (qaItems[qaIndex]) {
      qaItems[qaIndex].classList.add("active-highlight");
      // Scroll it into view smoothly within the scrollable content container
      qaItems[qaIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Bind Listeners to form elements to trigger helper highlights
  
  // A. Username focused -> Scope concepts
  if (usernameInput) {
    usernameInput.addEventListener("focus", () => {
      switchCompanionTab("scope");
      highlightQA(0); // Q: difference between global, local, block scope
      
      // Visual feedback: pulse the username input border purple
      usernameInput.closest(".input-wrapper").classList.add("active-pulse-purple");
    });
    
    usernameInput.addEventListener("blur", () => {
      usernameInput.closest(".input-wrapper").classList.remove("active-pulse-purple");
    });
  }

  // B. Email focused -> Regex validation concepts
  if (emailInput) {
    emailInput.addEventListener("focus", () => {
      switchCompanionTab("validation");
      highlightQA(4); // Q: How do you write email regex in JS
      
      emailInput.closest(".input-wrapper").classList.add("active-pulse-cyan");
    });
    
    emailInput.addEventListener("blur", () => {
      emailInput.closest(".input-wrapper").classList.remove("active-pulse-cyan");
      
      // If the field contains a syntactically valid email, highlight the MX Record check Q&A
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (emailInput.value.trim() !== "" && emailRegex.test(emailInput.value.trim())) {
        highlightQA(5); // Q: How do you check if email's domain actually exists (MX check)
      }
    });
  }

  // C. Password focused -> DOM manipulation / Live checking
  if (passwordInput) {
    passwordInput.addEventListener("focus", () => {
      switchCompanionTab("dom");
      highlightQA(3); // Q: change vs input
      
      passwordInput.closest(".input-wrapper").classList.add("active-pulse-cyan");
    });
    
    passwordInput.addEventListener("blur", () => {
      passwordInput.closest(".input-wrapper").classList.remove("active-pulse-cyan");
    });
  }

  // D. Leakage Test button -> Scope concept & leak explanation
  if (leakageBtn) {
    leakageBtn.addEventListener("click", () => {
      switchCompanionTab("scope");
      highlightQA(1); // Q: What is variable leakage
    });
  }

  // E. Password eye toggle button -> DOM manipulation explanation
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", () => {
      switchCompanionTab("dom");
      highlightQA(2); // Q: Explain real-world scenario of DOM manipulation
    });
  }

  // F. Form submit button hover/click -> Object Handling & Destructuring
  if (submitBtn) {
    submitBtn.addEventListener("mouseenter", () => {
      // Guide user to destructuring when they hover over submit
      if (document.activeElement !== passwordInput && 
          document.activeElement !== emailInput && 
          document.activeElement !== usernameInput) {
        switchCompanionTab("destructuring");
        highlightQA(7); // Q: Why store form data in an object
      }
    });
  }

  // G. Intercept submit triggers on authForm to show final Destructuring Q&A
  const authForm = document.querySelector("#auth-form");
  if (authForm) {
    authForm.addEventListener("submit", () => {
      switchCompanionTab("destructuring");
      highlightQA(8); // Q: Explain object destructuring benefits
    });
  }

  /* ==========================================================================
     3. COPY-TO-CLIPBOARD FUNCTIONALITY
     ========================================================================== */
  const copyButtons = document.querySelectorAll(".btn-copy");
  
  copyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const codeElement = document.getElementById(targetId);
      
      if (codeElement) {
        // Use modern navigator API
        navigator.clipboard.writeText(codeElement.innerText)
          .then(() => {
            const originalText = btn.innerText;
            btn.innerText = "Copied!";
            btn.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
            btn.style.borderColor = "var(--success)";
            btn.style.color = "#fff";
            
            if (window.logToSandbox) {
              window.logToSandbox(`Copied code block "${targetId}" to clipboard.`, "success");
            }

            setTimeout(() => {
              btn.innerText = originalText;
              btn.style.backgroundColor = "";
              btn.style.borderColor = "";
              btn.style.color = "";
            }, 1500);
          })
          .catch(err => {
            console.error("Clipboard copy failed: ", err);
            if (window.logToSandbox) {
              window.logToSandbox("Clipboard copy failed.", "error");
            }
          });
      }
    });
  });
});
