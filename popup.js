import { 
  authenticateUser,
  refreshTokens,
  signOutUser,
  isAuthenticated
 } from "./auth";

document.addEventListener("DOMContentLoaded", () => {
  const authSection = document.getElementById("authSection");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const password = document.getElementById("password");
  const loginButton = document.getElementById("loginButton");
  const loginError = document.getElementById("loginError");

  // New password challenge elements - these will be added to popup.html
  let newPasswordSection = null;
  let newPasswordInput = null;
  let confirmNewPasswordInput = null;
  let setNewPasswordButton = null;
  let newPasswordError = null;
  let storedSession = null;
  let storedEmail = null;

  // Config elements
  const configSection = document.getElementById("configSection");
  const logoutButton = document.getElementById("logoutButton");
  const userEmail = document.getElementById("userEmail");
  const configForm = document.getElementById("configForm");
  const voiceSelect = document.getElementById("voiceSelect");
  const engineSelect = document.getElementById("engineSelect");
  const speedRange = document.getElementById("speedRange");
  const speedDisplay = document.getElementById("speedDisplay");

  // Create the new password section elements
  function createNewPasswordSection() {
    // Create section if it doesn't exist
    if (!newPasswordSection) {
      newPasswordSection = document.createElement("div");
      newPasswordSection.id = "newPasswordSection";
      newPasswordSection.style.display = "none";
      
      const heading = document.createElement("h2");
      heading.textContent = "Set New Password";
      
      const subheading = document.createElement("p");
      subheading.textContent = "You need to set a new password before continuing.";
      
      // New password input
      const npDiv = document.createElement("div");
      npDiv.className = "form-group";
      
      const npLabel = document.createElement("label");
      npLabel.setAttribute("for", "newPassword");
      npLabel.textContent = "New Password:";
      
      newPasswordInput = document.createElement("input");
      newPasswordInput.type = "password";
      newPasswordInput.id = "newPassword";
      newPasswordInput.placeholder = "Enter new password";
      
      npDiv.appendChild(npLabel);
      npDiv.appendChild(newPasswordInput);
      
      // Confirm password input
      const cpDiv = document.createElement("div");
      cpDiv.className = "form-group";
      
      const cpLabel = document.createElement("label");
      cpLabel.setAttribute("for", "confirmNewPassword");
      cpLabel.textContent = "Confirm Password:";
      
      confirmNewPasswordInput = document.createElement("input");
      confirmNewPasswordInput.type = "password";
      confirmNewPasswordInput.id = "confirmNewPassword";
      confirmNewPasswordInput.placeholder = "Confirm new password";
      
      cpDiv.appendChild(cpLabel);
      cpDiv.appendChild(confirmNewPasswordInput);
      
      // Error message
      newPasswordError = document.createElement("div");
      newPasswordError.id = "newPasswordError";
      newPasswordError.className = "error-message";
      
      // Submit button
      setNewPasswordButton = document.createElement("button");
      setNewPasswordButton.id = "setNewPasswordButton";
      setNewPasswordButton.textContent = "Set Password";
      
      // Assemble the section
      newPasswordSection.appendChild(heading);
      newPasswordSection.appendChild(subheading);
      newPasswordSection.appendChild(npDiv);
      newPasswordSection.appendChild(cpDiv);
      newPasswordSection.appendChild(newPasswordError);
      newPasswordSection.appendChild(setNewPasswordButton);
      
      // Add to document
      document.body.insertBefore(newPasswordSection, configSection);
      
      // Add event listener
      setNewPasswordButton.addEventListener("click", handleNewPasswordSubmit);
    }
  }

  // Handle new password submission
  async function handleNewPasswordSubmit() {
    newPasswordError.textContent = "";
    
    // Validate passwords
    if (!newPasswordInput.value) {
      newPasswordError.textContent = "Please enter a new password";
      return;
    }
    
    if (newPasswordInput.value !== confirmNewPasswordInput.value) {
      newPasswordError.textContent = "Passwords don't match";
      return;
    }
    
    // Password complexity validation (optional, adjust as needed)
    if (newPasswordInput.value.length < 8) {
      newPasswordError.textContent = "Password must be at least 8 characters";
      return;
    }
    
    try {
      setNewPasswordButton.disabled = true;
      setNewPasswordButton.textContent = "Setting password...";
      
      // Complete authentication with new password
      const result = await authenticateUser(
        storedEmail, 
        null, 
        newPasswordInput.value, 
        storedSession
      );
      
      // Login successful
      newPasswordSection.style.display = "none";
      configSection.style.display = "block";
      userEmail.textContent = result.userInfo.email || storedEmail;
      
      // Clear stored session data
      storedSession = null;
      storedEmail = null;
      
      // Clear form
      newPasswordInput.value = "";
      confirmNewPasswordInput.value = "";
      
      // Load saved configuration
      loadSavedConfig();
    } catch (error) {
      newPasswordError.textContent = error.message || "Failed to set new password. Please try again.";
    } finally {
      setNewPasswordButton.disabled = false;
      setNewPasswordButton.textContent = "Set Password";
    }
  }

  // Check if user is authenticated
  const checkAuthState = async () => {
    const { isAuth, userInfo } = await isAuthenticated();
    
    if (isAuth && userInfo) {
      authSection.style.display = "none";
      if (newPasswordSection) newPasswordSection.style.display = "none";
      configSection.style.display = "block";
      userEmail.textContent = userInfo.email || "User";
      
      // Load saved configuration
      loadSavedConfig();
    } else {
      authSection.style.display = "block";
      if (newPasswordSection) newPasswordSection.style.display = "none";
      configSection.style.display = "none";
    }
  };

  // Create new password section
  createNewPasswordSection();
  
  // Check auth state
  checkAuthState();

  // Login functionality
  loginButton.addEventListener("click", async () => {
    loginError.textContent = "";
    
    if (!loginEmail.value || !password.value) {
      loginError.textContent = "Please enter both email and password";
      return;
    }
    
    try {
      loginButton.disabled = true;
      loginButton.textContent = "Logging in...";
      
      const result = await authenticateUser(loginEmail.value, password.value);
      
      // Check if new password is required
      if (result.requiresNewPassword) {
        // Store session for new password challenge
        storedSession = result.session;
        storedEmail = result.email;
        
        // Show new password section
        authSection.style.display = "none";
        newPasswordSection.style.display = "block";
        configSection.style.display = "none";
        return;
      }
      
      // Regular login successful
      authSection.style.display = "none";
      newPasswordSection.style.display = "none";
      configSection.style.display = "block";
      userEmail.textContent = result.userInfo.email || loginEmail.value;
      
      // Clear form
      loginEmail.value = "";
      password.value = "";
      
      // Load saved configuration
      loadSavedConfig();
    } catch (error) {
      loginError.textContent = error.message || "Login failed. Please try again.";
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  });

  // Logout functionality
  logoutButton.addEventListener("click", async () => {
    try {
      await signOutUser();
      authSection.style.display = "block";
      newPasswordSection.style.display = "none";
      configSection.style.display = "none";
    } catch (error) {
      console.error("Logout error:", error);
    }
  });

  // Load saved configuration
  function loadSavedConfig() {
    chrome.storage.local.get("ttsConfig", (data) => {
      if (data.ttsConfig) {
        const config = data.ttsConfig;
        if (config.voice) {
          voiceSelect.value = config.voice;
        }
        if (config.engine) {
          engineSelect.value = config.engine;
        }
        if (config.speed) {
          speedRange.value = config.speed;
          speedDisplay.textContent = config.speed;
        }
      }
    });
  }

  // Update the numeric display when the slider moves
  speedRange.addEventListener("input", () => {
    speedDisplay.textContent = speedRange.value;
  });

  // Handle form submission
  configForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const ttsConfig = {
      voice: voiceSelect.value,
      engine: engineSelect.value,
      speed: parseFloat(speedRange.value)
    };
    chrome.storage.local.set({ ttsConfig }, () => {
      alert("Configuration saved!");
    });
  });
});