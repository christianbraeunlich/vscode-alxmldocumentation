import { Disposable, TextDocumentChangeEvent, workspace } from 'vscode';
import { ALSyntaxUtil } from './util/ALSyntaxUtil';
import CancellationToken from 'cancellationtoken';

export class DoUpdateCache {
    private disposable: Disposable;

    constructor() {
        const subscriptions: Disposable[] = []; 
        var changeTimeout: NodeJS.Timeout | null;
        var cancellation: { cancel: (reason?: any) => void, token: CancellationToken } | null = null;       

        workspace.onDidChangeTextDocument(async (event: TextDocumentChangeEvent) => {
            if ((!event.document) || (event.document.languageId !== 'al')) {
                return;
            }

            if (event.contentChanges.length === 0) {
                return;
            }

            // clear timer to avoid update AL object cache while typing
            if (changeTimeout !== null) {
                clearTimeout(changeTimeout);
            }

            // send cancellation request to previously started process
            if (cancellation !== null) {
                cancellation.cancel();
            }
    
            // create cancellation token
            cancellation = CancellationToken.create();

            // avoid starting update AL object cache while typing
            changeTimeout = setInterval(function(token: CancellationToken) {
                if (changeTimeout !== null) {
                    clearTimeout(changeTimeout);
                }
                changeTimeout = null;

                ALSyntaxUtil.ClearALObjectFromCache(event.document);
                ALSyntaxUtil.GetALObject(event.document, token);
            }, 500, cancellation.token);
        }, this, subscriptions);
        
        this.disposable = Disposable.from(...subscriptions);
    }    

    public dispose() {
        this.disposable.dispose();
    }
}