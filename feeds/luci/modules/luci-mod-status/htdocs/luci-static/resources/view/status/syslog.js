'use strict';
'require view';
'require fs';
'require ui';
'require poll';
'require dom';
'require form';


// Fetch log file count and config from /mnt/oneip_log and /etc/logrotate.d/system_log
function fetchData() {
    return Promise.all([
        fs.read('/etc/logrotate.d/system_log'),
        fs.list('/mnt/oneip_log')
    ]).then(function(results) {
        let config = results[0] || '';
        let files = Array.isArray(results[1]) ? results[1] : [];
        let fileCount = files.filter(f => f.name && f.name.startsWith('system.log_')).length;
        let rotateLimit = 40;
        let match = config.match(/rotate\s+(\d+)/);
        if (match) rotateLimit = parseInt(match[1]);
        return { config, fileCount, rotateLimit };
    }).catch(function(err) {
        ui.addNotification(null, E('p', {}, _('Unable to load log configuration file: ' + err.message)));
        return { config: '', fileCount: 0, rotateLimit: 40 };
    });
}

function updateFileCountIndicator(fileCount, rotateLimit) {
    var prev = document.getElementById('filecount-indicator');
    if (prev) prev.remove();

    let icon, tooltip;
    if (fileCount >= rotateLimit) {
        icon = '⛔';
        tooltip = `CRITICAL! Log file count is too high (${fileCount} files, limit: ${rotateLimit}). Old data will be deleted.`;
    } else if (fileCount >= rotateLimit * 0.9) {  // 90% 이상
        icon = '🔴';
        tooltip = `WARNING! Log file count is high (${fileCount} files, limit: ${rotateLimit}).`;
    } else if (fileCount >= rotateLimit * 0.8) {  // 80% 이상
        icon = '⚠️';
        tooltip = `WARNING! Log file count is high (${fileCount} files, limit: ${rotateLimit}).`;
    } else {
        icon = '🟢';
        tooltip = 'Log file count is within safe range.';
    }

    var indicator = E('span', {
        id: 'filecount-indicator',
        title: tooltip,
        style: 'display:inline-flex; align-items:center; border:1px solid #1976d2; background:none; border-radius:1em; padding:2px 10px; margin-left:8px; font-size:14px; color:#1565c0; font-weight:500;'
    }, [
        E('span', { style: 'font-size:14px; vertical-align:middle; background:none; border:none; padding:0; border-radius:0;' }, icon),
        E('span', { style: 'font-size:14px; margin-left:6px; color:#1565c0; vertical-align:middle; background:none; border:none; padding:0; border-radius:0;' }, `Log file #${fileCount}`)
    ]);

    var indicators = document.getElementById('indicators');
    if (indicators) indicators.appendChild(indicator);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/bin/sh'), null),
			L.resolveDefault(fs.stat('/sbin/logread'), null),
			L.resolveDefault(fs.stat('/bin/grep'), null),
			L.resolveDefault(fs.stat('/usr/bin/awk'), null),
			fetchData()
		]).then(function(stat) {
			var shellcmd = stat[0] ? stat[0].path : null;
			var logreadcmd = stat[1] ? stat[1].path : null;
			var grepcmd = stat[2] ? stat[2].path : null;
			var awkcmd = stat[3] ? stat[3].path : null;
			var config = stat[4].config;
			var fileCount = stat[4].fileCount;
			var rotateLimit = stat[4].rotateLimit;

			if (!shellcmd || !logreadcmd || !grepcmd || !awkcmd) {
				ui.addNotification(null, E('p', {}, _('Missing required files: /bin/sh, /sbin/logread, /bin/grep, or /usr/bin/awk')));
				return { shellcmd: null, logreadcmd: null, grepcmd: null, awkcmd: null, logdata: '', fileCount: fileCount, rotateLimit: rotateLimit };
			}

			var grepPattern = 'user\\.|daemon\\.|auth\\.|authpriv\\.';
			var logCmd1 = logreadcmd + '|' + grepcmd + ' -E "' + grepPattern + '"';
			var logCmd2 = grepcmd + ' -v "kernel"';
			var logCmd3 = grepcmd + ' -v "S95done:"';
			var awkPattern = "\"/netifd/ && (/link is up/ || /link is down/) || !/netifd/ && !/uwsgi/\"";
			var logCmd4 = awkcmd + " " + awkPattern;
			var logCmd = logCmd1 + ' | ' + logCmd2 + ' | ' + logCmd3 + ' | ' + logCmd4;

			return fs.exec_direct(shellcmd, ['-c', logCmd]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return '';
			}).then(function(logdata) {
				return { shellcmd: shellcmd, logreadcmd: logreadcmd, grepcmd: grepcmd, awkcmd: awkcmd, logdata: logdata, fileCount: fileCount, rotateLimit: rotateLimit };
			});
		});
	},

	render: function(data) {
		var grepPattern = 'user\\.|daemon\\.|auth\\.|authpriv\\.';
		var logCmd1 = data.logreadcmd + '|' + data.grepcmd + ' -E "' + grepPattern + '"';
		var logCmd2 = data.grepcmd + ' -v "kernel"';
		var logCmd3 = data.grepcmd + ' -v "S95done:"';
		var awkPattern = "\"/netifd/ && (/link is up/ || /link is down/) || !/netifd/ && !/uwsgi/\"";
		var logCmd4 = data.awkcmd + " " + awkPattern;
		var logCmd = logCmd1 + ' | ' + logCmd2 + ' | ' + logCmd3 + ' | ' + logCmd4;

		var loglines = (data.logdata || '').trim().split(/\n/);

		// Create reverse checkbox
		var reverseCheckbox = E('input', {
			type: 'checkbox',
			id: 'reverse-log-checkbox',
			style: 'margin-left: 12px; vertical-align: middle;'
		});
		var reverseLabel = E('label', {
			for: 'reverse-log-checkbox',
			style: 'margin-left: 4px; font-size: 13px; vertical-align: middle;'
		}, [ _('Reverse') ]);

		// Set initial state (checked by default for reverse)
		reverseCheckbox.checked = true;

		function renderLog() {
			var lines = reverseCheckbox.checked ? loglines.slice().reverse() : loglines;
			textarea.value = lines.join('\n');
			textarea.rows = lines.length + 1;
		}

		var textarea = E('textarea', {
			'id': 'syslog',
			'style': 'font-size:12px',
			'readonly': 'readonly',
			'wrap': 'off',
			'rows': loglines.length + 1
		}, []);

		// Initial render
		renderLog();

		// Checkbox event
		reverseCheckbox.addEventListener('change', renderLog);

		var prev = document.getElementById('filecount-indicator');
		if (prev) prev.remove();
		updateFileCountIndicator(data.fileCount, data.rotateLimit);

		var container = E('div', { 'id': 'content_syslog' }, [ textarea ]);
		var titleRow = E('div', { style: 'display: flex; align-items: center;' }, [
			E('h2', { style: 'margin: 0;' }, [ _('System Log') ]),
			reverseCheckbox,
			reverseLabel
		]);
		var root = E([], [
			titleRow,
			container
		]);

		if (data.shellcmd && data.logreadcmd && data.grepcmd && data.awkcmd) {
			// Patch polling to respect reverse checkbox
			function customPolling(shellcmd, logCmd, textarea) {
				var step = function() {
					return Promise.all([
						fs.exec_direct(shellcmd, ['-c', logCmd]),
						fetchData()
					]).then(function(results) {
						var logdata = results[0];
						var data = results[1];
						if (textarea && logdata != null) {
							loglines = logdata.trim().split(/\n/);
							renderLog();
						}
						if (data) {
							updateFileCountIndicator(data.fileCount, data.rotateLimit);
						}
					});
				};
				step().then(function() {
					poll.add(step);
				});
			}
			customPolling(data.shellcmd, logCmd, textarea);
		}

		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
