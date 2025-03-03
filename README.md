# AWS TTS – Highlight & Speak Chrome Extension

A Chrome extension that allows users to highlight text on any webpage, right-click, and have it read aloud using AWS Polly text-to-speech service. The extension includes user authentication via AWS Cognito and configurable TTS settings.

## Demo
https://www.loom.com/share/1d6dc499ae9d440ab14b1ccea71ab4ca?sid=71c3ed66-42f7-4e14-b882-b0c71b6f222d

## Features

- User authentication with AWS Cognito
- Customizable Text-to-Speech settings:
  - Voice selection
  - Engine type (Standard, Neural, Generative)
  - Speech speed control
- Highlight text on any webpage and have it read aloud
- Overlay audio player with playback controls
- Secure token management with automatic refresh

## Architecture

### Components

1. **Popup Interface**: Configuration UI for authentication and TTS settings
2. **Background Service Worker**: Handles context menu setup and messaging
3. **Content Script**: Injects audio player and handles TTS requests
4. **Authentication Module**: Manages Cognito authentication flow
5. **AWS Backend** (in terraform file):
   - API Gateway endpoint for TTS requests
   - Lambda function to process requests and call AWS Polly
   - Cognito User Pool for authentication

### Data Flow

1. User authenticates via Cognito in the popup
2. Authentication tokens are stored securely in Chrome storage
3. User configures TTS settings (voice, engine, speed)
4. When text is highlighted and the context menu option is clicked:
   - Background script sends the selected text to the content script
   - Content script verifies authentication and retrieves settings
   - Content script sends authenticated request to API Gateway
   - Audio is returned and played in an overlay player

## Design 

### Security
- **Cognito Authentication**: Without an authorizer, anyone could call and use you AWS account's resources. Adding a Cognito User Pool Authorizer provides the user management and JWT token for authorization. By turning off user sign up, you can create a user for yourself to ensure a secure API.

### User Experience
- **Minimalist Overlay Player**: The audio player was designed to be non-intrusive, appearing only when needed and providing just the essential controls to avoid distracting from the browsing experience.
- **Context Menu Integration**: Using right-click for activation feels natural and integrates with existing browser patterns, requiring minimal learning curve.

### AWS Integration Choices
- **Cognito for Authentication**: Provides ecurity without having to build a custom auth system.
- **Polly for TTS**: Offers high-quality voices and multiple engine options 
- **API Gateway + Lambda**: Serverless architecture ensures scalability and cost-effectiveness

## Setup Instructions

### Prerequisites

- Node.js and npm
- AWS Account with:
  - Cognito User Pool
  - API Gateway
  - Lambda Function with Polly permissions

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/aws-tts-extension.git
   cd aws-tts-extension
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure AWS Cognito settings:
   - Open `auth.js` and replace the placeholder values in `COGNITO_CONFIG`:
     ```javascript
     const COGNITO_CONFIG = {
       clientId: "YOUR_CLIENT_ID",
       userPoolId: "YOUR_USER_POOL_ID",
       region: "YOUR_REGION",
       endpoint: "YOUR_COGNITO_ENDPOINT"
     };
     ```

4. Configure API endpoint:
   - Open `content.js` and replace the placeholder API URL:
     ```javascript
     const API_URL = "YOUR_API_GATEWAY_URL";
     ```

5. Build the extension:
   ```
   npx webpack
   ```

6. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

### AWS Backend Setup

1. Create a Cognito User Pool:
   - Enable app client with USER_PASSWORD_AUTH flow
   - Configure app client settings with appropriate permissions

2. Create an API Gateway endpoint:
   - Set up a POST method with Lambda proxy integration
   - Enable CORS and authorization via Cognito User Pool

3. Create a Lambda function:
   - Set up IAM role with Polly permissions
   - Implement the TTS functionality using AWS SDK
   - Use the code in 

## Potential Improvements

### Functionality Enhancements
- Add support for different languages
- Implement text highlighting during playback
- Add voice customization options (pitch, emphasis)
- Support for reading entire articles or pages
- Offline caching of frequently used audio

### Technical Improvements
- Migrate to TypeScript for better type safety
- Implement unit and integration tests
- Add error handling and retry mechanisms
- Optimize audio streaming for performance
- Implement progressive audio loading for long texts

### UI Enhancements
- Add themes (light/dark mode)
- Implement keyboard shortcuts
