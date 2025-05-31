'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/bin/sh'), null),
			L.resolveDefault(fs.stat('/sbin/logread'), null),
			L.resolveDefault(fs.stat('/bin/grep'), null)
		]).then(function(stat) {
			var shellcmd = stat[0] ? stat[0].path : null;
			var logreadcmd = stat[1] ? stat[1].path : null;
			var grepcmd = stat[2] ? stat[2].path : null;

			if (!shellcmd || !logreadcmd || !grepcmd) {
				ui.addNotification(null, E('p', {}, _('Missing required files: /bin/sh, /sbin/logread, or /bin/grep')));
				return '';
			}

			var logCmd = logreadcmd + ' | ' + grepcmd + ' -E "user\\.|daemon\\."' + '|' + grepcmd + ' -v "kernel"';

			return fs.exec_direct(shellcmd, ['-c', logCmd]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return '';
			});
		});
	},

	render: function(logdata) {
		var loglines = logdata.trim().split(/\n/);

		return E([], [
			E('h2', {}, [ _('System Log') ]),
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
