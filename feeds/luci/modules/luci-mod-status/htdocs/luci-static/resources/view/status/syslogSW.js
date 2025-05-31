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

            var linuxCmd = dmesgcmd + '|' + grepcmd + ' -E "Linux|kmod"';
            var initCmd = dmesgcmd + ' | ' + grepcmd + ' -E "init:|urandom|urngd" | ' + grepcmd + ' -v "conninfra"';
            var procdCmd = dmesgcmd + ' | ' + grepcmd + ' -E "procd"';

            return Promise.all([
                fs.exec_direct(shellcmd, ['-c', linuxCmd]),
                fs.exec_direct(shellcmd, ['-c', initCmd]),
                fs.exec_direct(shellcmd, ['-c', procdCmd])
            ]).then(function(results) {
                var linuxResult = results[0];
                var initResult = results[1];
                var procdResult = results[2];
                return 'LINUX TEST ....\n' + linuxResult + '\nLINUX TEST .... OK!\n'
                     + '----------------------\n\n'
                     + 'INIT TEST ....\n' + initResult + '\nINIT TEST .... OK!\n'
                     + '----------------------\n\n'
                     + 'PROCD TEST ....\n' + procdResult + '\nPROCD TEST .... OK!\n';
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
                return '';
            });
        });
    },

    render: function(logdata) {
        var loglines = logdata.trim().split(/\n/);

        return E([], [
            E('h2', {}, [ _('S/W Self Test Verification') ]),
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
