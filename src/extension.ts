import * as vscode from 'vscode';
import { TraceServer } from './trace-server';
import * as fs from 'fs';
import * as path from 'path';

const server = new TraceServer();
const extensionId = 'vscode-trace-server';
const stopOrReset = extensionId + '.stop-or-reset';
const startIfStopped = extensionId + '.start-if-stopped';
const logLocation = path.join('/', 'home/', 'bernd/', 'log.txt');

let activation: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    maybeLogLine(`activate`);
    context.subscriptions.push(registerStopOrReset(context));
    context.subscriptions.push(registerStartIfStopped(context));
    activation = context;
}

export async function deactivate() {
    maybeLogLine(`shutdown started`);
    await server.stopOrReset(maybeLogLine, undefined);
    maybeLogLine(`shutdown finished`);
}

function registerStopOrReset(context: vscode.ExtensionContext | undefined): vscode.Disposable {
    return vscode.commands.registerCommand(stopOrReset, async () => {
        await server.stopOrReset(maybeLogLine, context);
    });
}
export const registerStopOrReset_test = registerStopOrReset;

function registerStartIfStopped(context: vscode.ExtensionContext | undefined): vscode.Disposable {
    return vscode.commands.registerCommand(startIfStopped, async () => {
        await server.startIfStopped(maybeLogLine, context);
    });
}

function maybeLogLine(content: any) {
	const time = new Date().toLocaleString();
	fs.appendFileSync(logLocation, `[extension][${process.pid}]${time}: ${content}\n`);
}
export const registerStartIfStopped_test = registerStartIfStopped;
