
import { ChildProcess, spawn, exec, ChildProcessWithoutNullStreams } from 'child_process';

export function myTreeKill(pid2: number, signal?: any, callback?: (arg0?: unknown) => any) {
    if (typeof signal === 'function' && callback === undefined) {
        callback = signal;
        signal = undefined;
    }

    const pid = parseInt(pid2.toString());
    if (Number.isNaN(pid)) {
        if (callback) {
            return callback(new Error("pid must be a number"));
        } else {
            throw new Error("pid must be a number");
        }
    }

    const tree: { [index: string]: any } = {};
    const pidsToProcess: { [index: string]: any } = {};
    tree[pid] = [];
    pidsToProcess[pid] = 1;

    switch (process.platform) {
        case 'win32':
            exec('taskkill /pid ' + pid + ' /T /F', callback);
            break;
        case 'darwin':
            buildProcessTree(pid, tree, pidsToProcess, function (parentPid: string) {
                return spawn('pgrep', ['-P', parentPid]);
            }, function () {
                killAll(tree, signal, callback);
            });
            break;
        // case 'sunos':
        //     buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
        //         killAll(tree, signal, callback);
        //     });
        //     break;
        default: // Linux
            buildProcessTree(pid, tree, pidsToProcess, function (parentPid: string) {
                return spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
            }, function () {
                killAll(tree, signal, callback);
            });
            break;
    }
};

function killAll(tree: { [x: string]: any[]; }, signal: any, callback?: (arg0?: unknown) => any) {
    const killed: { [index: string]: any } = {};
    try {
        Object.keys(tree).forEach(function (pid) {
            tree[pid].forEach(function (pidpid) {
                if (!killed[pidpid]) {
                    killPid(pidpid, signal);
                    killed[pidpid] = 1;
                }
            });
            if (!killed[pid]) {
                killPid(pid, signal);
                killed[pid] = 1;
            }
        });
    } catch (err) {
        if (callback) {
            return callback(err);
        } else {
            throw err;
        }
    }
    if (callback) {
        return callback();
    }
}

function killPid(pid: string, signal: string | number | undefined) {
    try {
        process.kill(parseInt(pid, 10), signal);
    }
    catch (err) {
        // if (err?.code !== 'ESRCH') throw err;
    }
}

function buildProcessTree(parentPid: string | number, tree: { [x: string]: number[]; }, pidsToProcess: { [x: string]: number; }, spawnChildProcessesList: { (parentPid: any): ChildProcessWithoutNullStreams; (parentPid: any): ChildProcessWithoutNullStreams; (arg0: any): any; }, cb: { (): void; (): void; (): void; }) {
    const ps = spawnChildProcessesList(parentPid);
    let allData = '';
    ps.stdout.on('data', function (data: any) {
        data = data.toString('ascii');
        allData += data;
    });

    const onClose = function (code: number) {
        delete pidsToProcess[parentPid];

        if (code != 0) {
            // no more parent processes
            if (Object.keys(pidsToProcess).length == 0) {
                cb();
            }
            return;
        }
        const match = allData.match(/\d+/g);
        if (match) {
            match.forEach(function (pid) {
                const pid2 = parseInt(pid, 10);
                tree[parentPid].push(pid2);
                tree[pid2] = [];
                pidsToProcess[pid2] = 1;
                buildProcessTree(pid2, tree, pidsToProcess, spawnChildProcessesList, cb);
            });
        }
    };

    ps.on('close', onClose);
}
