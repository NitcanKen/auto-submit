
## Clicks a button at exactly the time you set (accurate to the millisecond)

## Installation

### Step 1: Download the Extension
Download this repo from github. Make sure you have the `auto-submit-main` folder on your computer (NOT ZIP!!!). 
**Remember YOUR FOLDER LOCATION**
Something like: C:\Users\asdzx\Downloads\auto-submit-main

### Step 2: Open Chrome Extensions Page
1. Open Google Chrome
2. Type `chrome://extensions` in the address bar and press Enter
3. Or click the menu (⋮) → **Extensions** → **Manage Extensions**

### Step 3: Enable Developer Mode
1. Find the **Developer mode** toggle in the top-right corner
2. Turn it **ON** (it should turn blue)

### Step 4: Load the Extension
1. Click the **Load unpacked** button (top-left)
2. Navigate to and select the `auto-submit-main` folder
3. Click **Select Folder**

### Step 5: Pin the Extension (Optional)
1. Click the puzzle icon (🧩) in Chrome's toolbar
2. Find "8AM Auto Submit" in the list
3. Click the pin icon to keep it visible in your toolbar

## How to Use

1. **Navigate to your target page** and complete any login steps
2. **Click the extension icon** in Chrome's toolbar
3. **Set your target time** using the time picker
4. **Click "🎯 Arm on Current Tab"**
5. **Wait** - The extension will automatically click the submit button at the exact time

### Advanced Settings

Click "⚙️ Advanced Settings" in the popup to configure:
- **Submit Button Selector**: CSS selector for the button (default: `#searchButton`)
- **Checkbox Selector**: Optional CSS selector for terms/agreement checkbox
- **Button Text Fallback**: Text to search for if selector fails (default: "Submit")