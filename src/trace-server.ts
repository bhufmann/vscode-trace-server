import { ChildProcess, spawn } from 'child_process';
import { TspClient } from 'tsp-typescript-client/lib/protocol/tsp-client';
import treeKill from 'tree-kill';
import { myTreeKill } from "/home/eedbhu/git/vscode-trace-server/src/my-tree-kill"
import * as vscode from 'vscode';

// Based on github.com/eclipse-cdt-cloud/vscode-trace-extension/blob/master/vscode-trace-extension/package.json
// -for naming consistency purposes across sibling extensions/settings:
const section = 'trace-server.traceserver';
const clientSection = 'trace-compass.traceserver';

const key = 'pid';
const millis = 10000;
const none = -1;
const prefix = 'Trace Server';
const suffix = ' failure or so.';

export class TraceServer {
    private server: ChildProcess | undefined;

    private async start(context: vscode.ExtensionContext | undefined) {
        const from = this.getSettings();
        const server = spawn(this.getPath(from), this.getArgs(from));

        if (!server.pid) {
            this.showError(prefix + ' startup' + suffix);
            return;
        }
        this.server = server;
        await context?.workspaceState.update(key, this.server.pid);
        await this.waitFor(context);
    }

    async stopOrReset(log: (el : string) => void, context: vscode.ExtensionContext | undefined) {
        const pid: number | undefined = context?.workspaceState.get(key);
        const not = prefix + ' not stopped as none running or owned by us.';
        log('test1');
        if (!pid) {
            log('test2');
            vscode.window.showWarningMessage(not);
            return;
        }
        log('test3');
        if (pid) {
            log('test4');
            let id: NodeJS.Timeout;
            // recovering from workspaceState => no this.server set
            if (this.server) {
                log('test5');
                this.server.once('exit', () => {
                    log('test6');
                    this.showStatus(false);
                    clearTimeout(id);
                });
            }
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: prefix,
                    cancellable: false
                },
                async progress => {
                    log('test7');
                    progress.report({ message: 'stopping...' });
                    const message = prefix + ' stopping' + suffix + ' Resetting.';
                    treeKill(pid, error => {
                        if (error) {
                            log('test8');
                            console.log('hallo: ' + error.message);
                            this.showErrorDetailed(message, error);
                        } else {
                            log('test9');
                            console.log('here: ' + message);
                            id = setTimeout(() => this.showError(message), millis);
                        }
                    });
                    log('test10');
                }
            );
        } else {
            log('test11');
            vscode.window.showWarningMessage(not);
        }
        log('test12');
        await context?.workspaceState.update(key, none);
        this.server = undefined;
        log('test13');
        await new Promise(resolve => setTimeout(resolve, 1000));
        log('test14');
    }

    async shutdown(log: (el : string) => void) {
        const pid = this.server ? this.server.pid : undefined;
        if (pid === none) {
            return;
        }
        if (pid) {
            log(pid.toString());
            log('bla1');
            await myTreeKill(log, pid);
            log('bla2');
            await new Promise(resolve => setTimeout(resolve, 1000));
            log('bla3');
        }
    }

    async startIfStopped(log: (el : string) => void, context: vscode.ExtensionContext | undefined) {
        const pid = context?.workspaceState.get(key);
        const stopped = !pid || pid === none;
        const foreigner = await this.isUp();
        log('start1 ' + pid + ', ' + foreigner + ', stopped ' + stopped);
        if (stopped && !foreigner) {
            log('start2');
            await this.start(context);
            log('start3');
        } else if (foreigner) {
            log('start4');
            vscode.window.showWarningMessage(prefix + ' not started as already running.');
            log('start6');
        } else {
            log('start7');
            // Not UP but there is still a pid stored.
            // Likely because Codium or so exited without one using the stop command prior.
            await context?.workspaceState.update(key, none);
            log('start8');
            await this.start(context);
            log('start9');
        }
    }

    private getPath(configuration: vscode.WorkspaceConfiguration): string {
        let path = configuration.get<string>('path');
        if (!path) {
            // Based on this extension's package.json default, if unset here:
            path = '/usr/bin/tracecompass-server';
        }
        return path;
    }
    getPath_test = this.getPath;

    private getArgs(configuration: vscode.WorkspaceConfiguration): string[] {
        let args = configuration.get<string>('arguments');
        if (!args) {
            args = '';
        }
        return args.split(' ');
    }
    getArgs_test = this.getArgs;

    private getUrl(configuration: vscode.WorkspaceConfiguration): string {
        let url = configuration.get<string>('url');
        if (!url) {
            url = 'http://localhost:8080';
        }
        return url;
    }
    getUrl_test = this.getUrl;

    private getApiPath(configuration: vscode.WorkspaceConfiguration): string {
        let apiPath = configuration.get<string>('apiPath');
        if (!apiPath) {
            apiPath = 'tsp/api';
        }
        return apiPath;
    }
    getApiPath_test = this.getApiPath;

    private getSettings() {
        return vscode.workspace.getConfiguration(section);
    }

    private getClientSettings() {
        return vscode.workspace.getConfiguration(clientSection);
    }

    private getServerUrl() {
        const from = this.getClientSettings();
        return this.getUrl(from) + '/' + this.getApiPath(from);
    }

    private async waitFor(context: vscode.ExtensionContext | undefined) {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: prefix,
                cancellable: false
            },
            async progress => {
                progress.report({ message: 'starting up...' });
                let timeout = false;
                const timeoutId = setTimeout(() => (timeout = true), millis);

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    if (await this.isUp()) {
                        this.showStatus(true);
                        clearTimeout(timeoutId);
                        break;
                    }
                    if (timeout) {
                        this.showError(prefix + ' startup timed-out after ' + millis + 'ms.');
                        await this.stopOrReset(this.dummy, context);
                        break;
                    }
                }
            }
        );
    }

    private async isUp() {
        const client = new TspClient(this.getServerUrl());
        const health = await client.checkHealth();
        const status = health.getModel()?.status;
        return health.isOk() && status === 'UP';
    }

    private async showError(message: string) {
        console.error(message);
        vscode.window.showErrorMessage(message);
        const disclaimer = ' running, despite this error.';
        const up = await this.isUp();
        if (up) {
            vscode.window.showWarningMessage(prefix + ' is still' + disclaimer);
        } else {
            vscode.window.showWarningMessage(prefix + ' is not' + disclaimer);
        }
        this.setStatusIfAvailable(up);
    }

    private showErrorDetailed(message: string, error: Error) {
        const details = error.name + ' - ' + error.message;
        vscode.window.showErrorMessage(details);
        console.error(details);
        this.showError(message);
    }

    private showStatus(started: boolean) {
        if (started) {
            vscode.window.showInformationMessage(prefix + ' started.');
        } else {
            vscode.window.showInformationMessage(prefix + ' stopped.');
        }
        this.setStatusIfAvailable(started);
    }

    private setStatusIfAvailable(started: boolean) {
        const commands = vscode.commands.getCommands();
        commands.then(commandArray => {
            const fromTraceExtension = 'serverStatus';
            const startCommand = fromTraceExtension + '.started';
            if (commandArray.findIndex(val => val === startCommand) > 0) {
                if (started) {
                    vscode.commands.executeCommand(startCommand);
                } else {
                    vscode.commands.executeCommand(fromTraceExtension + '.stopped');
                }
            }
        });
    }
    private dummy(el : string) {

    }

}
