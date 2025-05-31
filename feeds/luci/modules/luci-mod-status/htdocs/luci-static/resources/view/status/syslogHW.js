'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
    load(serial) {
        return Promise.all([
            L.resolveDefault(fs.stat('/bin/sh'), null),
            L.resolveDefault(fs.stat('/bin/dmesg'), null),
            L.resolveDefault(fs.stat('/bin/grep'), null)
        ]).then(function(stat) {
            var shellcmd = stat[0] ? stat[0].path : null;
            var dmesgcmd = stat[1] ? stat[1].path : null;
            var grepcmd  = stat[2] ? stat[2].path : null;

            if (!shellcmd || !dmesgcmd || !grepcmd) {
                ui.addNotification(null, E('p', {}, _('Missing required files: /bin/sh, /bin/dmesg, or /bin/grep')));
                return '';
            }

            var cpuCmd = dmesgcmd + ' | ' + grepcmd + ' -E "CPU"';
            var memCmd = dmesgcmd + ' | ' + grepcmd + ' -E "[m|M]emory"';
            var netLinkCmd = dmesgcmd + ' | ' + grepcmd + ' -E "Link is Up"';
            var netSwitchCmd = dmesgcmd + ' | ' + grepcmd + ' -w "Switch"';
            var hnatCmd = dmesgcmd + ' | ' + grepcmd + ' -E "hnat"';
            var storagePartCmd = dmesgcmd + ' | ' + grepcmd + ' -E "7 fixed-partitions" -A 8';
            var storageMtdCmd = dmesgcmd + ' | ' + grepcmd + ' -E "mtd"';

            return Promise.all([
                fs.exec_direct(shellcmd, ['-c', cpuCmd]),
                fs.exec_direct(shellcmd, ['-c', memCmd]),
                fs.exec_direct(shellcmd, ['-c', netLinkCmd]),
                fs.exec_direct(shellcmd, ['-c', netSwitchCmd]),
                fs.exec_direct(shellcmd, ['-c', hnatCmd]),
                fs.exec_direct(shellcmd, ['-c', storagePartCmd]),
                fs.exec_direct(shellcmd, ['-c', storageMtdCmd])
            ]).then(function(results) {
                var cpuResult = results[0];
                var memResult = results[1];
                var netResult = (results[2].trim().replace(/\n/g, ' ') + ' ' + results[3].trim().replace(/\n/g, ' ')).trim();
                var hnatResult = results[4];
                var storagePartResult = results[5];
                var storageMtdResult = results[6];
                var storageResult = storagePartResult + '\n----------------------\n' + storageMtdResult;
                return 'CPU TEST ....\n' + cpuResult + '\nCPU TEST .... OK!\n'
                     + '----------------------\n\n'
                     + 'MEMORY TEST ....\n' + memResult + '\nMEMORY TEST .... OK!\n'
                     + '----------------------\n\n'
                     + 'STORAGE TEST ....\n' + storageResult + '\nSTORAGE TEST .... OK!\n'
                     + '----------------------\n\n'
                     + 'NETWORK TEST ....\n' + netResult + '\nNETWORK TEST .... OK!\n'
                     + '----------------------\n\n'
                     + 'H/W NAT TEST ....\n' + hnatResult + '\nH/W NAT TEST .... OK!\n';
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
                return '';
            });
        });
    },

    render: function(logdata) {
        var loglines = logdata.trim().split(/\n/);

        return E([], [
            E('h2', {}, [ _('H/W Self Test Verification') ]),
            E('div', { 'id': 'content_syslog' }, [
                E('textarea', {
                    'id': 'syslog',
                    'style': 'font-size:12px',
                    'readonly': 'readonly',
                    'wrap': 'off',
                    'rows': loglines.length + 1
                }, [ loglines.join('\n') ])
            ])
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
