import * as vscode from "vscode";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

// Polyfill WebSocket for Node runtime in VS Code Extension Host
(global as any).WebSocket = WebSocket;

interface SessionState {
  roomId: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  statusBarItem: vscode.StatusBarItem;
}

let activeSession: SessionState | null = null;
let currentWebviewPanel: vscode.WebviewPanel | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log("Connect Live Extension activated!");

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "connect.openLiveWebview";
  context.subscriptions.push(statusBarItem);

  // ─── 1. Deep Link URI Handler: vscode://connect-live/join?room=XYZ ────────────
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        const queryParams = new URLSearchParams(uri.query);
        const roomId = queryParams.get("room") || uri.path.replace(/^\//, "");
        const serverUrl = queryParams.get("backend") || "wss://connect-y61u.onrender.com";

        if (roomId) {
          vscode.window.showInformationMessage(`Joining Connect Room: ${roomId}`);
          startLiveSession(context, roomId, serverUrl, statusBarItem);
        }
      },
    })
  );

  // ─── 2. Command: Start / Join Session ──────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("connect.startSession", async () => {
      const roomId = await vscode.window.showInputBox({
        prompt: "Enter Connect Room ID (e.g. from your web app URL)",
        placeHolder: "864c8088-ee5b-434d-b917-5440ed9f1d84",
      });
      if (!roomId) return;

      const config = vscode.workspace.getConfiguration("connect");
      const serverUrl = config.get<string>("serverUrl") || "wss://connect-y61u.onrender.com";
      startLiveSession(context, roomId.trim(), serverUrl, statusBarItem);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("connect.joinSession", async () => {
      vscode.commands.executeCommand("connect.startSession");
    })
  );

  // ─── 3. Command: Open Live Webview (Canvas / Doc) ─────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("connect.openLiveWebview", () => {
      if (!activeSession) {
        vscode.window.showWarningMessage("No active Connect session. Start a session first.");
        return;
      }
      openLiveWebview(context, activeSession.roomId);
    })
  );

  // ─── 4. Command: Disconnect Session ───────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("connect.stopSession", () => {
      if (activeSession) {
        activeSession.provider.destroy();
        activeSession.ydoc.destroy();
        activeSession.statusBarItem.hide();
        activeSession = null;
        vscode.window.showInformationMessage("Disconnected from Connect session.");
      }
    })
  );

  // ─── 5. Sidebar Webview Provider ──────────────────────────────────────────────
  const sidebarProvider = new ConnectSidebarViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("connect.liveCanvasView", sidebarProvider)
  );

  // ─── 6. Live Text Editor Change Sync ──────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      if (!activeSession || event.document.isUntitled) return;
      const fileName = vscode.workspace.asRelativePath(event.document.uri);
      const content = event.document.getText();
      const codeMap = activeSession.ydoc.getMap<string>("code-files");
      codeMap.set(fileName, content);

      // Broadcast active line & cursor snippet in awareness
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        const activeLine = editor.selection.active.line + 1;
        const lineText = editor.document.lineAt(editor.selection.active.line).text;
        activeSession.provider.awareness.setLocalStateField("vscodeState", {
          activeFile: fileName,
          activeLine,
          snippet: lineText.trim() || content.slice(0, 100),
        });
      }
    })
  );

  // Track active file switch
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
      if (!activeSession || !editor) return;
      const fileName = vscode.workspace.asRelativePath(editor.document.uri);
      const activeLine = editor.selection.active.line + 1;
      const lineText = editor.document.lineAt(editor.selection.active.line).text;
      activeSession.provider.awareness.setLocalStateField("vscodeState", {
        activeFile: fileName,
        activeLine,
        snippet: lineText.trim(),
      });
    })
  );
}

function startLiveSession(
  context: vscode.ExtensionContext,
  roomId: string,
  serverUrl: string,
  statusBarItem: vscode.StatusBarItem
) {
  if (activeSession) {
    activeSession.provider.destroy();
    activeSession.ydoc.destroy();
  }

  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(serverUrl, "yjs", ydoc, {
    params: { docId: roomId },
  });

  const userName = vscode.env.appName.includes("Visual Studio") ? "VS Code User" : "Dev";
  provider.awareness.setLocalStateField("user", {
    name: userName,
    color: "#6366f1",
    clientType: "vscode",
  });

  statusBarItem.text = `$(broadcast) Connect: #${roomId.slice(0, 6)} (Live)`;
  statusBarItem.tooltip = `Connected to Connect Room: ${roomId}\nClick to view Live Canvas/Doc`;
  statusBarItem.show();

  activeSession = {
    roomId,
    ydoc,
    provider,
    statusBarItem,
  };

  // Sync initial open file if exists
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const fileName = vscode.workspace.asRelativePath(activeEditor.document.uri);
    const content = activeEditor.document.getText();
    const codeMap = ydoc.getMap<string>("code-files");
    codeMap.set(fileName, content);
  }

  vscode.window
    .showInformationMessage(
      `Connected to Connect Room #${roomId.slice(0, 6)}!`,
      "Open Live Canvas Preview"
    )
    .then((action: string | undefined) => {
      if (action === "Open Live Canvas Preview") {
        openLiveWebview(context, roomId);
      }
    });
}

function openLiveWebview(context: vscode.ExtensionContext, roomId: string) {
  const config = vscode.workspace.getConfiguration("connect");
  const webAppUrl = config.get<string>("webAppUrl") || "https://connect-seven-ecru.vercel.app";
  const targetUrl = `${webAppUrl}/doc/${roomId}`;

  if (currentWebviewPanel) {
    currentWebviewPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  currentWebviewPanel = vscode.window.createWebviewPanel(
    "connectLivePreview",
    `Connect Canvas #${roomId.slice(0, 6)}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  currentWebviewPanel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #10231f; font-family: sans-serif; }
        iframe { border: none; width: 100%; height: 100%; }
      </style>
    </head>
    <body>
      <iframe src="${targetUrl}" allow="clipboard-read; clipboard-write"></iframe>
    </body>
    </html>
  `;

  currentWebviewPanel.onDidDispose(() => {
    currentWebviewPanel = null;
  });
}

class ConnectSidebarViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = { enableScripts: true };

    const updateHtml = () => {
      if (!activeSession) {
        webviewView.webview.html = `
          <!DOCTYPE html>
          <html lang="en">
          <body style="padding: 16px; color: #a5bbb0; font-family: sans-serif;">
            <p><strong>Connect Live Bridge</strong></p>
            <p style="font-size: 12px; line-height: 1.5;">Connect to a room from the status bar or web link to view live canvas whiteboard and document notes.</p>
          </body>
          </html>
        `;
        return;
      }

      const config = vscode.workspace.getConfiguration("connect");
      const webAppUrl = config.get<string>("webAppUrl") || "https://connect-seven-ecru.vercel.app";
      const targetUrl = `${webAppUrl}/doc/${activeSession.roomId}`;

      webviewView.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <style>
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #10231f; }
            iframe { border: none; width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          <iframe src="${targetUrl}"></iframe>
        </body>
        </html>
      `;
    };

    updateHtml();
  }
}

export function deactivate() {
  if (activeSession) {
    activeSession.provider.destroy();
    activeSession.ydoc.destroy();
    activeSession = null;
  }
}
