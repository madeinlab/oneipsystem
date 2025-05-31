'use strict';
'require view';
'require fs';
'require ui';
'require poll';
'require dom';

function startPolling(shellcmd, logreadcmd, grepcmd, textarea) {
	var logCmd = logreadcmd + ' | ' + grepcmd + ' -E "user\\.|daemon\\."' + '|' + grepcmd + ' -v "kernel"';

	var step = function() {
		return fs.exec_direct(shellcmd, ['-c', logCmd]).then(function(logdata) {
			if (textarea && logdata != null) {
				var loglines = logdata.trim().split(/\n/);
				textarea.value = loglines.join('\n');
				textarea.rows = loglines.length + 1;
			}
		});
	};

	return step().then(function() {
		poll.add(step);
	});
}

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
				return { shellcmd: null, logreadcmd: null, grepcmd: null, logdata: '' };
			}

			var logCmd1 = logreadcmd + '|' + grepcmd + ' -E "user\\.|daemon\\."';
			var logCmd2 = grepcmd + ' -v "kernel"' + '|' + grepcmd + ' -v "S95done:"';
			var logCmd = logCmd1 + '|' + logCmd2;

			return fs.exec_direct(shellcmd, ['-c', logCmd]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return '';
			}).then(function(logdata) {
				return { shellcmd: shellcmd, logreadcmd: logreadcmd, grepcmd: grepcmd, logdata: logdata };
			});
		});
	},

	render: function(data) {
		var loglines = (data.logdata || '').trim().split(/\n/);
		var textarea = E('textarea', {
			'id': 'syslog',
			'style': 'font-size:12px',
			'readonly': 'readonly',
			'wrap': 'off',
			'rows': loglines.length + 1
		}, [ loglines.join('\n') ]);

		var container = E('div', { 'id': 'content_syslog' }, [ textarea ]);
		var root = E([], [
			E('h2', {}, [ _('System Log') ]),
			container
		]);

		if (data.shellcmd && data.logreadcmd && data.grepcmd) {
			startPolling(data.shellcmd, data.logreadcmd, data.grepcmd, textarea);
		}

		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
