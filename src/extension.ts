import * as vscode from 'vscode';

const currentDiagnostics: Map<string, vscode.Diagnostic[]> = new Map();

export function activate(extensionContext: vscode.ExtensionContext) {
  // This function is called when the extension is activated
  console.log("Pylance code fix suggestions extension activated");

  // Set up diagnostics listener
  const diagnosticsListener = vscode.languages.onDidChangeDiagnostics(event => {
    event.uris.forEach(uri => {
      const diagnostics = vscode.languages.getDiagnostics(uri);
      const pyrightDiagnostics = diagnostics.filter(diag => diag.source === 'Pylance');
      if (pyrightDiagnostics.length > 0) {
        currentDiagnostics.set(uri.toString(), pyrightDiagnostics);
        console.log(`Pylance diagnostics updated for ${uri.toString()}`);
      } else {
        currentDiagnostics.delete(uri.toString());
      }
    });
  });

  const pythonTypeIgnoreCodeAction = vscode.languages.registerCodeActionsProvider(
    { scheme: '*', language: 'python' },
    new PythonTypeIgnoreCodeActionProvider(),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );
  
  extensionContext.subscriptions.push(pythonTypeIgnoreCodeAction, diagnosticsListener);
}

type DiagnosticCode = string | number | { value: string | number; target: any };

const getCodeValue = (code?: DiagnosticCode): string | undefined => {
  if (typeof code === 'object' && code !== null && 'value' in code) {
    return code.value.toString();
  }
  return undefined;
};

class PythonTypeIgnoreCodeActionProvider implements vscode.CodeActionProvider {
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const diagnosticForFile = currentDiagnostics.get(document.uri.toString());
    const diagnosticsForLine = diagnosticForFile ? diagnosticForFile.filter(diag => diag.range.start.line === range.start.line) : [];
    
    if (diagnosticsForLine.length === 0) {
      return [];
    }
        
    const errorCodes = new Set<string>();
    diagnosticsForLine.forEach(diag => {
      const error = getCodeValue(diag.code);
      if (error) {
        errorCodes.add(error);
      }
    });
    
    if (errorCodes.size > 0) {
      const errorCodesStr = Array.from(errorCodes).join(',');
      const action = new vscode.CodeAction(
        `Add # pyright: ignore[${errorCodesStr}]`, 
        vscode.CodeActionKind.QuickFix
      );
      action.edit = new vscode.WorkspaceEdit();
      const lineText = document.lineAt(range.end.line).text;
      action.edit.insert(document.uri, new vscode.Position(range.end.line, lineText.length), 
        ` # pyright: ignore[${errorCodesStr}]`);
      return [action];
    }
    
    return [];
  }
}