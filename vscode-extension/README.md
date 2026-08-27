# ⚡ Connect Live: VS Code Multiplayer Extension

Bridge **VS Code** with the **Connect Web Application** in real time.

---

## 🌟 Key Features

1. **Live Picture-in-Picture on Web**:
   - Collaborators in the Connect Web App see what you are coding in VS Code in a live floating monitor.
2. **Embedded Web Canvas in VS Code**:
   - Open a side-by-side or sidebar Webview directly in VS Code showing your team's live Whiteboard Canvas and Document Notes.
3. **1-Click Deep-Link Join**:
   - Clicking **"Jump into VS Code"** from the web app opens VS Code (`vscode://connect-live/join?room=...`) and connects instantly to the active room.
4. **Yjs CRDT File Sync**:
   - Real-time buffer synchronization over WebSockets with zero merge conflicts.

---

## 🚀 How to Run and Test in VS Code

1. Open this folder in VS Code:
   ```bash
   cd vscode-extension
   npm install
   ```
2. Press **`F5`** (or select **Run > Start Debugging**) to launch an **Extension Development Host** window.
3. In the new VS Code window:
   - Run Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`): **`Connect: Start Live Collaboration Session`**.
   - Enter your Connect Room ID from your browser URL (e.g. `http://localhost:3000/doc/<ROOM_ID>`).
   - Click **"Open Live Canvas Preview"** to see your web canvas and notes right inside VS Code!
