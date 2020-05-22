import {Position, Disposable, TextDocumentContentChangeEvent, TextEditor, window, workspace, WorkspaceConfiguration, ThemeIcon, Selection, Range } from 'vscode';
import { StringUtil } from './util/StringUtil';
import { VSCodeApi } from './api/VSCodeApi';
import { isNullOrUndefined } from 'util';

export class DoComment {
    public disposable: Disposable;
    public event!: TextDocumentContentChangeEvent;
    public activeEditor!: TextEditor;
    public vsCodeApi!: VSCodeApi;

    constructor() {       
        const subscriptions: Disposable[] = [];

        workspace.onDidChangeTextDocument(event => {
            const activeEditor = window.activeTextEditor;

            if (activeEditor && event.document === activeEditor.document) {
                this.onEvent(activeEditor, event.contentChanges[0]);
            }
        }, this, subscriptions);
        
        this.disposable = Disposable.from(...subscriptions);
    }

    private onEvent(activeEditor: TextEditor, event: TextDocumentContentChangeEvent) {
        this.Execute(activeEditor, event);
    }

    public Execute(activeEditor: TextEditor, event: TextDocumentContentChangeEvent) {
        this.event = event;
        this.vsCodeApi = new VSCodeApi(activeEditor);
        this.activeEditor = activeEditor;

        if (isNullOrUndefined(this.event) || isNullOrUndefined(this.activeEditor)) {
            return;
        }

        if (!this.IsDoCommentTrigger()) {
            return;
        }

        if (this.vsCodeApi.ReadLine(this.vsCodeApi.GetNextLine()).trim().startsWith('///')) {
            return;
        }

        const code: string = this.GetCode();
        let regExResult = code.match(/(?!local)procedure\s+(?<ProcedureName>[A-Za-z0-9]+)\b[^\(]*\((?<Params>.*)\)(?<ReturnType>((.*\:\s*)[A-Za-z0-9\s\""\.\[\]]+))?/);
        let groups = regExResult?.groups;
        if (isNullOrUndefined(groups)) {
            return;
        }   

        let xmlDocumentation = this.GenerateDocString(this.vsCodeApi.ReadLine(this.vsCodeApi.GetActiveLine()).indexOf('///'), groups);
        this.WriteDocString(xmlDocumentation);
    }

    private WriteDocString(docString: string) {
        // remove starting "///"
        docString = docString.substring(docString.indexOf("///") + 3);

        const position: Position = this.vsCodeApi.GetActivePosition();
        this.activeEditor.edit((editBuilder) => {
            editBuilder.insert(this.vsCodeApi.ShiftPositionChar(position, 1), docString);
        });
    }

    private GenerateDocString(indentPlaces: number, groups: { [key: string]: string; }): string {
        let indent = "";
        for (var i = 0; i < indentPlaces; i++) {
            indent += " ";
        }

        let docString = "";
        if (!isNullOrUndefined(groups['ProcedureName'])) {
            docString += indent + "/// <summary> \n";
            docString += indent + "/// Description for " + groups['ProcedureName'] + ".\n";
            docString += indent + "/// </summary>";
        }   

        if ((!isNullOrUndefined(groups['Params'])) && (groups['Params'] !== "")) {
            let paramDefinitions = groups['Params'].split(';');
            paramDefinitions.forEach(paramDefinition => {
                paramDefinition = paramDefinition.trim();
                let param = paramDefinition.split(':');
                let paramName = param[0].trim();
                let paramDataType = param[1].trim();

                docString += "\n";
                docString += indent + "/// <param name=\"" + paramName + "\">";
                docString += "Parameter of type " + paramDataType + ".";
                docString += "</param>";
            });
        }

        if (!isNullOrUndefined(groups['ReturnType'])) {
            let returnTypeDefintion = groups['ReturnType'].split(':');
            
            docString += "\n";
            docString += indent + "/// ";
            docString += "<returns>";
            if ((!isNullOrUndefined(returnTypeDefintion[0])) && (returnTypeDefintion[0] !== "")) {
                docString += "Return variable \"" + returnTypeDefintion[0].trim() + "\"";
            } else {
                docString += "Return value";
            }

            if ((!isNullOrUndefined(returnTypeDefintion[1])) && (returnTypeDefintion[1] !== "")) {
                docString += " of type " + returnTypeDefintion[1].trim();
            }
            docString += ".";
            docString += "</returns>";
        }

        return docString;
    }

    private IsDoCommentTrigger(): boolean {
        if (isNullOrUndefined(this.event)) {
            return false;
        }

        const eventText: string = this.event.text;
        if (eventText === null || eventText === '') {
            return false;
        }

        const currentChar: string = this.vsCodeApi.ReadCurrentChar();
        if (currentChar === null) {
            return false;
        }

        const activeLine: string = this.vsCodeApi.ReadLineAtCurrent();
        if (activeLine.match(/^[ \t]*\/{3}[ \t]*$/) === null) {
            return false;
        }

        return true;
    }

    private GetCode(eol: string = '\n'): string {
        const lineCount: number = this.vsCodeApi.GetLineCount();
        const curLine: number = this.vsCodeApi.GetActiveLine();

        let code = '';
        for (let i: number = curLine; i < lineCount - 1; i++) {

            const line: string = this.vsCodeApi.ReadLine(i + 1);

            // Skip empty line
            if (StringUtil.IsNullOrWhiteSpace(line)) {
                continue;
            }

            code += line + eol;

            // Detect start of code
            if (!StringUtil.IsProcedure(line)) {
                continue;
            }

            return StringUtil.RemoveComment(code).trim();
        }

        return "";
    }

    public dispose() {
        this.disposable.dispose();
    }
}