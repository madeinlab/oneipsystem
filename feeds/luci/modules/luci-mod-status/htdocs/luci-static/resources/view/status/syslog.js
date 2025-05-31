'use strict';
'require view';
'require fs';
'require ui';
'require poll';
'require dom';

function startPolling(shellcmd, logCmd, textarea) {
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
			L.resolveDefault(fs.stat('/bin/grep'), null),
			L.resolveDefault(fs.stat('/usr/bin/awk'), null)
		]).then(function(stat) {
			var shellcmd = stat[0] ? stat[0].path : null;
			var logreadcmd = stat[1] ? stat[1].path : null;
			var grepcmd = stat[2] ? stat[2].path : null;
			var awkcmd = stat[3] ? stat[3].path : null;

			if (!shellcmd || !logreadcmd || !grepcmd || !awkcmd) {
				ui.addNotification(null, E('p', {}, _('Missing required files: /bin/sh, /sbin/logread, /bin/grep, or /usr/bin/awk')));
				return { shellcmd: null, logreadcmd: null, grepcmd: null, awkcmd: null, logdata: '' };
			}

			var grepPattern = 'user\\.|daemon\\.|auth\\.';
			var logCmd1 = logreadcmd + '|' + grepcmd + ' -E "' + grepPattern + '"';
			var logCmd2 = grepcmd + ' -v "kernel"';
			var logCmd3 = grepcmd + ' -v "S95done:"';
			var awkPattern = "\"/netifd/ && /link is up/ || !/netifd/ && !/uwsgi/\"";
			var logCmd4 = awkcmd + " " + awkPattern;
			var logCmd = logCmd1 + ' | ' + logCmd2 + ' | ' + logCmd3 + ' | ' + logCmd4;

			return fs.exec_direct(shellcmd, ['-c', logCmd]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return '';
			}).then(function(logdata) {
				return { shellcmd: shellcmd, logreadcmd: logreadcmd, grepcmd: grepcmd, awkcmd: awkcmd, logdata: logdata };
			});
		});
	},

	render: function(data) {
		var grepPattern = 'user\\.|daemon\\.|auth\\.';
		var logCmd1 = data.logreadcmd + '|' + data.grepcmd + ' -E "' + grepPattern + '"';
		var logCmd2 = data.grepcmd + ' -v "kernel"';
		var logCmd3 = data.grepcmd + ' -v "S95done:"';
		var awkPattern = "\"/netifd/ && /link is up/ || !/netifd/ && !/uwsgi/\"";
		var logCmd4 = data.awkcmd + " " + awkPattern;
		var logCmd = logCmd1 + ' | ' + logCmd2 + ' | ' + logCmd3 + ' | ' + logCmd4;

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

		if (data.shellcmd && data.logreadcmd && data.grepcmd && data.awkcmd) {
			startPolling(data.shellcmd, logCmd, textarea);
		}

		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
